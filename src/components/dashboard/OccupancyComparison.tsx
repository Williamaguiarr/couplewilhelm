import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, TrendingUp, TrendingDown, Info, BarChart3, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeOccupancy } from "@/lib/occupancy";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MESES_CURTOS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

interface OccupancyComparisonProps {
  mes: number;
  ano: number;
  imovelIds?: string[] | null;
  onlyAudited?: boolean;
}

interface ImovelBreakdown {
  id: string;
  nome: string;
  noites: number;
  totalDias: number;
  taxa: number;
}

interface MonthData {
  month: number;
  year: number;
  label: string;
  receita: number;
  occupiedDays: number;
  totalDays: number;
  occupancyRate: number;
  avgDailyRate: number;
  reservationCount: number;
  breakdown: ImovelBreakdown[];
}

const DAY_MS = 86400000;

function atNoon(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 12, 0, 0, 0);
}

function fmtCompact(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(2)}K`;
  return v.toFixed(2);
}

function fmtCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function processMonthData(
  month: number,
  year: number,
  reservas: any[],
  imoveisMap: Map<string, string>,
  ganhosAvulsos: any[],
  imovelIds?: string[] | null,
): MonthData {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayStr = firstDay.toISOString().split("T")[0];
  const lastDayStr = lastDay.toISOString().split("T")[0];

  const reservasNoMes = reservas.filter(r => 
    r.data_inicio <= lastDayStr && r.data_fim > firstDayStr
  );

  const ganhosNoMes = ganhosAvulsos.filter(g => 
    g.data >= firstDayStr && g.data <= lastDayStr
  );

  const periodStart = atNoon(year, month, 1);
  const periodEnd = atNoon(year, month + 1, 1);
  const scopeIds = imovelIds && imovelIds.length > 0 ? imovelIds : Array.from(imoveisMap.keys());
  
  const occ = computeOccupancy(
    reservasNoMes.map((r: any) => ({
      imovel_id: r.imovel_id,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim,
      validada_financeiramente: r.validada_financeiramente,
    })),
    scopeIds,
    periodStart,
    periodEnd,
    true
  );

  const daysInMonthCount = Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS);
  const breakdown: ImovelBreakdown[] = scopeIds.map(id => {
    const set = occ.occupiedByImovel.get(id);
    const nights = set?.size ?? 0;
    return {
      id,
      nome: imoveisMap.get(id) || "Desconhecido",
      noites: nights,
      totalDias: daysInMonthCount,
      taxa: daysInMonthCount > 0 ? (nights / daysInMonthCount) * 100 : 0
    };
  }).sort((a, b) => b.taxa - a.taxa);

  let receita = 0;
  let reservationCount = 0;
  
  reservasNoMes.forEach((r: any) => {
    if (r.validada_financeiramente !== true) return;
    if (imovelIds && imovelIds.length > 0 && !imovelIds.includes(r.imovel_id)) return;
    
    const [y2, m2, d2] = r.data_fim.split("-").map(Number);
    const checkoutDate = new Date(y2, m2 - 1, d2);
    if (checkoutDate.getMonth() !== month || checkoutDate.getFullYear() !== year) return;
    
    reservationCount += 1;
    receita += Number(r.valor_bruto) || 0;
    (r.ganhos_extras || []).forEach((g: any) => {
      const regime = g.regime_comissao || (g.aplicar_comissao ? "com_comissao" : "sem_comissao");
      if (regime !== "exclusivo_adm") receita += Number(g.valor) || 0;
    });
  });

  ganhosNoMes.forEach((g: any) => {
    const regime = g.regime_comissao || (g.aplicar_comissao ? "com_comissao" : "sem_comissao");
    if (regime !== "exclusivo_adm") receita += Number(g.valor) || 0;
  });

  return {
    month,
    year,
    label: `${MESES_CURTOS[month]} ${year}`,
    receita,
    occupiedDays: occ.occupiedNights,
    totalDays: occ.capacity,
    occupancyRate: occ.occupancyRate,
    avgDailyRate: occ.occupiedNights > 0 ? receita / occ.occupiedNights : 0,
    reservationCount,
    breakdown
  };
}

const OccupancyAuditDialog: React.FC<{ monthData: MonthData }> = ({ monthData }) => (
  <Dialog>
    <DialogTrigger asChild>
      <button className="flex items-center gap-1.5 text-[10px] text-primary hover:underline font-medium mt-1">
        <ClipboardCheck className="h-3 w-3" /> Ver auditoria por imóvel
      </button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[500px] bg-card border-border">
      <DialogHeader>
        <DialogTitle className="text-base font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Auditoria de Ocupação - {monthData.label}
        </DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border">
                <TableHead className="text-[10px] uppercase font-bold text-muted-foreground">Imóvel</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-muted-foreground text-center">Noites</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-muted-foreground text-right">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthData.breakdown.map((item) => (
                <TableRow key={item.id} className="border-border hover:bg-muted/10 transition-colors">
                  <TableCell className="text-sm font-medium py-2.5">{item.nome}</TableCell>
                  <TableCell className="text-sm text-center py-2.5 tabular-nums">{item.noites} / {item.totalDias}</TableCell>
                  <TableCell className="text-sm text-right py-2.5 font-semibold text-foreground">{item.taxa.toFixed(0)}%</TableCell>
                </TableRow>
              ))}

              {monthData.breakdown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm italic">
                    Nenhum imóvel encontrado no filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-4 text-[10px] text-muted-foreground leading-relaxed italic">
          * A auditoria considera apenas reservas financeiramente validadas conforme o requisito do dashboard.
        </p>
      </div>
    </DialogContent>
  </Dialog>
);

const InfoIcon: React.FC<{ tooltip: string }> = ({ tooltip }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs max-w-[200px]">
      {tooltip}
    </TooltipContent>
  </Tooltip>
);

const ChangeIndicator: React.FC<{ current: number; previous: number; format?: "currency" | "percent" | "number" }> = ({ current, previous, format = "number" }) => {
  if (previous === 0 && current === 0) return <span className="text-muted-foreground">-</span>;
  const diff = current - previous;
  const isPositive = diff > 0;
  if (diff === 0) return <span className="text-muted-foreground">-</span>;

  let display: string;
  if (format === "percent") {
    display = `${Math.abs(diff).toFixed(0)}%`;
  } else if (format === "currency") {
    display = fmtCompact(Math.abs(diff));
  } else {
    display = Math.abs(diff).toFixed(0);
  }

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", isPositive ? "text-primary" : "text-destructive")}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {display}
    </span>
  );
};

type PeriodFilter = "current_month" | "ytd" | "last_year" | "last3_next9" | "last12" | "next12";

const OccupancyComparison: React.FC<OccupancyComparisonProps> = ({
  mes,
  ano,
  imovelIds,
}) => {
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [allData, setAllData] = useState<{ prior: any[]; current: any[]; next: any[] }>({ prior: [], current: [], next: [] });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("ytd");

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const baseYear = ano === -1 ? currentYear : ano;
      const startYear = baseYear - 1;
      const endYear = baseYear + 1;
      const firstDayTotal = `${startYear}-01-01`;
      const lastDayTotal = `${endYear}-12-31`;

      const [{ data: allReservas }, { data: imoveisData }, { data: allGanhosAvulsos }] = await Promise.all([
        supabase.from("reservas").select("data_inicio, data_fim, valor_bruto, taxa_limpeza, imovel_id, validada_financeiramente, ganhos_extras(valor, regime_comissao, aplicar_comissao)").lte("data_inicio", lastDayTotal).gt("data_fim", firstDayTotal),
        supabase.from("imoveis").select("id, nome_imovel"),
        supabase.from("ganhos_extras").select("valor, regime_comissao, aplicar_comissao, imovel_id, data").is("reserva_id", null).gte("data", firstDayTotal).lte("data", lastDayTotal)
      ]);

      const imoveisMap = new Map((imoveisData || []).map(i => [i.id, i.nome_imovel]));
      const years = [startYear, baseYear, endYear];
      const allResults: MonthData[] = [];
      for (const y of years) {
        for (let m = 0; m < 12; m++) {
          allResults.push(processMonthData(m, y, allReservas || [], imoveisMap, allGanhosAvulsos || [], imovelIds));
        }
      }

      const priorYear = allResults.slice(0, 12);
      const currentYearData = allResults.slice(12, 24);
      const nextYearData = allResults.slice(24, 36);

      setAllData({
        prior: priorYear,
        current: currentYearData.map((m, i) => ({ ...m, _prior: priorYear[i] })),
        next: nextYearData.map((m, i) => ({ ...m, _prior: currentYearData[i] })),
      });
      setMonthsData(currentYearData.map((m, i) => ({ ...m, _prior: priorYear[i] })));
      setLoading(false);
    };
    load();
  }, [ano, imovelIds?.join(",")]);

  const filteredMonths = React.useMemo(() => {
    if (loading || monthsData.length === 0) return [];
    if (period === "current_month") {
      const source = currentYear === ano ? monthsData : (currentYear === ano - 1 ? allData.prior : allData.next);
      const found = source?.find((m: any) => m.month === currentMonth && m.year === currentYear);
      return found ? [found] : [];
    }
    if (period === "ytd") return monthsData.filter((m) => ano === currentYear ? m.month <= currentMonth : true);
    if (period === "last_year") return allData.prior || [];
    if (period === "last3_next9") {
      const res: any[] = [];
      for (let i = -3; i < 9; i++) {
        let tm = currentMonth + i; let ty = currentYear;
        if (tm < 0) { tm += 12; ty--; } else if (tm > 11) { tm -= 12; ty++; }
        const s = ty === ano - 1 ? allData.prior : (ty === ano ? monthsData : allData.next);
        const f = s?.find((m: any) => m.month === tm && m.year === ty);
        if (f) res.push(f);
      }
      return res;
    }
    if (period === "last12") {
      const res: any[] = [];
      for (let i = -11; i <= 0; i++) {
        let tm = currentMonth + i; let ty = currentYear;
        while (tm < 0) { tm += 12; ty--; }
        const s = ty === ano - 1 ? allData.prior : monthsData;
        const f = s?.find((m: any) => m.month === tm && m.year === ty);
        if (f) res.push(f);
      }
      return res;
    }
    const res: any[] = [];
    for (let i = 1; i <= 12; i++) {
      let tm = currentMonth + i; let ty = currentYear;
      while (tm > 11) { tm -= 12; ty++; }
      const s = ty === ano ? monthsData : allData.next;
      const f = s?.find((m: any) => m.month === tm && m.year === ty);
      if (f) res.push(f);
    }
    return res;
  }, [period, loading, monthsData, allData, ano, currentMonth, currentYear]);

  const kpis = React.useMemo(() => {
    if (filteredMonths.length === 0) return { totalReceita: 0, totalOccupiedDays: 0, totalDays: 0, avgOccupancy: 0, avgDailyRate: 0, priorReceita: 0, priorOccupiedDays: 0, priorTotalDays: 0, priorAvgOccupancy: 0, priorAvgDailyRate: 0 };
    const tr = filteredMonths.reduce((s, m) => s + (Number(m.receita) || 0), 0);
    const tod = filteredMonths.reduce((s, m) => s + (Number(m.occupiedDays) || 0), 0);
    const td = filteredMonths.reduce((s, m) => s + (Number(m.totalDays) || 0), 0);
    const pm = filteredMonths.map((m: any) => m._prior).filter(Boolean);
    const ptr = pm.reduce((s, m) => s + (Number(m.receita) || 0), 0);
    const ptod = pm.reduce((s, m) => s + (Number(m.occupiedDays) || 0), 0);
    const ptd = pm.reduce((s, m) => s + (Number(m.totalDays) || 0), 0);
    return {
      totalReceita: tr, avgOccupancy: td > 0 ? (tod / td) * 100 : 0, avgDailyRate: tod > 0 ? tr / tod : 0,
      priorReceita: ptr, priorAvgOccupancy: ptd > 0 ? (ptod / ptd) * 100 : 0, priorAvgDailyRate: ptod > 0 ? ptr / ptod : 0
    };
  }, [filteredMonths]);

  if (loading || monthsData.length === 0) {
    return (
      <Card className="bg-card border-border"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Indicadores de Desempenho</CardTitle></CardHeader>
      <CardContent><div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}</div></CardContent></Card>
    );
  }

  const periodLabels: Record<PeriodFilter, string> = {
    current_month: `${MESES[currentMonth]} ${currentYear}`,
    ytd: ano === -1 ? "Este ano até hoje" : `${ano} até hoje`,
    last_year: ano === -1 ? "Ano passado completo" : `${ano - 1} completo`,
    last3_next9: "Últimos 3 e próximos 9 meses",
    last12: "Últimos 12 meses",
    next12: "Próximos 12 meses",
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />KPIs - {periodLabels[period]}</CardTitle>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
              <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="current_month">Mês atual</SelectItem><SelectItem value="ytd">Este ano</SelectItem><SelectItem value="last_year">Ano passado</SelectItem><SelectItem value="last3_next9">Últimos 3 e próximos 9</SelectItem><SelectItem value="last12">Últimos 12 meses</SelectItem><SelectItem value="next12">Próximos 12 meses</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-border rounded-xl p-4 bg-background/50 space-y-2">
              <p className="text-xs text-muted-foreground uppercase font-medium">Receita</p>
              <p className="font-display text-2xl font-semibold">R$ {fmtCompact(kpis.totalReceita)}</p>
              <div className="flex items-center gap-1.5"><ChangeIndicator current={kpis.totalReceita} previous={kpis.priorReceita} format="currency" /><span className="text-[10px] text-muted-foreground/50 font-medium">vs ano anterior</span></div>
            </div>
            <div className="border border-border rounded-xl p-4 bg-background/50 space-y-2">
              <p className="text-xs text-muted-foreground uppercase font-medium">Ocupação</p>
              <p className="font-display text-2xl font-semibold">{kpis.avgOccupancy.toFixed(0)}%</p>
              <div className="flex flex-col gap-1.5"><div className="flex items-center gap-1.5"><ChangeIndicator current={kpis.avgOccupancy} previous={kpis.priorAvgOccupancy} format="percent" /><span className="text-[10px] text-muted-foreground/50 font-medium">vs ano anterior</span></div>{period === "current_month" && filteredMonths[0] && <OccupancyAuditDialog monthData={filteredMonths[0]} />}</div>
            </div>
            <div className="border border-border rounded-xl p-4 bg-background/50 space-y-2">
              <p className="text-xs text-muted-foreground uppercase font-medium">Diária média</p>
              <p className="font-display text-2xl font-semibold">R$ {fmtCurrency(kpis.avgDailyRate)}</p>
              <div className="flex items-center gap-1.5"><ChangeIndicator current={kpis.avgDailyRate} previous={kpis.priorAvgDailyRate} format="currency" /><span className="text-[10px] text-muted-foreground/50 font-medium">vs ano anterior</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />Tendências mensais</CardTitle></CardHeader>
        <CardContent><div className="overflow-x-auto"><Table className="min-w-[600px]"><TableHeader><TableRow className="border-border"><TableHead className="text-muted-foreground text-xs font-medium">Mês</TableHead><TableHead className="text-muted-foreground text-xs font-medium text-right">Receita</TableHead><TableHead className="text-muted-foreground text-xs font-medium text-right">Ocupação</TableHead><TableHead className="text-muted-foreground text-xs font-medium text-right">Preço médio</TableHead></TableRow></TableHeader>
          <TableBody>{filteredMonths.map((m: any) => { const p = m._prior || { receita: 0, occupancyRate: 0, avgDailyRate: 0 }; const isC = m.month === currentMonth && m.year === currentYear; return (<TableRow key={`${m.year}-${m.month}`} className="border-border hover:bg-muted/30"><TableCell className="text-sm text-foreground font-medium"><span className="flex items-center gap-2">{m.label}{isC && <Badge variant="outline" className="text-[10px] text-primary">Atual</Badge>}</span></TableCell><TableCell className="text-right"><div className="flex items-center justify-end gap-3"><span>{m.receita > 0 ? fmtCompact(m.receita) : "-"}</span><div className="w-16"><ChangeIndicator current={m.receita} previous={p.receita} format="currency" /></div></div></TableCell><TableCell className="text-right"><div className="flex items-center justify-end gap-3"><div className="flex flex-col items-end"><span>{m.occupancyRate.toFixed(0)}%</span><OccupancyAuditDialog monthData={m} /></div><div className="w-16"><ChangeIndicator current={m.occupancyRate} previous={p.occupancyRate} format="percent" /></div></div></TableCell><TableCell className="text-right"><div className="flex items-center justify-end gap-3"><span>{m.avgDailyRate > 0 ? fmtCurrency(m.avgDailyRate) : "-"}</span><div className="w-16"><ChangeIndicator current={m.avgDailyRate} previous={p.avgDailyRate} format="currency" /></div></div></TableCell></TableRow>); })}</TableBody></Table></div></CardContent></Card>
    </div>
  );
};

export default OccupancyComparison;
