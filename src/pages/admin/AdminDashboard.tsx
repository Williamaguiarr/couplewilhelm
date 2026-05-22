import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
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
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Sparkles,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import OccupancyComparison from "@/components/dashboard/OccupancyComparison";
import FinancialYearComparison from "@/components/dashboard/FinancialYearComparison";
import GanhosExtrasDialog from "@/components/reservas/GanhosExtrasDialog";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import autoTable from "jspdf-autotable";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import {
  createPdfDoc, drawHeader, drawSummaryCards, drawSectionTitle,
  drawFooterAllPages, premiumTableStyles, genTimestamp,
} from "@/lib/pdf/builder";

interface Imovel {
  id: string;
  nome_imovel: string;
  proprietario_id: string | null;
  proprietario_id_2: string | null;
  taxa_comissao: number | null;
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

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const now = new Date();
const ANOS = Array.from(
  { length: now.getFullYear() - 2023 + 2 },
  (_, i) => 2024 + i
);

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { toast } = useToast();

  const [mesSelecionado, setMesSelecionado] = useState(now.getMonth()); 
  const [anoSelecionado, setAnoSelecionado] = useState(now.getFullYear());

  const [proprietarios, setProprietarios] = useState<Proprietario[]>([]);
  const [filtroProprietario, setFiltroProprietario] = useState<string>("todos");
  const [filtroImovel, setFiltroImovel] = useState<string>("todos");

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
  const [futuro, setFuturo] = useState({
    totalReservas: 0,
    valorBruto: 0,
    valorProprietario: 0,
  });
  const [loading, setLoading] = useState(true);
  const [reservasSemValores, setReservasSemValores] = useState(0);

