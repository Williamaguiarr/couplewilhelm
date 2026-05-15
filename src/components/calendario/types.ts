export interface ImovelLite {
  id: string;
  nome_imovel: string;
  hora_checkin?: string | null;
  hora_checkout?: string | null;
  tempo_limpeza_min?: number | null;
  max_hospedes?: number | null;
  observacoes_operacionais?: string | null;
}

export interface ReservaOp {
  id: string;
  imovel_id: string;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;
  nome_hospede: string | null;
  num_hospedes: number | null;
  plataforma_origem: string | null;
  observacoes: string | null;
  valor_bruto: number | null;
  hora_checkin_override?: string | null;
  hora_checkout_override?: string | null;
}

export interface Limpeza {
  id: string;
  reserva_id: string;
  imovel_id: string;
  data_limpeza: string;
  status: "pendente" | "concluida";
  responsavel: string | null;
  observacoes: string | null;
  concluida_em: string | null;
}

export type EventoTipo = "checkin" | "checkout";

export interface JanelaOperacional {
  liberacaoPrevista?: string; // HH:MM (checkout + tempo limpeza)
  proximoCheckin?: string;    // HH:MM do próximo check-in no mesmo imóvel
  proximoCheckinData?: string; // YYYY-MM-DD
  intervaloMin?: number;       // minutos entre liberação e próximo check-in
  conflito?: "critico" | "apertado" | null; // critico: <0, apertado: <60min
}

export interface EventoOperacional {
  id: string; // unique key: reservaId-tipo
  tipo: EventoTipo;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM (efetivo: override > imovel > padrão)
  reserva: ReservaOp;
  imovel: ImovelLite;
  limpeza?: Limpeza | null; // only meaningful on checkout
  janela?: JanelaOperacional | null; // only on checkout
}

export const HORA_CHECKIN_PADRAO = "15:00";
export const HORA_CHECKOUT_PADRAO = "11:00";
export const TEMPO_LIMPEZA_PADRAO_MIN = 180; // 3h

const normHora = (h?: string | null) => (h ? h.slice(0, 5) : null);

export const getHoraCheckin = (r: ReservaOp, i: ImovelLite) =>
  normHora(r.hora_checkin_override) || normHora(i.hora_checkin) || HORA_CHECKIN_PADRAO;

export const getHoraCheckout = (r: ReservaOp, i: ImovelLite) =>
  normHora(r.hora_checkout_override) || normHora(i.hora_checkout) || HORA_CHECKOUT_PADRAO;

export const getTempoLimpeza = (i: ImovelLite) =>
  i.tempo_limpeza_min ?? TEMPO_LIMPEZA_PADRAO_MIN;

export const horaParaMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const minParaHora = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const formatarDuracao = (min: number) => {
  if (min <= 0) return "0min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}min`;
};

export type Plataforma = "airbnb" | "booking" | "direto" | "manual";

export const detectarPlataforma = (r: ReservaOp): Plataforma => {
  const p = (r.plataforma_origem || "").toLowerCase();
  if (p.includes("airbnb")) return "airbnb";
  if (p.includes("booking")) return "booking";
  if (p.includes("direto") || p === "manual") return p === "manual" ? "manual" : "direto";
  const obs = (r.observacoes || "").toUpperCase();
  if (obs.startsWith("[AIRBNB]")) return "airbnb";
  if (obs.startsWith("[BOOKING]")) return "booking";
  return "manual";
};

export const PLATAFORMA_LABEL: Record<Plataforma, string> = {
  airbnb: "Airbnb",
  booking: "Booking",
  direto: "Direto",
  manual: "Manual",
};
