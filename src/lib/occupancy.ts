/**
 * Lógica única de cálculo de ocupação — usada por Calendário, KPIs e relatórios.
 *
 * Regras (alinhadas com a aba "Calendário", validada com o operacional):
 *  - Uma noite é contada quando uma data está no intervalo [check-in, check-out)
 *    — ou seja, o dia do check-out NÃO conta como ocupado.
 *  - Reservas sobrepostas no mesmo imóvel (ex.: duplicadas via iCal Airbnb +
 *    Booking) são deduplicadas por dia.
 *  - A contagem por imóvel é limitada ao total de dias do período (proteção
 *    extra contra qualquer inconsistência de dados).
 *  - O denominador é (dias do período × nº de imóveis no escopo).
 */

export interface ReservaParaOcupacao {
  imovel_id: string;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;    // YYYY-MM-DD
  validada_financeiramente?: boolean;
}

const DAY_MS = 86400000;

/**
 * Retorna as datas (ISO YYYY-MM-DD) ocupadas por uma reserva dentro de um
 * intervalo [periodStart, periodEnd) — periodEnd exclusivo.
 */
export function getOccupiedDatesInRange(
  reserva: ReservaParaOcupacao,
  periodStart: Date,
  periodEnd: Date,
): string[] {
  const [y1, m1, d1] = reserva.data_inicio.split("-").map(Number);
  const [y2, m2, d2] = reserva.data_fim.split("-").map(Number);
  
  // Normalizar para 12:00 para evitar problemas de fuso horário em cálculos de diferença
  const start = new Date(y1, m1 - 1, d1, 12, 0, 0, 0);
  const end = new Date(y2, m2 - 1, d2, 12, 0, 0, 0); // checkout excluído

  const overlapStart = new Date(Math.max(start.getTime(), periodStart.getTime()));
  const overlapEnd = new Date(Math.min(end.getTime(), periodEnd.getTime()));
  
  // Garantir que não contamos noites se o checkout for antes/no mesmo dia do checkin no overlap
  if (overlapEnd <= overlapStart) return [];

  const nights = Math.max(0, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / DAY_MS));

  const dates: string[] = [];
  for (let i = 0; i < nights; i++) {
    const d = new Date(overlapStart.getTime() + i * DAY_MS);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dates.push(iso);
  }
  return dates;
}

/**
 * Para uso no Calendário (mês específico): retorna os dias-do-mês (1..N)
 * ocupados por uma reserva.
 */
export function getDaysOccupiedInMonth(
  reserva: ReservaParaOcupacao,
  year: number,
  month: number,
): number[] {
  const periodStart = new Date(year, month, 1, 12, 0, 0, 0);
  const periodEnd = new Date(year, month + 1, 1, 12, 0, 0, 0);
  return getOccupiedDatesInRange(reserva, periodStart, periodEnd).map((iso) =>
    Number(iso.split("-")[2]),
  );
}

export interface OccupancySummary {
  /** Noites ocupadas (somatório por imóvel, deduplicado e limitado por imóvel). */
  occupiedNights: number;
  /** Capacidade total = dias_do_período × nº de imóveis. */
  capacity: number;
  /** Percentual (0..100). */
  occupancyRate: number;
  /** Conjunto de dias ocupados por imóvel (debug/auditoria). */
  occupiedByImovel: Map<string, Set<string>>;
}

/**
 * Cálculo principal de ocupação para um período arbitrário.
 *
 * @param reservas reservas que se sobrepõem ao período
 * @param imovelIds lista FECHADA de imóveis no escopo — usada para o denominador
 * @param periodStart início inclusivo
 * @param periodEnd fim exclusivo
 * @param onlyValidated se true, considera apenas validada_financeiramente: true
 */
export function computeOccupancy(
  reservas: ReservaParaOcupacao[],
  imovelIds: string[],
  periodStart: Date,
  periodEnd: Date,
  onlyValidated: boolean = false
): OccupancySummary {
  const totalDaysInPeriod = Math.max(
    0,
    Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS),
  );

  const occupiedByImovel = new Map<string, Set<string>>();
  
  // Inicializar o mapa com todos os imóveis do escopo para garantir que apareçam na auditoria
  imovelIds.forEach(id => {
    occupiedByImovel.set(id, new Set<string>());
  });

  for (const r of reservas) {
    // Filtrar por imóvel se a lista de escopo for fornecida
    if (imovelIds.length > 0 && !imovelIds.includes(r.imovel_id)) continue;
    
    // Filtrar por validação financeira se solicitado
    if (onlyValidated && r.validada_financeiramente !== true) continue;

    const dates = getOccupiedDatesInRange(r, periodStart, periodEnd);
    if (dates.length === 0) continue;

    let set = occupiedByImovel.get(r.imovel_id);
    if (!set) {
      // Se não estava no mapa inicial mas passou no filtro de scopeIds (ou scopeIds vazio)
      set = new Set<string>();
      occupiedByImovel.set(r.imovel_id, set);
    }
    for (const d of dates) set.add(d);
  }

  let occupiedNights = 0;
  occupiedByImovel.forEach((set) => {
    // Cada imóvel pode ter no máximo totalDaysInPeriod noites ocupadas no período
    occupiedNights += Math.min(set.size, totalDaysInPeriod);
  });

  // CRITICAL: capacity must use the actual number of properties in the scope
  const propertyCount = imovelIds.length;
  const capacity = totalDaysInPeriod * propertyCount;
  
  let occupancyRate = 0;
  if (capacity > 0) {
    occupancyRate = (occupiedNights / capacity) * 100;
  }

  return { 
    occupiedNights, 
    capacity, 
    occupancyRate, 
    occupiedByImovel 
  };
}

