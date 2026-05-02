import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Sparkles, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/supabase-helpers";

export type RegimeComissao = "com_comissao" | "sem_comissao" | "exclusivo_adm";

export interface GanhoExtra {
  id: string;
  imovel_id: string;
  reserva_id?: string | null;
  tipo: string;
  descricao: string;
  data: string;
  valor: number;
  regime_comissao: RegimeComissao;
  aplicar_comissao?: boolean; 
  imovel?: { nome_imovel: string };
}

export const GANHO_TIPOS = [
  { value: "late_checkout", label: "Late Checkout" },
  { value: "early_checkin", label: "Early Check-in" },
  { value: "hospede_extra", label: "Hóspede Extra" },
  { value: "diaria_extra", label: "Diária Extra" },
  { value: "limpeza_extra", label: "Taxa de Limpeza Extra" },
  { value: "outros", label: "Outros" },
];

export const REGIME_COMISSAO_OPTIONS = [
  { value: "com_comissao", label: "Receita Comissionada", description: "A porcentagem administrativa do imóvel é aplicada sobre o valor." },
  { value: "sem_comissao", label: "Repasse Integral ao Proprietário", description: "100% repassado ao proprietário." },
  { value: "exclusivo_adm", label: "Taxa de Gestão", description: "100% para a gestora (não entra no repasse)." },
];

export const ganhoTipoLabel = (v: string) =>
  GANHO_TIPOS.find((t) => t.value === v)?.label ?? v;

interface Imovel {
  id: string;
  nome_imovel: string;
  taxa_comissao?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imoveis: Imovel[];
  onChanged?: () => void;
  reservaId?: string; 
  imovelId?: string; 
}

const emptyForm = {
  imovel_id: "",
  tipo: "late_checkout",
  descricao: "",
  data: new Date().toISOString().split("T")[0],
  valor: "",
  regime_comissao: "com_comissao" as RegimeComissao,
};

const GanhosExtrasDialog: React.FC<Props> = ({ 
  open, 
  onOpenChange, 
  imoveis, 
  onChanged,
  reservaId,
  imovelId
}) => {
  const [ganhos, setGanhos] = useState<GanhoExtra[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (imovelId && !editingId) setForm(prev => ({ ...prev, imovel_id: imovelId }));
  }, [imovelId, editingId]);

  const fetchGanhos = async () => {
    setLoading(true);
    let query = supabase
      .from("ganhos_extras")
      .select(`
        *,
        imovel:imoveis!ganhos_extras_imovel_id_fkey (
          nome_imovel
        )
      `);
    
    if (reservaId) {
      query = query.eq("reserva_id", reservaId);
    } else if (imovelId) {
      query = query.eq("imovel_id", imovelId);
    }

    const { data, error } = await query.order("data", { ascending: false });
    
    if (error) {
      console.error("Erro ao buscar ganhos extras:", error);
      toast({ title: "Erro ao buscar ganhos", description: error.message, variant: "destructive" });
    }

    setGanhos((data || []).map((g: any) => ({ 
      ...g, 
      imovel: g.imovel 
    })));
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      setEditingId(null);
      setForm(emptyForm);
      if (imovelId) setForm(prev => ({ ...prev, imovel_id: imovelId }));
      fetchGanhos();
    }
  }, [open, reservaId, imovelId]);

  const handleSave = async () => {
    if (!form.imovel_id || !form.descricao || !form.valor) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    
    const payload = {
      imovel_id: form.imovel_id,
      reserva_id: reservaId || null,
      tipo: form.tipo,
      descricao: form.descricao,
      data: form.data,
      valor: parseFloat(form.valor.toString().replace(",", ".")),
      regime_comissao: form.regime_comissao,
      aplicar_comissao: form.regime_comissao === "com_comissao",
    };

    let error;
    if (editingId) {
      const { error: updateError } = await supabase
        .from("ganhos_extras" as any)
        .update(payload)
        .eq("id", editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("ganhos_extras" as any)
        .insert(payload);
      error = insertError;
    }

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "Ganho extra atualizado!" : "Ganho extra registrado!" });
    setForm(emptyForm);
    setEditingId(null);
    if (imovelId) setForm(prev => ({ ...prev, imovel_id: imovelId }));
    fetchGanhos();
    onChanged?.();
  };

  const handleEditClick = (g: GanhoExtra) => {
    setEditingId(g.id);
    setForm({
      imovel_id: g.imovel_id,
      tipo: g.tipo,
      descricao: g.descricao,
      data: g.data,
      valor: g.valor.toString(),
      regime_comissao: g.regime_comissao,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    if (imovelId) setForm(prev => ({ ...prev, imovel_id: imovelId }));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ganhos_extras" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ganho extra excluído" });
    fetchGanhos();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ganhos Extras
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Entradas avulsas por fora das plataformas — late checkout, hóspede extra, diárias extras, etc.
          </p>
        </DialogHeader>

        {/* Form */}
        <div className="space-y-4 border border-border rounded-lg p-4 bg-muted/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Imóvel *</Label>
              <Select value={form.imovel_id} onValueChange={(v) => setForm({ ...form, imovel_id: v })}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card">
                  {imoveis.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nome_imovel} {i.taxa_comissao != null ? `(${i.taxa_comissao}%)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">
                  {GANHO_TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Descrição *</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex: Late checkout — saída às 18h"
              className="bg-background"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Data *</Label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                placeholder="0,00"
                className="bg-background"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Regime de Comissão *</Label>
            <Select 
              value={form.regime_comissao} 
              onValueChange={(v) => setForm({ ...form, regime_comissao: v as RegimeComissao })}
            >
              <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card">
                {REGIME_COMISSAO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col text-left">
                      <span>{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2 flex-1">
              {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Salvando..." : editingId ? "Atualizar Ganho" : "Adicionar Ganho Extra"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={cancelEdit} size="sm">
                Cancelar Edição
              </Button>
            )}
          </div>
        </div>
        
        <div className="pt-4 border-t border-border mt-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            {reservaId ? "Ganhos vinculados a esta reserva" : "Últimos lançamentos"}
            {!loading && (
              <Badge variant="secondary" className="text-[10px]">
                {ganhos.length} registro{ganhos.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </h3>

          <div className="border border-border rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8 flex justify-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ganhos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum ganho extra registrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imóvel</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ganhos.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="text-sm font-medium text-foreground">
                          {g.imovel?.nome_imovel ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{g.descricao}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {ganhoTipoLabel(g.tipo)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(g.data + "T12:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold text-primary">
                          {formatBRL(g.valor)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {g.regime_comissao === "com_comissao" ? "Comissionada" : 
                             g.regime_comissao === "sem_comissao" ? "Repasse Integral" : "Taxa Gestão"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditClick(g)}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(g.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GanhosExtrasDialog;