export interface ImovelLite {
  id: string;
  nome_imovel: string;
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

export interface EventoOperacional {
  id: string; // unique key: reservaId-tipo
  tipo: EventoTipo;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  reserva: ReservaOp;
  imovel: ImovelLite;
  limpeza?: Limpeza | null; // only meaningful on checkout
}

export const HORA_CHECKIN_PADRAO = "15:00";
export const HORA_CHECKOUT_PADRAO = "11:00";

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
