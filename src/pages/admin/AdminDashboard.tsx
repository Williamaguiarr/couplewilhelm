import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, CalendarDays, TrendingUp, DollarSign, Percent, UserCheck } from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalProprietarios: 0,
    totalImoveis: 0,
    totalReservas: 0,
    receitaMes: 0,
  });
  const [financeiro, setFinanceiro] = useState({
    valorBruto: 0,
    taxaLimpeza: 0,
    valorLiquido: 0,
    comissaoCW: 0,
    valorProprietario: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];

      const [
        { count: propCount },
        { count: imovelCount },
        { count: reservaCount },
        { data: reservasMes },
        { data: reservasDetalhadas },
      ] = await Promise.all([
        supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "proprietario"),
        supabase.from("imoveis").select("*", { count: "exact", head: true }),
        supabase.from("reservas").select("*", { count: "exact", head: true }),
        supabase
          .from("reservas")
          .select("valor_liquido_proprietario")
          .gte("data_fim", firstDay)
          .lte("data_fim", lastDay),
        supabase
          .from("reservas")
          .select("valor_bruto, taxa_limpeza")
          .gte("data_fim", firstDay)
          .lte("data_fim", lastDay),
      ]);

      const receitaMes = (reservasMes || []).reduce(
        (acc, r) => acc + (r.valor_liquido_proprietario || 0),
        0
      );

      // Calcular valores financeiros detalhados
      const totais = (reservasDetalhadas || []).reduce(
        (acc, r) => {
          const valorBruto = r.valor_bruto || 0;
          const taxaLimpeza = r.taxa_limpeza || 0;
          const valorLiquido = valorBruto - taxaLimpeza;
          const comissaoCW = valorLiquido * 0.25;
          const valorProprietario = valorLiquido - comissaoCW;

          return {
            valorBruto: acc.valorBruto + valorBruto,
            taxaLimpeza: acc.taxaLimpeza + taxaLimpeza,
            valorLiquido: acc.valorLiquido + valorLiquido,
            comissaoCW: acc.comissaoCW + comissaoCW,
            valorProprietario: acc.valorProprietario + valorProprietario,
          };
        },
        { valorBruto: 0, taxaLimpeza: 0, valorLiquido: 0, comissaoCW: 0, valorProprietario: 0 }
      );

      setStats({
        totalProprietarios: propCount || 0,
        totalImoveis: imovelCount || 0,
        totalReservas: reservaCount || 0,
        receitaMes,
      });
      setFinanceiro(totais);
      setLoading(false);
    };

    fetchStats();
  }, []);

  const cards = [
    {
      title: "Proprietários",
      value: stats.totalProprietarios,
      icon: Users,
      format: "number",
    },
    {
      title: "Imóveis",
      value: stats.totalImoveis,
      icon: Building2,
      format: "number",
    },
    {
      title: "Reservas",
      value: stats.totalReservas,
      icon: CalendarDays,
      format: "number",
    },
    {
      title: "Repasse a Proprietários",
      value: stats.receitaMes,
      icon: TrendingUp,
      format: "currency",
    },
  ];

  const financeiroCards = [
    {
      title: "Valor Bruto",
      value: financeiro.valorBruto,
      icon: DollarSign,
      description: "Total sem deduções",
    },
    {
      title: "Taxa Limpeza",
      value: financeiro.taxaLimpeza,
      icon: Percent,
      description: "Dedução do bruto",
    },
    {
      title: "Valor Líquido",
      value: financeiro.valorLiquido,
      icon: DollarSign,
      description: "Bruto - Limpeza",
    },
    {
      title: "Comissão CW",
      value: financeiro.comissaoCW,
      icon: Percent,
      description: "25% sobre líquido",
    },
    {
      title: "Proprietário",
      value: financeiro.valorProprietario,
      icon: UserCheck,
      description: "Líquido - Comissão",
    },
  ];

  const formatValue = (value: number, format: string) => {
    if (format === "currency") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
    }
    return value.toString();
  };

  return (
    <PageTransition>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">
            Visão Geral
          </h1>
          <p className="text-muted-foreground mt-1">
            Resumo do mês de{" "}
            {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Card
              key={card.title}
              className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury group"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="font-display text-2xl text-foreground">
                    {formatValue(card.value, card.format)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <h2 className="font-display text-xl text-foreground tracking-wide mb-4">
            Detalhamento Financeiro
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {financeiroCards.map((card) => (
              <Card
                key={card.title}
                className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury group"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                    {card.title}
                  </CardTitle>
                  <card.icon className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  ) : (
                    <div className="space-y-1">
                      <p className="font-display text-xl text-foreground">
                        {formatValue(card.value, "currency")}
                      </p>
                      <p className="text-xs text-muted-foreground">{card.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-display text-lg text-foreground mb-2">
            Acesso Rápido
          </h2>
          <p className="text-muted-foreground text-sm">
            Use o menu lateral para gerenciar proprietários, imóveis e reservas.
          </p>
        </div>
      </div>
    </PageTransition>
  );
};

export default AdminDashboard;
