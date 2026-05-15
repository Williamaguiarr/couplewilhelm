import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
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
import { Plus, CalendarDays, Trash2, Pencil, FileText, X, AlertCircle, Sparkles } from "lucide-react";
import GanhosExtrasDialog from "@/components/reservas/GanhosExtrasDialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/layout/PageTransition";
import { useTheme } from "@/contexts/ThemeContext";
import {
  createPdfDoc, drawHeader, drawSummaryCards,
  drawFooterAllPages, makeAutoTableFooterCallback, premiumTableStyles,
  fmtBRL, genTimestamp,
} from "@/lib/pdf/builder";

interface Reserva {
  id: string;
  data_inicio: string;
  data_fim: string;
  valor_bruto: number | null;
  valor_liquido_proprietario: number | null;
  taxa_limpeza: number | null;
  comissao_plataforma: number | null;
  taxa_comissao_reserva: number | null;
  observacoes: string | null;
  imovel_id: string;
  num_hospedes: number | null;
  hora_checkin_override: string | null;
  hora_checkout_override: string | null;
  imovel?: { nome_imovel: string };
  ganhos_extras?: any[];
}

interface Imovel {
  id: string;
  nome_imovel: string;
  proprietario_id: string | null;
  proprietario_id_2: string | null;
  taxa_comissao?: number | null;
  hora_checkin?: string | null;
  hora_checkout?: string | null;
}

import { formatBRL as fmt, toNum } from "@/lib/supabase-helpers";


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
  taxa_comissao_reserva: "",
  observacoes: "",
  num_hospedes: "",
};

