import React, { useEffect, useState, useCallback } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  CalendarCheck,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Building2,
  FileText,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoSrc from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";

interface Reserva {
  id: string;
  imovel_id: string;
  data_inicio: string;
  data_fim: string;
  valor_bruto: number | null;
  taxa_limpeza: number | null;
  comissao_plataforma: number | null;
  valor_liquido_proprietario: number | null;
  observacoes: string | null;
  imovel?: { nome_imovel: string };
}

interface DespesaExtra {
  id: string;
  imovel_id: string;
  descricao: string;
  valor: number;
  data: string;
  tipo: string;
  imovel?: { nome_imovel: string };
}

const fmt = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";

const getDaysBetween = (start: string, end: string): Date[] => {
  const days: Date[] = [];
  const current = new Date(start + "T12:00:00");
  const endDate = new Date(end + "T12:00:00");
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const COMISSAO = 0.25;

const calcFinanceiro = (r: Reserva) => {
  const bruto = r.valor_bruto ?? 0;
  const limpeza = r.taxa_limpeza ?? 0;
  const plataforma = r.comissao_plataforma ?? 0;
  const liquido = bruto - limpeza - plataforma;
  const comissao = liquido * COMISSAO;
  const proprietario = liquido - comissao;
  return { bruto, limpeza, plataforma, liquido, comissao, proprietario };
};

const TIPO_LABELS: Record<string, string> = {
  manutencao: "Manutenção",
  amenities: "Amenities",
  limpeza_extra: "Limpeza Extra",
  reparo: "Reparo",
  outros: "Outros",
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ProprietarioDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [despesas, setDespesas] = useState<DespesaExtra[]>([]);
  const [imoveis, setImoveis] = useState<{ id: string; nome_imovel: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const now = new Date();

  // Filtros: mês e ano (baseado em data_fim - checkout)
  const [filterMes, setFilterMes] = useState<number>(now.getMonth()); // 0-indexed
  const [filterAno, setFilterAno] = useState<number>(now.getFullYear());
  const [filterImovel, setFilterImovel] = useState<string>("todos");
  const [extratoAberto, setExtratoAberto] = useState(true);
  const [despesasAberto, setDespesasAberto] = useState(true);

  // Gera lista de anos disponíveis: 2 anos atrás até 1 ano à frente
  const anoAtual = now.getFullYear();
  const anos = Array.from({ length: 4 }, (_, i) => anoAtual - 2 + i);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: imoveisData } = await supabase
        .from("imoveis")
        .select("id, nome_imovel")
        .or(`proprietario_id.eq.${user.id},proprietario_id_2.eq.${user.id}`);

      setImoveis(imoveisData || []);

      if (imoveisData && imoveisData.length === 1 && filterImovel === "todos") {
        setFilterImovel(imoveisData[0].id);
      }

      const [{ data: resData }, { data: despData }] = await Promise.all([
        supabase
          .from("reservas")
          .select("*, imoveis(nome_imovel)")
          .order("data_inicio", { ascending: false }),
        supabase
          .from("despesas_extras" as any)
          .select("*, imoveis(nome_imovel)")
          .order("data", { ascending: false }),
      ]);

      setReservas((resData || []).map((r: any) => ({ ...r, imovel: r.imoveis })));
      setDespesas((despData || []).map((d: any) => ({ ...d, imovel: d.imoveis })));
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const getReservasForDay = useCallback(
    (day: Date) =>
      reservas.filter((r) => {
        const inicio = new Date(r.data_inicio + "T12:00:00");
        const fim = new Date(r.data_fim + "T12:00:00");
        const d = new Date(day);
        d.setHours(12, 0, 0, 0);
        return d >= inicio && d <= fim;
      }),
    [reservas]
  );

  const handleDayClick = (day: Date) => {
    if (getReservasForDay(day).length > 0) {
      setSelectedDay(day);
      setPopoverOpen(true);
    }
  };

  const selectedReservas = selectedDay ? getReservasForDay(selectedDay) : [];

  // Filtrar reservas: pertence ao mês/ano pelo checkout (data_fim)
  const reservasFiltradas = reservas.filter((r) => {
    if (filterImovel !== "todos" && r.imovel_id !== filterImovel) return false;
    const fim = new Date(r.data_fim + "T12:00:00");
    return fim.getMonth() === filterMes && fim.getFullYear() === filterAno;
  });

  // Despesas: pelo campo data (mês da despesa)
  const despesasFiltradas = despesas.filter((d) => {
    if (filterImovel !== "todos" && d.imovel_id !== filterImovel) return false;
    const data = new Date(d.data + "T12:00:00");
    return data.getMonth() === filterMes && data.getFullYear() === filterAno;
  });

  // Calcular métricas apenas para o imóvel selecionado
  const reservasImovelSelecionado = filterImovel === "todos"
    ? reservas
    : reservas.filter(r => r.imovel_id === filterImovel);

  const receitaMesAtual = reservasImovelSelecionado
    .filter((r) => {
      const fim = new Date(r.data_fim + "T12:00:00");
      return fim.getMonth() === currentMonth && fim.getFullYear() === currentYear;
    })
    .reduce((acc, r) => acc + (r.valor_liquido_proprietario ?? 0), 0);

  const previsaoFutura = reservasImovelSelecionado
    .filter((r) => {
      const fim = new Date(r.data_fim + "T12:00:00");
      return (
        fim > new Date() &&
        !(fim.getMonth() === currentMonth && fim.getFullYear() === currentYear)
      );
    })
    .reduce((acc, r) => acc + (r.valor_liquido_proprietario ?? 0), 0);

  const occupiedDays = reservasImovelSelecionado.flatMap((r) =>
    getDaysBetween(r.data_inicio, r.data_fim)
  );

  const totais = reservasFiltradas.reduce(
    (acc, r) => {
      const f = calcFinanceiro(r);
      return {
        bruto: acc.bruto + f.bruto,
        limpeza: acc.limpeza + f.limpeza,
        plataforma: acc.plataforma + f.plataforma,
        comissao: acc.comissao + f.comissao,
        proprietario: acc.proprietario + f.proprietario,
      };
    },
    { bruto: 0, limpeza: 0, plataforma: 0, comissao: 0, proprietario: 0 }
  );

  const totalDespesas = despesasFiltradas.reduce((acc, d) => acc + d.valor, 0);
  const totalLiquido = totais.proprietario - totalDespesas;

  const isPeriodoAtual = filterMes === currentMonth && filterAno === currentYear;

  return (
    <PageTransition>
      <div className="space-y-6 max-w-5xl">

        {/* Header */}
        <div className="pb-2 border-b border-border">
          <h1 className="font-display text-2xl text-foreground tracking-wide">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            label="Receita do Mês"
            sub="Checkouts neste mês"
            value={loading ? null : fmt(receitaMesAtual)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            label="Previsão Futura"
            sub="Reservas confirmadas"
            value={loading ? null : fmt(previsaoFutura)}
            icon={<CalendarCheck className="h-4 w-4" />}
          />
        </div>

        {/* Extrato */}
        <section className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setExtratoAberto((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/10 transition-colors"
          >
            <span className="font-display text-base text-foreground tracking-wide">Extrato Financeiro</span>
            {extratoAberto
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {extratoAberto && (
            <div className="border-t border-border">
              {/* Filters */}
              <div className="px-5 py-3 flex flex-wrap items-end gap-3 border-b border-border">
                {/* Filtro por Imóvel */}
                {imoveis.length > 1 && (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Imóvel
                    </Label>
                    <Select value={filterImovel} onValueChange={setFilterImovel}>
                      <SelectTrigger className="w-44 h-8 text-xs bg-transparent border-border">
                        <SelectValue placeholder="Todos os imóveis" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="todos" className="text-xs">Todos os imóveis</SelectItem>
                        {imoveis.map((imovel) => (
                          <SelectItem key={imovel.id} value={imovel.id} className="text-xs">
                            {imovel.nome_imovel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Filtro Mês */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Mês</Label>
                  <Select value={String(filterMes)} onValueChange={(v) => setFilterMes(Number(v))}>
                    <SelectTrigger className="w-36 h-8 text-xs bg-transparent border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {MESES.map((nome, idx) => (
                        <SelectItem key={idx} value={String(idx)} className="text-xs">
                          {nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro Ano */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Ano</Label>
                  <Select value={String(filterAno)} onValueChange={(v) => setFilterAno(Number(v))}>
                    <SelectTrigger className="w-24 h-8 text-xs bg-transparent border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {anos.map((ano) => (
                        <SelectItem key={ano} value={String(ano)} className="text-xs">
                          {ano}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Botão voltar ao mês atual */}
                {!isPeriodoAtual && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFilterMes(currentMonth); setFilterAno(currentYear); }}
                    className="text-muted-foreground hover:text-foreground gap-1.5 h-8 self-end"
                  >
                    <X className="h-3 w-3" /> Mês atual
                  </Button>
                )}

                <span className="ml-auto self-end text-xs text-muted-foreground">
                  {reservasFiltradas.length} reserva{reservasFiltradas.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Table */}
              {loading ? (
                <div className="p-10 flex justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : reservasFiltradas.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-muted-foreground text-sm">Nenhuma reserva com checkout em {MESES[filterMes]} de {filterAno}</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        {["Imóvel", "Check-in", "Check-out", "Bruto", "Limpeza", "Com. OTA", "Comissão CW", "Repasse"].map((h, i) => (
                          <TableHead
                            key={h}
                            className={cn(
                              "text-muted-foreground text-[10px] uppercase tracking-widest py-2",
                              i > 2 && "text-right"
                            )}
                          >
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservasFiltradas.map((r) => {
                        const f = calcFinanceiro(r);
                        return (
                          <TableRow key={r.id} className="border-border hover:bg-muted/20">
                            <TableCell className="text-foreground font-medium text-sm py-3">
                              {r.imovel?.nome_imovel ?? "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm py-3">
                              {new Date(r.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm py-3">
                              {new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm text-right py-3">{fmt(f.bruto)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm text-right py-3">{fmt(f.limpeza)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm text-right py-3">
                              {f.plataforma > 0 ? fmt(f.plataforma) : <span className="opacity-30">—</span>}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm text-right py-3">{fmt(f.comissao)}</TableCell>
                            <TableCell className="text-primary text-sm text-right font-semibold py-3">{fmt(f.proprietario)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Totals footer */}
                  <div className="border-t border-border px-5 py-3 flex items-center justify-end gap-6 flex-wrap">
                    <TotalItem label="Bruto" value={fmt(totais.bruto)} />
                    <TotalItem label="Limpeza" value={fmt(totais.limpeza)} />
                    {totais.plataforma > 0 && (
                      <TotalItem label="Com. OTA" value={fmt(totais.plataforma)} />
                    )}
                    <TotalItem label="Comissão CW" value={fmt(totais.comissao)} />
                    <div className="pl-6 border-l border-border">
                      <p className="text-[10px] text-primary uppercase tracking-widest mb-0.5">Seu Repasse</p>
                      <p className="font-display text-base text-primary font-semibold">{fmt(totais.proprietario)}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Despesas Extras */}
        <section className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setDespesasAberto((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-display text-base text-foreground tracking-wide">Despesas Extras</span>
              {despesasFiltradas.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-destructive/70 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  {despesasFiltradas.length} item{despesasFiltradas.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {despesasAberto
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {despesasAberto && (
            <div className="border-t border-border">
              {loading ? (
                <div className="p-10 flex justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : despesasFiltradas.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground text-sm">Nenhuma despesa extra em {MESES[filterMes]} de {filterAno}</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        {["Imóvel", "Descrição", "Tipo", "Data", "Valor"].map((h, i) => (
                          <TableHead
                            key={h}
                            className={cn(
                              "text-muted-foreground text-[10px] uppercase tracking-widest py-2",
                              i === 4 && "text-right"
                            )}
                          >
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {despesasFiltradas.map((d) => (
                        <TableRow key={d.id} className="border-border hover:bg-muted/20">
                          <TableCell className="text-foreground font-medium text-sm py-3">
                            {d.imovel?.nome_imovel ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm py-3">{d.descricao}</TableCell>
                          <TableCell className="py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-destructive/10 text-destructive/80 border border-destructive/20">
                              {TIPO_LABELS[d.tipo] ?? d.tipo}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm py-3">
                            {new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-destructive text-sm text-right font-semibold py-3">
                            - {fmt(d.valor)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="border-t border-border px-5 py-3 flex items-center justify-end">
                    <div className="text-right">
                      <p className="text-[10px] text-destructive/70 uppercase tracking-widest mb-0.5">Total Despesas</p>
                      <p className="font-display text-base text-destructive font-semibold">- {fmt(totalDespesas)}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Resumo Líquido Final */}
        {!loading && (reservasFiltradas.length > 0 || despesasFiltradas.length > 0) && (
          <div className="border border-primary/20 rounded-lg px-5 py-4 bg-primary/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">
                Líquido Final — {MESES[filterMes]} {filterAno}
              </p>
              <p className="text-xs text-muted-foreground">Repasse − Despesas Extras</p>
            </div>
            <div className="text-right">
              <p className={cn(
                "font-display text-2xl font-semibold",
                totalLiquido >= 0 ? "text-primary" : "text-destructive"
              )}>
                {fmt(totalLiquido)}
              </p>
            </div>
          </div>
        )}

        {/* Calendar */}
        <section className="border border-border rounded-lg p-5">
          <div className="mb-5">
            <h2 className="font-display text-base text-foreground tracking-wide">Calendário de Ocupação</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dias em dourado indicam período de reserva — clique para detalhes
            </p>
          </div>

          <div className="flex justify-center">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <div>
                  <DayPicker
                    mode="single"
                    month={month}
                    onMonthChange={setMonth}
                    locale={ptBR}
                    onDayClick={handleDayClick}
                    modifiers={{ occupied: occupiedDays }}
                    modifiersClassNames={{ occupied: "rdp-day-occupied" }}
                    classNames={{
                      root: "rdp-luxury",
                      months: "flex flex-col",
                      month: "space-y-4",
                      caption: "flex justify-center relative items-center",
                      caption_label: "font-display text-foreground text-sm tracking-wide capitalize",
                      nav: "flex items-center gap-1",
                      nav_button: "h-7 w-7 bg-transparent hover:bg-muted rounded-md flex items-center justify-center transition-colors text-muted-foreground hover:text-primary",
                      nav_button_previous: "absolute left-0",
                      nav_button_next: "absolute right-0",
                      table: "w-full border-collapse",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.7rem] text-center uppercase tracking-wider",
                      row: "flex w-full mt-1",
                      cell: "h-9 w-9 text-center text-sm relative p-0",
                      day: "h-9 w-9 p-0 font-normal rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer aria-selected:opacity-100 flex items-center justify-center",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary",
                      day_today: "border border-primary/50 text-primary",
                      day_outside: "text-muted-foreground opacity-30",
                      day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
                    }}
                  />
                </div>
              </PopoverTrigger>

              {selectedDay && selectedReservas.length > 0 && (
                <PopoverContent
                  className="bg-card border border-border shadow-luxury w-72 p-4"
                  align="center"
                >
                  <div className="space-y-3">
                    <p className="font-display text-xs text-primary tracking-widest uppercase">
                      {selectedDay.toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    {selectedReservas.map((r) => {
                      const f = calcFinanceiro(r);
                      return (
                        <div key={r.id} className="border-t border-border pt-3 space-y-3">
                          <p className="text-foreground font-medium text-sm">
                            {r.imovel?.nome_imovel}
                          </p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex justify-between">
                              <span>Check-in</span>
                              <span>{new Date(r.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Check-out</span>
                              <span>{new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                          </div>
                          <div className="bg-muted/20 rounded p-2.5 space-y-1.5 text-xs">
                            <FinRow label="Valor bruto" value={fmt(f.bruto)} />
                            <FinRow label="Taxa de limpeza" value={`- ${fmt(f.limpeza)}`} />
                            <div className="border-t border-border pt-1.5">
                              <FinRow label="Valor líquido" value={fmt(f.bruto - f.limpeza)} />
                            </div>
                            <FinRow label="Comissão CW (25%)" value={`- ${fmt(f.comissao)}`} />
                            <div className="border-t border-border pt-1.5">
                              <FinRow label="Seu repasse" value={fmt(f.proprietario)} highlight />
                            </div>
                          </div>
                          {r.observacoes && (
                            <p className="text-xs text-muted-foreground italic">{r.observacoes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          </div>
        </section>
      </div>
    </PageTransition>
  );
};

/* ── Sub-components ─────────────────────────────────── */

const MetricCard: React.FC<{
  label: string;
  sub: string;
  value: string | null;
  icon: React.ReactNode;
}> = ({ label, sub, value, icon }) => (
  <div className="border border-border rounded-lg px-5 py-4 flex items-start justify-between group hover:border-primary/30 transition-colors">
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      {value === null ? (
        <div className="h-7 w-32 bg-muted animate-pulse rounded" />
      ) : (
        <p className="font-display text-2xl text-foreground">{value}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
    <span className="text-primary opacity-50 group-hover:opacity-80 transition-opacity mt-0.5">
      {icon}
    </span>
  </div>
);

const TotalItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-right">
    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">{label}</p>
    <p className="text-sm text-foreground">{value}</p>
  </div>
);

const FinRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={cn("flex justify-between", highlight ? "text-primary font-semibold" : "text-muted-foreground")}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

export default ProprietarioDashboard;
