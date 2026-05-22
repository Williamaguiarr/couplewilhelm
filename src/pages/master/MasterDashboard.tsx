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
      console.log("MasterDashboard: Fetching stats...");
      setError(null);
      
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (rolesError) {
        console.error("MasterDashboard: rolesError", rolesError);
        throw rolesError;
      }

      const adminIds = (adminRoles || []).map((r) => r.user_id);

      const [propRes, imovRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "proprietario"),
        supabase.from("imoveis").select("*", { count: "exact", head: true }),
      ]);

      if (propRes.error) {
        console.error("MasterDashboard: propRes error", propRes.error);
        throw propRes.error;
      }
      if (imovRes.error) {
        console.error("MasterDashboard: imovRes error", imovRes.error);
        throw imovRes.error;
      }

      let adminsAtivos = 0;
      if (adminIds.length > 0) {
        const { count, error: configError } = await supabase
          .from("admin_configs" as any)
          .select("*", { count: "exact", head: true })
          .eq("ativo", true)
          .in("admin_id", adminIds);
        
        if (configError) {
          console.error("MasterDashboard: configError", configError);
          // Don't throw if only admin_configs fails, it might be a new setup
        } else {
          adminsAtivos = count || 0;
        }
      }

      setStats({
        totalAdmins: adminIds.length,
        adminsAtivos,
        totalProprietarios: propRes.count || 0,
        totalImoveis: imovRes.count || 0,
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
          <Card className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">Total de Admins</CardTitle>
              <ShieldCheck className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <p className="font-display text-2xl text-foreground">{stats.totalAdmins}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stats.adminsAtivos} ativos</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">Proprietários</CardTitle>
              <Users className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <p className="font-display text-2xl text-foreground">{stats.totalProprietarios}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">na plataforma</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">Imóveis</CardTitle>
              <Building2 className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <p className="font-display text-2xl text-foreground">{stats.totalImoveis}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">cadastrados</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">Admins Ativos</CardTitle>
              <Activity className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <p className="font-display text-2xl text-foreground">{stats.adminsAtivos}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">de {stats.totalAdmins} totais</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
};

export default MasterDashboard;
