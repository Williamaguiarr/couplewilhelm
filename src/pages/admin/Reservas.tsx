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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Plus, CalendarDays, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/layout/PageTransition";

interface Reserva {
  id: string;
  data_inicio: string;
  data_fim: string;
  valor_bruto: number | null;
  valor_liquido_proprietario: number | null;
  taxa_limpeza: number | null;
  observacoes: string | null;
  imovel_id: string;
  imovel?: { nome_imovel: string };
}

interface Imovel {
  id: string;
  nome_imovel: string;
}

const fmt = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";

const COMISSAO_RATE = 0.25;

const calcComissao = (valorLiquido: string | number | null): number => {
  const v = typeof valorLiquido === "string" ? parseFloat(valorLiquido) : valorLiquido;
  if (!v || isNaN(v)) return 0;
  return v * COMISSAO_RATE;
};

const calcValorProprietario = (
  valorLiquido: string | number | null,
  taxaLimpeza: string | number | null
): number | null => {
  const liq = typeof valorLiquido === "string" ? parseFloat(valorLiquido) : valorLiquido;
  const taxa = typeof taxaLimpeza === "string" ? parseFloat(taxaLimpeza) : taxaLimpeza;
  if (liq == null || isNaN(liq)) return null;
  const comissao = liq * COMISSAO_RATE;
  const limpeza = (taxa && !isNaN(taxa)) ? taxa : 0;
  return liq - limpeza - comissao;
};

const emptyForm = {
  imovel_id: "",
  data_inicio: "",
  data_fim: "",
  valor_bruto: "",
  valor_liquido: "",
  taxa_limpeza: "",
  observacoes: "",
};

type FormState = typeof emptyForm;

