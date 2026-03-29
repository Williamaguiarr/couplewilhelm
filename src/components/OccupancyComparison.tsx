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
import { CalendarDays, TrendingUp, TrendingDown, Info, DollarSign, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

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
}

const DAY_MS = 86400000;

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

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

async function fetchMonthData(
  month: number,
  year: number,
  imovelIds?: string[] | null,
): Promise<MonthData> {
  const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
  const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];
  const total = daysInMonth(month, year);

  let query = supabase
    .from("reservas")
    .select("data_inicio, data_fim, valor_bruto, taxa_limpeza")
    .lte("data_inicio", lastDay)
    .gt("data_fim", firstDay);

  if (imovelIds && imovelIds.length > 0) {
    query = query.in("imovel_id", imovelIds);
  }

  const { data } = await query;

  let receita = 0;
  let reservationCount = 0;
  const occupiedSet = new Set<string>();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  if (data && data.length > 0) {
    reservationCount = data.length;
    data.forEach((r) => {
      const start = new Date(r.data_inicio + "T12:00:00");
      const end = new Date(r.data_fim + "T12:00:00");

      // Calculate total nights of this reservation
      const totalNights = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));

      // Calculate nights that fall within this month
      const from = start < monthStart ? monthStart : start;
      const to = end > new Date(monthEnd.getTime() + 86400000) ? new Date(monthEnd.getTime() + 86400000) : end;
      const current = new Date(from);
      let nightsInMonth = 0;
      while (current < to) {
        if (current.getMonth() === month && current.getFullYear() === year) {
          occupiedSet.add(current.toISOString().split("T")[0]);
          nightsInMonth++;
        }
        current.setDate(current.getDate() + 1);
      }

      // Prorate revenue proportionally to nights in this month
      const valorBruto = Number(r.valor_bruto) || 0;
      receita += (nightsInMonth / totalNights) * valorBruto;
    });
  }

  const occupiedDays = Math.min(occupiedSet.size, total);
  const occupancyRate = total > 0 ? (occupiedDays / total) * 100 : 0;
  const avgDailyRate = occupiedDays > 0 ? receita / occupiedDays : 0;

  return {
    month,
    year,
    label: `${MESES_CURTOS[month]} ${year}`,
    receita,
    occupiedDays,
    totalDays: total,
    occupancyRate,
    avgDailyRate,
    reservationCount,
  };
}

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
  const isZero = diff === 0;

  if (isZero) return <span className="text-muted-foreground">-</span>;

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

