import React, { useEffect, useState, useCallback } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import {
  TrendingUp,
  CalendarCheck,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Building2,
  FileText,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useTheme } from "@/contexts/ThemeContext";
import { buildPdfPalette } from "@/hooks/use-pdf-theme";
import { useToast } from "@/hooks/use-toast";

interface Reserva {
  id: string;
  imovel_id: string;
  data_inicio: string;
  data_fim: string;
  valor_bruto: number | null;
  taxa_limpeza: number | null;
  comissao_plataforma: number | null;
  valor_liquido_proprietario: number | null;
  observacoes: string | null;
  imovel?: { nome_imovel: string };
}

interface DespesaExtra {
  id: string;
  imovel_id: string;
  descricao: string;
  valor: number;
  data: string;
  tipo: string;
  imovel?: { nome_imovel: string };
}

const fmt = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";

// Checkout day is excluded: guest leaves in the morning (≤12h), so that day is free
const getDaysBetween = (start: string, end: string): Date[] => {
  const days: Date[] = [];
  const current = new Date(start + "T12:00:00");
  const endDate = new Date(end + "T12:00:00");
  // Exclude the checkout day (data_fim) — it's free since guest leaves in the morning
  while (current < endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const calcFinanceiro = (r: Reserva, comissaoRate: number) => {
  const bruto = r.valor_bruto ?? 0;
  const limpeza = r.taxa_limpeza ?? 0;
  const plataforma = r.comissao_plataforma ?? 0;
  const liquido = bruto - limpeza - plataforma;
  const comissao = liquido * comissaoRate;
  const proprietario = liquido - comissao;
  return { bruto, limpeza, plataforma, liquido, comissao, proprietario };
};

const TIPO_LABELS: Record<string, string> = {
  manutencao: "Manutenção",
  amenities: "Amenities",
  limpeza_extra: "Limpeza Extra",
  reparo: "Reparo",
  outros: "Outros",
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ProprietarioDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [despesas, setDespesas] = useState<DespesaExtra[]>([]);
  const [imoveis, setImoveis] = useState<{ id: string; nome_imovel: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [comissaoRate, setComissaoRate] = useState<number>(0.25);
  const [nomeAdmin, setNomeAdmin] = useState<string>("CW");

  const now = new Date();

  // Filtros: mês e ano (baseado em data_fim - checkout)
  const [filterMes, setFilterMes] = useState<number>(now.getMonth()); // 0-indexed
  const [filterAno, setFilterAno] = useState<number>(now.getFullYear());
  const [filterImovel, setFilterImovel] = useState<string>("todos");
  const [extratoAberto, setExtratoAberto] = useState(true);
  const [despesasAberto, setDespesasAberto] = useState(true);

  // Gera lista de anos disponíveis: 2 anos atrás até 1 ano à frente
  const anoAtual = now.getFullYear();
  const anos = Array.from({ length: 4 }, (_, i) => anoAtual - 2 + i);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: imoveisData } = await supabase
        .from("imoveis")
        .select("id, nome_imovel, admin_id")
        .or(`proprietario_id.eq.${user.id},proprietario_id_2.eq.${user.id}`);

      setImoveis((imoveisData || []).map(({ id, nome_imovel }) => ({ id, nome_imovel })));

      if (imoveisData && imoveisData.length === 1 && filterImovel === "todos") {
        setFilterImovel(imoveisData[0].id);
      }

      // Buscar comissão do admin responsável (usa o admin_id do primeiro imóvel)
      const adminId = imoveisData?.[0]?.admin_id;
      if (adminId) {
        const { data: configData } = await supabase
          .from("admin_configs" as any)
          .select("comissao_cw, nome_empresa")
          .eq("admin_id", adminId)
          .maybeSingle();
        if (configData) {
          const cfg = configData as any;
          if (cfg.comissao_cw != null) setComissaoRate(cfg.comissao_cw);
          if (cfg.nome_empresa) setNomeAdmin(cfg.nome_empresa);
        }
      }

      const [{ data: resData }, { data: despData }] = await Promise.all([
        supabase
          .from("reservas")
          .select("*, imoveis(nome_imovel)")
          .order("data_inicio", { ascending: false }),
        supabase
          .from("despesas_extras" as any)
          .select("*, imoveis(nome_imovel)")
          .order("data", { ascending: false }),
      ]);

      setReservas((resData || []).map((r: any) => ({ ...r, imovel: r.imoveis })));
      setDespesas((despData || []).map((d: any) => ({ ...d, imovel: d.imoveis })));
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const getReservasForDay = useCallback(
    (day: Date) =>
      reservas.filter((r) => {
        const inicio = new Date(r.data_inicio + "T12:00:00");
        const fim = new Date(r.data_fim + "T12:00:00");
        const d = new Date(day);
        d.setHours(12, 0, 0, 0);
        // Checkout day is free (guest leaves in the morning)
        return d >= inicio && d < fim;
      }),
    [reservas]
  );

  const handleDayClick = (day: Date) => {
    if (getReservasForDay(day).length > 0) {
      setSelectedDay(day);
      setPopoverOpen(true);
    }
  };

  const selectedReservas = selectedDay ? getReservasForDay(selectedDay) : [];

  // Filtrar reservas: pertence ao mês/ano pelo checkout (data_fim)
  const reservasFiltradas = reservas.filter((r) => {
    if (filterImovel !== "todos" && r.imovel_id !== filterImovel) return false;
    const fim = new Date(r.data_fim + "T12:00:00");
    return fim.getMonth() === filterMes && fim.getFullYear() === filterAno;
  });

  // Despesas: pelo campo data (mês da despesa)
  const despesasFiltradas = despesas.filter((d) => {
    if (filterImovel !== "todos" && d.imovel_id !== filterImovel) return false;
    const data = new Date(d.data + "T12:00:00");
    return data.getMonth() === filterMes && data.getFullYear() === filterAno;
  });

  // Calcular métricas apenas para o imóvel selecionado
  const reservasImovelSelecionado = filterImovel === "todos"
    ? reservas
    : reservas.filter(r => r.imovel_id === filterImovel);

  const receitaMesAtual = reservasImovelSelecionado
    .filter((r) => {
      const fim = new Date(r.data_fim + "T12:00:00");
      return fim.getMonth() === currentMonth && fim.getFullYear() === currentYear;
    })
    .reduce((acc, r) => acc + (r.valor_liquido_proprietario ?? 0), 0);

  const previsaoFutura = reservasImovelSelecionado
    .filter((r) => {
      const fim = new Date(r.data_fim + "T12:00:00");
      return (
        fim > new Date() &&
        !(fim.getMonth() === currentMonth && fim.getFullYear() === currentYear)
      );
    })
    .reduce((acc, r) => acc + (r.valor_liquido_proprietario ?? 0), 0);

  const occupiedDays = reservasImovelSelecionado.flatMap((r) =>
    getDaysBetween(r.data_inicio, r.data_fim)
  );

  const totais = reservasFiltradas.reduce(
    (acc, r) => {
      const f = calcFinanceiro(r, comissaoRate);
      return {
        bruto: acc.bruto + f.bruto,
        limpeza: acc.limpeza + f.limpeza,
        plataforma: acc.plataforma + f.plataforma,
        comissao: acc.comissao + f.comissao,
        proprietario: acc.proprietario + f.proprietario,
      };
    },
    { bruto: 0, limpeza: 0, plataforma: 0, comissao: 0, proprietario: 0 }
  );

  const totalDespesas = despesasFiltradas.reduce((acc, d) => acc + d.valor, 0);
  const totalLiquido = totais.proprietario - totalDespesas;

  const isPeriodoAtual = filterMes === currentMonth && filterAno === currentYear;

  const gerarPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const genDate = new Date();

    const navy: [number, number, number] = [10, 25, 47];
    const gold: [number, number, number] = [163, 163, 139];
    const cream: [number, number, number] = [240, 237, 232];
    const lightGray: [number, number, number] = [245, 244, 241];

    // Header navy
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageW, 42, "F");
    doc.setFillColor(...gold);
    doc.rect(0, 42, pageW, 0.8, "F");

    // Logo
    try { doc.addImage(logoSrc, "PNG", 10, 4, 52, 34); } catch (_) {}

    // Título
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gold);
    doc.text("EXTRATO DO PROPRIETÁRIO", pageW - 14, 16, { align: "right" });

    doc.setFontSize(7);
    doc.setTextColor(...cream);
    const imovelNome = filterImovel !== "todos"
      ? imoveis.find((i) => i.id === filterImovel)?.nome_imovel ?? "Todos"
      : "Todos os imóveis";
    doc.text(`Imóvel: ${imovelNome}`, pageW - 14, 23, { align: "right" });
    doc.text(`Período: ${MESES[filterMes]} de ${filterAno}`, pageW - 14, 29, { align: "right" });
    doc.text(
      `Gerado em ${genDate.toLocaleDateString("pt-BR")} às ${genDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      pageW - 14, 35, { align: "right" }
    );

    const fmtPDF = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Cards de resumo
    const summaryItems = [
      { label: "Valor Bruto Total", value: fmtPDF(totais.bruto) },
      { label: "Tx. Limpeza", value: fmtPDF(totais.limpeza) },
      { label: "Comissão OTA", value: fmtPDF(totais.plataforma) },
      { label: "Comissão CW (25%)", value: fmtPDF(totais.comissao) },
      { label: "Despesas Extras", value: fmtPDF(totalDespesas) },
      { label: "Repasse Líquido", value: fmtPDF(totalLiquido), highlight: true },
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

    doc.setDrawColor(...gold);
    doc.setLineWidth(0.3);
    doc.line(14, cardY + cardH + 4, pageW - 14, cardY + cardH + 4);

    // Tabela de reservas
    const tableData = reservasFiltradas.map((r) => {
      const f = calcFinanceiro(r, comissaoRate);
      return [
        r.imovel?.nome_imovel || "—",
        new Date(r.data_inicio + "T12:00:00").toLocaleDateString("pt-BR"),
        new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR"),
        fmtPDF(f.bruto),
        fmtPDF(f.limpeza),
        f.plataforma > 0 ? fmtPDF(f.plataforma) : "—",
        fmtPDF(f.comissao),
        fmtPDF(f.proprietario),
        r.observacoes || "",
      ];
    });

    autoTable(doc, {
      startY: cardY + cardH + 8,
      head: [["Imóvel", "Check-in", "Check-out", "V. Bruto", "Limpeza", "Com. OTA", "Comissão CW", "Repasse", "Obs."]],
      body: tableData,
      headStyles: { fillColor: navy, textColor: gold, fontSize: 7, fontStyle: "bold", cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
      bodyStyles: { fontSize: 7.5, textColor: [40, 40, 40] as [number, number, number], cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
      alternateRowStyles: { fillColor: lightGray },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 22, halign: "right" },
        4: { cellWidth: 18, halign: "right" },
        5: { cellWidth: 18, halign: "right" },
        6: { cellWidth: 22, halign: "right" },
        7: { cellWidth: 24, halign: "right", fontStyle: "bold", textColor: navy },
        8: { cellWidth: "auto" },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const footerY = pageH - 8;
        doc.setFillColor(...navy);
        doc.rect(0, footerY - 4, pageW, 14, "F");
        doc.setFontSize(6.5);
        doc.setTextColor(...gold);
        doc.text("COUPLE WILHELM — Gestão de Imóveis", 14, footerY + 1);
        doc.setTextColor(...cream);
        doc.text(`Página ${data.pageNumber}`, pageW - 14, footerY + 1, { align: "right" });
      },
    });

    // Se houver despesas extras, adicionar seção
    if (despesasFiltradas.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? pageH - 40;
      if (finalY + 40 > pageH - 20) {
        doc.addPage();
      }
      const despY = Math.min(finalY + 8, pageH - 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...navy);
      doc.text("DESPESAS EXTRAS", 14, despY + 6);
      doc.setLineWidth(0.3);
      doc.setDrawColor(...gold);
      doc.line(14, despY + 8, pageW - 14, despY + 8);

      autoTable(doc, {
        startY: despY + 12,
        head: [["Imóvel", "Descrição", "Tipo", "Data", "Valor"]],
        body: despesasFiltradas.map((d) => [
          d.imovel?.nome_imovel || "—",
          d.descricao,
          TIPO_LABELS[d.tipo] ?? d.tipo,
          new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR"),
          `- ${fmtPDF(d.valor)}`,
        ]),
        headStyles: { fillColor: navy, textColor: gold, fontSize: 7, fontStyle: "bold", cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
        bodyStyles: { fontSize: 7.5, textColor: [40, 40, 40] as [number, number, number], cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
        alternateRowStyles: { fillColor: lightGray },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: "auto" },
          2: { cellWidth: 28 },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 28, halign: "right", textColor: [180, 40, 40] as [number, number, number], fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          const footerY = pageH - 8;
          doc.setFillColor(...navy);
          doc.rect(0, footerY - 4, pageW, 14, "F");
          doc.setFontSize(6.5);
          doc.setTextColor(...gold);
          doc.text("COUPLE WILHELM — Gestão de Imóveis", 14, footerY + 1);
          doc.setTextColor(...cream);
          doc.text(`Página ${data.pageNumber}`, pageW - 14, footerY + 1, { align: "right" });
        },
      });
    }

    doc.save(`CW-extrato-${MESES[filterMes].toLowerCase()}-${filterAno}.pdf`);
    toast({ title: "Extrato gerado com sucesso!" });
  };

  return (
    <PageTransition>
      <div className="space-y-6 max-w-5xl">

        {/* Header */}
        <div className="pb-2 border-b border-border flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground tracking-wide">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={gerarPDF}
            disabled={loading || (reservasFiltradas.length === 0 && despesasFiltradas.length === 0)}
            className="gap-2 text-xs"
          >
            <FileText className="h-3.5 w-3.5" />
            Gerar PDF — {MESES[filterMes]} {filterAno}
          </Button>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            label="Receita do Mês"
            sub="Checkouts neste mês"
            value={loading ? null : fmt(receitaMesAtual)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            label="Previsão Futura"
            sub="Reservas confirmadas"
            value={loading ? null : fmt(previsaoFutura)}
            icon={<CalendarCheck className="h-4 w-4" />}
          />
        </div>

        {/* Extrato */}
        <section className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setExtratoAberto((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/10 transition-colors"
          >
            <span className="font-display text-base text-foreground tracking-wide">Extrato Financeiro</span>
            {extratoAberto
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {extratoAberto && (
            <div className="border-t border-border">
              {/* Filters */}
              <div className="px-5 py-3 flex flex-wrap items-end gap-3 border-b border-border">
                {/* Filtro por Imóvel */}
                {imoveis.length > 1 && (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Imóvel
                    </Label>
                    <Select value={filterImovel} onValueChange={setFilterImovel}>
                      <SelectTrigger className="w-44 h-8 text-xs bg-transparent border-border">
                        <SelectValue placeholder="Todos os imóveis" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="todos" className="text-xs">Todos os imóveis</SelectItem>
                        {imoveis.map((imovel) => (
                          <SelectItem key={imovel.id} value={imovel.id} className="text-xs">
                            {imovel.nome_imovel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Filtro Mês */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Mês</Label>
                  <Select value={String(filterMes)} onValueChange={(v) => setFilterMes(Number(v))}>
                    <SelectTrigger className="w-36 h-8 text-xs bg-transparent border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {MESES.map((nome, idx) => (
                        <SelectItem key={idx} value={String(idx)} className="text-xs">
                          {nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro Ano */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Ano</Label>
                  <Select value={String(filterAno)} onValueChange={(v) => setFilterAno(Number(v))}>
                    <SelectTrigger className="w-24 h-8 text-xs bg-transparent border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {anos.map((ano) => (
                        <SelectItem key={ano} value={String(ano)} className="text-xs">
                          {ano}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Botão voltar ao mês atual */}
                {!isPeriodoAtual && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFilterMes(currentMonth); setFilterAno(currentYear); }}
                    className="text-muted-foreground hover:text-foreground gap-1.5 h-8 self-end"
                  >
                    <X className="h-3 w-3" /> Mês atual
                  </Button>
                )}

                <span className="ml-auto self-end text-xs text-muted-foreground">
                  {reservasFiltradas.length} reserva{reservasFiltradas.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Table */}
              {loading ? (
                <div className="p-10 flex justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : reservasFiltradas.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-muted-foreground text-sm">Nenhuma reserva com checkout em {MESES[filterMes]} de {filterAno}</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        {["Imóvel", "Check-in", "Check-out", "Bruto", "Limpeza", "Com. OTA", "Comissão CW", "Repasse"].map((h, i) => (
                          <TableHead
                            key={h}
                            className={cn(
                              "text-muted-foreground text-[10px] uppercase tracking-widest py-2",
                              i > 2 && "text-right"
                            )}
                          >
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservasFiltradas.map((r) => {
                        const f = calcFinanceiro(r, comissaoRate);
                        return (
                          <TableRow key={r.id} className="border-border hover:bg-muted/20">
                            <TableCell className="text-foreground font-medium text-sm py-3">
                              {r.imovel?.nome_imovel ?? "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm py-3">
                              {new Date(r.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm py-3">
                              {new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm text-right py-3">{fmt(f.bruto)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm text-right py-3">{fmt(f.limpeza)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm text-right py-3">
                              {f.plataforma > 0 ? fmt(f.plataforma) : <span className="opacity-30">—</span>}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm text-right py-3">{fmt(f.comissao)}</TableCell>
                            <TableCell className="text-primary text-sm text-right font-semibold py-3">{fmt(f.proprietario)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Totals footer */}
                  <div className="border-t border-border px-5 py-3 flex items-center justify-end gap-6 flex-wrap">
                    <TotalItem label="Bruto" value={fmt(totais.bruto)} />
                    <TotalItem label="Limpeza" value={fmt(totais.limpeza)} />
                    {totais.plataforma > 0 && (
                      <TotalItem label="Com. OTA" value={fmt(totais.plataforma)} />
                    )}
                    <TotalItem label="Comissão CW" value={fmt(totais.comissao)} />
                    <div className="pl-6 border-l border-border">
                      <p className="text-[10px] text-primary uppercase tracking-widest mb-0.5">Seu Repasse</p>
                      <p className="font-display text-base text-primary font-semibold">{fmt(totais.proprietario)}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Despesas Extras */}
        <section className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setDespesasAberto((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-display text-base text-foreground tracking-wide">Despesas Extras</span>
              {despesasFiltradas.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-destructive/70 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  {despesasFiltradas.length} item{despesasFiltradas.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {despesasAberto
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {despesasAberto && (
            <div className="border-t border-border">
              {loading ? (
                <div className="p-10 flex justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : despesasFiltradas.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground text-sm">Nenhuma despesa extra em {MESES[filterMes]} de {filterAno}</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        {["Imóvel", "Descrição", "Tipo", "Data", "Valor"].map((h, i) => (
                          <TableHead
                            key={h}
                            className={cn(
                              "text-muted-foreground text-[10px] uppercase tracking-widest py-2",
                              i === 4 && "text-right"
                            )}
                          >
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {despesasFiltradas.map((d) => (
                        <TableRow key={d.id} className="border-border hover:bg-muted/20">
                          <TableCell className="text-foreground font-medium text-sm py-3">
                            {d.imovel?.nome_imovel ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm py-3">{d.descricao}</TableCell>
                          <TableCell className="py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-destructive/10 text-destructive/80 border border-destructive/20">
                              {TIPO_LABELS[d.tipo] ?? d.tipo}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm py-3">
                            {new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-destructive text-sm text-right font-semibold py-3">
                            - {fmt(d.valor)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="border-t border-border px-5 py-3 flex items-center justify-end">
                    <div className="text-right">
                      <p className="text-[10px] text-destructive/70 uppercase tracking-widest mb-0.5">Total Despesas</p>
                      <p className="font-display text-base text-destructive font-semibold">- {fmt(totalDespesas)}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Resumo Líquido Final */}
        {!loading && (reservasFiltradas.length > 0 || despesasFiltradas.length > 0) && (
          <div className="border border-primary/20 rounded-lg px-5 py-4 bg-primary/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">
                Líquido Final — {MESES[filterMes]} {filterAno}
              </p>
              <p className="text-xs text-muted-foreground">Repasse − Despesas Extras</p>
            </div>
            <div className="text-right">
              <p className={cn(
                "font-display text-2xl font-semibold",
                totalLiquido >= 0 ? "text-primary" : "text-destructive"
              )}>
                {fmt(totalLiquido)}
              </p>
            </div>
          </div>
        )}

        {/* Calendar */}
        <section className="border border-border rounded-lg p-5">
          <div className="mb-5">
            <h2 className="font-display text-base text-foreground tracking-wide">Calendário de Ocupação</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dias em dourado indicam período de reserva — clique para detalhes
            </p>
          </div>

          <div className="flex justify-center">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <div>
                  <DayPicker
                    mode="single"
                    month={month}
                    onMonthChange={setMonth}
                    locale={ptBR}
                    onDayClick={handleDayClick}
                    modifiers={{ occupied: occupiedDays }}
                    modifiersClassNames={{ occupied: "rdp-day-occupied" }}
                    classNames={{
                      root: "rdp-luxury",
                      months: "flex flex-col",
                      month: "space-y-4",
                      caption: "flex justify-center relative items-center",
                      caption_label: "font-display text-foreground text-sm tracking-wide capitalize",
                      nav: "flex items-center gap-1",
                      nav_button: "h-7 w-7 bg-transparent hover:bg-muted rounded-md flex items-center justify-center transition-colors text-muted-foreground hover:text-primary",
                      nav_button_previous: "absolute left-0",
                      nav_button_next: "absolute right-0",
                      table: "w-full border-collapse",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.7rem] text-center uppercase tracking-wider",
                      row: "flex w-full mt-1",
                      cell: "h-9 w-9 text-center text-sm relative p-0",
                      day: "h-9 w-9 p-0 font-normal rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer aria-selected:opacity-100 flex items-center justify-center",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary",
                      day_today: "border border-primary/50 text-primary",
                      day_outside: "text-muted-foreground opacity-30",
                      day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
                    }}
                  />
                </div>
              </PopoverTrigger>

              {selectedDay && selectedReservas.length > 0 && (
                <PopoverContent
                  className="bg-card border border-border shadow-luxury w-72 p-4"
                  align="center"
                >
                  <div className="space-y-3">
                    <p className="font-display text-xs text-primary tracking-widest uppercase">
                      {selectedDay.toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    {selectedReservas.map((r) => {
                      const f = calcFinanceiro(r, comissaoRate);
                      const pctLabel = `${Math.round(comissaoRate * 100)}%`;
                      return (
                        <div key={r.id} className="border-t border-border pt-3 space-y-3">
                          <p className="text-foreground font-medium text-sm">
                            {r.imovel?.nome_imovel}
                          </p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex justify-between">
                              <span>Check-in</span>
                              <span>{new Date(r.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Check-out</span>
                              <span>{new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                          </div>
                          <div className="bg-muted/20 rounded p-2.5 space-y-1.5 text-xs">
                            <FinRow label="Valor bruto" value={fmt(f.bruto)} />
                            <FinRow label="Taxa de limpeza" value={`- ${fmt(f.limpeza)}`} />
                            <div className="border-t border-border pt-1.5">
                              <FinRow label="Valor líquido" value={fmt(f.bruto - f.limpeza)} />
                            </div>
                            <FinRow label={`Comissão ${nomeAdmin} (${pctLabel})`} value={`- ${fmt(f.comissao)}`} />
                            <div className="border-t border-border pt-1.5">
                              <FinRow label="Seu repasse" value={fmt(f.proprietario)} highlight />
                            </div>
                          </div>
                          {r.observacoes && (
                            <p className="text-xs text-muted-foreground italic">{r.observacoes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          </div>
        </section>
      </div>
    </PageTransition>
  );
};

/* ── Sub-components ─────────────────────────────────── */

const MetricCard: React.FC<{
  label: string;
  sub: string;
  value: string | null;
  icon: React.ReactNode;
}> = ({ label, sub, value, icon }) => (
  <div className="border border-border rounded-lg px-5 py-4 flex items-start justify-between group hover:border-primary/30 transition-colors">
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      {value === null ? (
        <div className="h-7 w-32 bg-muted animate-pulse rounded" />
      ) : (
        <p className="font-display text-2xl text-foreground">{value}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
    <span className="text-primary opacity-50 group-hover:opacity-80 transition-opacity mt-0.5">
      {icon}
    </span>
  </div>
);

const TotalItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-right">
    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">{label}</p>
    <p className="text-sm text-foreground">{value}</p>
  </div>
);

const FinRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={cn("flex justify-between", highlight ? "text-primary font-semibold" : "text-muted-foreground")}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

export default ProprietarioDashboard;
