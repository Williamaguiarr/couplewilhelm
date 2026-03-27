import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfMonth, endOfMonth, endOfDay, isWithinInterval, parseISO } from "date-fns";
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
import { useTheme } from "@/contexts/ThemeContext";
import { buildPdfPalette, getPdfLogoEscuro } from "@/hooks/use-pdf-theme";

interface Reserva {
  id: string;
  data_inicio: string;
  data_fim: string;
  valor_bruto: number | null;
  valor_liquido_proprietario: number | null;
  taxa_limpeza: number | null;
  comissao_plataforma: number | null;
  observacoes: string | null;
  imovel_id: string;
  imovel?: { nome_imovel: string };
}

interface Imovel {
  id: string;
  nome_imovel: string;
  proprietario_id: string | null;
  proprietario_id_2: string | null;
}

const fmt = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";

const toNum = (v: string | number | null): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return n == null || isNaN(n) ? null : n;
};

const calcValorLiquido = (
  valorBruto: string | number | null,
  taxaLimpeza: string | number | null,
  comissaoPlataforma: string | number | null = 0
): number | null => {
  const bruto = toNum(valorBruto);
  if (bruto == null) return null;
  const limpeza = toNum(taxaLimpeza) ?? 0;
  const plataforma = toNum(comissaoPlataforma) ?? 0;
  return bruto - limpeza - plataforma;
};

const calcComissao = (valorLiquido: number | null, rate: number): number => {
  if (valorLiquido == null) return 0;
  return valorLiquido * rate;
};

const calcValorProprietario = (valorLiquido: number | null, rate: number): number | null => {
  if (valorLiquido == null) return null;
  return valorLiquido * (1 - rate);
};

const emptyForm = {
  imovel_id: "",
  data_inicio: "",
  data_fim: "",
  valor_bruto: "",
  taxa_limpeza: "",
  comissao_plataforma: "",
  observacoes: "",
};

type FormState = typeof emptyForm;

