import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface OccupancyComparisonProps {
  /** 0-indexed month */
  mes: number;
  ano: number;
  /** If provided, only count reservations for these property IDs */
  imovelIds?: string[] | null;
}

interface MonthOccupancy {
  label: string;
  occupiedDays: number;
  totalDays: number;
  rate: number;
}

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthRange(month: number, year: number) {
  let m = month;
  let y = year;
  if (m < 0) { m = 11; y -= 1; }
  if (m > 11) { m = 0; y += 1; }
  return { m, y };
}

async function fetchOccupiedDays(
  month: number,
  year: number,
  imovelIds?: string[] | null,
): Promise<number> {
  const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
  const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];
  const total = daysInMonth(month, year);

  // Fetch reservations that overlap with this month
  // A reservation overlaps if data_inicio < lastDay+1 AND data_fim > firstDay
  let query = supabase
    .from("reservas")
    .select("data_inicio, data_fim")
    .lte("data_inicio", lastDay)
    .gt("data_fim", firstDay);

  if (imovelIds && imovelIds.length > 0) {
    query = query.in("imovel_id", imovelIds);
  }

  const { data } = await query;
  if (!data || data.length === 0) return 0;

  // Count unique occupied days within the month
  const occupiedSet = new Set<string>();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  data.forEach((r) => {
    const start = new Date(r.data_inicio + "T12:00:00");
    const end = new Date(r.data_fim + "T12:00:00"); // checkout day is free

    const from = start < monthStart ? monthStart : start;
    const to = end > monthEnd ? new Date(monthEnd.getTime() + 86400000) : end;

    const current = new Date(from);
    while (current < to) {
      if (current.getMonth() === month && current.getFullYear() === year) {
        occupiedSet.add(current.toISOString().split("T")[0]);
      }
      current.setDate(current.getDate() + 1);
    }
  });

  return Math.min(occupiedSet.size, total);
}

const OccupancyComparison: React.FC<OccupancyComparisonProps> = ({
  mes,
  ano,
  imovelIds,
}) => {
  const [months, setMonths] = useState<MonthOccupancy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const prev = getMonthRange(mes - 1, ano);
      const next = getMonthRange(mes + 1, ano);

      const [prevDays, currDays, nextDays] = await Promise.all([
        fetchOccupiedDays(prev.m, prev.y, imovelIds),
        fetchOccupiedDays(mes, ano, imovelIds),
        fetchOccupiedDays(next.m, next.y, imovelIds),
      ]);

      const prevTotal = daysInMonth(prev.m, prev.y);
      const currTotal = daysInMonth(mes, ano);
      const nextTotal = daysInMonth(next.m, next.y);

      setMonths([
        {
          label: `${MESES[prev.m].slice(0, 3)}/${prev.y}`,
          occupiedDays: prevDays,
          totalDays: prevTotal,
          rate: prevTotal > 0 ? (prevDays / prevTotal) * 100 : 0,
        },
        {
          label: `${MESES[mes].slice(0, 3)}/${ano}`,
          occupiedDays: currDays,
          totalDays: currTotal,
          rate: currTotal > 0 ? (currDays / currTotal) * 100 : 0,
        },
        {
          label: `${MESES[next.m].slice(0, 3)}/${next.y}`,
          occupiedDays: nextDays,
          totalDays: nextTotal,
          rate: nextTotal > 0 ? (nextDays / nextTotal) * 100 : 0,
        },
      ]);
      setLoading(false);
    };

    load();
  }, [mes, ano, JSON.stringify(imovelIds)]);

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Taxa de Ocupação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const current = months[1];
  const prev = months[0];
  const diff = current.rate - prev.rate;

  const TrendIcon =
    diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const trendColor =
    diff > 0
      ? "text-emerald-500"
      : diff < 0
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Taxa de Ocupação
          </CardTitle>
          <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {diff > 0 ? "+" : ""}
            {diff.toFixed(1)}% vs mês anterior
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {months.map((m, i) => {
          const isCurrent = i === 1;
          return (
            <div key={m.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs tracking-wide",
                    isCurrent
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                  )}
                >
                  {m.label}
                  {isCurrent && (
                    <span className="ml-1.5 text-[10px] text-primary font-medium uppercase">
                      Atual
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    isCurrent
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                  )}
                >
                  {m.occupiedDays}/{m.totalDays} dias ({m.rate.toFixed(0)}%)
                </span>
              </div>
              <Progress
                value={m.rate}
                className={cn("h-2", isCurrent ? "[&>div]:bg-primary" : "[&>div]:bg-muted-foreground/30")}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default OccupancyComparison;
