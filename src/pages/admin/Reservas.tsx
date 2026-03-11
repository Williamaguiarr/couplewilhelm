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
import { Plus, CalendarDays, Trash2, Pencil, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

const toNum = (v: string | number | null): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return n == null || isNaN(n) ? null : n;
};

// Valor Líquido = Valor Bruto - Taxa de Limpeza
const calcValorLiquido = (valorBruto: string | number | null, taxaLimpeza: string | number | null): number | null => {
  const bruto = toNum(valorBruto);
  if (bruto == null) return null;
  const limpeza = toNum(taxaLimpeza) ?? 0;
  return bruto - limpeza;
};

// Comissão CW = 25% do Valor Líquido
const calcComissao = (valorLiquido: number | null): number => {
  if (valorLiquido == null) return 0;
  return valorLiquido * COMISSAO_RATE;
};

// Valor Proprietário = Valor Líquido - Comissão CW
const calcValorProprietario = (valorLiquido: number | null): number | null => {
  if (valorLiquido == null) return null;
  return valorLiquido * (1 - COMISSAO_RATE);
};

const emptyForm = {
  imovel_id: "",
  data_inicio: "",
  data_fim: "",
  valor_bruto: "",
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
  const valorLiquido = calcValorLiquido(form.valor_bruto, form.taxa_limpeza);
  const comissao = calcComissao(valorLiquido);
  const valorProprietario = calcValorProprietario(valorLiquido);

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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Valor Líquido (R$)</Label>
          <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm">
            {valorLiquido != null ? fmt(valorLiquido) : "—"}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Comissão CW (25% sobre líquido)</Label>
          <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm">
            {valorLiquido != null ? fmt(comissao) : "—"}
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

  const gerarPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const mesAno = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    // Header
    doc.setFontSize(20);
    doc.setTextColor(30, 30, 30);
    doc.text("Relatório de Reservas", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, 14, 28);

    const imovelNome = filterImovel !== "all"
      ? imoveis.find((i) => i.id === filterImovel)?.nome_imovel ?? "Todos"
      : "Todos os imóveis";
    doc.text(`Imóvel: ${imovelNome}`, 14, 34);

    // Totals summary
    let totalBruto = 0, totalLimpeza = 0, totalLiquido = 0, totalComissao = 0, totalProprietario = 0;
    filteredReservas.forEach((r) => {
      const bruto = r.valor_bruto || 0;
      const limpeza = r.taxa_limpeza || 0;
      const liquido = bruto - limpeza;
      const comissao = liquido * 0.25;
      const proprietario = liquido - comissao;
      totalBruto += bruto;
      totalLimpeza += limpeza;
      totalLiquido += liquido;
      totalComissao += comissao;
      totalProprietario += proprietario;
    });

    const fmtPDF = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Summary box
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 40, 182, 40, "F");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const summaryY = 50;
    doc.text(`Total Bruto: ${fmtPDF(totalBruto)}`, 20, summaryY);
    doc.text(`Taxa de Limpeza: ${fmtPDF(totalLimpeza)}`, 80, summaryY);
    doc.text(`Valor Líquido: ${fmtPDF(totalLiquido)}`, 20, summaryY + 10);
    doc.text(`Comissão CW (25%): ${fmtPDF(totalComissao)}`, 80, summaryY + 10);
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(`Repasse Total aos Proprietários: ${fmtPDF(totalProprietario)}`, 20, summaryY + 22);

    // Table
    const tableData = filteredReservas.map((r) => {
      const bruto = r.valor_bruto || 0;
      const limpeza = r.taxa_limpeza || 0;
      const liquido = bruto - limpeza;
      const comissao = liquido * 0.25;
      const proprietario = liquido - comissao;
      return [
        r.imovel?.nome_imovel || "—",
        new Date(r.data_inicio + "T12:00:00").toLocaleDateString("pt-BR"),
        new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR"),
        fmtPDF(bruto),
        fmtPDF(limpeza),
        fmtPDF(comissao),
        fmtPDF(proprietario),
        r.observacoes || "",
      ];
    });

    autoTable(doc, {
      startY: 88,
      head: [["Imóvel", "Check-in", "Check-out", "V. Bruto", "Limpeza", "Comissão CW", "Proprietário", "Obs."]],
      body: tableData,
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 18 },
        2: { cellWidth: 18 },
        3: { cellWidth: 22 },
        4: { cellWidth: 18 },
        5: { cellWidth: 24 },
        6: { cellWidth: 24 },
        7: { cellWidth: "auto" },
      },
      margin: { left: 14, right: 14 },
    });

    doc.save(`relatorio-reservas-${now.toISOString().split("T")[0]}.pdf`);
    toast({ title: "PDF gerado com sucesso!" });
  };

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
    const taxaLimpeza = form.taxa_limpeza ? parseFloat(form.taxa_limpeza) : null;
    const valorLiquido = calcValorLiquido(valorBruto, taxaLimpeza);
    const valorProprietario = calcValorProprietario(valorLiquido);

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
    setEditForm({
      imovel_id: r.imovel_id,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim,
      valor_bruto: r.valor_bruto != null ? String(r.valor_bruto) : "",
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
    const taxaLimpeza = editForm.taxa_limpeza ? parseFloat(editForm.taxa_limpeza) : null;
    const valorLiquido = calcValorLiquido(valorBruto, taxaLimpeza);
    const valorProprietario = calcValorProprietario(valorLiquido);

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
          <div className="flex gap-2">
            <Button variant="outline" onClick={gerarPDF} disabled={filteredReservas.length === 0} className="gap-2">
              <FileText className="h-4 w-4" /> Gerar PDF
            </Button>
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
                  // Valor Líquido = Bruto - Limpeza; Comissão CW = Líquido * 25%
                  const valorLiquido = calcValorLiquido(r.valor_bruto, r.taxa_limpeza);
                  const comissao = calcComissao(valorLiquido);
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
