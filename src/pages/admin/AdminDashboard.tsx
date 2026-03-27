import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Building2,
  CalendarDays,
  TrendingUp,
  DollarSign,
  Percent,
  UserCheck,
  Plus,
  Trash2,
  Receipt,
  AlertTriangle,
  ArrowRight,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileDown,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useTheme } from "@/contexts/ThemeContext";
import { buildPdfPalette, getPdfLogoEscuro } from "@/hooks/use-pdf-theme";

interface Imovel {
  id: string;
  nome_imovel: string;
  proprietario_id: string | null;
  proprietario_id_2: string | null;
}

interface Proprietario {
  id: string;
  nome: string | null;
  email: string | null;
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

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const TIPOS = [
  { value: "manutencao", label: "Manutenção" },
  { value: "amenities", label: "Amenities" },
  { value: "limpeza_extra", label: "Limpeza Extra" },
  { value: "reparo", label: "Reparo" },
  { value: "outros", label: "Outros" },
];

const tipoLabel = (v: string) => TIPOS.find((t) => t.value === v)?.label ?? v;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const now = new Date();
// Gerar anos disponíveis: de 2 anos atrás até o ano atual
const ANOS = Array.from(
  { length: now.getFullYear() - 2023 + 1 },
  (_, i) => 2024 + i
);

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Filtro mês/ano
  const [mesSelecionado, setMesSelecionado] = useState(now.getMonth()); // 0-indexed
  const [anoSelecionado, setAnoSelecionado] = useState(now.getFullYear());

  // Filtro por proprietário
  const [proprietarios, setProprietarios] = useState<Proprietario[]>([]);
  const [filtroProprietario, setFiltroProprietario] = useState<string>("todos");

  const [stats, setStats] = useState({
    totalProprietarios: 0,
    totalImoveis: 0,
    totalReservas: 0,
    receitaMes: 0,
  });
  const [financeiro, setFinanceiro] = useState({
    valorBruto: 0,
    taxaLimpeza: 0,
    valorLiquido: 0,
    comissaoCW: 0,
    valorProprietario: 0,
  });
  const [loading, setLoading] = useState(true);
  const [reservasSemValores, setReservasSemValores] = useState(0);

