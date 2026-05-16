import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, CalendarDays, X, LayoutGrid, ClipboardList, RefreshCw } from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { cn } from "@/lib/utils";
import VisaoOperacional from "@/components/calendario/VisaoOperacional";
import { useToast } from "@/hooks/use-toast";

interface Imovel {
  id: string;
  nome_imovel: string;
  hora_checkin?: string | null;
  hora_checkout?: string | null;
}

interface Reserva {
  id: string;
  imovel_id: string;
  data_inicio: string;
  data_fim: string;
  valor_bruto: number | null;
  observacoes: string | null;
  hora_checkin_override?: string | null;
  hora_checkout_override?: string | null;
}

const HORA_CHECKIN_PADRAO = "15:00";
const HORA_CHECKOUT_PADRAO = "11:00";
const normHora = (h?: string | null) => (h ? h.slice(0, 5) : null);

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const now = new Date();
// Allow viewing up to 12 months ahead
const ANOS = Array.from({ length: now.getFullYear() - 2023 + 2 }, (_, i) => 2024 + i);

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Plataforma = "airbnb" | "booking" | "manual";

const detectPlataforma = (observacoes: string | null): Plataforma => {
  if (!observacoes) return "manual";
  const upper = observacoes.toUpperCase();
  if (upper.startsWith("[AIRBNB]")) return "airbnb";
  if (upper.startsWith("[BOOKING]")) return "booking";
  return "manual";
};

const PLATAFORMA_CONFIG: Record<Plataforma, { label: string; bg: string; text: string; icon: string }> = {
  airbnb:  { label: "Airbnb",      bg: "bg-[#FF385C]/15", text: "text-[#FF385C]", icon: "🏠" },
  booking: { label: "Booking.com", bg: "bg-[#003580]/15", text: "text-[#4A90D9]", icon: "🔵" },
  manual:  { label: "Manual",      bg: "bg-muted",        text: "text-muted-foreground", icon: "✏️" },
};

// Palette: 10 distinct hues that look good on the dark-navy background
const COLORS = [
  { bg: "bg-[#3B82F6]", text: "text-white", hex: "#3B82F6" },   // blue
  { bg: "bg-[#10B981]", text: "text-white", hex: "#10B981" },   // emerald
  { bg: "bg-[#F59E0B]", text: "text-white", hex: "#F59E0B" },   // amber
  { bg: "bg-[#EF4444]", text: "text-white", hex: "#EF4444" },   // red
  { bg: "bg-[#8B5CF6]", text: "text-white", hex: "#8B5CF6" },   // violet
  { bg: "bg-[#EC4899]", text: "text-white", hex: "#EC4899" },   // pink
  { bg: "bg-[#14B8A6]", text: "text-white", hex: "#14B8A6" },   // teal
  { bg: "bg-[#F97316]", text: "text-white", hex: "#F97316" },   // orange
  { bg: "bg-[#6366F1]", text: "text-white", hex: "#6366F1" },   // indigo
  { bg: "bg-[#84CC16]", text: "text-gray-900", hex: "#84CC16" }, // lime
];

// Parse "YYYY-MM-DD" without timezone shift
const parseDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Returns day-of-month numbers occupied by a reservation in the given month/year
const daysOccupied = (r: Reserva, year: number, month: number): number[] => {
  const [y1, m1, d1] = r.data_inicio.split("-").map(Number);
  const [y2, m2, d2] = r.data_fim.split("-").map(Number);
  const start = new Date(y1, m1 - 1, d1, 12, 0, 0);
  const end = new Date(y2, m2 - 1, d2, 12, 0, 0); 
  
  const days: number[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d, 12, 0, 0);
    if (date >= start && date < end) days.push(d);
  }
  return days;
};

interface TooltipData {
  reserva: Reserva;
  imovelNome: string;
  color: string;
  x: number;
  y: number;
}

