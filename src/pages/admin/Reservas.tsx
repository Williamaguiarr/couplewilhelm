import React, { useEffect, useState } from "react";
import logoSrc from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { Plus, CalendarDays, Trash2, Pencil, FileText, X, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  const [filterDe, setFilterDe] = useState<Date | undefined>(startOfMonth(new Date()));
  const [filterAte, setFilterAte] = useState<Date | undefined>(endOfMonth(new Date()));
  const [filterSemValores, setFilterSemValores] = useState(false);
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
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const now = new Date();

    // ── Paleta da marca ──────────────────────────────────────────────────────
    const navy: [number, number, number] = [10, 25, 47];      // #0A192F
    const gold: [number, number, number] = [163, 163, 139];   // #A3A38B
    const cream: [number, number, number] = [240, 237, 232];  // #F0EDE8
    const white: [number, number, number] = [255, 255, 255];
    const lightGray: [number, number, number] = [245, 244, 241];

    // ── Fundo header navy ────────────────────────────────────────────────────
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageW, 42, "F");

    // Linha dourada sob o header
    doc.setFillColor(...gold);
    doc.rect(0, 42, pageW, 0.8, "F");

    // ── Logo ─────────────────────────────────────────────────────────────────
    try {
      doc.addImage(logoSrc, "PNG", 10, 4, 52, 34);
    } catch (_) { /* se falhar, continua sem logo */ }

    // ── Título do relatório (direita do header) ───────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gold);
    doc.text("RELATÓRIO DE RESERVAS", pageW - 14, 16, { align: "right" });

    doc.setFontSize(7);
    doc.setTextColor(...cream);
    const imovelNome = filterImovel !== "all"
      ? imoveis.find((i) => i.id === filterImovel)?.nome_imovel ?? "Todos"
      : "Todos os imóveis";
    const periodoLabel = filterDe && filterAte
      ? `${format(filterDe, "dd/MM/yyyy")} a ${format(filterAte, "dd/MM/yyyy")}`
      : filterDe
        ? `A partir de ${format(filterDe, "dd/MM/yyyy")}`
        : filterAte
          ? `Até ${format(filterAte, "dd/MM/yyyy")}`
          : "Todos os períodos";
    doc.text(`Imóvel: ${imovelNome}`, pageW - 14, 23, { align: "right" });
    doc.text(`Período: ${periodoLabel}`, pageW - 14, 29, { align: "right" });
    doc.text(
      `Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      pageW - 14, 35, { align: "right" }
    );

    // ── Calcular totais ───────────────────────────────────────────────────────
    let totalBruto = 0, totalLimpeza = 0, totalLiquido = 0, totalComissao = 0, totalProprietario = 0;
    filteredReservas.forEach((r) => {
      const bruto = r.valor_bruto || 0;
      const limpeza = r.taxa_limpeza || 0;
      const liquido = bruto - limpeza;
      const comissao = liquido * 0.25;
      totalBruto += bruto;
      totalLimpeza += limpeza;
      totalLiquido += liquido;
      totalComissao += comissao;
      totalProprietario += liquido - comissao;
    });

    const fmtPDF = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // ── Cards de resumo financeiro ────────────────────────────────────────────
    const summaryItems = [
      { label: "Valor Bruto Total", value: fmtPDF(totalBruto) },
      { label: "Taxa de Limpeza", value: fmtPDF(totalLimpeza) },
      { label: "Valor Líquido", value: fmtPDF(totalLiquido) },
      { label: "Comissão CW (25%)", value: fmtPDF(totalComissao) },
      { label: "Repasse Proprietários", value: fmtPDF(totalProprietario), highlight: true },
    ];

    const cardW = (pageW - 28 - (summaryItems.length - 1) * 4) / summaryItems.length;
    const cardY = 48;
    const cardH = 22;

    summaryItems.forEach((item, i) => {
      const x = 14 + i * (cardW + 4);
      doc.setFillColor(...(item.highlight ? navy : lightGray));
      doc.roundedRect(x, cardY, cardW, cardH, 2, 2, "F");

      if (item.highlight) {
        doc.setDrawColor(...gold);
        doc.setLineWidth(0.4);
        doc.roundedRect(x, cardY, cardW, cardH, 2, 2, "S");
      }

      doc.setFontSize(6.5);
      doc.setTextColor(...(item.highlight ? gold : [120, 115, 105] as [number, number, number]));
      doc.text(item.label.toUpperCase(), x + cardW / 2, cardY + 8, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(item.highlight ? cream : navy));
      doc.text(item.value, x + cardW / 2, cardY + 17, { align: "center" });
      doc.setFont("helvetica", "normal");
    });

    // Linha separadora dourada
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.3);
    doc.line(14, cardY + cardH + 4, pageW - 14, cardY + cardH + 4);

    // ── Tabela de reservas ────────────────────────────────────────────────────
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
        fmtPDF(liquido),
        fmtPDF(comissao),
        fmtPDF(proprietario),
        r.observacoes || "",
      ];
    });

    autoTable(doc, {
      startY: cardY + cardH + 8,
      head: [["Imóvel", "Check-in", "Check-out", "V. Bruto", "Limpeza", "V. Líquido", "Comissão CW", "Proprietário", "Obs."]],
      body: tableData,
      headStyles: {
        fillColor: navy,
        textColor: gold,
        fontSize: 7,
        fontStyle: "bold",
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [40, 40, 40] as [number, number, number],
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      },
      alternateRowStyles: { fillColor: lightGray },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 24, halign: "right" },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 24, halign: "right" },
        6: { cellWidth: 24, halign: "right" },
        7: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: navy },
        8: { cellWidth: "auto" },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Footer em cada página
        const footerY = pageH - 8;
        doc.setFillColor(...navy);
        doc.rect(0, footerY - 4, pageW, 14, "F");
        doc.setFontSize(6.5);
        doc.setTextColor(...gold);
        doc.text("COUPLE WILHELM — Gestão de Imóveis", 14, footerY + 1);
        doc.setTextColor(...cream);
        doc.text(
          `Página ${data.pageNumber}`,
          pageW - 14,
          footerY + 1,
          { align: "right" }
        );
      },
    });

    doc.save(`CW-relatorio-reservas-${now.toISOString().split("T")[0]}.pdf`);
    toast({ title: "Relatório gerado com sucesso!" });
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

  const filteredReservas = reservas.filter((r) => {
    const matchImovel = filterImovel === "all" || r.imovel_id === filterImovel;

    let matchPeriodo = true;
    if (filterDe || filterAte) {
      const dataFim = parseISO(r.data_fim + "T12:00:00");
      if (filterDe && filterAte) {
        matchPeriodo = isWithinInterval(dataFim, { start: filterDe, end: filterAte });
      } else if (filterDe) {
        matchPeriodo = dataFim >= filterDe;
      } else if (filterAte) {
        matchPeriodo = dataFim <= filterAte;
      }
    }

    return matchImovel && matchPeriodo;
  });

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

        {/* Filtros */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Filtro por imóvel */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Imóvel</Label>
              <Select value={filterImovel} onValueChange={setFilterImovel}>
                <SelectTrigger className="w-52 bg-background border-border">
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

            {/* Filtro De */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">De</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-40 justify-start text-left font-normal bg-background border-border",
                      !filterDe && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4 opacity-60" />
                    {filterDe ? format(filterDe, "dd/MM/yyyy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                  <Calendar
                    mode="single"
                    selected={filterDe}
                    onSelect={setFilterDe}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Filtro Até */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Até</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-40 justify-start text-left font-normal bg-background border-border",
                      !filterAte && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4 opacity-60" />
                    {filterAte ? format(filterAte, "dd/MM/yyyy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                  <Calendar
                    mode="single"
                    selected={filterAte}
                    onSelect={setFilterAte}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Limpar filtros de data */}
            {(filterDe || filterAte) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFilterDe(undefined); setFilterAte(undefined); }}
                className="text-muted-foreground hover:text-foreground gap-1.5 self-end"
              >
                <X className="h-3.5 w-3.5" /> Limpar período
              </Button>
            )}

            {/* Contador de resultados */}
            <div className="ml-auto self-end">
              <span className="text-xs text-muted-foreground">
                {filteredReservas.length} reserva{filteredReservas.length !== 1 ? "s" : ""} encontrada{filteredReservas.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
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
                      <TableCell className="text-foreground font-medium">
                        <div className="flex items-center gap-2">
                          {r.imovel?.nome_imovel || "—"}
                          {r.valor_bruto == null && (
                            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
                              Sem valores
                            </span>
                          )}
                        </div>
                      </TableCell>
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
