import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calculator,
  MapPin,
  Users,
  Bed,
  Star,
  Wifi,
  Car,
  Sparkles,
  TrendingUp,
  Lightbulb,
  Info,
  Calendar,
  ShowerHead,
  RefreshCw,
  Globe,
  Loader2,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ---------- Constants ----------

const TIPO_SERVICO = [
  { value: "standard", label: "Standard", mult: 1.0 },
  { value: "premium", label: "Premium", mult: 1.2 },
  { value: "luxo", label: "Luxo", mult: 1.45 },
];

const LOCALIZACOES = [
  { value: "centro", label: "Centro / Urbano", mult: 1.0 },
  { value: "praia", label: "Praia / Litoral", mult: 1.25 },
  { value: "campo", label: "Campo / Interior", mult: 0.85 },
  { value: "montanha", label: "Serra / Montanha", mult: 1.15 },
  { value: "capital", label: "Capital / Metrópole", mult: 1.3 },
];

const TEMPORADAS = [
  { value: "baixa", label: "Baixa temporada", mult: 0.8 },
  { value: "media", label: "Média temporada", mult: 1.0 },
  { value: "alta", label: "Alta temporada", mult: 1.35 },
  { value: "feriado", label: "Feriado / Réveillon", mult: 1.6 },
];

interface FormState {
  tipoServico: string;
  localizacao: string;
  temporada: string;
  quartos: number;
  hospedes: number;
  duracaoMinima: number;
  notaAvaliacao: number;
  wifi: boolean;
  estacionamento: boolean;
  piscina: boolean;
  arCondicionado: boolean;
  cozinhaEquipada: boolean;
  lavanderia: boolean;
  taxaLimpeza: number;
}

const DEFAULT: FormState = {
  tipoServico: "standard",
  localizacao: "centro",
  temporada: "media",
  quartos: 1,
  hospedes: 2,
  duracaoMinima: 2,
  notaAvaliacao: 4.5,
  wifi: true,
  estacionamento: false,
  piscina: false,
  arCondicionado: true,
  cozinhaEquipada: false,
  lavanderia: false,
  taxaLimpeza: 120,
};

interface PriceLabsListing {
  id: string;
  pms: string;
  name: string;
  min: number;
  base: number;
  max: number;
}

interface PriceLabsPriceData {
  id: string;
  pms: string;
  currency: string;
  data: Array<{ date: string; price: number; min_stay: number }>;
}