// ─── Reusable form fields ───────────────────────────────────────────────────
const ReservaFormFields = ({
  form,
  setForm,
  imoveis,
  comissaoRate,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  imoveis: Imovel[];
  comissaoRate: number;
}) => {
  const comissaoPlataforma = toNum(form.comissao_plataforma) ?? 0;
  const valorLiquido = calcValorLiquido(form.valor_bruto, form.taxa_limpeza, comissaoPlataforma);
  const comissao = calcComissao(valorLiquido, comissaoRate);
  const valorProprietario = calcValorProprietario(valorLiquido, comissaoRate);
  const pct = Math.round(comissaoRate * 100);

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

      {/* Comissão de Plataforma (OTA) */}
      <div className="space-y-2">
        <Label className="text-muted-foreground">
          Comissão Plataforma OTA (R$)
          <span className="ml-1.5 text-xs text-muted-foreground/60 font-normal">ex: Booking.com — deduzida antes da CW</span>
        </Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={form.comissao_plataforma}
          onChange={(e) => setForm({ ...form, comissao_plataforma: e.target.value })}
          placeholder="0,00 (opcional)"
          className="bg-background"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Valor Base Líquido</Label>
          <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm">
            {valorLiquido != null ? fmt(valorLiquido) : "—"}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Comissão CW ({pct}% sobre base)</Label>
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
  const [comissaoRate, setComissaoRate] = useState<number>(0.25);
  const [ownerRates, setOwnerRates] = useState<Record<string, number>>({});
  const [filterImovel, setFilterImovel] = useState("all");
  const [filterDe, setFilterDe] = useState<Date | undefined>(startOfMonth(new Date()));
  const [filterAte, setFilterAte] = useState<Date | undefined>(endOfMonth(new Date()));
  const [filterSemValores, setFilterSemValores] = useState(false);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [editOpen, setEditOpen] = useState(false);
  const [editingReserva, setEditingReserva] = useState<Reserva | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { toast } = useToast();

  const gerarPDF = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const now = new Date();

    // ── Paleta do tema do admin ──────────────────────────────────────────────
    const { primary, accent, textOnPrimary, lightGray, bodyText } = buildPdfPalette(
      theme.corPrimaria,
      theme.corSecundaria,
      theme.corTexto,
    );
    const companyName = (theme.nomeEmpresa || "Couple Wilhelm").toUpperCase();

    // ── Fundo header ─────────────────────────────────────────────────────────
    doc.setFillColor(...primary);
    doc.rect(0, 0, pageW, 42, "F");
    doc.setFillColor(...accent);
    doc.rect(0, 42, pageW, 0.8, "F");

    // ── Logo ─────────────────────────────────────────────────────────────────
    const logoUrl = theme.logoUrl || await getPdfLogoEscuro();
    if (logoUrl) {
      try { doc.addImage(logoUrl, "PNG", 10, 4, 52, 34); } catch (_) {}
    }

    // ── Título do relatório ───────────────────────────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...accent);
    doc.text("RELATÓRIO DE RESERVAS", pageW - 14, 16, { align: "right" });

    doc.setFontSize(7);
    doc.setTextColor(...textOnPrimary);
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
    let totalBruto = 0, totalLimpeza = 0, totalPlataforma = 0, totalLiquido = 0, totalComissao = 0, totalProprietario = 0;
    filteredReservas.forEach((r) => {
      const bruto = r.valor_bruto || 0;
      const limpeza = r.taxa_limpeza || 0;
      const plataforma = r.comissao_plataforma || 0;
      const liquido = bruto - limpeza - plataforma;
      const rate = getRateForImovel(r.imovel_id);
      const comissao = liquido * rate;
      totalBruto += bruto;
      totalLimpeza += limpeza;
      totalPlataforma += plataforma;
      totalLiquido += liquido;
      totalComissao += comissao;
      totalProprietario += liquido - comissao;
    });

    const fmtPDF = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // ── Cards de resumo financeiro ────────────────────────────────────────────
    const summaryItems = [
      { label: "Valor Bruto Total", value: fmtPDF(totalBruto) },
      { label: "Tx. Limpeza", value: fmtPDF(totalLimpeza) },
      { label: "Comissão OTA", value: fmtPDF(totalPlataforma) },
      { label: `Comissão (${Math.round(comissaoRate * 100)}%)`, value: fmtPDF(totalComissao) },
      { label: "Repasse Proprietários", value: fmtPDF(totalProprietario), highlight: true },
    ];

    const cardW = (pageW - 28 - (summaryItems.length - 1) * 4) / summaryItems.length;
    const cardY = 48;
    const cardH = 22;

    summaryItems.forEach((item, i) => {
      const x = 14 + i * (cardW + 4);
      doc.setFillColor(...(item.highlight ? primary : lightGray));
      doc.roundedRect(x, cardY, cardW, cardH, 2, 2, "F");
      if (item.highlight) {
        doc.setDrawColor(...accent);
        doc.setLineWidth(0.4);
        doc.roundedRect(x, cardY, cardW, cardH, 2, 2, "S");
      }
      doc.setFontSize(6.5);
      doc.setTextColor(...(item.highlight ? accent : [120, 115, 105] as [number, number, number]));
      doc.text(item.label.toUpperCase(), x + cardW / 2, cardY + 8, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(item.highlight ? textOnPrimary : primary));
      doc.text(item.value, x + cardW / 2, cardY + 17, { align: "center" });
      doc.setFont("helvetica", "normal");
    });

    doc.setDrawColor(...accent);
    doc.setLineWidth(0.3);
    doc.line(14, cardY + cardH + 4, pageW - 14, cardY + cardH + 4);

    // ── Tabela de reservas ────────────────────────────────────────────────────
    const tableData = filteredReservas.map((r) => {
      const bruto = r.valor_bruto || 0;
      const limpeza = r.taxa_limpeza || 0;
      const plataforma = r.comissao_plataforma || 0;
      const liquido = bruto - limpeza - plataforma;
      const comissao = liquido * comissaoRate;
      const proprietario = liquido - comissao;
      return [
        r.imovel?.nome_imovel || "—",
        new Date(r.data_inicio + "T12:00:00").toLocaleDateString("pt-BR"),
        new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR"),
        fmtPDF(bruto),
        fmtPDF(limpeza),
        plataforma > 0 ? fmtPDF(plataforma) : "—",
        fmtPDF(liquido),
        fmtPDF(comissao),
        fmtPDF(proprietario),
        r.observacoes || "",
      ];
    });

    autoTable(doc, {
      startY: cardY + cardH + 8,
      head: [["Imóvel", "Check-in", "Check-out", "V. Bruto", "Limpeza", "Comissão OTA", "Base Liq.", "Comissão", "Proprietário", "Obs."]],
      body: tableData,
      headStyles: { fillColor: primary, textColor: accent, fontSize: 7, fontStyle: "bold", cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
      bodyStyles: { fontSize: 7.5, textColor: bodyText, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
      alternateRowStyles: { fillColor: lightGray },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 16, halign: "center" },
        2: { cellWidth: 16, halign: "center" },
        3: { cellWidth: 20, halign: "right" },
        4: { cellWidth: 17, halign: "right" },
        5: { cellWidth: 20, halign: "right" },
        6: { cellWidth: 20, halign: "right" },
        7: { cellWidth: 20, halign: "right" },
        8: { cellWidth: 22, halign: "right", fontStyle: "bold", textColor: primary },
        9: { cellWidth: "auto" },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const footerY = pageH - 8;
        doc.setFillColor(...primary);
        doc.rect(0, footerY - 4, pageW, 14, "F");
        doc.setFontSize(6.5);
        doc.setTextColor(...accent);
        doc.text(`${companyName} — Gestão de Imóveis`, 14, footerY + 1);
        doc.setTextColor(...textOnPrimary);
        doc.text(`Página ${data.pageNumber}`, pageW - 14, footerY + 1, { align: "right" });
      },
    });

    doc.save(`relatorio-reservas-${now.toISOString().split("T")[0]}.pdf`);
    toast({ title: "Relatório gerado com sucesso!" });
  };

  const fetchData = async () => {
    const [{ data: reservasData }, { data: imoveisData }] = await Promise.all([
      supabase
        .from("reservas")
        .select("*, imoveis(nome_imovel)")
        .order("data_inicio", { ascending: false }),
      supabase.from("imoveis").select("id, nome_imovel, proprietario_id, proprietario_id_2").order("nome_imovel"),
    ]);

    setReservas(
      (reservasData || []).map((r: any) => ({ ...r, imovel: r.imoveis }))
    );
    setImoveis(imoveisData || []);

    // Buscar comissão do admin como fallback
    if (user) {
      const { data: configData } = await supabase
        .from("admin_configs" as any)
        .select("comissao_cw")
        .eq("admin_id", user.id)
        .maybeSingle();
      if (configData) {
        const cfg = configData as any;
        if (cfg.comissao_cw != null) setComissaoRate(cfg.comissao_cw);
      }
    }

    // Buscar comissão por proprietário
    const ownerIds = new Set<string>();
    (imoveisData || []).forEach((im: any) => {
      if (im.proprietario_id) ownerIds.add(im.proprietario_id);
      if (im.proprietario_id_2) ownerIds.add(im.proprietario_id_2);
    });
    if (ownerIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, comissao_percentual")
        .in("id", Array.from(ownerIds));
      const rates: Record<string, number> = {};
      (profiles || []).forEach((p: any) => {
        rates[p.id] = (p.comissao_percentual ?? 25) / 100;
      });
      setOwnerRates(rates);
    }

    setLoading(false);
  };

  // Helper: get commission rate for a given imovel_id based on owner
  const getRateForImovel = (imovelId: string): number => {
    const im = imoveis.find((i) => i.id === imovelId);
    if (im?.proprietario_id && ownerRates[im.proprietario_id] != null) {
      return ownerRates[im.proprietario_id];
    }
    return comissaoRate; // fallback to admin rate
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const rate = getRateForImovel(form.imovel_id);
    const valorBruto = form.valor_bruto ? parseFloat(form.valor_bruto) : null;
    const taxaLimpeza = form.taxa_limpeza ? parseFloat(form.taxa_limpeza) : null;
    const comissaoPlataforma = form.comissao_plataforma ? parseFloat(form.comissao_plataforma) : null;
    const valorLiquido = calcValorLiquido(valorBruto, taxaLimpeza, comissaoPlataforma ?? 0);
    const valorProprietario = calcValorProprietario(valorLiquido, rate);

    const { error } = await supabase.from("reservas").insert({
      imovel_id: form.imovel_id,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      valor_bruto: valorBruto,
      valor_liquido_proprietario: valorProprietario,
      taxa_limpeza: taxaLimpeza,
      comissao_plataforma: comissaoPlataforma,
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
      comissao_plataforma: r.comissao_plataforma != null ? String(r.comissao_plataforma) : "",
      observacoes: r.observacoes || "",
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReserva) return;
    setEditSubmitting(true);

    const rate = getRateForImovel(editForm.imovel_id);
    const valorBruto = editForm.valor_bruto ? parseFloat(editForm.valor_bruto) : null;
    const taxaLimpeza = editForm.taxa_limpeza ? parseFloat(editForm.taxa_limpeza) : null;
    const comissaoPlataforma = editForm.comissao_plataforma ? parseFloat(editForm.comissao_plataforma) : null;
    const valorLiquido = calcValorLiquido(valorBruto, taxaLimpeza, comissaoPlataforma ?? 0);
    const valorProprietario = calcValorProprietario(valorLiquido, rate);

    const { error } = await supabase
      .from("reservas")
      .update({
        imovel_id: editForm.imovel_id,
        data_inicio: editForm.data_inicio,
        data_fim: editForm.data_fim,
        valor_bruto: valorBruto,
        valor_liquido_proprietario: valorProprietario,
        taxa_limpeza: taxaLimpeza,
        comissao_plataforma: comissaoPlataforma,
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

  const semValoresCount = reservas.filter((r) => r.valor_bruto == null).length;

  const filteredReservas = reservas.filter((r) => {
    const matchImovel = filterImovel === "all" || r.imovel_id === filterImovel;

    let matchPeriodo = true;
    if (filterDe || filterAte) {
      const dataFim = parseISO(r.data_fim);
      if (filterDe && filterAte) {
        // Use endOfDay on filterAte so that a checkout on the last selected day is included
        matchPeriodo = isWithinInterval(dataFim, { start: filterDe, end: endOfDay(filterAte) });
      } else if (filterDe) {
        matchPeriodo = dataFim >= filterDe;
      } else if (filterAte) {
        matchPeriodo = dataFim <= endOfDay(filterAte);
      }
    }

    const matchSemValores = !filterSemValores || r.valor_bruto == null;

    return matchImovel && matchPeriodo && matchSemValores;
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
                <ReservaFormFields form={form} setForm={setForm} imoveis={imoveis} comissaoRate={getRateForImovel(form.imovel_id)} />
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

            {/* Filtro Sem Valores */}
            {semValoresCount > 0 && (
              <Button
                variant={filterSemValores ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterSemValores((v) => !v)}
                className={cn(
                  "gap-1.5 self-end",
                  filterSemValores
                    ? "bg-warning text-warning-foreground hover:bg-warning/90 border-warning"
                    : "border-warning/50 text-warning hover:bg-warning/10 hover:text-warning"
                )}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Sem valores ({semValoresCount})
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
                  const valorLiquido = calcValorLiquido(r.valor_bruto, r.taxa_limpeza, r.comissao_plataforma ?? 0);
                  const comissao = calcComissao(valorLiquido, comissaoRate);
                  const semValores = r.valor_bruto == null;
                  return (
                    <TableRow key={r.id} className={cn("border-border hover:bg-muted/30", semValores && "bg-warning/5 hover:bg-warning/10")}>
                      <TableCell className="text-foreground font-medium">
                        <div className="flex items-center gap-2">
                          {r.imovel?.nome_imovel || "—"}
                          {semValores && (
                            <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/20 text-xs font-medium gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Sem valores
                            </Badge>
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
            <ReservaFormFields form={editForm} setForm={setEditForm} imoveis={imoveis} comissaoRate={getRateForImovel(editForm.imovel_id)} />
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