  const [despesas, setDespesas] = useState<DespesaExtra[]>([]);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ganhosDialogOpen, setGanhosDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    imovel_id: "",
    descricao: "",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    tipo: "manutencao",
  });

  const filteredImovelIds = useMemo(() => {
    if (filtroImovel !== "todos") return [filtroImovel];
    if (filtroProprietario !== "todos") {
      return imoveis
        .filter(i => i.proprietario_id === filtroProprietario || i.proprietario_id_2 === filtroProprietario)
        .map(i => i.id);
    }
    return imoveis.map(i => i.id);
  }, [filtroImovel, filtroProprietario, imoveis]);

  useEffect(() => {
    fetchProprietarios();
    fetchDespesas();
    fetchImoveis();
    fetchReservasSemValores();
  }, []);

  useEffect(() => {
    if (imoveis.length > 0) {
      fetchStats();
    }
  }, [filtroProprietario, imoveis, mesSelecionado, anoSelecionado]);

  const navegarMes = (delta: number) => {
    let novoMes = mesSelecionado + delta;
    let novoAno = anoSelecionado;
    if (novoMes < 0) { novoMes = 11; novoAno -= 1; }
    if (novoMes > 11) { novoMes = 0; novoAno += 1; }
    setMesSelecionado(novoMes);
    setAnoSelecionado(novoAno);
  };

  const isMesAtual = mesSelecionado === now.getMonth() && anoSelecionado === now.getFullYear();
  const isMesFuturo = anoSelecionado > now.getFullYear() || (anoSelecionado === now.getFullYear() && mesSelecionado > now.getMonth());

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

    setProprietarios((profiles || []).filter((p) => p && p.id));
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
    const isAcumuladoMes = mesSelecionado === -1;
    const isAcumuladoAno = anoSelecionado === -1;

    // Início e fim do período para busca no banco (se acumulado, busca tudo)
    const firstDay = isAcumuladoMes ? (isAcumuladoAno ? "1970-01-01" : `${anoSelecionado}-01-01`) : (isAcumuladoAno ? "1970-01-01" : new Date(anoSelecionado, mesSelecionado, 1).toISOString().split("T")[0]);
    const lastDay = isAcumuladoMes ? (isAcumuladoAno ? "2099-12-31" : `${anoSelecionado}-12-31`) : (isAcumuladoAno ? "2099-12-31" : new Date(anoSelecionado, mesSelecionado + 1, 0).toISOString().split("T")[0]);

    let imovelIds: string[] | null = null;
    if (filtroProprietario !== "todos" && imoveis.length > 0) {
      imovelIds = imoveis
        .filter((im) => im.proprietario_id === filtroProprietario || im.proprietario_id_2 === filtroProprietario)
        .map((im) => im.id);
    }

    if (imovelIds !== null && imovelIds.length === 0) {
      setStats({ totalProprietarios: 1, totalImoveis: 0, totalReservas: 0, receitaMes: 0 });
      setFinanceiro({ valorBruto: 0, taxaLimpeza: 0, valorLiquido: 0, comissaoCW: 0, valorProprietario: 0 });
      setLoading(false);
      return;
    }

    // 1. Batch metadata queries
    const [propCountRes, adminConfigRes, imoveisCountRes] = await Promise.all([
      supabase.from("admin_proprietarios").select("*", { count: "exact", head: true }),
      supabase.from("admin_configs").select("comissao_cw").single(),
      supabase.from("imoveis").select("*", { count: "exact", head: true }).in("id", imovelIds || imoveis.map(i => i.id))
    ]);

    const adminRate = adminConfigRes.data?.comissao_cw ?? 0.25;
    
    // 2. Data queries
    const ownerIds = new Set<string>();
    imoveis.forEach((im) => {
      if (im.proprietario_id) ownerIds.add(im.proprietario_id);
      if (im.proprietario_id_2) ownerIds.add(im.proprietario_id_2);
    });

    const futureStart = (isAcumuladoMes || isAcumuladoAno) 
      ? new Date().toISOString().split("T")[0]
      : new Date(anoSelecionado, mesSelecionado + 1, 1).toISOString().split("T")[0];

    const reservationsQuery = supabase.from("reservas")
      .select("imovel_id, valor_bruto, taxa_limpeza, comissao_plataforma, valor_liquido_proprietario, taxa_comissao_reserva, data_fim")
      .gte("data_fim", isAcumuladoMes && isAcumuladoAno ? "1970-01-01" : firstDay);

    const ganhosQuery = supabase.from("ganhos_extras" as any)
      .select("imovel_id, valor, regime_comissao, aplicar_comissao, data, reservas(data_fim)");

    const [reservasRes, ganhosRes, profilesRes] = await Promise.all([
      imovelIds ? reservationsQuery.in("imovel_id", imovelIds) : reservationsQuery,
      imovelIds ? ganhosQuery.in("imovel_id", imovelIds) : ganhosQuery,
      ownerIds.size > 0 
        ? supabase.from("profiles").select("id, comissao_percentual").in("id", Array.from(ownerIds))
        : Promise.resolve({ data: [] })
    ]);

    const ownerRatesMap: Record<string, number> = {};
    (profilesRes.data || []).forEach((p: any) => {
      ownerRatesMap[p.id] = (p.comissao_percentual ?? 25) / 100;
    });

    const getOwnerRate = (imovelId: string): number => {
      const im = imoveis.find((i) => i.id === imovelId);
      if (im?.taxa_comissao != null) return im.taxa_comissao / 100;
      if (im?.proprietario_id && ownerRatesMap[im.proprietario_id] != null) return ownerRatesMap[im.proprietario_id];
      return adminRate;
    };

    const filterByDate = (dateStr: string) => {
      if (!dateStr) return false;
      const [y, m, d] = dateStr.split("-").map(Number);
      const matchAno = isAcumuladoAno || y === anoSelecionado;
      const matchMes = isAcumuladoMes || (m - 1) === mesSelecionado;
      return matchAno && matchMes;
    };

    // 3. Single-pass calculation
    const currentReservas = (reservasRes.data || []).filter(r => filterByDate(r.data_fim));
    const futureReservas = (reservasRes.data || []).filter(r => r.data_fim >= futureStart);

    const totaisReservas = currentReservas.reduce((acc, r) => {
      const valorBruto = r.valor_bruto || 0;
      const taxaLimpeza = r.taxa_limpeza || 0;
      const comissaoPlataforma = (r as any).comissao_plataforma || 0;
      const valorLiquido = valorBruto - taxaLimpeza - comissaoPlataforma;
      const rate = (r as any).taxa_comissao_reserva != null 
        ? (r as any).taxa_comissao_reserva / 100 
        : getOwnerRate((r as any).imovel_id);
      const comissaoCW = valorLiquido * rate;
      const valorProprietario = valorLiquido - comissaoCW;
      return {
        valorBruto: acc.valorBruto + valorBruto,
        taxaLimpeza: acc.taxaLimpeza + taxaLimpeza,
        valorLiquido: acc.valorLiquido + valorLiquido,
        comissaoCW: acc.comissaoCW + comissaoCW,
        valorProprietario: acc.valorProprietario + valorProprietario,
      };
    }, { valorBruto: 0, taxaLimpeza: 0, valorLiquido: 0, comissaoCW: 0, valorProprietario: 0 });

    const currentGanhos = (ganhosRes.data || []).filter((g: any) => {
      const resData = Array.isArray(g.reservas) ? g.reservas[0] : g.reservas;
      const effectiveDate = resData?.data_fim || g.data;
      return filterByDate(effectiveDate);
    });

    const totaisGanhos = currentGanhos.reduce((acc: any, g: any) => {
      const valor = Number(g.valor) || 0;
      let com = 0; let prop = 0;
      const regime = g.regime_comissao || (g.aplicar_comissao ? "com_comissao" : "sem_comissao");
      if (regime === "com_comissao") {
        const rate = getOwnerRate(g.imovel_id);
        com = valor * rate;
        prop = valor - com;
      } else if (regime === "sem_comissao") prop = valor;
      else if (regime === "exclusivo_adm") com = valor;
      
      return {
        valorBruto: acc.valorBruto + (regime === "exclusivo_adm" ? 0 : valor),
        comissaoCW: acc.comissaoCW + com,
        valorProprietario: acc.valorProprietario + prop,
      };
    }, { valorBruto: 0, comissaoCW: 0, valorProprietario: 0 });

    const futuroTotais = futureReservas.reduce((acc, r) => {
      const valorBruto = r.valor_bruto || 0;
      const taxaLimpeza = r.taxa_limpeza || 0;
      const comissaoPlataforma = (r as any).comissao_plataforma || 0;
      const valorLiquido = valorBruto - taxaLimpeza - comissaoPlataforma;
      const rate = (r as any).taxa_comissao_reserva != null 
        ? (r as any).taxa_comissao_reserva / 100 
        : getOwnerRate((r as any).imovel_id);
      const comissaoCW = valorLiquido * rate;
      const valorProprietario = valorLiquido - comissaoCW;
      return {
        totalReservas: acc.totalReservas + 1,
        valorBruto: acc.valorBruto + valorBruto,
        valorProprietario: acc.valorProprietario + valorProprietario,
      };
    }, { totalReservas: 0, valorBruto: 0, valorProprietario: 0 });

    setFuturo(futuroTotais);
    setStats({
      totalProprietarios: filtroProprietario === "todos" ? (propCountRes.count || 0) : 1,
      totalImoveis: imoveisCountRes.count || 0,
      totalReservas: currentReservas.length,
      receitaMes: totaisReservas.valorProprietario + totaisGanhos.valorProprietario,
    });
    setFinanceiro({
      valorBruto: totaisReservas.valorBruto + totaisGanhos.valorBruto,
      taxaLimpeza: totaisReservas.taxaLimpeza,
      valorLiquido: totaisReservas.valorLiquido + totaisGanhos.valorBruto,
      comissaoCW: totaisReservas.comissaoCW + totaisGanhos.comissaoCW,
      valorProprietario: totaisReservas.valorProprietario + totaisGanhos.valorProprietario,
    });
    setLoading(false);
  };

  const fetchDespesas = async () => {
    const { data } = await supabase.from("despesas_extras" as any).select("*, imoveis(nome_imovel)").order("data", { ascending: false });
    setDespesas((data || []).map((d: any) => ({ ...d, imovel: d.imoveis })));
  };

  const fetchImoveis = async () => {
    const { data } = await supabase.from("imoveis").select("id, nome_imovel, proprietario_id, proprietario_id_2, taxa_comissao").order("nome_imovel");
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
    try {
      const mesNome = mesSelecionado === -1 ? "Acumulado" : MESES[mesSelecionado];
      const periodoLabel = `${mesNome} / ${anoSelecionado === -1 ? "Todos os Anos" : anoSelecionado}`;
      const nomeProprietario = filtroProprietario === "todos" ? "Todos os proprietários" : proprietarios.find(p => p.id === filtroProprietario)?.nome || "—";
      const { doc, palette, companyName, logoData, pageW, pageH } = await createPdfDoc(theme, "portrait");
      let y = drawHeader(doc, { title: "Visão Geral — Relatório Financeiro", subtitle: companyName, lines: [`Período: ${periodoLabel}`, `Proprietário: ${nomeProprietario}`, genTimestamp()], palette, logoData, companyName, pageW });
      y += 6;
      y = drawSummaryCards(doc, [
        { label: "Proprietários", value: String(stats.totalProprietarios) },
        { label: "Imóveis", value: String(stats.totalImoveis) },
        { label: "Reservas", value: String(stats.totalReservas) },
        { label: "Repasse", value: fmt(stats.receitaMes), highlight: true },
      ], { startY: y, pageW, palette });
      y += 4;
      y = drawSectionTitle(doc, "Detalhamento Financeiro", y, palette, pageW);
      const finData = [
        ["Receita Bruta", fmt(financeiro.valorBruto), "Total das receitas sem deduções"],
        ["(−) Taxa de Limpeza", fmt(financeiro.taxaLimpeza), "Dedução do valor bruto"],
        ["(−) Comissão OTA", fmt(financeiro.valorBruto - financeiro.taxaLimpeza - financeiro.valorLiquido), "Comissão da plataforma"],
        ["= Receita Líquida", fmt(financeiro.valorLiquido), "Bruto − Limpeza − OTA"],
        ["(−) Comissão ADM", fmt(financeiro.comissaoCW), "Comissão de gestão"],
        ["= Repasse ao Proprietário", fmt(financeiro.valorProprietario), "Líquido − Comissão ADM"],
      ];
      autoTable(doc, { startY: y, head: [["Descrição", "Valor", "Observação"]], body: finData, ...premiumTableStyles(palette), columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { textColor: [130, 130, 130], fontSize: 7 } } });
      drawFooterAllPages(doc, palette, companyName, pageW, pageH);
      doc.save(`relatorio_${mesNome}_${anoSelecionado === -1 ? "TodosAnos" : anoSelecionado}.pdf`);
      toast({ title: "Relatório gerado!" });
    } catch (err) { toast({ title: "Erro ao gerar PDF", variant: "destructive" }); }
  };

  const despesasFiltradas = useMemo(() => {
    return despesas.filter(d => {
      const im = imoveis.find(i => i.id === d.imovel_id);
      const matchProp = filtroProprietario === "todos" || im?.proprietario_id === filtroProprietario || im?.proprietario_id_2 === filtroProprietario;
      if (!matchProp) return false;
      
      const [y, m] = d.data.split("-").map(Number);
      const matchAno = anoSelecionado === -1 || y === anoSelecionado;
      const matchMes = mesSelecionado === -1 || (m - 1) === mesSelecionado;
      return matchAno && matchMes;
    });
  }, [despesas, imoveis, filtroProprietario, anoSelecionado, mesSelecionado]);

  const cards = [
    { title: filtroProprietario === "todos" ? "Proprietários" : "Proprietário", value: stats.totalProprietarios, icon: Users, format: "number" },
    { title: "Imóveis", value: stats.totalImoveis, icon: Building2, format: "number" },
    { title: "Reservas no mês", value: stats.totalReservas, icon: CalendarDays, format: "number" },
    { title: "Repasse a Proprietários", value: stats.receitaMes, icon: TrendingUp, format: "currency" },
  ];

  const financeiroCards = [
    { title: "Receita Bruta", value: financeiro.valorBruto, icon: DollarSign, description: "Total sem deduções" },
    { title: "Taxa Limpeza", value: financeiro.taxaLimpeza, icon: Percent, description: "Dedução do bruto" },
    { title: "Receita Líquida", value: financeiro.valorLiquido, icon: DollarSign, description: "Bruto - Limpeza" },
    { title: "Comissão ADM", value: financeiro.comissaoCW, icon: Percent, description: "Sobre líquido" },
    { title: "Proprietário", value: financeiro.valorProprietario, icon: UserCheck, description: "Líquido - Comissão" },
  ];

  const formatValue = (value: number, format: string) => format === "currency" ? fmt(value) : value.toString();

  return (
    <PageTransition>
      <div className="space-y-6 sm:space-y-8 w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl text-foreground">Visão Geral</h1>
            {isMesFuturo && <Badge variant="secondary" className="text-[10px]">Futuro</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-1.5 py-1 shadow-sm">
              <button 
                onClick={() => navegarMes(-1)} 
                disabled={mesSelecionado === -1}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <Select value={String(mesSelecionado)} onValueChange={(v) => setMesSelecionado(Number(v))}>
                <SelectTrigger className="border-0 bg-transparent h-8 w-[108px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1" className="font-semibold">Acumulado</SelectItem>
                  {MESES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(Number(v))}>
                <SelectTrigger className="border-0 bg-transparent h-8 w-[68px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1" className="font-semibold">Acumulado</SelectItem>
                  {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              <button 
                onClick={() => navegarMes(1)} 
                disabled={mesSelecionado === -1}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {proprietarios.length > 0 && (
                <Select 
                  value={filtroProprietario} 
                  onValueChange={(v) => {
                    setFiltroProprietario(v);
                    setFiltroImovel("todos");
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[190px] h-9 shadow-sm"><SelectValue placeholder="Proprietário…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Proprietários</SelectItem>
                    {proprietarios.map(p => <SelectItem key={p.id} value={p.id}>{p.nome || p.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              
              <Select value={filtroImovel} onValueChange={setFiltroImovel}>
                <SelectTrigger className="w-full sm:w-[190px] h-9 shadow-sm"><SelectValue placeholder="Imóvel…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Imóveis</SelectItem>
                  {imoveis
                    .filter(im => filtroProprietario === "todos" || im.proprietario_id === filtroProprietario || im.proprietario_id_2 === filtroProprietario)
                    .map(im => <SelectItem key={im.id} value={im.id}>{im.nome_imovel}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <Button onClick={gerarPDF} disabled={loading} variant="outline" size="sm" className="gap-2"><FileDown className="h-4 w-4" /> Exportar PDF</Button>
          </div>
        </div>

        {reservasSemValores > 0 && (
          <button onClick={() => navigate("/admin/reservas")} className="w-full text-left flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 group">
            <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-warning/15 text-warning"><AlertTriangle className="h-4 w-4" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{reservasSemValores} reservas sem valores financeiros</p>
              <p className="text-xs text-muted-foreground">Clique para preencher os valores</p>
            </div>
            <ArrowRight className="h-4 w-4 text-warning opacity-60 group-hover:opacity-100 transition-all" />
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="spotlight-card group">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase">{card.title}</CardTitle>
                  <div className="h-10 w-10 rounded-xl bg-primary/8 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>{loading ? <div className="h-8 w-24 bg-muted animate-pulse rounded-lg" /> : <p className="font-display text-2xl font-semibold">{formatValue(card.value, card.format)}</p>}</CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {financeiroCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="spotlight-card group">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase">{card.title}</CardTitle>
                  <Icon className="h-3.5 w-3.5 text-primary opacity-60" />
                </CardHeader>
                <CardContent>{loading ? <div className="h-7 w-20 bg-muted animate-pulse rounded-lg" /> : <div className="space-y-1"><p className="font-display text-lg text-foreground">{fmt(card.value)}</p><p className="text-[11px] text-muted-foreground">{card.description}</p></div>}</CardContent>
              </Card>
            );
          })}
        </div>

        <OccupancyComparison 
          mes={mesSelecionado} 
          ano={anoSelecionado} 
          imovelIds={filteredImovelIds} 
        />

        <FinancialYearComparison imovelIds={filteredImovelIds} imoveis={imoveis} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-foreground">Despesas Extras</h2>
              <Button onClick={() => setDialogOpen(true)} size="sm" variant="outline" className="gap-2 h-8 text-xs"><Plus className="h-3.5 w-3.5" /> Nova Despesa</Button>
            </div>
            <div className="border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Imóvel</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {despesasFiltradas.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm">{imoveis.find(i => i.id === d.imovel_id)?.nome_imovel || "—"}</TableCell>
                      <TableCell className="text-sm">{d.descricao}</TableCell>
                      <TableCell className="text-sm text-right font-semibold">{fmt(d.valor)}</TableCell>
                      <TableCell><button onClick={() => handleDelete(d.id)} className="text-muted-foreground hover:text-destructive p-1.5"><Trash2 className="h-3.5 w-3.5" /></button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-foreground">Receitas Extras</h2>
              <Button onClick={() => setGanhosDialogOpen(true)} size="sm" variant="outline" className="gap-2 h-8 text-xs text-primary hover:text-primary hover:bg-primary/5"><Sparkles className="h-3.5 w-3.5" /> Gerenciar Receitas</Button>
            </div>
            <div className="border border-border rounded-xl bg-card p-8 flex flex-col items-center justify-center gap-3 text-center h-[200px]">
              <div className="h-10 w-10 rounded-xl bg-primary/8 flex items-center justify-center"><Sparkles className="h-5 w-5 text-primary" /></div>
              <p className="text-sm font-medium">Gestão de Receitas Extras</p>
              <Button variant="link" onClick={() => setGanhosDialogOpen(true)} className="text-primary text-xs">Abrir painel de gestão</Button>
            </div>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card border-border sm:max-w-md">
            <DialogHeader><DialogTitle>Nova Despesa Extra</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest">Imóvel</Label>
                <Select value={form.imovel_id} onValueChange={(v) => setForm({ ...form, imovel_id: v })}><SelectTrigger><SelectValue placeholder="Selecionar imóvel…" /></SelectTrigger><SelectContent>{imoveis.map(im => <SelectItem key={im.id} value={im.id}>{im.nome_imovel}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest">Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Manutenção..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest">Tipo</Label><Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest">Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest">Valor (R$)</Label><CurrencyInput value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} placeholder="0,00" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave} disabled={saving}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <GanhosExtrasDialog 
          open={ganhosDialogOpen} 
          onOpenChange={setGanhosDialogOpen} 
          imoveis={imoveis} 
          onChanged={fetchStats} 
          imovelId={filtroImovel !== "todos" ? filtroImovel : undefined}
        />
      </div>
    </PageTransition>
  );
};

export default AdminDashboard;