const SimuladorDiaria: React.FC = () => {
  const [form, setForm] = useState<FormState>(DEFAULT);

  // PriceLabs state
  const [plListings, setPlListings] = useState<PriceLabsListing[]>([]);
  const [plSelectedListing, setPlSelectedListing] = useState<string>("");
  const [plPrices, setPlPrices] = useState<PriceLabsPriceData | null>(null);
  const [plLoading, setPlLoading] = useState(false);
  const [plPricesLoading, setPlPricesLoading] = useState(false);
  const [plNeighborhood, setPlNeighborhood] = useState<any>(null);
  const [plNeighborhoodLoading, setPlNeighborhoodLoading] = useState(false);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  // ---------- PriceLabs integration ----------
  const fetchListings = useCallback(async () => {
    setPlLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pricelabs-proxy", {
        body: { action: "listings" },
      });
      if (error) throw error;
      if (data?.listings) {
        setPlListings(data.listings);
        if (data.listings.length > 0 && !plSelectedListing) {
          setPlSelectedListing(data.listings[0].id);
        }
        toast.success(`${data.listings.length} imóveis encontrados no PriceLabs`);
      } else if (data?.error) {
        toast.error(`PriceLabs: ${data.error}`);
      }
    } catch (err: any) {
      console.error("PriceLabs listings error:", err);
      toast.error("Erro ao buscar imóveis do PriceLabs");
    } finally {
      setPlLoading(false);
    }
  }, [plSelectedListing]);

  const fetchPrices = useCallback(async () => {
    if (!plSelectedListing) return;
    const listing = plListings.find((l) => l.id === plSelectedListing);
    if (!listing) return;

    setPlPricesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pricelabs-proxy", {
        body: {
          action: "prices",
          listing_ids: [{ id: listing.id, pms: listing.pms }],
        },
      });
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        setPlPrices(data[0]);
        toast.success("Preços de mercado carregados com sucesso");
      } else if (data?.error) {
        toast.error(`PriceLabs: ${data.error}`);
      }
    } catch (err: any) {
      console.error("PriceLabs prices error:", err);
      toast.error("Erro ao buscar preços do PriceLabs");
    } finally {
      setPlPricesLoading(false);
    }
  }, [plSelectedListing, plListings]);

  const fetchNeighborhood = useCallback(async () => {
    if (!plSelectedListing) return;
    const listing = plListings.find((l) => l.id === plSelectedListing);
    if (!listing) return;

    setPlNeighborhoodLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pricelabs-proxy", {
        body: {
          action: "neighborhood_data",
          listing_id: listing.id,
          pms: listing.pms,
        },
      });
      if (error) throw error;
      if (data && !data.error) {
        setPlNeighborhood(data);
        toast.success("Dados de vizinhança carregados");
      } else if (data?.error) {
        toast.error(`PriceLabs: ${data.error}`);
      }
    } catch (err: any) {
      console.error("PriceLabs neighborhood error:", err);
      toast.error("Erro ao buscar dados de vizinhança");
    } finally {
      setPlNeighborhoodLoading(false);
    }
  }, [plSelectedListing, plListings]);

  // Auto-fetch prices when listing changes
  useEffect(() => {
    if (plSelectedListing && plListings.length > 0) {
      fetchPrices();
      fetchNeighborhood();
    }
  }, [plSelectedListing]);

  // ---------- PriceLabs computed stats ----------
  const plStats = useMemo(() => {
    if (!plPrices?.data || plPrices.data.length === 0) return null;

    const prices = plPrices.data.map((d) => d.price).filter((p) => p > 0);
    if (prices.length === 0) return null;

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Next 7 days average
    const today = new Date();
    const next7 = plPrices.data
      .filter((d) => {
        const dt = new Date(d.date);
        const diff = (dt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
      })
      .map((d) => d.price)
      .filter((p) => p > 0);

    const avg7 = next7.length > 0 ? next7.reduce((a, b) => a + b, 0) / next7.length : null;

    // Next 30 days average
    const next30 = plPrices.data
      .filter((d) => {
        const dt = new Date(d.date);
        const diff = (dt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 30;
      })
      .map((d) => d.price)
      .filter((p) => p > 0);

    const avg30 = next30.length > 0 ? next30.reduce((a, b) => a + b, 0) / next30.length : null;

    return { avg: Math.round(avg), min, max, avg7: avg7 ? Math.round(avg7) : null, avg30: avg30 ? Math.round(avg30) : null, totalDays: prices.length };
  }, [plPrices]);

  // Selected listing base price
  const selectedListingBase = useMemo(() => {
    if (!plSelectedListing) return null;
    return plListings.find((l) => l.id === plSelectedListing) ?? null;
  }, [plSelectedListing, plListings]);

  // ---------- Calculation ----------
  const resultado = useMemo(() => {
    const basePorQuarto = 120;
    const base = basePorQuarto * Math.max(1, form.quartos);

    const tipoMult = TIPO_SERVICO.find((t) => t.value === form.tipoServico)?.mult ?? 1;
    const localMult = LOCALIZACOES.find((l) => l.value === form.localizacao)?.mult ?? 1;
    const temporadaMult = TEMPORADAS.find((t) => t.value === form.temporada)?.mult ?? 1;

    const guestMult = 1 + Math.max(0, form.hospedes - 2) * 0.05;

    const duracaoMult =
      form.duracaoMinima >= 7 ? 0.9 : form.duracaoMinima >= 3 ? 0.95 : 1;

    const ratingMult =
      form.notaAvaliacao >= 4.5 ? 1.1 : form.notaAvaliacao >= 4.0 ? 1.05 : 1;

    const amenities =
      (form.wifi ? 10 : 0) +
      (form.estacionamento ? 20 : 0) +
      (form.piscina ? 35 : 0) +
      (form.arCondicionado ? 15 : 0) +
      (form.cozinhaEquipada ? 20 : 0) +
      (form.lavanderia ? 10 : 0);

    let diaria = Math.round(
      base * tipoMult * localMult * temporadaMult * guestMult * duracaoMult * ratingMult + amenities
    );

    // If PriceLabs data available, blend with market data
    let priceLabsAdjusted = false;
    if (plStats) {
      const marketRef = plStats.avg7 ?? plStats.avg30 ?? plStats.avg;
      // Weighted blend: 40% simulator, 60% market
      diaria = Math.round(diaria * 0.4 + marketRef * 0.6);
      priceLabsAdjusted = true;
    }

    const diariaMin = Math.round(diaria * 0.85);
    const diariaMax = Math.round(diaria * 1.15);

    const receitaMensal = Math.round(diaria * 30 * 0.7);

    return { diaria: Math.max(50, diaria), diariaMin, diariaMax, receitaMensal, priceLabsAdjusted };
  }, [form, plStats]);

  // ---------- Tips ----------
  const dicas = useMemo(() => {
    const tips: { icon: React.ReactNode; text: string; type: "success" | "info" | "warning" }[] = [];

    if (resultado.priceLabsAdjusted && plStats) {
      tips.push({
        icon: <Globe className="h-4 w-4" />,
        text: `Preço ajustado com dados de mercado PriceLabs (média ${fmt(plStats.avg)}, faixa ${fmt(plStats.min)}–${fmt(plStats.max)}).`,
        type: "success",
      });
    }

    if (!form.wifi)
      tips.push({ icon: <Wifi className="h-4 w-4" />, text: "Wi-Fi é essencial — 95% dos hóspedes consideram obrigatório. Adicionar pode aumentar a diária em até R$10.", type: "warning" });

    if (form.notaAvaliacao < 4.0)
      tips.push({ icon: <Star className="h-4 w-4" />, text: "Notas abaixo de 4.0 reduzem a visibilidade nas plataformas. Invista em melhorias para subir a avaliação.", type: "warning" });

    if (form.notaAvaliacao >= 4.5)
      tips.push({ icon: <Star className="h-4 w-4" />, text: "Excelente avaliação! Isso permite cobrar um prêmio de até 10% acima da média.", type: "success" });

    if (form.piscina)
      tips.push({ icon: <Sparkles className="h-4 w-4" />, text: "Piscina agrega valor significativo, especialmente em praia e campo.", type: "success" });

    if (form.duracaoMinima >= 7)
      tips.push({ icon: <Calendar className="h-4 w-4" />, text: "Estadias longas reduzem custos de limpeza e rotatividade. Desconto aplicado.", type: "info" });

    if (form.temporada === "alta" || form.temporada === "feriado")
      tips.push({ icon: <TrendingUp className="h-4 w-4" />, text: "Em alta temporada, considere exigir estadia mínima de 3-5 noites para maximizar receita.", type: "info" });

    if (!form.arCondicionado && (form.localizacao === "praia" || form.localizacao === "capital"))
      tips.push({ icon: <Info className="h-4 w-4" />, text: "Ar-condicionado é quase obrigatório para praia e capitais. Pode impactar negativamente as avaliações.", type: "warning" });

    if (form.cozinhaEquipada)
      tips.push({ icon: <Sparkles className="h-4 w-4" />, text: "Cozinha equipada é muito valorizada por famílias e estadias longas.", type: "success" });

    if (!form.estacionamento && form.localizacao !== "centro")
      tips.push({ icon: <Car className="h-4 w-4" />, text: "Fora do centro, estacionamento é altamente desejável. Considere incluir.", type: "info" });

    return tips;
  }, [form, resultado.priceLabsAdjusted, plStats]);

  // ---------- Competitiveness score ----------
  const competitividadeScore = useMemo(() => {
    let score = 50;
    if (form.wifi) score += 8;
    if (form.arCondicionado) score += 7;
    if (form.piscina) score += 10;
    if (form.estacionamento) score += 6;
    if (form.cozinhaEquipada) score += 7;
    if (form.lavanderia) score += 4;
    if (form.notaAvaliacao >= 4.5) score += 10;
    else if (form.notaAvaliacao >= 4.0) score += 5;
    if (form.tipoServico === "luxo") score += 8;
    else if (form.tipoServico === "premium") score += 4;
    return Math.min(100, score);
  }, [form]);

  const competitividadeLabel =
    competitividadeScore >= 85
      ? "Excelente"
      : competitividadeScore >= 70
        ? "Bom"
        : competitividadeScore >= 50
          ? "Médio"
          : "Baixo";

  const competitividadeColor =
    competitividadeScore >= 85
      ? "text-emerald-500"
      : competitividadeScore >= 70
        ? "text-primary"
        : competitividadeScore >= 50
          ? "text-amber-500"
          : "text-destructive";

  return (
    <PageTransition>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl text-foreground tracking-wide">
              Simulador de Diária Ideal
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Configure os parâmetros do imóvel para calcular a diária sugerida com base no mercado
          </p>
        </div>

        {/* PriceLabs Integration Card */}
        <Card className="bg-card border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Dados de Mercado — PriceLabs
              {resultado.priceLabsAdjusted && (
                <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px] ml-2">
                  Conectado
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchListings}
                disabled={plLoading}
                className="gap-2"
              >
                {plLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {plListings.length > 0 ? "Atualizar Imóveis" : "Carregar Imóveis PriceLabs"}
              </Button>

              {plListings.length > 0 && (
                <div className="flex items-end gap-2 flex-1 min-w-[200px]">
                  <div className="space-y-1.5 flex-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                      Imóvel PriceLabs
                    </Label>
                    <Select value={plSelectedListing} onValueChange={setPlSelectedListing}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Selecione um imóvel" />
                      </SelectTrigger>
                      <SelectContent>
                        {plListings.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name} ({l.pms})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      fetchPrices();
                      fetchNeighborhood();
                    }}
                    disabled={plPricesLoading || plNeighborhoodLoading}
                    className="gap-1"
                  >
                    {(plPricesLoading || plNeighborhoodLoading) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Atualizar
                  </Button>
                </div>
              )}
            </div>

            {/* PriceLabs Stats */}
            {(plPricesLoading || plNeighborhoodLoading) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            )}

            {plStats && !plPricesLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Média Geral</p>
                  <p className="text-lg font-bold text-foreground">{fmt(plStats.avg)}</p>
                </div>
                {plStats.avg7 !== null && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Próx. 7 dias</p>
                    <p className="text-lg font-bold text-primary">{fmt(plStats.avg7)}</p>
                  </div>
                )}
                {plStats.avg30 !== null && (
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Próx. 30 dias</p>
                    <p className="text-lg font-bold text-foreground">{fmt(plStats.avg30)}</p>
                  </div>
                )}
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Faixa Mercado</p>
                  <p className="text-sm font-semibold text-foreground">{fmt(plStats.min)} — {fmt(plStats.max)}</p>
                </div>
              </div>
            )}

            {selectedListingBase && !plPricesLoading && (
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Base PriceLabs: <strong className="text-foreground">{fmt(selectedListingBase.base)}</strong></span>
                <span>Mínimo: <strong className="text-foreground">{fmt(selectedListingBase.min)}</strong></span>
                <span>Máximo: <strong className="text-foreground">{fmt(selectedListingBase.max)}</strong></span>
                <span>PMS: <strong className="text-foreground">{selectedListingBase.pms}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Form inputs */}
          <div className="lg:col-span-2 space-y-5">
            {/* Row 1: Tipo de Serviço + Localização + Temporada */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Características do Imóvel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                      Tipo de Serviço
                    </Label>
                    <Select value={form.tipoServico} onValueChange={(v) => set("tipoServico", v)}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_SERVICO.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                      Localização
                    </Label>
                    <Select value={form.localizacao} onValueChange={(v) => set("localizacao", v)}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCALIZACOES.map((l) => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                      Temporada
                    </Label>
                    <Select value={form.temporada} onValueChange={(v) => set("temporada", v)}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPORADAS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Row 2: Quartos, Hóspedes, Duração, Nota */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2">
                  <Bed className="h-4 w-4 text-primary" />
                  Capacidade e Duração
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                        Quartos
                      </Label>
                      <span className="text-sm font-semibold text-foreground">{form.quartos}</span>
                    </div>
                    <Slider
                      value={[form.quartos]}
                      onValueChange={([v]) => set("quartos", v)}
                      min={1}
                      max={6}
                      step={1}
                      className="[&>span>span]:bg-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>1</span><span>6</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                        Hóspedes
                      </Label>
                      <span className="text-sm font-semibold text-foreground">{form.hospedes}</span>
                    </div>
                    <Slider
                      value={[form.hospedes]}
                      onValueChange={([v]) => set("hospedes", v)}
                      min={1}
                      max={12}
                      step={1}
                      className="[&>span>span]:bg-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>1</span><span>12</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                        Estadia Mínima (noites)
                      </Label>
                      <span className="text-sm font-semibold text-foreground">{form.duracaoMinima}</span>
                    </div>
                    <Slider
                      value={[form.duracaoMinima]}
                      onValueChange={([v]) => set("duracaoMinima", v)}
                      min={1}
                      max={30}
                      step={1}
                      className="[&>span>span]:bg-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>1</span><span>30</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Star className="h-3 w-3" /> Nota de Avaliação
                      </Label>
                      <span className="text-sm font-semibold text-foreground">{form.notaAvaliacao.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[form.notaAvaliacao]}
                      onValueChange={([v]) => set("notaAvaliacao", v)}
                      min={1}
                      max={5}
                      step={0.1}
                      className="[&>span>span]:bg-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>1.0</span><span>5.0</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                    Taxa de Limpeza (R$)
                  </Label>
                  <Input
                    type="number"
                    value={form.taxaLimpeza}
                    onChange={(e) => set("taxaLimpeza", Math.max(0, Number(e.target.value) || 0))}
                    className="bg-background border-border w-40"
                    min={0}
                    max={1000}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Row 3: Amenities */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Comodidades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { key: "wifi" as const, label: "Wi-Fi", icon: <Wifi className="h-4 w-4" />, bonus: "+R$10" },
                    { key: "arCondicionado" as const, label: "Ar-Condicionado", icon: <Sparkles className="h-4 w-4" />, bonus: "+R$15" },
                    { key: "estacionamento" as const, label: "Estacionamento", icon: <Car className="h-4 w-4" />, bonus: "+R$20" },
                    { key: "piscina" as const, label: "Piscina", icon: <ShowerHead className="h-4 w-4" />, bonus: "+R$35" },
                    { key: "cozinhaEquipada" as const, label: "Cozinha Equipada", icon: <Sparkles className="h-4 w-4" />, bonus: "+R$20" },
                    { key: "lavanderia" as const, label: "Lavanderia", icon: <Sparkles className="h-4 w-4" />, bonus: "+R$10" },
                  ].map((amenity) => (
                    <div
                      key={amenity.key}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-3 transition-all duration-200 cursor-pointer",
                        form[amenity.key]
                          ? "border-primary/40 bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                      onClick={() => set(amenity.key, !form[amenity.key])}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("text-muted-foreground", form[amenity.key] && "text-primary")}>
                          {amenity.icon}
                        </span>
                        <div>
                          <span className="text-sm text-foreground">{amenity.label}</span>
                          <p className="text-[10px] text-muted-foreground">{amenity.bonus}/noite</p>
                        </div>
                      </div>
                      <Switch
                        checked={form[amenity.key]}
                        onCheckedChange={(v) => set(amenity.key, v)}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Results */}
          <div className="space-y-5">
            {/* Main result */}
            <Card className="bg-card border-primary/30 shadow-luxury sticky top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Diária Sugerida
                  {resultado.priceLabsAdjusted && (
                    <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 ml-auto">
                      <Globe className="h-3 w-3 mr-1" />
                      PriceLabs
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="text-center py-4">
                  <p className="font-display text-4xl text-primary font-bold">
                    {fmt(resultado.diaria)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">por noite</p>
                  <p className="text-sm text-muted-foreground mt-3">
                    Faixa sugerida:{" "}
                    <span className="text-foreground font-medium">
                      {fmt(resultado.diariaMin)} — {fmt(resultado.diariaMax)}
                    </span>
                  </p>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Taxa de limpeza</span>
                    <span className="text-sm font-medium text-foreground">{fmt(form.taxaLimpeza)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total p/ hóspede ({form.duracaoMinima} noites)</span>
                    <span className="text-sm font-semibold text-foreground">
                      {fmt(resultado.diaria * form.duracaoMinima + form.taxaLimpeza)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 cursor-help">
                          <Info className="h-3 w-3" />
                          Receita mensal estimada
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Baseado em 70% de ocupação mensal</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-sm font-bold text-primary">{fmt(resultado.receitaMensal)}</span>
                  </div>
                </div>

                {/* Competitiveness */}
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-widest">
                      Competitividade
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-xs border-current", competitividadeColor)}
                    >
                      {competitividadeLabel}
                    </Badge>
                  </div>
                  <Progress
                    value={competitividadeScore}
                    className={cn(
                      "h-2",
                      competitividadeScore >= 85
                        ? "[&>div]:bg-emerald-500"
                        : competitividadeScore >= 70
                          ? "[&>div]:bg-primary"
                          : competitividadeScore >= 50
                            ? "[&>div]:bg-amber-500"
                            : "[&>div]:bg-destructive"
                    )}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {competitividadeScore}/100
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            {dicas.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Dicas de Otimização
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dicas.map((dica, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex gap-3 rounded-lg border p-3 text-sm",
                        dica.type === "success"
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : dica.type === "warning"
                            ? "border-amber-500/20 bg-amber-500/5"
                            : "border-primary/20 bg-primary/5"
                      )}
                    >
                      <span
                        className={cn(
                          "flex-shrink-0 mt-0.5",
                          dica.type === "success"
                            ? "text-emerald-500"
                            : dica.type === "warning"
                              ? "text-amber-500"
                              : "text-primary"
                        )}
                      >
                        {dica.icon}
                      </span>
                      <p className="text-muted-foreground text-xs leading-relaxed">{dica.text}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default SimuladorDiaria;