const Calendario: React.FC = () => {
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Map imovel index → color
  const colorMap = useRef<Record<string, (typeof COLORS)[0]>>({});

  useEffect(() => {
    fetchData();
  }, [mes, ano]);

  const fetchData = async () => {
    setLoading(true);
    const firstDay = new Date(ano, mes, 1).toISOString().split("T")[0];
    const lastDay = new Date(ano, mes + 1, 0).toISOString().split("T")[0];

    const [{ data: imoveisData }, { data: reservasData }] = await Promise.all([
      supabase.from("imoveis").select("id, nome_imovel, hora_checkin, hora_checkout").order("nome_imovel"),
      supabase
        .from("reservas")
        .select("id, imovel_id, data_inicio, data_fim, valor_bruto, observacoes, hora_checkin_override, hora_checkout_override")
        .lte("data_inicio", lastDay)
        .gte("data_fim", firstDay),
    ]);

    const im = imoveisData || [];
    setImoveis(im);

    // Assign stable colors by imovel id
    im.forEach((imovel, idx) => {
      if (!colorMap.current[imovel.id]) {
        colorMap.current[imovel.id] = COLORS[idx % COLORS.length];
      }
    });

    setReservas(reservasData || []);
    setLoading(false);
  };

  const isMesAtual = mes === now.getMonth() && ano === now.getFullYear();
  // Allow navigation up to 12 months ahead
  const maxAno = now.getFullYear() + 1;
  const maxMes = now.getMonth(); // same month next year
  const isMesMaximo = ano > maxAno || (ano === maxAno && mes >= maxMes);

  const navegarMes = (delta: number) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 0) { novoMes = 11; novoAno -= 1; }
    if (novoMes > 11) { novoMes = 0; novoAno += 1; }
    if (novoAno > maxAno || (novoAno === maxAno && novoMes > maxMes)) return;
    setMes(novoMes);
    setAno(novoAno);
  };

  const daysInMonth = new Date(ano, mes + 1, 0).getDate();
  const today = new Date();

  // Build occupancy map: day → list of {imovel, reserva}
  const occupancyMap: Record<number, Array<{ imovel: Imovel; reserva: Reserva }>> = {};
  for (let d = 1; d <= daysInMonth; d++) occupancyMap[d] = [];

  reservas.forEach((r) => {
    const imovel = imoveis.find((im) => im.id === r.imovel_id);
    if (!imovel) return;
    daysOccupied(r, ano, mes).forEach((d) => {
      occupancyMap[d].push({ imovel, reserva: r });
    });
  });

  // Count total occupied days per imovel
  const ocupacaoPorImovel: Record<string, { dias: number; reservas: number }> = {};
  imoveis.forEach((im) => {
    ocupacaoPorImovel[im.id] = { dias: 0, reservas: 0 };
  });
  reservas.forEach((r) => {
    const dias = daysOccupied(r, ano, mes).length;
    if (ocupacaoPorImovel[r.imovel_id]) {
      ocupacaoPorImovel[r.imovel_id].dias += dias;
      ocupacaoPorImovel[r.imovel_id].reservas += 1;
    }
  });

  const handleCellClick = (
    e: React.MouseEvent,
    imovel: Imovel,
    reserva: Reserva
  ) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const color = colorMap.current[imovel.id]?.hex ?? "#3B82F6";
    setTooltip({
      reserva,
      imovelNome: imovel.nome_imovel,
      color,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 w-full overflow-x-hidden">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground tracking-wide">
            Calendário
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão estratégica de ocupação e operacional de check-ins/outs
          </p>
        </div>

        <Tabs defaultValue="ocupacao" className="w-full">
          <TabsList className="grid grid-cols-2 w-full sm:w-auto sm:inline-grid">
            <TabsTrigger value="ocupacao" className="gap-2">
              <LayoutGrid className="h-4 w-4" /> Ocupação
            </TabsTrigger>
            <TabsTrigger value="operacional" className="gap-2">
              <ClipboardList className="h-4 w-4" /> Operacional
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operacional" className="mt-4">
            <VisaoOperacional />
          </TabsContent>

          <TabsContent value="ocupacao" className="mt-4 space-y-4 sm:space-y-6">
            {/* Month/year nav */}
            <div className="flex justify-end">
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1 py-1">
                <button
                  onClick={() => navegarMes(-1)}
                  className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger className="border-0 bg-transparent shadow-none h-8 text-sm font-medium text-foreground focus:ring-0 w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem
                        key={i}
                        value={String(i)}
                        disabled={ano === maxAno && i > maxMes}
                      >
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                  <SelectTrigger className="border-0 bg-transparent shadow-none h-8 text-sm font-medium text-foreground focus:ring-0 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANOS.map((a) => (
                      <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => navegarMes(1)}
                  disabled={isMesMaximo}
                  className={cn(
                    "p-1 rounded transition-colors",
                    isMesMaximo
                      ? "text-muted-foreground/30 cursor-not-allowed"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : imoveis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum imóvel cadastrado</p>
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {imoveis.map((im) => {
                const color = colorMap.current[im.id];
                return (
                  <div key={im.id} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color?.hex }}
                    />
                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                      {im.nome_imovel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Calendar grid */}
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium w-36 sticky left-0 bg-muted/40 z-10">
                      Imóvel
                    </th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const isToday =
                        ano === today.getFullYear() &&
                        mes === today.getMonth() &&
                        d === today.getDate();
                      return (
                        <th
                          key={d}
                          className={cn(
                            "text-center text-[10px] font-medium px-0 py-2 min-w-[26px] w-[26px]",
                            isToday
                              ? "text-primary font-bold"
                              : "text-muted-foreground"
                          )}
                        >
                          {d}
                        </th>
                      );
                    })}
                    <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium w-28 whitespace-nowrap">
                      Ocupação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {imoveis.map((im, rowIdx) => {
                    const color = colorMap.current[im.id];
                    const { dias, reservas: numReservas } = ocupacaoPorImovel[im.id] ?? { dias: 0, reservas: 0 };
                    const taxaOcupacao = Math.round((dias / daysInMonth) * 100);

                    return (
                      <tr
                        key={im.id}
                        className={cn(
                          "border-t border-border/50 transition-colors",
                          rowIdx % 2 === 0 ? "bg-background" : "bg-muted/10"
                        )}
                      >
                        {/* Property name — sticky */}
                        <td className={cn(
                          "px-3 py-1.5 sticky left-0 z-10 text-xs font-medium text-foreground truncate max-w-[144px]",
                          rowIdx % 2 === 0 ? "bg-background" : "bg-muted/10"
                        )}>
                          {im.nome_imovel}
                        </td>

                        {/* Day cells */}
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                          const isToday =
                            ano === today.getFullYear() &&
                            mes === today.getMonth() &&
                            d === today.getDate();
                          const entries = occupancyMap[d].filter(
                            (e) => e.imovel.id === im.id
                          );
                          const occupied = entries.length > 0;

                          // Determine start/end of contiguous block for rounded corners
                          const prevOccupied = d > 1 && occupancyMap[d - 1].some((e) => e.imovel.id === im.id);
                          const nextOccupied =
                            d < daysInMonth &&
                            occupancyMap[d + 1].some((e) => e.imovel.id === im.id);
                          const roundLeft = occupied && !prevOccupied;
                          const roundRight = occupied && !nextOccupied;

                          return (
                            <td
                              key={d}
                              className={cn(
                                "h-8 px-0 py-1 text-center relative",
                                isToday && "after:absolute after:inset-x-[3px] after:bottom-0.5 after:h-0.5 after:bg-primary after:rounded-full"
                              )}
                            >
                              {occupied ? (
                                <button
                                  onClick={(e) => handleCellClick(e, entries[0].imovel, entries[0].reserva)}
                                  className={cn(
                                    "h-6 w-full block transition-opacity hover:opacity-80 active:opacity-60",
                                    roundLeft ? "rounded-l-full ml-0.5" : "",
                                    roundRight ? "rounded-r-full mr-0.5" : "",
                                  )}
                                  style={{ backgroundColor: color?.hex }}
                                />
                              ) : (
                                <span className="block h-6 w-full" />
                              )}
                            </td>
                          );
                        })}

                        {/* Occupancy summary */}
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${taxaOcupacao}%`,
                                  backgroundColor: color?.hex,
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                              {taxaOcupacao}%
                            </span>
                          </div>
                          {numReservas > 0 && (
                            <p className="text-[9px] text-muted-foreground/60 text-right mt-0.5">
                              {numReservas} reserva{numReservas !== 1 ? "s" : ""}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Month summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Total de imóveis",
                  value: imoveis.length,
                  format: "n",
                },
                {
                  label: "Reservas no mês",
                  value: reservas.length,
                  format: "n",
                },
                {
                  label: "Imóveis c/ ocupação",
                  value: imoveis.filter((im) => (ocupacaoPorImovel[im.id]?.dias ?? 0) > 0).length,
                  format: "n",
                },
                {
                  label: "Receita bruta estimada",
                  value: reservas.reduce((acc, r) => acc + (r.valor_bruto || 0), 0),
                  format: "currency",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-card border border-border rounded-lg px-4 py-3"
                >
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="font-display text-xl text-foreground mt-1">
                    {s.format === "currency"
                      ? fmt(s.value as number)
                      : String(s.value)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setTooltip(null)}
          />
          <div
            ref={tooltipRef}
            className="fixed z-50 bg-card border border-border rounded-xl shadow-xl p-4 w-64 animate-in fade-in-0 zoom-in-95 duration-150"
            style={{
              left: Math.min(tooltip.x, window.innerWidth - 270),
              top: tooltip.y - 8,
              transform: "translateY(-100%)",
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block h-3 w-3 rounded-sm flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: tooltip.color }}
                />
                <p className="text-sm font-semibold text-foreground truncate">
                  {tooltip.imovelNome}
                </p>
              </div>
              <button
                onClick={() => setTooltip(null)}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Platform badge */}
            {(() => {
              const plataforma = detectPlataforma(tooltip.reserva.observacoes);
              const cfg = PLATAFORMA_CONFIG[plataforma];
              return (
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium mb-3 ${cfg.bg} ${cfg.text}`}>
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </div>
              );
            })()}

            <div className="space-y-2 text-xs">
              {(() => {
                const im = imoveis.find((i) => i.id === tooltip.reserva.imovel_id);
                const horaIn = normHora(tooltip.reserva.hora_checkin_override) || normHora(im?.hora_checkin) || HORA_CHECKIN_PADRAO;
                const horaOut = normHora(tooltip.reserva.hora_checkout_override) || normHora(im?.hora_checkout) || HORA_CHECKOUT_PADRAO;
                const isOverIn = !!normHora(tooltip.reserva.hora_checkin_override);
                const isOverOut = !!normHora(tooltip.reserva.hora_checkout_override);
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-in</span>
                      <span className="text-foreground font-medium">
                        {parseDate(tooltip.reserva.data_inicio).toLocaleDateString("pt-BR")} · <span className={isOverIn ? "text-primary" : ""}>{horaIn}{isOverIn && " ✱"}</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-out</span>
                      <span className="text-foreground font-medium">
                        {parseDate(tooltip.reserva.data_fim).toLocaleDateString("pt-BR")} · <span className={isOverOut ? "text-primary" : ""}>{horaOut}{isOverOut && " ✱"}</span>
                      </span>
                    </div>
                  </>
                );
              })()}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duração</span>
                <span className="text-foreground font-medium">
                  {daysOccupied(tooltip.reserva, ano, mes).length} noite(s) no mês
                </span>
              </div>
              {tooltip.reserva.valor_bruto != null && (
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <span className="text-muted-foreground">Valor bruto</span>
                  <span className="text-foreground font-semibold">
                    {fmt(tooltip.reserva.valor_bruto)}
                  </span>
                </div>
              )}
              {tooltip.reserva.observacoes && (() => {
                const clean = tooltip.reserva.observacoes
                  .replace(/^\[(AIRBNB|BOOKING)\]\s*/i, "")
                  .trim();
                return clean ? (
                  <p className="text-muted-foreground text-[10px] border-t border-border pt-2 mt-2 italic">
                    {clean}
                  </p>
                ) : null;
              })()}
            </div>
          </div>
        </>
      )}
    </PageTransition>
  );
};

export default Calendario;