type PeriodFilter = "ytd" | "last_year" | "last3_next9" | "last12" | "next12";

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

      // Fetch current year, prior year, and next year to support all filters
      const years = [ano - 1, ano, ano + 1];
      const allPromises: Promise<MonthData>[] = [];
      for (const y of years) {
        for (let m = 0; m < 12; m++) {
          allPromises.push(fetchMonthData(m, y, imovelIds));
        }
      }

      const allResults = await Promise.all(allPromises);

      // Group by year
      const priorYear = allResults.slice(0, 12);
      const currentYearData = allResults.slice(12, 24);
      const nextYearData = allResults.slice(24, 36);

      // Enrich current year with prior for YoY comparison
      const enriched = currentYearData.map((m, i) => ({
        ...m,
        _prior: priorYear[i],
      }));

      // Store all data for flexible filtering
      const allEnriched = {
        prior: priorYear.map((m, i) => ({ ...m, _prior: priorYear[i] })),
        current: enriched,
        next: nextYearData.map((m, i) => ({ ...m, _prior: currentYearData[i] })),
      };

      setAllData(allEnriched as any);
      setMonthsData(enriched as any);
      setLoading(false);
    };

    load();
  }, [ano, JSON.stringify(imovelIds)]);

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Indicadores de Desempenho
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter months based on period
  let filteredMonths: any[];
  if (period === "ytd") {
    filteredMonths = monthsData.filter((m) => {
      if (ano === currentYear) return m.month <= currentMonth;
      return true;
    });
  } else if (period === "last_year") {
    filteredMonths = allData.prior;
  } else if (period === "last3_next9") {
    // Last 3 months + next 9 months from current month
    const result: any[] = [];
    for (let i = -3; i < 9; i++) {
      let targetMonth = currentMonth + i;
      let targetYear = currentYear;
      if (targetMonth < 0) { targetMonth += 12; targetYear--; }
      if (targetMonth > 11) { targetMonth -= 12; targetYear++; }
      
      let source: any[];
      if (targetYear === ano - 1) source = allData.prior;
      else if (targetYear === ano) source = monthsData;
      else if (targetYear === ano + 1) source = allData.next;
      else continue;
      
      const found = source.find((m: any) => m.month === targetMonth && m.year === targetYear);
      if (found) result.push(found);
    }
    filteredMonths = result;
  } else if (period === "last12") {
    // Last 12 months from current month
    const result: any[] = [];
    for (let i = -11; i <= 0; i++) {
      let targetMonth = currentMonth + i;
      let targetYear = currentYear;
      while (targetMonth < 0) { targetMonth += 12; targetYear--; }
      
      let source: any[];
      if (targetYear === ano - 1) source = allData.prior;
      else if (targetYear === ano) source = monthsData;
      else continue;
      
      const found = source.find((m: any) => m.month === targetMonth && m.year === targetYear);
      if (found) result.push(found);
    }
    filteredMonths = result;
  } else {
    // next12
    const result: any[] = [];
    for (let i = 1; i <= 12; i++) {
      let targetMonth = currentMonth + i;
      let targetYear = currentYear;
      while (targetMonth > 11) { targetMonth -= 12; targetYear++; }
      
      let source: any[];
      if (targetYear === ano) source = monthsData;
      else if (targetYear === ano + 1) source = allData.next;
      else continue;
      
      const found = source.find((m: any) => m.month === targetMonth && m.year === targetYear);
      if (found) result.push(found);
    }
    filteredMonths = result;
  }

  // Calculate KPIs
  const totalReceita = filteredMonths.reduce((s, m) => s + (Number(m.receita) || 0), 0);
  const totalOccupiedDays = filteredMonths.reduce((s, m) => s + (Number(m.occupiedDays) || 0), 0);
  const totalDays = filteredMonths.reduce((s, m) => s + (Number(m.totalDays) || 0), 0);
  const avgOccupancy = totalDays > 0 ? (totalOccupiedDays / totalDays) * 100 : 0;
  const avgDailyRate = totalOccupiedDays > 0 ? totalReceita / totalOccupiedDays : 0;

  // Prior year KPIs for same period
  const priorMonths = filteredMonths.map((m: any) => m._prior as MonthData).filter(Boolean);
  const priorReceita = priorMonths.reduce((s, m) => s + (Number(m?.receita) || 0), 0);
  const priorOccupiedDays = priorMonths.reduce((s, m) => s + (Number(m?.occupiedDays) || 0), 0);
  const priorTotalDays = priorMonths.reduce((s, m) => s + (Number(m?.totalDays) || 0), 0);
  const priorAvgOccupancy = priorTotalDays > 0 ? (priorOccupiedDays / priorTotalDays) * 100 : 0;
  const priorAvgDailyRate = priorOccupiedDays > 0 ? priorReceita / priorOccupiedDays : 0;

  const periodLabels: Record<PeriodFilter, string> = {
    ytd: `${ano} até hoje`,
    last_year: `${ano - 1} completo`,
    last3_next9: "Últimos 3 e próximos 9 meses",
    last12: "Últimos 12 meses",
    next12: "Próximos 12 meses",
  };
  const periodLabel = periodLabels[period];

  return (
    <div className="space-y-4">
      {/* KPI Header */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              KPIs (Indicadores-chave de desempenho) - {periodLabel}
            </CardTitle>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ytd">Este ano</SelectItem>
                <SelectItem value="last_year">Ano passado</SelectItem>
                <SelectItem value="last3_next9">Últimos 3 e próximos 9 meses</SelectItem>
                <SelectItem value="last12">Últimos 12 meses</SelectItem>
                <SelectItem value="next12">Próximos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Receita */}
            <div className="border border-border rounded-lg p-4 space-y-1">
              <p className="font-display text-2xl text-foreground font-bold">
                {fmtCompact(totalReceita)} BRL
              </p>
              <ChangeIndicator current={totalReceita} previous={priorReceita} format="currency" />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                Receita <InfoIcon tooltip="Total de receita bruta no período selecionado" />
              </p>
            </div>

            {/* Ocupação */}
            <div className="border border-border rounded-lg p-4 space-y-1">
              <p className="font-display text-2xl text-foreground font-bold">
                {avgOccupancy.toFixed(0)}%
              </p>
              <ChangeIndicator current={avgOccupancy} previous={priorAvgOccupancy} format="percent" />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                Ocupação <InfoIcon tooltip="Percentual de dias ocupados no período" />
              </p>
            </div>

            {/* Preço médio da diária */}
            <div className="border border-border rounded-lg p-4 space-y-1">
              <p className="font-display text-2xl text-foreground font-bold">
                {fmtCurrency(avgDailyRate)} BRL
              </p>
              <ChangeIndicator current={avgDailyRate} previous={priorAvgDailyRate} format="currency" />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                Preço médio da diária <InfoIcon tooltip="Receita dividida pelo total de dias ocupados" />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Tendências mensais de desempenho
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground text-xs font-medium">Mês</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    <span className="flex items-center justify-end gap-1">
                      Receita <InfoIcon tooltip="Valor bruto das reservas" />
                    </span>
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    <span className="flex items-center justify-end gap-1">
                      Ocupação <InfoIcon tooltip="Percentual de dias ocupados no mês" />
                    </span>
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    <span className="flex items-center justify-end gap-1">
                      Preço médio da diária <InfoIcon tooltip="Receita / dias ocupados" />
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMonths.map((m: any, idx: number) => {
                  const prior = (m._prior as MonthData) || { receita: 0, occupancyRate: 0, avgDailyRate: 0, occupiedDays: 0, totalDays: 0, reservationCount: 0 };
                  const isCurrent = m.month === currentMonth && m.year === currentYear;

                  return (
                    <TableRow key={`${m.year}-${m.month}`} className="border-border hover:bg-muted/30">
                      <TableCell className="text-sm text-foreground font-medium">
                        <span className="flex items-center gap-2">
                          {m.label}
                          {isCurrent && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary font-medium">
                              Atual
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-sm text-foreground tabular-nums">
                            {(m.receita || 0) > 0 ? fmtCompact(m.receita) : "-"}
                          </span>
                          <div className="w-16 text-right">
                            <ChangeIndicator current={m.receita || 0} previous={prior.receita || 0} format="currency" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-sm text-foreground tabular-nums">
                            {(m.occupancyRate || 0).toFixed(0)}%
                          </span>
                          <div className="w-16 text-right">
                            <ChangeIndicator current={m.occupancyRate || 0} previous={prior.occupancyRate || 0} format="percent" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-sm text-foreground tabular-nums">
                            {(m.avgDailyRate || 0) > 0 ? fmtCurrency(m.avgDailyRate) : "-"}
                          </span>
                          <div className="w-16 text-right">
                            <ChangeIndicator current={m.avgDailyRate || 0} previous={prior.avgDailyRate || 0} format="currency" />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OccupancyComparison;
