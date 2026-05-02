import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Trash2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/supabase-helpers";

export interface GanhoExtra {
  id: string;
  imovel_id: string;
  tipo: string;
  descricao: string;
  data: string;
  valor: number;
  aplicar_comissao: boolean;
  imovel?: { nome_imovel: string };
}

export const GANHO_TIPOS = [
  { value: "late_checkout", label: "Late Checkout" },
  { value: "early_checkin", label: "Early Check-in" },
  { value: "hospede_extra", label: "Hóspede Extra" },
  { value: "diaria_extra", label: "Diária Extra" },
  { value: "outros", label: "Outros" },
];

export const ganhoTipoLabel = (v: string) =>
  GANHO_TIPOS.find((t) => t.value === v)?.label ?? v;

interface Imovel {
  id: string;
  nome_imovel: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imoveis: Imovel[];
  onChanged?: () => void;
}

const emptyForm = {
  imovel_id: "",
  tipo: "late_checkout",
  descricao: "",
  data: new Date().toISOString().split("T")[0],
  valor: "",
  aplicar_comissao: true,
};

const GanhosExtrasDialog: React.FC<Props> = ({ open, onOpenChange, imoveis, onChanged }) => {
  const [ganhos, setGanhos] = useState<GanhoExtra[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchGanhos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ganhos_extras" as any)
      .select("*, imoveis(nome_imovel)")
      .order("data", { ascending: false });
    setGanhos((data || []).map((g: any) => ({ ...g, imovel: g.imoveis })));
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchGanhos();
  }, [open]);

  const handleSave = async () => {
    if (!form.imovel_id || !form.descricao || !form.valor) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("ganhos_extras" as any).insert({
      imovel_id: form.imovel_id,
      tipo: form.tipo,
      descricao: form.descricao,
      data: form.data,
      valor: parseFloat(form.valor.replace(",", ".")),
      aplicar_comissao: form.aplicar_comissao,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ganho extra registrado!" });
    setForm(emptyForm);
    fetchGanhos();
    onChanged?.();
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
                    <SelectItem key={i.id} value={i.id}>{i.nome_imovel}</SelectItem>
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

          <div className="flex items-start gap-2 rounded-md bg-background border border-border p-3">
            <Checkbox
              id="aplicar_comissao"
              checked={form.aplicar_comissao}
              onCheckedChange={(c) => setForm({ ...form, aplicar_comissao: !!c })}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="aplicar_comissao" className="text-sm text-foreground cursor-pointer">
                Aplicar comissão da administradora
              </Label>
              <p className="text-xs text-muted-foreground">
                Se marcado, o % de comissão ADM será descontado deste valor (igual a uma reserva). Caso contrário, 100% vai ao proprietário.
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> {saving ? "Salvando..." : "Adicionar Ganho Extra"}
          </Button>
        </div>

        {/* List */}
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
                    <TableHead className="w-10"></TableHead>
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
                        {g.aplicar_comissao ? (
                          <Badge variant="outline" className="text-[10px]">ADM aplica</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">100% prop.</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleDelete(g.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GanhosExtrasDialog;
