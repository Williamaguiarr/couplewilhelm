import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Users, Building2, Activity, AlertCircle } from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MasterDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalAdmins: 0,
    adminsAtivos: 0,
    totalProprietarios: 0,
    totalImoveis: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setError(null);
      // Busca IDs dos admins que ainda existem em user_roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (rolesError) throw rolesError;

      const adminIds = (adminRoles || []).map((r) => r.user_id);

      const [propRes, imovRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "proprietario"),
        supabase.from("imoveis").select("*", { count: "exact", head: true }),
      ]);

      if (propRes.error) throw propRes.error;
      if (imovRes.error) throw imovRes.error;

      const totalProprietarios = propRes.count || 0;
      const totalImoveis = imovRes.count || 0;

      // Admins ativos: cruzamento entre user_roles (admin existente) e admin_configs (ativo=true)
      let adminsAtivos = 0;
      if (adminIds.length > 0) {
        const { count, error: configError } = await supabase
          .from("admin_configs" as any)
          .select("*", { count: "exact", head: true })
          .eq("ativo", true)
          .in("admin_id", adminIds);
        
        if (configError) throw configError;
        adminsAtivos = count || 0;
      }

      setStats({
        totalAdmins: adminIds.length,
        adminsAtivos,
        totalProprietarios: totalProprietarios || 0,
        totalImoveis: totalImoveis || 0,
      });
    } catch (err: any) {
      console.error("Error fetching master stats:", err);
      setError(err.message || "Erro ao carregar dados do dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Realtime: atualiza automaticamente ao alterar admins, imóveis ou proprietários
    const channel = supabase
      .channel("master-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "imoveis" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_configs" }, fetchStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl sm:text-3xl text-foreground tracking-wide">
            Painel Master
          </h1>
          <p className="text-muted-foreground">
            Visão geral de toda a plataforma
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar dados</AlertTitle>
            <AlertDescription className="text-xs opacity-80">
              {error}. Tente recarregar a página.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.title}
                className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury group"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                    {card.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
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
          );
        })}
        </div>
      </div>
    </PageTransition>
  );
};

export default MasterDashboard;