  // Despesas extras
  const [despesas, setDespesas] = useState<DespesaExtra[]>([]);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    imovel_id: "",
    descricao: "",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    tipo: "manutencao",
  });

  useEffect(() => {
    fetchProprietarios();
    fetchDespesas();
    fetchImoveis();
    fetchReservasSemValores();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [filtroProprietario, imoveis, mesSelecionado, anoSelecionado]);

  const navegarMes = (delta: number) => {
    let novoMes = mesSelecionado + delta;
    let novoAno = anoSelecionado;
    if (novoMes < 0) { novoMes = 11; novoAno -= 1; }
    if (novoMes > 11) { novoMes = 0; novoAno += 1; }
    // Não avançar além do mês atual
    if (novoAno > now.getFullYear() || (novoAno === now.getFullYear() && novoMes > now.getMonth())) return;
    setMesSelecionado(novoMes);
    setAnoSelecionado(novoAno);
  };

  const isMesAtual = mesSelecionado === now.getMonth() && anoSelecionado === now.getFullYear();

  const fetchProprietarios = async () => {
    const { data: vinculos } = await supabase
      .from("admin_proprietarios")
      .select("proprietario_id");

    if (!vinculos || vinculos.length === 0) {
      setProprietarios([]);
      return;
    }

    const ids = vinculos.map((v) => v.proprietario_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .in("id", ids);

    setProprietarios(profiles || []);
  };

  const fetchReservasSemValores = async () => {
    const { count } = await supabase
      .from("reservas")
      .select("*", { count: "exact", head: true })
      .is("valor_bruto", null);
    setReservasSemValores(count ?? 0);
  };

  const fetchStats = async () => {
    setLoading(true);
    const firstDay = new Date(anoSelecionado, mesSelecionado, 1)
      .toISOString()
      .split("T")[0];
    const lastDay = new Date(anoSelecionado, mesSelecionado + 1, 0)
      .toISOString()
      .split("T")[0];

    // Determinar quais imovel_ids usar com base no filtro de proprietário
    let imovelIds: string[] | null = null;
    if (filtroProprietario !== "todos" && imoveis.length > 0) {
      imovelIds = imoveis
        .filter(
          (im) =>
            im.proprietario_id === filtroProprietario ||
            im.proprietario_id_2 === filtroProprietario
        )
        .map((im) => im.id);
    }

    if (imovelIds !== null && imovelIds.length === 0) {
      setStats({ totalProprietarios: 1, totalImoveis: 0, totalReservas: 0, receitaMes: 0 });
      setFinanceiro({ valorBruto: 0, taxaLimpeza: 0, valorLiquido: 0, comissaoCW: 0, valorProprietario: 0 });
      setLoading(false);
      return;
    }

    let reservasMesQuery = supabase
      .from("reservas")
      .select("valor_liquido_proprietario")
      .gte("data_fim", firstDay)
      .lte("data_fim", lastDay);

    let reservasDetalhadasQuery = supabase
      .from("reservas")
      .select("imovel_id, valor_bruto, taxa_limpeza, comissao_plataforma, valor_liquido_proprietario")
      .gte("data_fim", firstDay)
      .lte("data_fim", lastDay);

    let reservaCountQuery = supabase
      .from("reservas")
      .select("*", { count: "exact", head: true })
      .gte("data_fim", firstDay)
      .lte("data_fim", lastDay);

    let imovelCountQuery = supabase
      .from("imoveis")
      .select("*", { count: "exact", head: true });

    if (imovelIds) {
      reservasMesQuery = reservasMesQuery.in("imovel_id", imovelIds);
      reservasDetalhadasQuery = reservasDetalhadasQuery.in("imovel_id", imovelIds);
      reservaCountQuery = reservaCountQuery.in("imovel_id", imovelIds);
      imovelCountQuery = imovelCountQuery.in("id", imovelIds);
    }

    const [
      { count: propCount },
      { count: imovelCount },
      { count: reservaCount },
      { data: reservasMes },
      { data: reservasDetalhadas },
    ] = await Promise.all([
      supabase
        .from("admin_proprietarios")
        .select("*", { count: "exact", head: true }),
      imovelCountQuery,
      reservaCountQuery,
      reservasMesQuery,
      reservasDetalhadasQuery,
    ]);

    const receitaMes = (reservasMes || []).reduce(
      (acc, r) => acc + (r.valor_liquido_proprietario || 0),
      0
    );

    const { data: adminConfig } = await supabase
      .from("admin_configs")
      .select("comissao_cw")
      .single();
    const adminRate = adminConfig?.comissao_cw ?? 0.25;

    // Buscar comissão por proprietário
    const ownerIds = new Set<string>();
    imoveis.forEach((im) => {
      if (im.proprietario_id) ownerIds.add(im.proprietario_id);
      if (im.proprietario_id_2) ownerIds.add(im.proprietario_id_2);
    });
    let ownerRatesMap: Record<string, number> = {};
    if (ownerIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, comissao_percentual")
        .in("id", Array.from(ownerIds));
      (profiles || []).forEach((p: any) => {
        ownerRatesMap[p.id] = (p.comissao_percentual ?? 25) / 100;
      });
    }

    const getOwnerRate = (imovelId: string): number => {
      const im = imoveis.find((i) => i.id === imovelId);
      if (im?.proprietario_id && ownerRatesMap[im.proprietario_id] != null) {
        return ownerRatesMap[im.proprietario_id];
      }
      return adminRate;
    };

    const totais = (reservasDetalhadas || []).reduce(
      (acc, r) => {
        const valorBruto = r.valor_bruto || 0;
        const taxaLimpeza = r.taxa_limpeza || 0;
        const comissaoPlataforma = (r as any).comissao_plataforma || 0;
        const valorLiquido = valorBruto - taxaLimpeza - comissaoPlataforma;
        const comissaoRate = getOwnerRate((r as any).imovel_id);
        const comissaoCW = valorLiquido * comissaoRate;
        const valorProprietario = valorLiquido - comissaoCW;
        return {
          valorBruto: acc.valorBruto + valorBruto,
          taxaLimpeza: acc.taxaLimpeza + taxaLimpeza,
          valorLiquido: acc.valorLiquido + valorLiquido,
          comissaoCW: acc.comissaoCW + comissaoCW,
          valorProprietario: acc.valorProprietario + valorProprietario,
        };
      },
      { valorBruto: 0, taxaLimpeza: 0, valorLiquido: 0, comissaoCW: 0, valorProprietario: 0 }
    );

    setStats({
      totalProprietarios: filtroProprietario === "todos" ? (propCount || 0) : 1,
      totalImoveis: imovelCount || 0,
      totalReservas: reservaCount || 0,
      receitaMes,
    });
    setFinanceiro(totais);
    setLoading(false);
  };

  const fetchDespesas = async () => {
    const { data } = await supabase
      .from("despesas_extras" as any)
      .select("*, imoveis(nome_imovel)")
      .order("data", { ascending: false });
    setDespesas((data || []).map((d: any) => ({ ...d, imovel: d.imoveis })));
  };

  const fetchImoveis = async () => {
    const { data } = await supabase
      .from("imoveis")
      .select("id, nome_imovel, proprietario_id, proprietario_id_2")
      .order("nome_imovel");
    setImoveis(data || []);
  };

  const handleSave = async () => {
    if (!form.imovel_id || !form.descricao || !form.valor) return;
    setSaving(true);
    await supabase.from("despesas_extras" as any).insert({
      imovel_id: form.imovel_id,
      descricao: form.descricao,
      valor: parseFloat(form.valor.replace(",", ".")),
      data: form.data,
      tipo: form.tipo,
    });
    setForm({ imovel_id: "", descricao: "", valor: "", data: new Date().toISOString().split("T")[0], tipo: "manutencao" });
    setDialogOpen(false);
    setSaving(false);
    fetchDespesas();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("despesas_extras" as any).delete().eq("id", id);
    fetchDespesas();
  };

  const gerarPDF = async () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const mesNome = MESES[mesSelecionado];
    const nomeProprietario =
      filtroProprietario === "todos"
        ? "Todos os proprietários"
        : proprietarioSelecionado?.nome || proprietarioSelecionado?.email || "—";

    const { primary, accent, textOnPrimary, lightGray, bodyText } = buildPdfPalette(
      theme.corPrimaria,
      theme.corSecundaria,
      theme.corTexto,
    );
    const companyName = (theme.nomeEmpresa || "Couple Wilhelm").toUpperCase();

    // Header background
    doc.setFillColor(...primary);
    doc.rect(0, 0, 210, 38, "F");

    // Accent line under header
    doc.setFillColor(...accent);
    doc.rect(0, 38, 210, 0.8, "F");

    // Logo (personalizada ou CW como fallback)
    const logoData = theme.logoUrl || await getPdfLogoEscuro();
    if (logoData) {
      try { doc.addImage(logoData, "PNG", 10, 4, 40, 30); } catch (_) {}
    }

    doc.setTextColor(...textOnPrimary);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Visão Geral — Relatório Financeiro", logoData ? 56 : 14, 16);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Período: ${mesNome} / ${anoSelecionado}`, logoData ? 56 : 14, 25);
    doc.text(`Proprietário: ${nomeProprietario}`, logoData ? 56 : 14, 32);

    // Generated date
    doc.setFontSize(8);
    doc.setTextColor(...textOnPrimary);
    doc.setGState(new (doc as any).GState({ opacity: 0.6 }));
    doc.text(
      `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      196, 32, { align: "right" }
    );
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    let y = 48;

    // ── Estatísticas ──
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primary);
    doc.text("Estatísticas do Período", 14, y);
    y += 6;

    const statsData = [
      ["Proprietários", String(stats.totalProprietarios)],
      ["Imóveis", String(stats.totalImoveis)],
      ["Reservas no mês", String(stats.totalReservas)],
      ["Repasse a proprietários", fmt(stats.receitaMes)],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Indicador", "Valor"]],
      body: statsData,
      theme: "grid",
      headStyles: { fillColor: primary, textColor: textOnPrimary, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9, textColor: bodyText },
      alternateRowStyles: { fillColor: lightGray },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // ── Detalhamento Financeiro ──
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primary);
    doc.text("Detalhamento Financeiro", 14, y);
    y += 6;

    const finData = [
      ["Valor Bruto", fmt(financeiro.valorBruto), "Total das receitas sem deduções"],
      ["(−) Taxa de Limpeza", fmt(financeiro.taxaLimpeza), "Dedução do valor bruto"],
      ["(−) Comissão OTA", fmt(financeiro.valorBruto - financeiro.taxaLimpeza - financeiro.valorLiquido), "Comissão da plataforma (Airbnb, Booking...)"],
      ["= Valor Líquido", fmt(financeiro.valorLiquido), "Bruto − Limpeza − OTA"],
      ["(−) Comissão CW", fmt(financeiro.comissaoCW), "Comissão de gestão"],
      ["= Repasse ao Proprietário", fmt(financeiro.valorProprietario), "Líquido − Comissão CW"],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Descrição", "Valor", "Observação"]],
      body: finData,
      theme: "grid",
      headStyles: { fillColor: primary, textColor: textOnPrimary, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9, textColor: bodyText },
      alternateRowStyles: { fillColor: lightGray },
      columnStyles: {
        1: { halign: "right", fontStyle: "bold" },
        2: { textColor: [120, 120, 120] as [number, number, number], fontSize: 8 },
      },
      didParseCell: (data) => {
        if (data.row.index === 5) {
          data.cell.styles.fillColor = accent;
          data.cell.styles.textColor = textOnPrimary;
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // ── Despesas Extras ──
    if (despesasFiltradas.length > 0) {
      if (y > 220) { doc.addPage(); y = 20; }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...primary);
      doc.text("Despesas Extras", 14, y);
      y += 6;

      const despesasData = despesasFiltradas.map((d) => [
        d.imovel?.nome_imovel ?? "—",
        d.descricao,
        tipoLabel(d.tipo),
        new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR"),
        fmt(d.valor),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Imóvel", "Descrição", "Tipo", "Data", "Valor"]],
        body: despesasData,
        theme: "grid",
        headStyles: { fillColor: primary, textColor: textOnPrimary, fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 9, textColor: bodyText },
        alternateRowStyles: { fillColor: lightGray },
        columnStyles: { 4: { halign: "right", fontStyle: "bold" } },
        margin: { left: 14, right: 14 },
        foot: [["", "", "", "Total", fmt(despesasFiltradas.reduce((acc, d) => acc + d.valor, 0))]],
        footStyles: { fillColor: primary, textColor: textOnPrimary, fontStyle: "bold", fontSize: 9 },
      });
    }

    // Footer em todas as páginas
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.5);
      doc.line(14, 285, 196, 285);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      doc.text(`${companyName} — Sistema de Gestão de Imóveis`, 14, 289);
      doc.text(`Página ${i} de ${totalPages}`, 196, 289, { align: "right" });
    }

    const fileName = `visao-geral_${mesNome.toLowerCase()}-${anoSelecionado}${filtroProprietario !== "todos" ? `_${(proprietarioSelecionado?.nome || "proprietario").replace(/\s+/g, "-").toLowerCase()}` : ""}.pdf`;
    doc.save(fileName);
  };

  const proprietarioSelecionado = proprietarios.find((p) => p.id === filtroProprietario);

  const imoveisDoProprietario =
    filtroProprietario === "todos"
      ? null
      : imoveis
          .filter(
            (im) =>
              im.proprietario_id === filtroProprietario ||
              im.proprietario_id_2 === filtroProprietario
          )
          .map((im) => im.id);

  const despesasFiltradas =
    imoveisDoProprietario === null
      ? despesas
      : despesas.filter((d) => imoveisDoProprietario.includes(d.imovel_id));

  const cards = [
    { title: filtroProprietario === "todos" ? "Proprietários" : "Proprietário", value: stats.totalProprietarios, icon: Users, format: "number" },
    { title: "Imóveis", value: stats.totalImoveis, icon: Building2, format: "number" },
    { title: "Reservas no mês", value: stats.totalReservas, icon: CalendarDays, format: "number" },
    { title: "Repasse a Proprietários", value: stats.receitaMes, icon: TrendingUp, format: "currency" },
  ];

  const financeiroCards = [
    { title: "Valor Bruto", value: financeiro.valorBruto, icon: DollarSign, description: "Total sem deduções" },
    { title: "Taxa Limpeza", value: financeiro.taxaLimpeza, icon: Percent, description: "Dedução do bruto" },
    { title: "Valor Líquido", value: financeiro.valorLiquido, icon: DollarSign, description: "Bruto - Limpeza" },
    { title: "Comissão CW", value: financeiro.comissaoCW, icon: Percent, description: "Sobre líquido" },
    { title: "Proprietário", value: financeiro.valorProprietario, icon: UserCheck, description: "Líquido - Comissão" },
  ];

  const formatValue = (value: number, format: string) => {
    if (format === "currency") return fmt(value);
    return value.toString();
  };

  return (
    <PageTransition>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-foreground tracking-wide">Visão Geral</h1>
            {filtroProprietario !== "todos" && proprietarioSelecionado && (
              <p className="text-primary text-sm font-medium mt-1">
                {proprietarioSelecionado.nome || proprietarioSelecionado.email}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de mês/ano */}
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1 py-1">
              <button
                onClick={() => navegarMes(-1)}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <Select
                value={String(mesSelecionado)}
                onValueChange={(v) => setMesSelecionado(Number(v))}
              >
                <SelectTrigger className="border-0 bg-transparent shadow-none h-8 text-sm font-medium text-foreground focus:ring-0 w-[108px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => {
                    const disabled =
                      anoSelecionado === now.getFullYear() && i > now.getMonth();
                    return (
                      <SelectItem key={i} value={String(i)} disabled={disabled}>
                        {m}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select
                value={String(anoSelecionado)}
                onValueChange={(v) => setAnoSelecionado(Number(v))}
              >
                <SelectTrigger className="border-0 bg-transparent shadow-none h-8 text-sm font-medium text-foreground focus:ring-0 w-[68px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANOS.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                onClick={() => navegarMes(1)}
                disabled={isMesAtual}
                className={cn(
                  "p-1 rounded transition-colors",
                  isMesAtual
                    ? "text-muted-foreground/30 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Filtro por proprietário */}
            {proprietarios.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={filtroProprietario} onValueChange={setFiltroProprietario}>
                  <SelectTrigger className="w-[190px] bg-background border-border text-sm h-9">
                    <SelectValue placeholder="Filtrar proprietário…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os proprietários</SelectItem>
                    {proprietarios.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome || p.email || p.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Botão exportar PDF */}
            <Button
              onClick={gerarPDF}
              disabled={loading}
              variant="outline"
              size="sm"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/60"
            >
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Banner: reservas sem valores */}
        {reservasSemValores > 0 && (
          <button
            onClick={() => navigate("/admin/reservas")}
            className="w-full text-left flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 hover:bg-primary/10 transition-colors group"
          >
            <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary/15 text-primary">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {reservasSemValores} reserva{reservasSemValores !== 1 ? "s" : ""} sem valores financeiros
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Importada{reservasSemValores !== 1 ? "s" : ""} via iCal — clique para preencher os valores
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-primary opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Card
              key={card.title}
              className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury group"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="font-display text-2xl text-foreground">
                    {formatValue(card.value, card.format)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Financeiro */}
        <div>
          <h2 className="font-display text-xl text-foreground tracking-wide mb-4">
            Detalhamento Financeiro
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {financeiroCards.map((card) => (
              <Card
                key={card.title}
                className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury group"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                    {card.title}
                  </CardTitle>
                  <card.icon className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  ) : (
                    <div className="space-y-1">
                      <p className="font-display text-xl text-foreground">
                        {fmt(card.value)}
                      </p>
                      <p className="text-xs text-muted-foreground">{card.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Despesas Extras */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl text-foreground tracking-wide">Despesas Extras</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                Manutenções, amenities e outros custos vinculados aos imóveis
              </p>
            </div>
            <Button
              onClick={() => setDialogOpen(true)}
              size="sm"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Nova Despesa
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            {despesasFiltradas.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <Receipt className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {filtroProprietario === "todos"
                    ? "Nenhuma despesa extra registrada"
                    : "Nenhuma despesa extra para este proprietário"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    {["Imóvel", "Descrição", "Tipo", "Data", "Valor", ""].map((h, i) => (
                      <TableHead
                        key={i}
                        className={cn(
                          "text-muted-foreground text-[10px] uppercase tracking-widest py-2",
                          i === 4 && "text-right",
                          i === 5 && "w-10"
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
                      <TableCell className="text-muted-foreground text-sm py-3">
                        {d.descricao}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-primary/10 text-primary border border-primary/20">
                          {tipoLabel(d.tipo)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm py-3">
                        {new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-foreground text-sm text-right font-semibold py-3">
                        {fmt(d.valor)}
                      </TableCell>
                      <TableCell className="py-3">
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {despesasFiltradas.length > 0 && (
            <div className="mt-2 flex justify-end">
              <p className="text-xs text-muted-foreground">
                Total:{" "}
                <span className="text-foreground font-semibold">
                  {fmt(despesasFiltradas.reduce((acc, d) => acc + d.valor, 0))}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dialog Nova Despesa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground tracking-wide">
              Nova Despesa Extra
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Imóvel</Label>
              <Select value={form.imovel_id} onValueChange={(v) => setForm((f) => ({ ...f, imovel_id: v }))}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Selecionar imóvel…" />
                </SelectTrigger>
                <SelectContent>
                  {imoveis.map((im) => (
                    <SelectItem key={im.id} value={im.id}>{im.nome_imovel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Troca de torneira, kit amenities…"
                className="bg-background border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Data</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Valor (R$)</Label>
              <Input
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                placeholder="0,00"
                className="bg-background border-border"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-border">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.imovel_id || !form.descricao || !form.valor}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default AdminDashboard;