// ─── Reusable form fields ───────────────────────────────────────────────────
const ReservaFormFields = ({
  form,
  setForm,
  imoveis,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  imoveis: Imovel[];
}) => {
  const comissao = calcComissao(form.valor_liquido);
  const valorProprietario = calcValorProprietario(form.valor_liquido, form.taxa_limpeza);

  return (
    <>
      <div className="space-y-2">
        <Label className="text-muted-foreground">Imóvel</Label>
        <Select value={form.imovel_id} onValueChange={(v) => setForm({ ...form, imovel_id: v })}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue placeholder="Selecione o imóvel" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {imoveis.map((i) => (
              <SelectItem key={i.id} value={i.id} className="text-foreground">
                {i.nome_imovel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Check-in</Label>
          <Input
            type="date"
            value={form.data_inicio}
            onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
            required
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Check-out</Label>
          <Input
            type="date"
            value={form.data_fim}
            onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
            required
            className="bg-background"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Valor Bruto (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.valor_bruto}
            onChange={(e) => setForm({ ...form, valor_bruto: e.target.value })}
            placeholder="0,00"
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Valor Líquido (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.valor_liquido}
            onChange={(e) => setForm({ ...form, valor_liquido: e.target.value })}
            placeholder="0,00"
            className="bg-background"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Taxa de Limpeza (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.taxa_limpeza}
            onChange={(e) => setForm({ ...form, taxa_limpeza: e.target.value })}
            placeholder="0,00"
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Comissão CW (25% sobre líquido)</Label>
          <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm">
            {form.valor_liquido ? fmt(comissao) : "—"}
          </div>
        </div>
      </div>

      {/* Valor do Proprietário calculado */}
      <div className="rounded-md border border-border bg-muted/20 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">Valor do Proprietário</span>
        <span className="text-primary font-semibold text-base">
          {valorProprietario != null ? fmt(valorProprietario) : "—"}
        </span>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground">Observações</Label>
        <Input
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          placeholder="Opcional"
          className="bg-background"
        />
      </div>
    </>
  );
};

// ─── Main component ─────────────────────────────────────────────────────────
const Reservas: React.FC = () => {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [filterImovel, setFilterImovel] = useState("all");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [editOpen, setEditOpen] = useState(false);
  const [editingReserva, setEditingReserva] = useState<Reserva | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchData = async () => {
    const [{ data: reservasData }, { data: imoveisData }] = await Promise.all([
      supabase
        .from("reservas")
        .select("*, imoveis(nome_imovel)")
        .order("data_inicio", { ascending: false }),
      supabase.from("imoveis").select("id, nome_imovel").order("nome_imovel"),
    ]);

    setReservas(
      (reservasData || []).map((r: any) => ({ ...r, imovel: r.imoveis }))
    );
    setImoveis(imoveisData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const valorBruto = form.valor_bruto ? parseFloat(form.valor_bruto) : null;
    const valorLiquido = form.valor_liquido ? parseFloat(form.valor_liquido) : null;
    const taxaLimpeza = form.taxa_limpeza ? parseFloat(form.taxa_limpeza) : null;
    const valorProprietario = calcValorProprietario(valorLiquido, taxaLimpeza);

    const { error } = await supabase.from("reservas").insert({
      imovel_id: form.imovel_id,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      valor_bruto: valorBruto,
      valor_liquido_proprietario: valorProprietario,
      taxa_limpeza: taxaLimpeza,
      observacoes: form.observacoes || null,
    });

    if (error) {
      toast({ title: "Erro ao criar reserva", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reserva cadastrada!" });
      setOpen(false);
      setForm(emptyForm);
      fetchData();
    }

    setSubmitting(false);
  };

  const openEdit = (r: Reserva) => {
    setEditingReserva(r);
    // Reverse-calc valor_liquido from stored valor_liquido_proprietario
    // stored = liquido - limpeza - comissao (25% do liquido) => liquido = (stored + limpeza) / 0.75
    const limpeza = r.taxa_limpeza ?? 0;
    const liquidoRecalc = r.valor_liquido_proprietario != null
      ? (r.valor_liquido_proprietario + limpeza) / 0.75
      : null;

    setEditForm({
      imovel_id: r.imovel_id,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim,
      valor_bruto: r.valor_bruto != null ? String(r.valor_bruto) : "",
      valor_liquido: liquidoRecalc != null ? String(liquidoRecalc) : "",
      taxa_limpeza: r.taxa_limpeza != null ? String(r.taxa_limpeza) : "",
      observacoes: r.observacoes || "",
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReserva) return;
    setEditSubmitting(true);

    const valorBruto = editForm.valor_bruto ? parseFloat(editForm.valor_bruto) : null;
    const valorLiquido = editForm.valor_liquido ? parseFloat(editForm.valor_liquido) : null;
    const taxaLimpeza = editForm.taxa_limpeza ? parseFloat(editForm.taxa_limpeza) : null;
    const valorProprietario = calcValorProprietario(valorLiquido, taxaLimpeza);

    const { error } = await supabase
      .from("reservas")
      .update({
        imovel_id: editForm.imovel_id,
        data_inicio: editForm.data_inicio,
        data_fim: editForm.data_fim,
        valor_bruto: valorBruto,
        valor_liquido_proprietario: valorProprietario,
        taxa_limpeza: taxaLimpeza,
        observacoes: editForm.observacoes || null,
      })
      .eq("id", editingReserva.id);

    if (error) {
      toast({ title: "Erro ao editar reserva", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reserva atualizada!" });
      setEditOpen(false);
      setEditingReserva(null);
      fetchData();
    }

    setEditSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("reservas").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir reserva", variant: "destructive" });
    } else {
      toast({ title: "Reserva excluída" });
      fetchData();
    }
    setDeleteId(null);
  };

  const filteredReservas =
    filterImovel === "all"
      ? reservas
      : reservas.filter((r) => r.imovel_id === filterImovel);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-foreground tracking-wide">Reservas</h1>
            <p className="text-muted-foreground mt-1">Gerencie as reservas de todos os imóveis</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nova Reserva
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-foreground">Cadastrar Reserva</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 mt-2">
                <ReservaFormFields form={form} setForm={setForm} imoveis={imoveis} />
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting || !form.imovel_id} className="flex-1">
                    {submitting ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtro */}
        <div className="flex items-center gap-3">
          <Label className="text-muted-foreground text-sm">Filtrar por imóvel:</Label>
          <Select value={filterImovel} onValueChange={setFilterImovel}>
            <SelectTrigger className="w-56 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all" className="text-foreground">Todos os imóveis</SelectItem>
              {imoveis.map((i) => (
                <SelectItem key={i.id} value={i.id} className="text-foreground">
                  {i.nome_imovel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredReservas.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">Nenhuma reserva encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">Imóvel</TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">Check-in</TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">Check-out</TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">Valor Bruto</TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">Tx. Limpeza</TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">Comissão CW</TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">Proprietário</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReservas.map((r) => {
                  const comissao = r.valor_bruto ? r.valor_bruto * COMISSAO_RATE : null;
                  return (
                    <TableRow key={r.id} className="border-border hover:bg-muted/30">
                      <TableCell className="text-foreground font-medium">{r.imovel?.nome_imovel || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(r.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-muted-foreground">{fmt(r.valor_bruto)}</TableCell>
                      <TableCell className="text-muted-foreground">{fmt(r.taxa_limpeza)}</TableCell>
                      <TableCell className="text-muted-foreground">{fmt(comissao)}</TableCell>
                      <TableCell className="text-primary font-semibold">{fmt(r.valor_liquido_proprietario)}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)} className="h-8 w-8 hover:text-primary">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)} className="h-8 w-8 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Dialog Editar Reserva */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-foreground">Editar Reserva</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <ReservaFormFields form={editForm} setForm={setEditForm} imoveis={imoveis} />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={editSubmitting || !editForm.imovel_id} className="flex-1">
                {editSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Excluir Reserva */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir reserva?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação não pode ser desfeita. A reserva será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
};

export default Reservas;
