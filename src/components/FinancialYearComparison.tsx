import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
  LabelList,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const MESES_CURTOS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtCompact = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
};

interface MonthlyData {
  mes: string;
  mesIndex: number;
  valorBruto: number;
  comissaoCW: number;
  repasseProprietario: number;
  reservas: number;
}

interface YearData {
  year: number;
  months: MonthlyData[];
  totalBruto: number;
  totalComissao: number;
  totalRepasse: number;
  totalReservas: number;
}

interface Props {
  imovelIds?: string[] | null;
  imoveis: { id: string; proprietario_id: string | null; proprietario_id_2: string | null }[];
}

const now = new Date();
const currentYear = now.getFullYear();
const availableYears = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);

const BRAND_BLUE = "#1E3A8A";
const BRAND_GOLD = "#D4AF37";

const FinancialYearComparison: React.FC<Props> = ({ imovelIds, imoveis }) => {
  const [anoBase, setAnoBase] = useState(currentYear);
  const [anoComparacao, setAnoComparacao] = useState(currentYear - 1);
  const [dataBase, setDataBase] = useState<YearData | null>(null);
  const [dataComparacao, setDataComparacao] = useState<YearData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchYearData = async (year: number): Promise<YearData> => {
    const firstDay = `${year}-01-01`;
    const lastDay = `${year}-12-31`;

    let query = supabase
      .from("reservas")
      .select("imovel_id, valor_bruto, taxa_limpeza, comissao_plataforma, valor_liquido_proprietario, data_fim")
      .gte("data_fim", firstDay)
      .lte("data_fim", lastDay);

    if (imovelIds && imovelIds.length > 0) {
      query = query.in("imovel_id", imovelIds);
    }

    const { data: reservas } = await query;

    const { data: adminConfig } = await supabase
      .from("admin_configs")
      .select("comissao_cw")
      .single();
    const adminRate = adminConfig?.comissao_cw ?? 0.25;

    const ownerIds = new Set<string>();
    imoveis.forEach((im) => {
      if (im.proprietario_id) ownerIds.add(im.proprietario_id);
      if (im.proprietario_id_2) ownerIds.add(im.proprietario_id_2);
    });

    const ownerRatesMap: Record<string, number> = {};
    if (ownerIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, comissao_percentual")
        .in("id", Array.from(ownerIds));
      (profiles || []).forEach((p: any) => {
        ownerRatesMap[p.id] = (p.comissao_percentual ?? 25) / 100;
      });
    }

    const getOwnerRate = (imovelId: string): number => {
      const im = imoveis.find((i) => i.id === imovelId);
      if (im?.proprietario_id && ownerRatesMap[im.proprietario_id] != null) {
        return ownerRatesMap[im.proprietario_id];
      }
      return adminRate;
    };

    const monthlyMap: Record<number, MonthlyData> = {};
    for (let i = 0; i < 12; i++) {
      monthlyMap[i] = {
        mes: MESES_CURTOS[i],
        mesIndex: i,
        valorBruto: 0,
        comissaoCW: 0,
        repasseProprietario: 0,
        reservas: 0,
      };
    }

    (reservas || []).forEach((r: any) => {
      const monthIdx = new Date(r.data_fim + "T12:00:00").getMonth();
      const valorBruto = r.valor_bruto || 0;
      const taxaLimpeza = r.taxa_limpeza || 0;
      const comissaoPlataforma = r.comissao_plataforma || 0;
      const valorLiquido = valorBruto - taxaLimpeza - comissaoPlataforma;
      const rate = getOwnerRate(r.imovel_id);
      const comissaoCW = valorLiquido * rate;
      const repasse = valorLiquido - comissaoCW;

      monthlyMap[monthIdx].valorBruto += valorBruto;
      monthlyMap[monthIdx].comissaoCW += comissaoCW;
      monthlyMap[monthIdx].repasseProprietario += repasse;
      monthlyMap[monthIdx].reservas += 1;
    });

    const months = Object.values(monthlyMap).sort((a, b) => a.mesIndex - b.mesIndex);

    return {
      year,
      months,
      totalBruto: months.reduce((s, m) => s + m.valorBruto, 0),
      totalComissao: months.reduce((s, m) => s + m.comissaoCW, 0),
      totalRepasse: months.reduce((s, m) => s + m.repasseProprietario, 0),
      totalReservas: months.reduce((s, m) => s + m.reservas, 0),
    };
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [base, comp] = await Promise.all([
        fetchYearData(anoBase),
        fetchYearData(anoComparacao),
      ]);
      setDataBase(base);
      setDataComparacao(comp);
      setLoading(false);
    };
    load();
  }, [anoBase, anoComparacao, imovelIds, imoveis]);

  if (loading || !dataBase || !dataComparacao) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-display text-xl text-foreground tracking-wide">
            Comparativo Financeiro Anual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const sameYear = anoBase === anoComparacao;

  // --- Chart 1 & 2: Single year data ---
  const singleYearData = dataBase.months.map((m) => ({
    mes: m.mes,
    valor: m.valorBruto,
    reservas: m.reservas,
  }));

  // --- Chart 3 & 4: Comparison data with year-over-year evolution line ---
  const comparisonData = dataBase.months.map((m, i) => {
    const compVal = dataComparacao.months[i].valorBruto;
    const compRes = dataComparacao.months[i].reservas;

    return {
      mes: m.mes,
      [`valor_${anoBase}`]: m.valorBruto,
      ...(sameYear ? {} : { [`valor_${anoComparacao}`]: compVal }),
      [`reservas_${anoBase}`]: m.reservas,
      ...(sameYear ? {} : { [`reservas_${anoComparacao}`]: compRes }),
    };
  });

  // Summary
  const variacao = (atual: number, anterior: number) => {
    if (anterior === 0) return atual > 0 ? 100 : 0;
    return ((atual - anterior) / anterior) * 100;
  };
  const varBruto = variacao(dataBase.totalBruto, dataComparacao.totalBruto);
  const varComissao = variacao(dataBase.totalComissao, dataComparacao.totalComissao);
  const varRepasse = variacao(dataBase.totalRepasse, dataComparacao.totalRepasse);

  const TrendIcon = ({ val }: { val: number }) =>
    val > 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> :
    val < 0 ? <TrendingDown className="h-3.5 w-3.5 text-red-500" /> :
    <Minus className="h-3.5 w-3.5 text-muted-foreground" />;

  const summaryCards = [
    { label: "Receita Bruta", base: dataBase.totalBruto, comp: dataComparacao.totalBruto, var: varBruto },
    { label: "Comissão CW", base: dataBase.totalComissao, comp: dataComparacao.totalComissao, var: varComissao },
    { label: "Repasse", base: dataBase.totalRepasse, comp: dataComparacao.totalRepasse, var: varRepasse },
  ];

  const singleConfig = {
    valor: { label: "Valor (R$)", color: BRAND_BLUE },
    reservas: { label: "Reservas", color: BRAND_BLUE },
  };

  const compConfig = {
    [`valor_${anoBase}`]: { label: `${anoBase}`, color: BRAND_BLUE },
    ...(sameYear ? {} : { [`valor_${anoComparacao}`]: { label: `${anoComparacao}`, color: BRAND_GOLD } }),
    [`reservas_${anoBase}`]: { label: `${anoBase}`, color: BRAND_BLUE },
    ...(sameYear ? {} : { [`reservas_${anoComparacao}`]: { label: `${anoComparacao}`, color: BRAND_GOLD } }),
    evolValor: { label: "Evolução %", color: EVOLUTION_COLOR },
    evolReservas: { label: "Evolução %", color: EVOLUTION_COLOR },
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle className="font-display text-xl text-foreground tracking-wide">
          Comparativo Financeiro Anual
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={String(anoBase)} onValueChange={(v) => setAnoBase(Number(v))}>
            <SelectTrigger className="w-[90px] h-8 text-sm bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm">vs</span>
          <Select value={String(anoComparacao)} onValueChange={(v) => setAnoComparacao(Number(v))}>
            <SelectTrigger className="w-[90px] h-8 text-sm bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {summaryCards.map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-3 bg-background">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{s.label}</p>
              <p className="text-lg font-display text-foreground">{fmt(s.base)}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendIcon val={s.var} />
                <span className={`text-xs font-medium ${s.var > 0 ? "text-emerald-500" : s.var < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                  {s.var > 0 ? "+" : ""}{s.var.toFixed(1)}% vs {anoComparacao}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{anoComparacao}: {fmt(s.comp)}</p>
            </div>
          ))}
        </div>

        {/* Gráfico 1: Valor Financeiro Mensal (ano base) */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Valor Financeiro Mensal — {anoBase}
          </h3>
          <ChartContainer config={singleConfig} className="h-[280px] w-full">
            <BarChart data={singleYearData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `R$ ${fmtCompact(v)}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={60} />
              <Tooltip
                formatter={(value: number) => [fmt(value), "Valor"]}
                contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
              />
              <Bar dataKey="valor" name="Valor (R$)" fill={BRAND_BLUE} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="valor" position="top" formatter={(v: number) => fmtCompact(v)} style={{ fill: "hsl(var(--foreground))", fontSize: 10, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        {/* Gráfico 2: Quantidade de Reservas Mensal (ano base) */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Quantidade de Reservas Mensal — {anoBase}
          </h3>
          <ChartContainer config={singleConfig} className="h-[280px] w-full">
            <BarChart data={singleYearData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={30} />
              <Tooltip
                formatter={(value: number) => [value, "Reservas"]}
                contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
              />
              <Bar dataKey="reservas" name="Reservas" fill={BRAND_BLUE} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="reservas" position="top" style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        {/* Gráfico 3: Comparativo Anual de Valor */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Comparativo de Valor Financeiro — {anoBase} vs {anoComparacao}
          </h3>
          <ChartContainer config={compConfig} className="h-[320px] w-full">
            <BarChart data={comparisonData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `R$ ${fmtCompact(v)}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={60} />
              <Tooltip
                formatter={(value: number) => [fmt(value), "Valor"]}
                contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
              />
              <Legend />
              <Bar dataKey={`valor_${anoBase}`} name={String(anoBase)} fill={BRAND_BLUE} radius={[4, 4, 0, 0]}>
                <LabelList dataKey={`valor_${anoBase}`} position="top" formatter={(v: number) => fmtCompact(v)} style={{ fill: "hsl(var(--foreground))", fontSize: 10, fontWeight: 600 }} />
              </Bar>
              {!sameYear && (
                <Bar dataKey={`valor_${anoComparacao}`} name={String(anoComparacao)} fill={BRAND_GOLD} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey={`valor_${anoComparacao}`} position="top" formatter={(v: number) => fmtCompact(v)} style={{ fill: BRAND_GOLD, fontSize: 10, fontWeight: 600 }} />
                </Bar>
              )}
            </BarChart>
          </ChartContainer>
        </div>

        {/* Gráfico 4: Comparativo Anual de Reservas */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Comparativo de Reservas — {anoBase} vs {anoComparacao}
          </h3>
          <ChartContainer config={compConfig} className="h-[320px] w-full">
            <BarChart data={comparisonData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={30} />
              <Tooltip
                formatter={(value: number) => [value, "Reservas"]}
                contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
              />
              <Legend />
              <Bar dataKey={`reservas_${anoBase}`} name={String(anoBase)} fill={BRAND_BLUE} radius={[4, 4, 0, 0]}>
                <LabelList dataKey={`reservas_${anoBase}`} position="top" style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }} />
              </Bar>
              {!sameYear && (
                <Bar dataKey={`reservas_${anoComparacao}`} name={String(anoComparacao)} fill={BRAND_GOLD} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey={`reservas_${anoComparacao}`} position="top" style={{ fill: BRAND_GOLD, fontSize: 11, fontWeight: 600 }} />
                </Bar>
              )}
            </BarChart>
          </ChartContainer>
        </div>

        {/* Monthly detail table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted-foreground uppercase tracking-widest py-2 pr-3">Mês</th>
                <th className="text-right text-xs text-muted-foreground uppercase tracking-widest py-2 px-2">Bruto {anoBase}</th>
                <th className="text-right text-xs text-muted-foreground uppercase tracking-widest py-2 px-2">Bruto {anoComparacao}</th>
                <th className="text-right text-xs text-muted-foreground uppercase tracking-widest py-2 px-2">Δ%</th>
              </tr>
            </thead>
            <tbody>
              {dataBase.months.map((m, i) => {
                const compVal = dataComparacao.months[i].valorBruto;
                const delta = compVal === 0 ? (m.valorBruto > 0 ? 100 : 0) : ((m.valorBruto - compVal) / compVal) * 100;
                return (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2 pr-3 text-foreground font-medium">{MESES[i]}</td>
                    <td className="py-2 px-2 text-right text-foreground">{fmt(m.valorBruto)}</td>
                    <td className="py-2 px-2 text-right text-muted-foreground">{fmt(compVal)}</td>
                    <td className={`py-2 px-2 text-right font-medium ${delta > 0 ? "text-emerald-500" : delta < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-primary/30 font-semibold">
                <td className="py-2 pr-3 text-foreground">Total</td>
                <td className="py-2 px-2 text-right text-foreground">{fmt(dataBase.totalBruto)}</td>
                <td className="py-2 px-2 text-right text-muted-foreground">{fmt(dataComparacao.totalBruto)}</td>
                <td className={`py-2 px-2 text-right ${varBruto > 0 ? "text-emerald-500" : varBruto < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                  {varBruto > 0 ? "+" : ""}{varBruto.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinancialYearComparison;