const calcDuracaoEstadia = (dataInicio: string, dataFim: string): number | null => {
  if (!dataInicio || !dataFim) return null;
  // Ensure we are parsing YYYY-MM-DD correctly by splitting and using Date(y, m-1, d)
  // This avoids timezone shifts and "US format" interpretation issues
  const [y1, m1, d1] = dataInicio.split("-").map(Number);
  const [y2, m2, d2] = dataFim.split("-").map(Number);
  
  if (isNaN(y1) || isNaN(y2)) return null;

  const start = new Date(y1, m1 - 1, d1, 12, 0, 0);
  const end = new Date(y2, m2 - 1, d2, 12, 0, 0);
  
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : null;
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
  const comissaoPersonalizadaStr = form.taxa_comissao_reserva;
  const comissaoEffective = comissaoPersonalizadaStr !== "" 
    ? parseFloat(comissaoPersonalizadaStr) / 100 
    : comissaoRate;

  const comissaoPlataforma = toNum(form.comissao_plataforma) ?? 0;
  const valorLiquido = calcValorLiquido(form.valor_bruto, form.taxa_limpeza, comissaoPlataforma);
  const comissao = calcComissao(valorLiquido, comissaoEffective);
  const valorProprietario = calcValorProprietario(valorLiquido, comissaoEffective);
  const pct = Math.round(comissaoEffective * 100);

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

      {/* Duração da estadia */}
      {(() => {
        const duracao = calcDuracaoEstadia(form.data_inicio, form.data_fim);
        return duracao != null ? (
          <div className="rounded-md border border-border bg-muted/20 px-4 py-2 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-sm text-foreground font-medium">Duração da estadia: {duracao} {duracao === 1 ? 'dia' : 'dias'}</span>
          </div>
        ) : null;
      })()}

      {/* Número de hóspedes */}
      <div className="space-y-2">
        <Label className="text-muted-foreground">Nº de Hóspedes</Label>
        <Input
          type="number"
          min="1"
          value={form.num_hospedes}
          onChange={(e) => setForm({ ...form, num_hospedes: e.target.value })}
          placeholder="Ex: 2"
          className="bg-background"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Valor Bruto (R$)</Label>
          <CurrencyInput
            value={form.valor_bruto}
            onChange={(v) => setForm({ ...form, valor_bruto: v })}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Taxa de Limpeza (R$)</Label>
          <CurrencyInput
            value={form.taxa_limpeza}
            onChange={(v) => setForm({ ...form, taxa_limpeza: v })}
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
        <CurrencyInput
          value={form.comissao_plataforma}
          onChange={(v) => setForm({ ...form, comissao_plataforma: v })}
          className="bg-background"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Comissão ADM (%)</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={form.taxa_comissao_reserva}
            onChange={(e) => setForm({ ...form, taxa_comissao_reserva: e.target.value })}
            placeholder="Comissão padrão"
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Valor Base Líquido</Label>
          <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm">
            {valorLiquido != null ? fmt(valorLiquido) : "—"}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground">Valor Comissão ADM ({pct}% sobre base)</Label>
        <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm font-medium text-foreground">
          {valorLiquido != null ? fmt(comissao) : "—"}
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
  const [ganhosOpen, setGanhosOpen] = useState(false);
  const [selectedReservaForGanhos, setSelectedReservaForGanhos] = useState<{id: string, imovelId: string} | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [syncAlerts, setSyncAlerts] = useState<any[]>([]);

  const { toast } = useToast();

  const gerarPDF = async () => {
    try {
    const { doc, palette, companyName, logoData, pageW, pageH } = await createPdfDoc(theme, "landscape");

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

    // ── Header
    let y = drawHeader(doc, {
      title: "Relatório de Reservas",
      subtitle: companyName,
      lines: [
        `Imóvel: ${imovelNome}`,
        `Período: ${periodoLabel}`,
        genTimestamp(),
      ],
      palette, logoData, companyName, pageW,
    });

    y += 6;

    // ── Totais
    let totalBruto = 0, totalLimpeza = 0, totalPlataforma = 0, totalLiquido = 0, totalComissao = 0, totalProprietario = 0, totalGanhosExtras = 0;
    filteredReservas.forEach((r) => {
      const bruto = r.valor_bruto || 0;
      const limpeza = r.taxa_limpeza || 0;
      const plataforma = r.comissao_plataforma || 0;
      const liquido = bruto - limpeza - plataforma;
      const rate = r.taxa_comissao_reserva != null ? r.taxa_comissao_reserva / 100 : getRateForImovel(r.imovel_id);
      
      const valorPropBase = liquido * (1 - rate);
      const comissaoBase = liquido * rate;
      
      let comissaoGanhosExtras = 0;
      let repasseGanhosExtras = 0;
      let brutoGanhosExtras = 0;

      (r.ganhos_extras || []).forEach(g => {
        const regime = g.regime_comissao || (g.aplicar_comissao ? "com_comissao" : "sem_comissao");
        if (regime === "com_comissao") {
          const com = g.valor * rate;
          comissaoGanhosExtras += com;
          repasseGanhosExtras += (g.valor - com);
          brutoGanhosExtras += g.valor;
        } else if (regime === "sem_comissao") {
          repasseGanhosExtras += g.valor;
          brutoGanhosExtras += g.valor;
        } else if (regime === "exclusivo_adm") {
          comissaoGanhosExtras += g.valor;
        }
      });

      totalBruto += bruto + brutoGanhosExtras;
      totalLimpeza += limpeza;
      totalPlataforma += plataforma;
      totalLiquido += liquido + brutoGanhosExtras;
      totalComissao += comissaoBase + comissaoGanhosExtras;
      totalProprietario += valorPropBase + repasseGanhosExtras;
      totalGanhosExtras += brutoGanhosExtras;
    });

    // ── Summary cards
    y = drawSummaryCards(doc, [
      { label: "Valor Bruto Total", value: fmtBRL(totalBruto) },
      { label: "Tx. Limpeza", value: fmtBRL(totalLimpeza) },
      { label: "Comissão OTA", value: fmtBRL(totalPlataforma) },
      { label: "Ganhos Extras", value: fmtBRL(totalGanhosExtras) },
      { label: "Comissão ADM", value: fmtBRL(totalComissao) },
      { label: "Repasse Proprietários", value: fmtBRL(totalProprietario), highlight: true },
    ], { startY: y, pageW, palette });

    y += 2;

    // ── Tabela de reservas
    const tableData = filteredReservas.map((r) => {
      const bruto = r.valor_bruto || 0;
      const limpeza = r.taxa_limpeza || 0;
      const plataforma = r.comissao_plataforma || 0;
      const liquido = bruto - limpeza - plataforma;
      const rate = r.taxa_comissao_reserva != null ? r.taxa_comissao_reserva / 100 : getRateForImovel(r.imovel_id);
      
      let repasseGanhosExtras = 0;
      let comissaoGanhosExtras = 0;
      let brutoGanhosExtras = 0;
      (r.ganhos_extras || []).forEach(g => {
        const regime = g.regime_comissao || (g.aplicar_comissao ? "com_comissao" : "sem_comissao");
        if (regime === "com_comissao") {
          const com = g.valor * rate;
          comissaoGanhosExtras += com;
          repasseGanhosExtras += (g.valor - com);
          brutoGanhosExtras += g.valor;
        } else if (regime === "sem_comissao") {
          repasseGanhosExtras += g.valor;
          brutoGanhosExtras += g.valor;
        } else if (regime === "exclusivo_adm") {
          comissaoGanhosExtras += g.valor;
        }
      });

      const valorPropBase = liquido * (1 - rate);
      const comissaoTotal = (liquido * rate) + comissaoGanhosExtras;
      const proprietarioTotal = valorPropBase + repasseGanhosExtras;
      return [
        r.imovel?.nome_imovel || "—",
        (() => {
          const [y, m, d] = r.data_inicio.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
        })(),
        (() => {
          const [y, m, d] = r.data_fim.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
        })(),
        fmtBRL(bruto),
        fmtBRL(limpeza),
        plataforma > 0 ? fmtBRL(plataforma) : "—",
        fmtBRL(liquido),
        fmtBRL(comissaoTotal),
        fmtBRL(proprietarioTotal),
        r.observacoes || "",
      ];
    });

    const footerCb = makeAutoTableFooterCallback(doc, palette, companyName, pageW, pageH);

    autoTable(doc, {
      startY: y,
      head: [["Imóvel", "Check-in", "Check-out", "V. Bruto", "Limpeza", "Comissão OTA", "Base Liq.", "Comissão", "Proprietário", "Obs."]],
      body: tableData,
      ...premiumTableStyles(palette),
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 24, halign: "right" },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 24, halign: "right" },
        7: { cellWidth: 22, halign: "right" },
        8: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: palette.primary },
        9: { cellWidth: "auto" },
      },
      didDrawPage: footerCb,
    });

    // Footer on all pages
    drawFooterAllPages(doc, palette, companyName, pageW, pageH);

    doc.save(`relatorio-reservas-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "Relatório gerado com sucesso!" });
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast({ title: "Erro ao gerar relatório", description: String(err), variant: "destructive" });
    }
  };

  const fetchData = async () => {
    const [{ data: reservasData }, { data: imoveisData }, { data: alertsData }, { data: ganhosData }] = await Promise.all([
      supabase
        .from("reservas")
        .select("*, imoveis(nome_imovel)")
        .order("data_inicio", { ascending: false }),
      supabase.from("imoveis").select("id, nome_imovel, proprietario_id, proprietario_id_2, taxa_comissao").order("nome_imovel"),
      supabase.from("ical_sync_alerts").select("*, reservas(nome_hospede, data_inicio, data_fim), imoveis(nome_imovel)").eq("status", "pending"),
      supabase.from("ganhos_extras" as any).select("reserva_id, valor, regime_comissao, aplicar_comissao")
    ]);

    // Mapear ganhos por reserva
    const ganhosPorReserva: Record<string, any[]> = {};
    (ganhosData || []).forEach((g: any) => {
      if (g.reserva_id) {
        if (!ganhosPorReserva[g.reserva_id]) ganhosPorReserva[g.reserva_id] = [];
        ganhosPorReserva[g.reserva_id].push(g);
      }
    });

    setReservas(
      (reservasData || []).map((r: any) => ({ 
        ...r, 
        imovel: r.imoveis,
        ganhos_extras: ganhosPorReserva[r.id] || []
      }))
    );
    setImoveis(imoveisData || []);
    setSyncAlerts(alertsData || []);

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

  // Helper: get commission rate for a given imovel_id
  const getRateForImovel = (imovelId: string): number => {
    const im = imoveis.find((i) => i.id === imovelId);
    if (im?.taxa_comissao != null) return im.taxa_comissao / 100;
    if (im?.proprietario_id && ownerRates[im.proprietario_id] != null) {
      return ownerRates[im.proprietario_id];
    }
    return comissaoRate;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const rateDefault = getRateForImovel(form.imovel_id);
    const taxaComissaoReserva = form.taxa_comissao_reserva !== "" ? parseFloat(form.taxa_comissao_reserva) : null;
    const rate = taxaComissaoReserva !== null ? taxaComissaoReserva / 100 : rateDefault;

    const valorBruto = form.valor_bruto ? parseFloat(form.valor_bruto) : null;
    const taxaLimpeza = form.taxa_limpeza ? parseFloat(form.taxa_limpeza) : null;
    const comissaoPlataforma = form.comissao_plataforma ? parseFloat(form.comissao_plataforma) : null;
    const valorLiquido = calcValorLiquido(valorBruto, taxaLimpeza, comissaoPlataforma ?? 0);
    const valorProprietario = calcValorProprietario(valorLiquido, rate);

    const numHospedes = form.num_hospedes ? parseInt(form.num_hospedes) : null;

    const { error } = await supabase.from("reservas").insert({
      imovel_id: form.imovel_id,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      valor_bruto: valorBruto,
      valor_liquido_proprietario: valorProprietario,
      taxa_limpeza: taxaLimpeza,
      comissao_plataforma: comissaoPlataforma,
      taxa_comissao_reserva: taxaComissaoReserva,
      observacoes: form.observacoes || null,
      num_hospedes: numHospedes,
    } as any);

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
      taxa_comissao_reserva: r.taxa_comissao_reserva != null ? String(r.taxa_comissao_reserva) : "",
      observacoes: r.observacoes || "",
      num_hospedes: r.num_hospedes != null ? String(r.num_hospedes) : "",
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReserva) return;
    setEditSubmitting(true);

    const rateDefault = getRateForImovel(editForm.imovel_id);
    const taxaComissaoReserva = editForm.taxa_comissao_reserva !== "" ? parseFloat(editForm.taxa_comissao_reserva) : null;
    const rate = taxaComissaoReserva !== null ? taxaComissaoReserva / 100 : rateDefault;

    const valorBruto = editForm.valor_bruto ? parseFloat(editForm.valor_bruto) : null;
    const taxaLimpeza = editForm.taxa_limpeza ? parseFloat(editForm.taxa_limpeza) : null;
    const comissaoPlataforma = editForm.comissao_plataforma ? parseFloat(editForm.comissao_plataforma) : null;
    const valorLiquido = calcValorLiquido(valorBruto, taxaLimpeza, comissaoPlataforma ?? 0);
    const valorProprietario = calcValorProprietario(valorLiquido, rate);
    const numHospedes = editForm.num_hospedes ? parseInt(editForm.num_hospedes) : null;

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
        taxa_comissao_reserva: taxaComissaoReserva,
        observacoes: editForm.observacoes || null,
        num_hospedes: numHospedes,
      } as any)
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
      <div className="space-y-4 sm:space-y-6 w-full max-w-[100vw] overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-foreground">Reservas</h1>
            <p className="text-muted-foreground mt-1 text-sm">Gerencie as reservas de todos os imóveis</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {syncAlerts.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAlertsOpen(true)} 
                className="gap-2 bg-warning/10 text-warning border-warning/50 hover:bg-warning/20 animate-pulse"
              >
                <AlertCircle className="h-4 w-4" /> 
                {syncAlerts.length} Alerta{syncAlerts.length > 1 ? "s" : ""} iCal
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={gerarPDF} disabled={filteredReservas.length === 0} className="gap-2">
              <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Gerar</span> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setSelectedReservaForGanhos(null);
              setGanhosOpen(true);
            }} className="gap-2 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
              <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Ganhos</span> Extras
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova</span> Reserva
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
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
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            {/* Filtro por imóvel */}
            <div className="space-y-1.5 w-full sm:w-auto">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Imóvel</Label>
              <Select value={filterImovel} onValueChange={setFilterImovel}>
                <SelectTrigger className="w-full sm:w-52 bg-background border-border">
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
            <div className="space-y-1.5 w-[calc(50%-6px)] sm:w-auto">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">De</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-40 justify-start text-left font-normal bg-background border-border",
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
            <div className="space-y-1.5 w-[calc(50%-6px)] sm:w-auto">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Até</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-40 justify-start text-left font-normal bg-background border-border",
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

        <div className="bg-card border border-border rounded-xl overflow-hidden">
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
            <div className="overflow-x-auto">
            <div className="min-w-[900px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Hóspedes</TableHead>
                  <TableHead>Valor Bruto</TableHead>
                  <TableHead>Tx. Limpeza</TableHead>
                  <TableHead>Comissão ADM</TableHead>
                  <TableHead>Proprietário</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {filteredReservas.map((r: any) => {
                  const rateDefault = getRateForImovel(r.imovel_id);
                  const rateForRow = r.taxa_comissao_reserva != null ? r.taxa_comissao_reserva / 100 : rateDefault;
                  
                  const valorLiquidoBase = calcValorLiquido(r.valor_bruto, r.taxa_limpeza, r.comissao_plataforma ?? 0);
                  
                  // Calcular valor dos ganhos extras vinculados
                  const totalGanhosExtras = (r.ganhos_extras || []).reduce((acc: number, g: any) => acc + (g.valor || 0), 0);
                  const repasseGanhosExtras = (r.ganhos_extras || []).reduce((acc: number, g: any) => {
                    const regime = g.regime_comissao || (g.aplicar_comissao ? "com_comissao" : "sem_comissao");
                    if (regime === "com_comissao") return acc + (g.valor * (1 - rateForRow));
                    if (regime === "sem_comissao") return acc + g.valor;
                    return acc; // exclusivo_adm = 0 repasse
                  }, 0);

                  const comissaoGanhosExtras = (r.ganhos_extras || []).reduce((acc: number, g: any) => {
                    const regime = g.regime_comissao || (g.aplicar_comissao ? "com_comissao" : "sem_comissao");
                    if (regime === "com_comissao") return acc + (g.valor * rateForRow);
                    if (regime === "exclusivo_adm") return acc + g.valor;
                    return acc; // sem_comissao = 0 comissão
                  }, 0);

                  const comissaoTotal = (valorLiquidoBase != null ? valorLiquidoBase * rateForRow : 0) + comissaoGanhosExtras;
                  const valorPropBase = valorLiquidoBase != null ? valorLiquidoBase * (1 - rateForRow) : 0;
                  const repasseTotal = valorPropBase + repasseGanhosExtras;
                  
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
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {(() => {
                          const [y, m, d] = r.data_inicio.split("-").map(Number);
                          return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
                        })()}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {(() => {
                          const [y, m, d] = r.data_fim.split("-").map(Number);
                          return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
                        })()}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{calcDuracaoEstadia(r.data_inicio, r.data_fim) ?? "—"} {calcDuracaoEstadia(r.data_inicio, r.data_fim) === 1 ? "dia" : calcDuracaoEstadia(r.data_inicio, r.data_fim) ? "dias" : ""}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{r.num_hospedes ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {fmt(r.valor_bruto)}
                        {totalGanhosExtras > 0 && (
                          <div className="text-[10px] text-primary font-medium">
                            + {fmt(totalGanhosExtras)} (extra)
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmt(r.taxa_limpeza)}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmt(comissaoTotal)}</TableCell>
                      <TableCell className="text-primary font-semibold whitespace-nowrap">{fmt(repasseTotal)}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            setSelectedReservaForGanhos({ id: r.id, imovelId: r.imovel_id });
                            setGanhosOpen(true);
                          }} 
                          className="h-8 w-8 hover:text-primary"
                          title="Receitas Extras"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </Button>
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
            </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialog Editar Reserva */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
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

      <GanhosExtrasDialog
        open={ganhosOpen}
        onOpenChange={setGanhosOpen}
        imoveis={imoveis}
        onChanged={fetchData}
        reservaId={selectedReservaForGanhos?.id}
        imovelId={selectedReservaForGanhos?.imovelId}
      />

      <Dialog open={alertsOpen} onOpenChange={setAlertsOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" /> Alertas de Sincronização iCal
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              As reservas abaixo não foram encontradas no feed iCal mais recente e podem ter sido canceladas.
            </p>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {syncAlerts.map((alert) => (
              <div key={alert.id} className="p-3 border border-border rounded-lg bg-muted/20 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{alert.imoveis?.nome_imovel}</div>
                  <div className="text-xs text-muted-foreground">
                    Hóspede: {alert.reservas?.nome_hospede || "—"} | {(() => {
                      if (!alert.reservas?.data_inicio) return "—";
                      const [y, m, d] = alert.reservas.data_inicio.split("-").map(Number);
                      return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
                    })()} a {(() => {
                      if (!alert.reservas?.data_fim) return "—";
                      const [y, m, d] = alert.reservas.data_fim.split("-").map(Number);
                      return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
                    })()}
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">{alert.plataforma}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="h-8 px-3"
                    onClick={async () => {
                      await supabase.from("reservas").delete().eq("id", alert.reserva_id);
                      await supabase.from("ical_sync_alerts").update({ status: "resolved" }).eq("id", alert.id);
                      toast({ title: "Reserva excluída e alerta resolvido" });
                      fetchData();
                    }}
                  >
                    Excluir Reserva
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 px-3"
                    onClick={async () => {
                      await supabase.from("ical_sync_alerts").update({ status: "dismissed" }).eq("id", alert.id);
                      toast({ title: "Alerta ignorado" });
                      fetchData();
                    }}
                  >
                    Ignorar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default Reservas;
