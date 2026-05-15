import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarDays, Filter, Search } from "lucide-react";
import EventoCard from "./EventoCard";
import LimpezaDialog from "./LimpezaDialog";
import ResumoDia from "./ResumoDia";
import {
  getHoraCheckin,
  getHoraCheckout,
  getTempoLimpeza,
  horaParaMin,
  minParaHora,
  type EventoOperacional,
  type ImovelLite,
  type JanelaOperacional,
  type Limpeza,
  type ReservaOp,
} from "./types";
import { cn } from "@/lib/utils";

type Periodo = "hoje" | "amanha" | "7dias" | "data";
type FiltroTipo = "todos" | "checkin" | "checkout";
type FiltroLimpeza = "todos" | "pendente" | "concluida";

const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const formatarDiaLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const hoje = isoDate(new Date());
  const amanha = isoDate(new Date(Date.now() + 86400000));
  if (iso === hoje) return "Hoje";
  if (iso === amanha) return "Amanhã";
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
};

export default function VisaoOperacional() {
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [dataEspecifica, setDataEspecifica] = useState<string>(isoDate(new Date()));
  const [imovelFiltro, setImovelFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<FiltroTipo>("todos");
  const [limpezaFiltro, setLimpezaFiltro] = useState<FiltroLimpeza>("todos");
  const [busca, setBusca] = useState("");

  const [imoveis, setImoveis] = useState<ImovelLite[]>([]);
  const [reservas, setReservas] = useState<ReservaOp[]>([]);
  const [limpezas, setLimpezas] = useState<Limpeza[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventoEdit, setEventoEdit] = useState<EventoOperacional | null>(null);

  const { dataInicio, dataFim } = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (periodo === "hoje") return { dataInicio: isoDate(hoje), dataFim: isoDate(hoje) };
    if (periodo === "amanha") {
      const a = new Date(hoje); a.setDate(a.getDate() + 1);
      return { dataInicio: isoDate(a), dataFim: isoDate(a) };
    }
    if (periodo === "7dias") {
      const f = new Date(hoje); f.setDate(f.getDate() + 6);
      return { dataInicio: isoDate(hoje), dataFim: isoDate(f) };
    }
    return { dataInicio: dataEspecifica, dataFim: dataEspecifica };
  }, [periodo, dataEspecifica]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: imv }, { data: res }] = await Promise.all([
      supabase
        .from("imoveis")
        .select("id, nome_imovel, hora_checkin, hora_checkout, tempo_limpeza_min, max_hospedes, observacoes_operacionais")
        .order("nome_imovel"),
      supabase
        .from("reservas")
        .select("id, imovel_id, data_inicio, data_fim, nome_hospede, num_hospedes, plataforma_origem, observacoes, valor_bruto, hora_checkin_override, hora_checkout_override")
        .or(`and(data_inicio.gte.${dataInicio},data_inicio.lte.${dataFim}),and(data_fim.gte.${dataInicio},data_fim.lte.${dataFim})`),
    ]);

    setImoveis((imv || []) as ImovelLite[]);
    setReservas((res || []) as ReservaOp[]);

    const reservaIds = (res || []).map((r) => r.id);
    if (reservaIds.length) {
      const { data: lim } = await supabase
        .from("limpezas")
        .select("*")
        .in("reserva_id", reservaIds);
      setLimpezas((lim || []) as Limpeza[]);
    } else {
      setLimpezas([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [dataInicio, dataFim]);

  // Buscar próximo check-in de cada imóvel (para detectar conflitos com limpeza)
  // Usa as reservas já carregadas no período, mas isso pode subestimar conflitos
  // se o próximo check-in cair fora da janela. Para robustez, calculamos a partir
  // das reservas em memória.
  const eventos = useMemo<EventoOperacional[]>(() => {
    const limpezaPorReserva = new Map(limpezas.map((l) => [l.reserva_id, l]));
    const imovelPorId = new Map(imoveis.map((i) => [i.id, i]));

    // index: por imovel_id, lista de check-ins ordenados (data_inicio + hora_checkin)
    const checkinsPorImovel = new Map<string, { data: string; hora: string; min: number }[]>();
    for (const r of reservas) {
      const im = imovelPorId.get(r.imovel_id);
      if (!im) continue;
      const hora = getHoraCheckin(r, im);
      const arr = checkinsPorImovel.get(r.imovel_id) || [];
      arr.push({ data: r.data_inicio, hora, min: horaParaMin(hora) });
      checkinsPorImovel.set(r.imovel_id, arr);
    }
    for (const arr of checkinsPorImovel.values()) {
      arr.sort((a, b) => a.data.localeCompare(b.data) || a.min - b.min);
    }

    const out: EventoOperacional[] = [];

    for (const r of reservas) {
      const imovel = imovelPorId.get(r.imovel_id);
      if (!imovel) continue;

      const horaCheckin = getHoraCheckin(r, imovel);
      const horaCheckout = getHoraCheckout(r, imovel);

      if (r.data_inicio >= dataInicio && r.data_inicio <= dataFim) {
        out.push({
          id: `${r.id}-checkin`,
          tipo: "checkin",
          data: r.data_inicio,
          hora: horaCheckin,
          reserva: r,
          imovel,
        });
      }
      if (r.data_fim >= dataInicio && r.data_fim <= dataFim) {
        // calcular janela operacional
        const tempoLimp = getTempoLimpeza(imovel);
        const checkoutMin = horaParaMin(horaCheckout);
        const liberacaoMin = checkoutMin + tempoLimp;
        const liberacaoPrevista = minParaHora(liberacaoMin);

        // próximo check-in do MESMO imóvel no MESMO dia (ou após)
        const proximos = checkinsPorImovel.get(r.imovel_id) || [];
        const prox = proximos.find(
          (c) => c.data > r.data_fim || (c.data === r.data_fim && c.min >= checkoutMin)
        );

        let janela: JanelaOperacional = { liberacaoPrevista };
        if (prox && prox.data === r.data_fim) {
          const intervalo = prox.min - liberacaoMin;
          janela = {
            liberacaoPrevista,
            proximoCheckin: prox.hora,
            proximoCheckinData: prox.data,
            intervaloMin: intervalo,
            conflito: intervalo < 0 ? "critico" : intervalo < 60 ? "apertado" : null,
          };
        } else if (prox) {
          janela = {
            liberacaoPrevista,
            proximoCheckin: prox.hora,
            proximoCheckinData: prox.data,
          };
        }

        out.push({
          id: `${r.id}-checkout`,
          tipo: "checkout",
          data: r.data_fim,
          hora: horaCheckout,
          reserva: r,
          imovel,
          limpeza: limpezaPorReserva.get(r.id) || null,
          janela,
        });
      }
    }

    out.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      if (a.tipo !== b.tipo) return a.tipo === "checkout" ? -1 : 1;
      return a.hora.localeCompare(b.hora);
    });
    return out;
  }, [reservas, limpezas, imoveis, dataInicio, dataFim]);

  const eventosFiltrados = useMemo(() => {
    return eventos.filter((e) => {
      if (imovelFiltro !== "todos" && e.imovel.id !== imovelFiltro) return false;
      if (tipoFiltro !== "todos" && e.tipo !== tipoFiltro) return false;
      if (limpezaFiltro !== "todos") {
        if (e.tipo !== "checkout") return false;
        const st = e.limpeza?.status || "pendente";
        if (st !== limpezaFiltro) return false;
      }
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        const hay = `${e.imovel.nome_imovel} ${e.reserva.nome_hospede || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [eventos, imovelFiltro, tipoFiltro, limpezaFiltro, busca]);

  const agruparPorDia = (lista: EventoOperacional[]) => {
    const map = new Map<string, EventoOperacional[]>();
    for (const ev of lista) {
      if (!map.has(ev.data)) map.set(ev.data, []);
      map.get(ev.data)!.push(ev);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, evs]) => [dia, evs.sort((a, b) => a.hora.localeCompare(b.hora))] as const);
  };

  const checkinsPorDia = useMemo(
    () => agruparPorDia(eventosFiltrados.filter((e) => e.tipo === "checkin")),
    [eventosFiltrados]
  );
  const checkoutsPorDia = useMemo(
    () => agruparPorDia(eventosFiltrados.filter((e) => e.tipo === "checkout")),
    [eventosFiltrados]
  );
  const totalCheckins = checkinsPorDia.reduce((acc, [, e]) => acc + e.length, 0);
  const totalCheckouts = checkoutsPorDia.reduce((acc, [, e]) => acc + e.length, 0);
  const semEventos = totalCheckins === 0 && totalCheckouts === 0;

  // Resumo (do dia selecionado quando hoje/amanha/data; do range quando 7dias)
  const resumo = useMemo(() => {
    const dia = periodo === "7dias" ? isoDate(new Date()) : dataInicio;
    const evDia = eventos.filter((e) => e.data === dia);
    const checkins = evDia.filter((e) => e.tipo === "checkin").length;
    const checkouts = evDia.filter((e) => e.tipo === "checkout").length;
    const hospedes = evDia
      .filter((e) => e.tipo === "checkin")
      .reduce((acc, e) => acc + (e.reserva.num_hospedes || 0), 0);
    const limpezasPendentes = evDia.filter(
      (e) => e.tipo === "checkout" && (e.limpeza?.status || "pendente") === "pendente"
    ).length;
    return { checkins, checkouts, hospedes, limpezasPendentes };
  }, [eventos, periodo, dataInicio]);

  return (
    <div className="space-y-4">
      <ResumoDia {...resumo} />

      {/* Período */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          ["hoje", "Hoje"],
          ["amanha", "Amanhã"],
          ["7dias", "Próximos 7 dias"],
          ["data", "Data específica"],
        ] as [Periodo, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriodo(k)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              periodo === k
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
        {periodo === "data" && (
          <Input
            type="date"
            value={dataEspecifica}
            onChange={(e) => setDataEspecifica(e.target.value)}
            className="h-8 w-[160px] text-xs"
          />
        )}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar imóvel ou hóspede"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>
        <Select value={imovelFiltro} onValueChange={setImovelFiltro}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Imóvel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os imóveis</SelectItem>
            {imoveis.map((i) => (
              <SelectItem key={i.id} value={i.id}>{i.nome_imovel}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as FiltroTipo)}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="checkin">Apenas check-ins</SelectItem>
            <SelectItem value="checkout">Apenas check-outs</SelectItem>
          </SelectContent>
        </Select>
        <Select value={limpezaFiltro} onValueChange={(v) => setLimpezaFiltro(v as FiltroLimpeza)}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Toda limpeza</SelectItem>
            <SelectItem value="pendente">Limpeza pendente</SelectItem>
            <SelectItem value="concluida">Limpeza concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : semEventos ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border border-dashed border-border rounded-xl">
          <CalendarDays className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Nenhuma movimentação encontrada para este período.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* Coluna Check-ins */}
          <ColunaOperacional
            titulo="Check-ins"
            tone="checkin"
            total={totalCheckins}
            grupos={checkinsPorDia}
            formatarDiaLabel={formatarDiaLabel}
            onAbrirLimpeza={setEventoEdit}
          />
          {/* Coluna Check-outs */}
          <ColunaOperacional
            titulo="Check-outs"
            tone="checkout"
            total={totalCheckouts}
            grupos={checkoutsPorDia}
            formatarDiaLabel={formatarDiaLabel}
            onAbrirLimpeza={setEventoEdit}
          />
        </div>
      )}

      <LimpezaDialog
        evento={eventoEdit}
        onClose={() => setEventoEdit(null)}
        onSaved={fetchData}
      />
    </div>
  );
}

function ColunaOperacional({
  titulo,
  tone,
  total,
  grupos,
  formatarDiaLabel,
  onAbrirLimpeza,
}: {
  titulo: string;
  tone: "checkin" | "checkout";
  total: number;
  grupos: ReadonlyArray<readonly [string, EventoOperacional[]]>;
  formatarDiaLabel: (iso: string) => string;
  onAbrirLimpeza: (e: EventoOperacional) => void;
}) {
  const isIn = tone === "checkin";
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-card overflow-hidden",
        isIn ? "border-emerald-500/30" : "border-rose-500/30"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b",
          isIn
            ? "bg-emerald-500/5 border-emerald-500/20"
            : "bg-rose-500/5 border-rose-500/20"
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isIn ? "bg-emerald-500" : "bg-rose-500"
            )}
          />
          <h3 className="font-display text-sm sm:text-base text-foreground">
            {titulo}
          </h3>
        </div>
        <span
          className={cn(
            "text-xs font-semibold px-2.5 py-1 rounded-full tabular-nums",
            isIn
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
          )}
        >
          {total} {total === 1 ? (isIn ? "entrada" : "saída") : isIn ? "entradas" : "saídas"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[70vh] lg:max-h-[calc(100vh-360px)] p-3 space-y-4">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              Sem {isIn ? "check-ins" : "check-outs"} no período.
            </p>
          </div>
        ) : (
          grupos.map(([dia, evs]) => (
            <div key={dia} className="space-y-2">
              <div className="sticky top-0 -mx-3 px-3 py-1 bg-card/95 backdrop-blur z-10">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground capitalize">
                  {formatarDiaLabel(dia)}
                </p>
              </div>
              <div className="space-y-2">
                {evs.map((e) => (
                  <EventoCard key={e.id} evento={e} onAbrirLimpeza={onAbrirLimpeza} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
