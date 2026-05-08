import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  RotateCcw,
  TrendingUp,
  DollarSign,
  Home,
  ClipboardList,
  TestTube,
  ArrowRight,
  Info,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtPct = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);

interface Imovel {
  id: string;
  nome_imovel: string;
}

const SimuladorDiaria: React.FC = () => {
  const { user } = useAuth();
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [selectedImovelId, setSelectedImovelId] = useState<string>("");

  // Parâmetros
  const [ocupacaoEstimada, setOcupacaoEstimada] = useState(20);
  const [custosFixos, setCustosFixos] = useState(0);
  const [custoReserva, setCustoReserva] = useState(150);
  const [taxaPlataforma, setTaxaPlataforma] = useState(15);
  const [lucroDesejado, setLucroDesejado] = useState(0);

  // Teste de diária
  const [diariaTeste, setDiariaTeste] = useState(0);

  // Carregar imóveis
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("imoveis")
        .select("id, nome_imovel")
        .eq("admin_id", user.id);
      if (data) setImoveis(data);
    };
    load();
  }, [user]);

  // Ao selecionar imóvel, buscar custos fixos das despesas
  useEffect(() => {
    if (!selectedImovelId) return;
    const load = async () => {
      const { data } = await supabase
        .from("despesas_extras")
        .select("valor")
        .eq("imovel_id", selectedImovelId)
        .eq("tipo", "fixa");
      if (data) {
        const total = data.reduce((sum, d) => sum + (d.valor || 0), 0);
        setCustosFixos(total);
      }
    };
    load();
  }, [selectedImovelId]);

  // Cálculo do resultado
  const resultado = useMemo(() => {
    const diasOcupados = Math.max(1, ocupacaoEstimada);
    const estadiaMedia = 3; // média de 3 noites por reserva
    const reservasEstimadas = diasOcupados / estadiaMedia;

    const custosVariaveisMes = custoReserva * reservasEstimadas;
    const custosTotaisMes = custosFixos + custosVariaveisMes + lucroDesejado;

    // Receita necessária = custos totais / (1 - taxa da plataforma)
    const taxaDecimal = taxaPlataforma / 100;
    const receitaNecessaria = custosTotaisMes / (1 - taxaDecimal);

    const diariaMinima = receitaNecessaria / diasOcupados;

    return {
      diariaMinima: Math.max(0, diariaMinima),
      receitaNecessaria: Math.max(0, receitaNecessaria),
      reservasEstimadas,
      custosVariaveisMes,
      custosTotaisMes,
    };
  }, [ocupacaoEstimada, custosFixos, custoReserva, taxaPlataforma, lucroDesejado]);

  // Resultado do teste
  const teste = useMemo(() => {
    if (diariaTeste <= 0) return null;
    const diasOcupados = Math.max(1, ocupacaoEstimada);
    const taxaDecimal = taxaPlataforma / 100;

    const receitaBruta = diariaTeste * diasOcupados;
    const receitaLiquida = receitaBruta * (1 - taxaDecimal);
    const estadiaMedia = 3;
    const reservasEstimadas = diasOcupados / estadiaMedia;
    const custosVariaveis = custoReserva * reservasEstimadas;
    const lucroEstimado = receitaLiquida - custosFixos - custosVariaveis;
    const margem = receitaBruta > 0 ? lucroEstimado / receitaBruta : 0;

    return { receitaBruta, receitaLiquida, lucroEstimado, margem };
  }, [diariaTeste, ocupacaoEstimada, taxaPlataforma, custosFixos, custoReserva]);

  const handleReset = () => {
    setSelectedImovelId("");
    setOcupacaoEstimada(20);
    setCustosFixos(0);
    setCustoReserva(150);
    setTaxaPlataforma(15);
    setLucroDesejado(0);
    setDiariaTeste(0);
  };

  // Atualizar teste com valor sugerido
  useEffect(() => {
    if (resultado.diariaMinima > 0 && diariaTeste === 0) {
      setDiariaTeste(Math.round(resultado.diariaMinima));
    }
  }, [resultado.diariaMinima]);

  return (
    <PageTransition>
      <div className="space-y-6 max-w-5xl w-full overflow-x-hidden">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl sm:text-3xl text-foreground">
              Simulador de Diária Ideal
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Calcule o preço mínimo para atingir seu lucro desejado
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Parâmetros */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Parâmetros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Imóvel */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Imóvel</Label>
                <Select value={selectedImovelId} onValueChange={setSelectedImovelId}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione para puxar custos fixos" />
                  </SelectTrigger>
                  <SelectContent>
                    {imoveis.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.nome_imovel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ocupação estimada */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  Ocupação estimada (dias/mês)
                </Label>
                <Input
                  type="number"
                  value={ocupacaoEstimada}
                  onChange={(e) => setOcupacaoEstimada(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
                  className="bg-background border-border"
                  min={1}
                  max={30}
                />
              </div>

              {/* Custos fixos */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label className="text-sm font-medium text-foreground">Custos fixos mensais (R$)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Condomínio, IPTU, internet, luz, etc. Selecionando um imóvel, busca automaticamente.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  value={custosFixos}
                  onChange={(e) => setCustosFixos(Math.max(0, Number(e.target.value) || 0))}
                  className="bg-background border-border"
                  min={0}
                  step={0.01}
                />
              </div>

              {/* Custo por reserva */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  Custo médio por reserva (limpeza + reposição)
                </Label>
                <Input
                  type="number"
                  value={custoReserva}
                  onChange={(e) => setCustoReserva(Math.max(0, Number(e.target.value) || 0))}
                  className="bg-background border-border"
                  min={0}
                />
              </div>

              {/* Taxa da plataforma */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  Taxa média da plataforma (%)
                </Label>
                <Input
                  type="number"
                  value={taxaPlataforma}
                  onChange={(e) => setTaxaPlataforma(Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
                  className="bg-background border-border"
                  min={0}
                  max={50}
                />
              </div>

              {/* Lucro desejado */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  Lucro desejado no mês (R$) <span className="text-muted-foreground font-normal text-xs">opcional</span>
                </Label>
                <Input
                  type="number"
                  value={lucroDesejado}
                  onChange={(e) => setLucroDesejado(Math.max(0, Number(e.target.value) || 0))}
                  className="bg-background border-border"
                  min={0}
                  step={0.01}
                />
              </div>

              {/* Reset */}
              <Button
                variant="outline"
                className="w-full border-border text-muted-foreground hover:text-foreground"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Recalcular / Limpar
              </Button>
            </CardContent>
          </Card>

          {/* RIGHT: Resultado + Teste */}
          <div className="space-y-6">
            {/* Resultado principal */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent shadow-luxury">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Resultado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Diária mínima */}
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-1">Diária mínima sugerida</p>
                  <p className="font-display text-4xl sm:text-5xl text-primary font-bold tracking-tight">
                    {fmt(resultado.diariaMinima)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">por noite</p>
                </div>

                {/* Breakdown */}
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Receita necessária/mês</span>
                    <span className="text-sm font-semibold text-foreground">{fmt(resultado.receitaNecessaria)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Reservas estimadas</span>
                    <span className="text-sm font-semibold text-foreground">{resultado.reservasEstimadas.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Custos variáveis/mês</span>
                    <span className="text-sm font-semibold text-destructive">{fmt(resultado.custosVariaveisMes)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Custos fixos/mês</span>
                    <span className="text-sm font-semibold text-destructive">{fmt(custosFixos)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Teste de diária */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <TestTube className="h-4 w-4 text-primary" />
                  Teste uma diária
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">
                    Diária que você quer testar (R$)
                  </Label>
                  <Input
                    type="number"
                    value={diariaTeste}
                    onChange={(e) => setDiariaTeste(Math.max(0, Number(e.target.value) || 0))}
                    className="bg-background border-border"
                    min={0}
                  />
                </div>

                {teste && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Receita bruta/mês</span>
                      <span className="text-sm font-semibold text-foreground">{fmt(teste.receitaBruta)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Receita líquida/mês</span>
                      <span className="text-sm font-semibold text-foreground">{fmt(teste.receitaLiquida)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Lucro estimado/mês</span>
                      <span className={cn(
                        "text-sm font-bold",
                        teste.lucroEstimado >= 0 ? "text-primary" : "text-destructive"
                      )}>
                        {fmt(teste.lucroEstimado)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Margem</span>
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded",
                        teste.margem >= 0.2
                          ? "bg-primary/10 text-primary"
                          : teste.margem >= 0
                            ? "bg-warning/10 text-warning"
                            : "bg-destructive/10 text-destructive"
                      )}>
                        {fmtPct(teste.margem)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default SimuladorDiaria;
