import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPin, CalendarDays } from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";

interface Imovel {
  id: string;
  nome_imovel: string;
  endereco: string | null;
  reservas_count?: number;
}

const MeusImoveis: React.FC = () => {
  const { user } = useAuth();
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchImoveis = async () => {
      const { data } = await supabase
        .from("imoveis")
        .select("id, nome_imovel, endereco")
        .or(`proprietario_id.eq.${user.id},proprietario_id_2.eq.${user.id}`);

      if (data && data.length > 0) {
        // Contar reservas por imóvel
        const imoveisComCount = await Promise.all(
          data.map(async (imovel) => {
            const { count } = await supabase
              .from("reservas")
              .select("*", { count: "exact", head: true })
              .eq("imovel_id", imovel.id);
            return { ...imovel, reservas_count: count || 0 };
          })
        );
        setImoveis(imoveisComCount);
      } else {
        setImoveis([]);
      }

      setLoading(false);
    };

    fetchImoveis();
  }, [user]);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">Meus Imóveis</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral dos seus imóveis cadastrados
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-40 bg-card border border-border rounded-lg animate-pulse" />
            ))}
          </div>
        ) : imoveis.length === 0 ? (
          <div className="p-16 flex flex-col items-center gap-4 text-center bg-card border border-border rounded-lg">
            <Building2 className="h-12 w-12 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">Nenhum imóvel vinculado à sua conta</p>
            <p className="text-sm text-muted-foreground opacity-60">
              Entre em contato com o administrador
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {imoveis.map((imovel) => (
              <Card
                key={imovel.id}
                className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground text-base font-medium leading-tight">
                        {imovel.nome_imovel}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {imovel.endereco && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{imovel.endereco}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      {imovel.reservas_count}{" "}
                      {imovel.reservas_count === 1 ? "reserva cadastrada" : "reservas cadastradas"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default MeusImoveis;
