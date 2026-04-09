import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronUp,
  Home,
  Landmark,
  Building2,
  FileText,
  Zap,
  Droplets,
  Flame,
  Wifi,
  Save,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const TIPOS_CUSTOS = [
  { key: "financiamento", label: "Financiamento", icon: Landmark },
  { key: "condominio", label: "Condomínio", icon: Building2 },
  { key: "iptu", label: "IPTU", icon: FileText },
  { key: "luz", label: "Luz", icon: Zap },
  { key: "agua", label: "Água", icon: Droplets },
  { key: "gas", label: "Gás", icon: Flame },
  { key: "internet", label: "Internet", icon: Wifi },
] as const;

type CustoFixo = {
  id?: string;
  tipo: string;
  valor: number;
  ativo: boolean;
};

interface CustosFixosProprietarioProps {
  imoveis: { id: string; nome_imovel: string }[];
  repasseMensal: number;
  filterImovel: string;
  onTotalChange?: (total: number) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const CustosFixosProprietario: React.FC<CustosFixosProprietarioProps> = ({
  imoveis,
  repasseMensal,
  filterImovel,
  onTotalChange,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [selectedImovel, setSelectedImovel] = useState<string>("");
  const [custos, setCustos] = useState<Record<string, CustoFixo>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Set default selected property
  useEffect(() => {
    if (filterImovel && filterImovel !== "todos") {
      setSelectedImovel(filterImovel);
    } else if (imoveis.length === 1) {
      setSelectedImovel(imoveis[0].id);
    } else if (imoveis.length > 0 && !selectedImovel) {
      setSelectedImovel(imoveis[0].id);
    }
  }, [filterImovel, imoveis]);

  const fetchCustos = useCallback(async () => {
    if (!user || !selectedImovel) return;
    setLoading(true);
    const { data } = await supabase
      .from("custos_fixos_proprietario" as any)
      .select("*")
      .eq("imovel_id", selectedImovel)
      .eq("proprietario_id", user.id);

    const map: Record<string, CustoFixo> = {};
    TIPOS_CUSTOS.forEach(({ key }) => {
      map[key] = { tipo: key, valor: 0, ativo: false };
    });
    if (data) {
      (data as any[]).forEach((row) => {
        map[row.tipo] = {
          id: row.id,
          tipo: row.tipo,
          valor: Number(row.valor),
          ativo: row.ativo,
        };
      });
    }
    setCustos(map);
    setLoading(false);
  }, [user, selectedImovel]);

  useEffect(() => {
    fetchCustos();
  }, [fetchCustos]);

  // Notify parent of total
  useEffect(() => {
    const total = Object.values(custos)
      .filter((c) => c.ativo)
      .reduce((acc, c) => acc + c.valor, 0);
    onTotalChange?.(total);
  }, [custos, onTotalChange]);

  const handleToggle = (tipo: string, checked: boolean) => {
    setCustos((prev) => ({
      ...prev,
      [tipo]: { ...prev[tipo], ativo: checked },
    }));
  };

  const handleValorChange = (tipo: string, valor: string) => {
    const num = parseFloat(valor.replace(",", ".")) || 0;
    setCustos((prev) => ({
      ...prev,
      [tipo]: { ...prev[tipo], valor: num },
    }));
  };

  const handleSave = async () => {
    if (!user || !selectedImovel) return;
    setSaving(true);

    try {
      for (const custo of Object.values(custos)) {
        if (custo.id) {
          // Update existing
          await supabase
            .from("custos_fixos_proprietario" as any)
            .update({ valor: custo.valor, ativo: custo.ativo } as any)
            .eq("id", custo.id);
        } else if (custo.ativo && custo.valor > 0) {
          // Insert new
          await supabase
            .from("custos_fixos_proprietario" as any)
            .insert({
              imovel_id: selectedImovel,
              proprietario_id: user.id,
              tipo: custo.tipo,
              valor: custo.valor,
              ativo: custo.ativo,
            } as any);
        }
      }
      toast({ title: "Custos fixos salvos com sucesso!" });
      fetchCustos();
    } catch {
      toast({ title: "Erro ao salvar custos fixos", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const totalCustos = Object.values(custos)
    .filter((c) => c.ativo)
    .reduce((acc, c) => acc + c.valor, 0);

  const liquidoFinal = repasseMensal - totalCustos;

  return (
    <section className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-primary" />
          <span className="font-display text-base text-foreground tracking-wide">
            Custos Fixos Mensais
          </span>
          {totalCustos > 0 && (
            <span className="text-[10px] text-muted-foreground font-medium">
              ({fmt(totalCustos)}/mês)
            </span>
          )}
        </div>
        {aberto ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {aberto && (
        <div className="border-t border-border px-5 py-4 space-y-5">
          {/* Property selector */}
          {imoveis.length > 1 && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Imóvel
              </Label>
              <Select value={selectedImovel} onValueChange={setSelectedImovel}>
                <SelectTrigger className="w-56 h-8 text-xs bg-transparent border-border">
                  <SelectValue placeholder="Selecione um imóvel" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {imoveis.map((im) => (
                    <SelectItem key={im.id} value={im.id} className="text-xs">
                      {im.nome_imovel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {loading ? (
            <div className="py-6 flex justify-center">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Cost items grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TIPOS_CUSTOS.map(({ key, label, icon: Icon }) => {
                  const custo = custos[key] || { tipo: key, valor: 0, ativo: false };
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                        custo.ativo
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-transparent opacity-60"
                      )}
                    >
                      <Checkbox
                        checked={custo.ativo}
                        onCheckedChange={(checked) =>
                          handleToggle(key, checked === true)
                        }
                      />
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground flex-1 min-w-0">
                        {label}
                      </span>
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={custo.valor || ""}
                          onChange={(e) => handleValorChange(key, e.target.value)}
                          disabled={!custo.ativo}
                          className="h-8 text-xs pl-8 text-right"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Custos Fixos</span>
                  <span className="text-foreground font-medium">
                    - {fmt(totalCustos)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Repasse do Período</span>
                  <span className="text-foreground font-medium">
                    {fmt(repasseMensal)}
                  </span>
                </div>
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-widest">
                    Líquido após Custos Fixos
                  </span>
                  <span
                    className={cn(
                      "font-display text-lg font-semibold",
                      liquidoFinal >= 0 ? "text-primary" : "text-destructive"
                    )}
                  >
                    {fmt(liquidoFinal)}
                  </span>
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2 text-xs"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Salvar Custos Fixos
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default CustosFixosProprietario;
