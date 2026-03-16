import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Users, Building2, Activity } from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";

const MasterDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalAdmins: 0,
    adminsAtivos: 0,
    totalProprietarios: 0,
    totalImoveis: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [
        { count: totalAdmins },
        { count: adminsAtivos },
        { count: totalProprietarios },
        { count: totalImoveis },
      ] = await Promise.all([
        supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin"),
        supabase
          .from("admin_configs" as any)
          .select("*", { count: "exact", head: true })
          .eq("ativo", true),
        supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "proprietario"),
        supabase.from("imoveis").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        totalAdmins: totalAdmins || 0,
        adminsAtivos: adminsAtivos || 0,
        totalProprietarios: totalProprietarios || 0,
        totalImoveis: totalImoveis || 0,
      });
      setLoading(false);
    };

    fetchStats();
  }, []);

  const cards = [
    {
      title: "Total de Admins",
      value: stats.totalAdmins,
      icon: ShieldCheck,
      description: `${stats.adminsAtivos} ativos`,
    },
    {
      title: "Proprietários",
      value: stats.totalProprietarios,
      icon: Users,
      description: "na plataforma",
    },
    {
      title: "Imóveis",
      value: stats.totalImoveis,
      icon: Building2,
      description: "cadastrados",
    },
    {
      title: "Admins Ativos",
      value: stats.adminsAtivos,
      icon: Activity,
      description: `de ${stats.totalAdmins} totais`,
    },
  ];

  return (
    <PageTransition>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">
            Painel Master
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão geral de toda a plataforma
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
                  <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <p className="font-display text-2xl text-foreground">
                      {card.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {card.description}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageTransition>
  );
};

export default MasterDashboard;
