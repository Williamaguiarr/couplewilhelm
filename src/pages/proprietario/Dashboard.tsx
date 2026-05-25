import React, { useEffect, useState, useCallback } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import OccupancyComparison from "@/components/dashboard/OccupancyComparison";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import autoTable from "jspdf-autotable";
import { useTheme } from "@/contexts/ThemeContext";
import {
  createPdfDoc, drawHeader, drawSummaryCards, drawSectionTitle,
  drawFooterAllPages, makeAutoTableFooterCallback, premiumTableStyles,
  fmtBRL, genTimestamp,
} from "@/lib/pdf/builder";
import { useToast } from "@/hooks/use-toast";
import CustosFixosProprietario from "@/components/dashboard/CustosFixosProprietario";

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
  taxa_comissao_reserva: number | null;
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

interface GanhoExtra {
  id: string;
  imovel_id: string;
  reserva_id?: string | null;
  descricao: string;
  valor: number;
  data: string;
  tipo: string;
  regime_comissao?: string;
  aplicar_comissao: boolean;
  imovel?: { nome_imovel: string };
  reservas?: { data_fim: string } | null;
}

const fmt = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";

// Checkout day is excluded: guest leaves in the morning (≤12h), so that day is free
const getDaysBetween = (start: string, end: string): Date[] => {
  const days: Date[] = [];
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  
  if (isNaN(y1) || isNaN(y2)) return [];

  const current = new Date(y1, m1 - 1, d1, 12, 0, 0);
  const endDate = new Date(y2, m2 - 1, d2, 12, 0, 0);

  // Exclude the checkout day (data_fim) — it's free since guest leaves in the morning
  while (current < endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const calcFinanceiro = (r: Reserva, defaultRate: number, getRateForImovel: (id: string) => number) => {
  const bruto = r.valor_bruto ?? 0;
  const limpeza = r.taxa_limpeza ?? 0;
  const plataforma = r.comissao_plataforma ?? 0;
  
  // Use a taxa específica da reserva se existir, senão usa a do imóvel, senão a padrão
  const rate = r.taxa_comissao_reserva != null 
    ? r.taxa_comissao_reserva / 100 
    : getRateForImovel(r.imovel_id);
    
  const liquido = bruto - limpeza - plataforma;
  const comissao = liquido * rate;
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
  const { theme } = useTheme();
  const { toast } = useToast();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [despesas, setDespesas] = useState<DespesaExtra[]>([]);
  const [ganhos, setGanhos] = useState<GanhoExtra[]>([]);
  const [imoveis, setImoveis] = useState<{ id: string; nome_imovel: string; taxa_comissao?: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [comissaoRate, setComissaoRate] = useState<number>(0.25);
  const [nomeAdmin, setNomeAdmin] = useState<string>("CW");

  const now = new Date();

  // Filtros: mês e ano (baseado em data_fim - checkout)
  // -1 representa "Acumulado"
  const [filterMes, setFilterMes] = useState<number>(now.getMonth()); // -1 to 11
  const [filterAno, setFilterAno] = useState<number>(now.getFullYear()); // -1 for Acumulado
  const [filterImovel, setFilterImovel] = useState<string>("todos");
  const [extratoAberto, setExtratoAberto] = useState(true);
  const [totalCustosFixos, setTotalCustosFixos] = useState(0);

  const getRateForImovel = useCallback((imovelId: string) => {
    const im = imoveis.find(i => i.id === imovelId);
    if (im?.taxa_comissao != null) return im.taxa_comissao / 100;
    return comissaoRate;
  }, [imoveis, comissaoRate]);

  
  const anoAtual = now.getFullYear();
  const anos = Array.from({ length: 4 }, (_, i) => anoAtual - 2 + i);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Buscar comissão do próprio proprietário
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("comissao_percentual")
        .eq("id", user.id)
        .maybeSingle();
      if (myProfile && (myProfile as any).comissao_percentual != null) {
        setComissaoRate((myProfile as any).comissao_percentual / 100);
      }

      const { data: imoveisData } = await supabase
        .from("imoveis")
        .select("id, nome_imovel, admin_id, taxa_comissao")
        .or(`proprietario_id.eq.${user.id},proprietario_id_2.eq.${user.id}`);

      setImoveis((imoveisData || []).map(({ id, nome_imovel, taxa_comissao }) => ({ id, nome_imovel, taxa_comissao })));

      if (imoveisData && imoveisData.length === 1 && filterImovel === "todos") {
        setFilterImovel(imoveisData[0].id);
      }

      // Buscar nome do admin para exibição
      const adminId = imoveisData?.[0]?.admin_id;
      if (adminId) {
        const { data: configData } = await supabase
          .from("admin_configs" as any)
          .select("nome_empresa")
          .eq("admin_id", adminId)
          .maybeSingle();
        if (configData) {
          const cfg = configData as any;
          if (cfg.nome_empresa) setNomeAdmin(cfg.nome_empresa);
        }
      }

      const [{ data: resData }, { data: despData }, { data: ganhosData }] = await Promise.all([
        supabase
          .from("reservas")
          .select("*, imoveis(nome_imovel)")
          .order("data_inicio", { ascending: false }),
        supabase
          .from("despesas_extras" as any)
          .select("*, imoveis(nome_imovel)")
          .order("data", { ascending: false }),
        supabase
          .from("ganhos_extras" as any)
          .select("*, imoveis(nome_imovel), reservas(data_fim)")
          .order("data", { ascending: false }),
      ]);

      setReservas((resData || []).map((r: any) => ({ ...r, imovel: Array.isArray(r.imoveis) ? r.imoveis[0] : r.imoveis })));
      setDespesas((despData || []).map((d: any) => ({ ...d, imovel: Array.isArray(d.imoveis) ? d.imoveis[0] : d.imoveis })));
      setGanhos((ganhosData || []).map((g: any) => ({ 
        ...g, 
        imovel: Array.isArray(g.imoveis) ? g.imoveis[0] : g.imoveis,
        reservas: Array.isArray(g.reservas) ? g.reservas[0] : g.reservas
      })));
      setLoading(false);
    };
    fetchData();
  }, [user]);

  

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const getReservasForDay = useCallback(
    (day: Date) =>
      reservas.filter((r) => {
        const [y1, m1, d1] = r.data_inicio.split("-").map(Number);
        const [y2, m2, d2] = r.data_fim.split("-").map(Number);
        const inicio = new Date(y1, m1 - 1, d1, 12, 0, 0);
        const fim = new Date(y2, m2 - 1, d2, 12, 0, 0);
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
    const [y, m, d] = r.data_fim.split("-").map(Number);
    const fim = new Date(y, m - 1, d);
    
    const matchAno = filterAno === -1 || fim.getFullYear() === filterAno;
    const matchMes = filterMes === -1 || fim.getMonth() === filterMes;
    
    return matchAno && matchMes;
  });

  // Despesas: pelo campo data (mês da despesa)
  const despesasFiltradas = despesas.filter((d) => {
    if (filterImovel !== "todos" && d.imovel_id !== filterImovel) return false;
    const [y, m, day] = d.data.split("-").map(Number);
    const data = new Date(y, m - 1, day);
    
    const matchAno = filterAno === -1 || data.getFullYear() === filterAno;
    const matchMes = filterMes === -1 || data.getMonth() === filterMes;
    
    return matchAno && matchMes;
  });

  // Ganhos extras: prioriza o mês de checkout da reserva vinculada, senão usa a data do lançamento.
  const ganhosFiltrados = ganhos.filter((g) => {
    if (filterImovel !== "todos" && g.imovel_id !== filterImovel) return false;
    
    // Se vinculado a uma reserva, deve aparecer no mês de checkout dela
    const effectiveDate = g.reservas?.data_fim || g.data;
    
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveDate || "");
    if (!m) return true; // data inválida → não esconder (estratégia defensiva)
    const [, y, mo, d] = m.map(Number) as unknown as number[];
    const data = new Date(y, mo - 1, d);
    
    const matchAno = filterAno === -1 || data.getFullYear() === filterAno;
    const matchMes = filterMes === -1 || data.getMonth() === filterMes;
    
    return matchAno && matchMes;
  });

  // Calcular métricas apenas para o imóvel selecionado
  const reservasImovelSelecionado = filterImovel === "todos"
    ? reservas
    : reservas.filter(r => r.imovel_id === filterImovel);

  const ganhosImovelSelecionado = filterImovel === "todos"
    ? ganhos
    : ganhos.filter(g => g.imovel_id === filterImovel);

  // Receita líquida do proprietário a partir de um ganho extra.
  // Defensivo: valores nulos/NaN viram 0 — nunca propagam NaN para os totais.
  const ganhoProprietarioValor = (g: GanhoExtra): number => {
    const valor = Number.isFinite(Number(g.valor)) ? Number(g.valor) : 0;
    const regime = g.regime_comissao || (g.aplicar_comissao ? "com_comissao" : "sem_comissao");
    if (regime === "com_comissao") {
      const rate = getRateForImovel(g.imovel_id);
      return valor * (1 - rate);
    }
    if (regime === "sem_comissao") return valor;
    if (regime === "exclusivo_adm") return 0;
    return 0;
  };

  const receitaMesAtual =
    reservasImovelSelecionado
      .filter((r) => {
        const [y, m, d] = r.data_fim.split("-").map(Number);
        const fim = new Date(y, m - 1, d);
        const matchAno = filterAno === -1 || fim.getFullYear() === filterAno;
        const matchMes = filterMes === -1 || fim.getMonth() === filterMes;
        return matchAno && matchMes;
      })
      .reduce((acc, r) => {
        const f = calcFinanceiro(r, comissaoRate, getRateForImovel);
        return acc + f.proprietario;
      }, 0)
    + ganhosImovelSelecionado
      .filter((g) => {
        const effectiveDate = g.reservas?.data_fim || g.data;
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveDate || "");
        if (!m) return true;
        const [, y, mo, d] = m.map(Number) as unknown as number[];
        const data = new Date(y, mo - 1, d);
        const matchAno = filterAno === -1 || data.getFullYear() === filterAno;
        const matchMes = filterMes === -1 || data.getMonth() === filterMes;
        return matchAno && matchMes;
      })
      .reduce((acc, g) => acc + ganhoProprietarioValor(g), 0);

  const previsaoFutura = reservasImovelSelecionado
    .filter((r) => {
      const [y, m, d] = r.data_fim.split("-").map(Number);
      // Use local date for "today" to match user's perspective
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const checkoutDate = new Date(y, m - 1, d);
      checkoutDate.setHours(0, 0, 0, 0);

      // Rule: From TODAY onwards
      if (checkoutDate < today) return false;

      // Rule: Until the end of the next 3 full calendar months
      // Example: If today is May 15, current month is 4 (0-indexed).
      // Next 3 full months are June (5), July (6), August (7).
      // End date is the last day of August.
      const limitDate = new Date(today.getFullYear(), today.getMonth() + 4, 0);
      limitDate.setHours(23, 59, 59, 999);

      return checkoutDate <= limitDate;
    })
    .reduce((acc, r) => {
      const f = calcFinanceiro(r, comissaoRate, getRateForImovel);
      return acc + f.proprietario;
    }, 0);

  const occupiedDays = reservasImovelSelecionado.flatMap((r) =>
    getDaysBetween(r.data_inicio, r.data_fim)
  );

  const totaisReservas = reservasFiltradas.reduce(
    (acc, r) => {
      const f = calcFinanceiro(r, comissaoRate, getRateForImovel);
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

  // Totais de ganhos extras (defensivo: valor inválido = 0, nunca NaN).
  const totaisGanhos = ganhosFiltrados.reduce(
    (acc, g) => {
      const valor = Number.isFinite(Number(g.valor)) ? Number(g.valor) : 0;
      const regime = g.regime_comissao || (g.aplicar_comissao ? "com_comissao" : "sem_comissao");
      let comissao = 0;
      let proprietario = 0;

      if (regime === "com_comissao") {
        const rate = getRateForImovel(g.imovel_id);
        comissao = valor * rate;
        proprietario = valor - comissao;
      } else if (regime === "sem_comissao") {
        comissao = 0;
        proprietario = valor;
      } else if (regime === "exclusivo_adm") {
        comissao = valor;
        proprietario = 0;
      }

      return {
        bruto: acc.bruto + (regime === "exclusivo_adm" ? 0 : valor),
        comissao: acc.comissao + comissao,
        proprietario: acc.proprietario + proprietario,
      };
    },
    { bruto: 0, comissao: 0, proprietario: 0 }
  );

  // Totais combinados (reservas + ganhos extras)
  const totais = {
    bruto: totaisReservas.bruto + totaisGanhos.bruto,
    limpeza: totaisReservas.limpeza,
    plataforma: totaisReservas.plataforma,
    comissao: totaisReservas.comissao + totaisGanhos.comissao,
    proprietario: totaisReservas.proprietario + totaisGanhos.proprietario,
  };

  const totalDespesas = despesasFiltradas.reduce((acc, d) => acc + d.valor, 0);
  const totalLiquido = totais.proprietario - totalDespesas;

  const isPeriodoAtual = filterMes === currentMonth && filterAno === currentYear;
  const isAcumulado = filterMes === -1 || filterAno === -1;

  const gerarPDF = async () => {
    try {
    const { doc, palette, companyName, logoData, pageW, pageH } = await createPdfDoc(theme, "landscape");

    const imovelNome = filterImovel !== "todos"
      ? imoveis.find((i) => i.id === filterImovel)?.nome_imovel ?? "Todos"
      : "Todos os imóveis";

    // ── Header
    let y = drawHeader(doc, {
      title: "Extrato do Proprietário",
      subtitle: companyName,
      lines: [
        `Imóvel: ${imovelNome}`,
        `Período: ${filterMes === -1 ? "Todos os meses" : MESES[filterMes]} de ${filterAno === -1 ? "Todos os anos" : filterAno}`,
        genTimestamp(),
      ],
      palette, logoData, companyName, pageW,
    });

    y += 6;

    // ── Summary cards
    y = drawSummaryCards(doc, [
      { label: "Valor Bruto Total", value: fmtBRL(totais.bruto) },
      { label: "Tx. Limpeza", value: fmtBRL(totais.limpeza) },
      { label: "Comissão OTA", value: fmtBRL(totais.plataforma) },
      { label: "Ganhos Extras", value: fmtBRL(totaisGanhos.bruto) },
      { label: "Comissão ADM", value: fmtBRL(totais.comissao) },
      { label: "Despesas Extras", value: fmtBRL(totalDespesas) },
      { label: "Custos Fixos", value: fmtBRL(totalCustosFixos) },
      { label: "Líquido Final", value: fmtBRL(totalLiquido - totalCustosFixos), highlight: true },
    ], { startY: y, pageW, palette });

    y += 2;

    // ── Tabela de reservas
    const tableData = reservasFiltradas.map((r) => {
      const f = calcFinanceiro(r, comissaoRate, getRateForImovel);
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
        fmtBRL(f.bruto),
        fmtBRL(f.limpeza),
        f.plataforma > 0 ? fmtBRL(f.plataforma) : "—",
        fmtBRL(f.comissao),
        fmtBRL(f.proprietario),
        r.observacoes || "",
      ];
    });

    const footerCb = makeAutoTableFooterCallback(doc, palette, companyName, pageW, pageH);

    autoTable(doc, {
      startY: y,
      head: [["Imóvel", "Check-in", "Check-out", "V. Bruto", "Limpeza", "Com. OTA", "Comissão", "Repasse", "Obs."]],
      body: tableData,
      ...premiumTableStyles(palette),
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 26, halign: "right" },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 26, halign: "right" },
        7: { cellWidth: 28, halign: "right", fontStyle: "bold", textColor: palette.primary },
        8: { cellWidth: "auto" },
      },
      didDrawPage: footerCb,
    });

    // ── Ganhos extras
    if (ganhosFiltrados.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? pageH - 40;
      if (finalY + 40 > pageH - 20) { doc.addPage(); }
      let gY = Math.min(finalY + 8, pageH - 60);
      gY = drawSectionTitle(doc, "Ganhos Extras", gY + 6, palette, pageW);

      autoTable(doc, {
        startY: gY,
        head: [["Imóvel", "Descrição", "Tipo", "Data", "Valor", "Comissão ADM", "Repasse"]],
        body: ganhosFiltrados
          .filter(g => g.regime_comissao !== "exclusivo_adm" || filterImovel === "todos") // Mostra tudo se for visão geral, senão filtra se solicitado
          .map((g) => {
            const regime = g.regime_comissao || (g.aplicar_comissao ? "com_comissao" : "sem_comissao");
            const rate = getRateForImovel(g.imovel_id);
            const com = regime === "com_comissao" ? g.valor * rate : 0;
            const rep = g.valor - com;
            return [
              g.imovel?.nome_imovel || "—",
              g.descricao,
              g.tipo,
              (() => {
                const effectiveDate = g.reservas?.data_fim || g.data;
                const [y, m, d] = (effectiveDate || "").split("-").map(Number);
                if (isNaN(y)) return "—";
                return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
              })(),
              fmtBRL(g.valor),
              com > 0 ? `- ${fmtBRL(com)}` : "—",
              fmtBRL(rep),
            ];
          }),
        ...premiumTableStyles(palette),
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: "auto" },
          2: { cellWidth: 26 },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 24, halign: "right" },
          5: { cellWidth: 26, halign: "right" },
          6: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: palette.primary },
        },
        didDrawPage: footerCb,
      });
    }

    // ── Despesas extras
    if (despesasFiltradas.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? pageH - 40;
      if (finalY + 40 > pageH - 20) { doc.addPage(); }
      let despY = Math.min(finalY + 8, pageH - 60);

      despY = drawSectionTitle(doc, "Despesas Extras", despY + 6, palette, pageW);

      autoTable(doc, {
        startY: despY,
        head: [["Imóvel", "Descrição", "Tipo", "Data", "Valor"]],
        body: despesasFiltradas.map((d) => [
          d.imovel?.nome_imovel || "—",
          d.descricao,
          TIPO_LABELS[d.tipo] ?? d.tipo,
          new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR"),
          `- ${fmtBRL(d.valor)}`,
        ]),
        ...premiumTableStyles(palette),
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: "auto" },
          2: { cellWidth: 28 },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 28, halign: "right", textColor: [180, 40, 40] as [number, number, number], fontStyle: "bold" },
        },
        didDrawPage: footerCb,
      });
    }

    // Footer on all pages
    drawFooterAllPages(doc, palette, companyName, pageW, pageH);

    doc.save(`extrato-${MESES[filterMes].toLowerCase()}-${filterAno}.pdf`);
    toast({ title: "Extrato gerado com sucesso!" });
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast({ title: "Erro ao gerar relatório", description: String(err), variant: "destructive" });
    }
  };

  return (
    <PageTransition>
      <div className="w-full max-w-6xl overflow-x-hidden space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={gerarPDF}
            disabled={loading || (reservasFiltradas.length === 0 && despesasFiltradas.length === 0 && ganhosFiltrados.length === 0)}
            className="gap-2 text-xs"
          >
            <FileText className="h-3.5 w-3.5" />
            Gerar PDF — {filterMes === -1 ? "Acumulado" : MESES[filterMes]} {filterAno === -1 ? "Total" : filterAno}
          </Button>
        </div>

        {/* ═══ BENTO GRID ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-min">

          {/* ── Receita do Mês (span 1) ── */}
          <BentoBox className="lg:col-span-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {filterMes === -1 && filterAno === -1 ? "Receita Total" : "Receita do Período"}
                </p>
                {loading ? (
                  <div className="h-9 w-36 bg-muted animate-pulse rounded-lg" />
                ) : (
                  <p className="font-display text-2xl sm:text-4xl text-foreground font-semibold tabular-nums">{fmt(receitaMesAtual)}</p>
                )}
                <p className="text-xs text-muted-foreground/70">Checkouts {filterMes === -1 ? "em todos os meses" : "neste período"}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-primary/8 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
          </BentoBox>

          {/* ── Previsão Futura (span 1) ── */}
          <BentoBox className="lg:col-span-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Previsão Futura</p>
                {loading ? (
                  <div className="h-9 w-36 bg-muted animate-pulse rounded-lg" />
                ) : (
                  <p className="font-display text-2xl sm:text-4xl text-foreground font-semibold tabular-nums">{fmt(previsaoFutura)}</p>
                )}
                <p className="text-xs text-muted-foreground/70">Reservas confirmadas</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-primary/8 flex items-center justify-center">
                <CalendarCheck className="h-5 w-5 text-primary" />
              </div>
            </div>
          </BentoBox>

          {/* ── Líquido Final (full width highlight) ── */}
          {!loading && (reservasFiltradas.length > 0 || despesasFiltradas.length > 0 || ganhosFiltrados.length > 0) && (
            <BentoBox className="lg:col-span-4 bg-gradient-to-r from-primary/6 via-primary/3 to-transparent border-primary/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-primary uppercase tracking-wider font-semibold mb-1">
                    Líquido Final — {filterMes === -1 ? "Acumulado" : MESES[filterMes]} {filterAno === -1 ? "Total" : filterAno}
                  </p>
                  <p className="text-xs text-muted-foreground">Repasse − Despesas Extras − Custos Fixos</p>
                </div>
                <p className={cn(
                  "font-display text-2xl sm:text-4xl font-semibold tabular-nums",
                  (totalLiquido - totalCustosFixos) >= 0 ? "text-primary" : "text-destructive"
                )}>
                  {fmt(totalLiquido - totalCustosFixos)}
                </p>
              </div>
            </BentoBox>
          )}

          {/* ── Extrato Financeiro (full width) ── */}
          <BentoBox className="lg:col-span-4 !p-0 overflow-hidden" hover={false}>
            <button
              onClick={() => setExtratoAberto((v) => !v)}
              className="w-full flex items-center justify-between px-5 sm:px-6 py-4 hover:bg-muted/30 transition-colors duration-150"
            >
              <span className="font-display text-base text-foreground">Extrato Financeiro</span>
              {extratoAberto
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {extratoAberto && (
              <div className="border-t border-border">
                {/* Filters */}
                <div className="px-4 sm:px-6 py-3 grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3 border-b border-border">
                  {imoveis.length > 1 && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> Imóvel
                      </Label>
                      <Select value={filterImovel} onValueChange={setFilterImovel}>
                        <SelectTrigger className="w-full sm:w-44 h-8 text-xs bg-transparent border-border">
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

                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Mês</Label>
                    <Select value={String(filterMes)} onValueChange={(v) => setFilterMes(Number(v))}>
                      <SelectTrigger className="w-full sm:w-36 h-8 text-xs bg-transparent border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="-1" className="text-xs font-semibold">Acumulado</SelectItem>
                        {MESES.map((nome, idx) => (
                          <SelectItem key={idx} value={String(idx)} className="text-xs">
                            {nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Ano</Label>
                    <Select value={String(filterAno)} onValueChange={(v) => setFilterAno(Number(v))}>
                      <SelectTrigger className="w-full sm:w-24 h-8 text-xs bg-transparent border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="-1" className="text-xs font-semibold">Acumulado</SelectItem>
                        {anos.map((ano) => (
                          <SelectItem key={ano} value={String(ano)} className="text-xs">
                            {ano}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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
                    <p className="text-muted-foreground text-sm">
                      Nenhuma reserva com checkout em {filterMes === -1 ? "todos os meses" : MESES[filterMes]} de {filterAno === -1 ? "todos os anos" : filterAno}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table className="min-w-[700px]">
                        <TableHeader>
                          <TableRow>
                            {["Imóvel", "Check-in", "Check-out", "Bruto", "Limpeza", "Com. OTA", "Comissão ADM", "Repasse"].map((h, i) => (
                              <TableHead key={h} className={cn(i > 2 && "text-right")}>
                                {h}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reservasFiltradas.map((r) => {
                            const f = calcFinanceiro(r, comissaoRate, getRateForImovel);
                            return (
                              <TableRow key={r.id} className="border-border hover:bg-muted/20">
                                <TableCell className="text-foreground font-medium text-sm py-3 whitespace-nowrap">{r.imovel?.nome_imovel ?? "—"}</TableCell>
                                <TableCell className="text-muted-foreground text-sm py-3 whitespace-nowrap">{new Date(r.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                                <TableCell className="text-muted-foreground text-sm py-3 whitespace-nowrap">{new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                                <TableCell className="text-muted-foreground text-sm text-right py-3 whitespace-nowrap">{fmt(f.bruto)}</TableCell>
                                <TableCell className="text-muted-foreground text-sm text-right py-3 whitespace-nowrap">{fmt(f.limpeza)}</TableCell>
                                <TableCell className="text-muted-foreground text-sm text-right py-3 whitespace-nowrap">
                                  {f.plataforma > 0 ? fmt(f.plataforma) : <span className="opacity-30">—</span>}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm text-right py-3 whitespace-nowrap">{fmt(f.comissao)}</TableCell>
                                <TableCell className="text-primary text-sm text-right font-semibold py-3 whitespace-nowrap">{fmt(f.proprietario)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Totals footer */}
                    <div className="border-t border-border px-4 sm:px-6 py-3 flex items-center justify-end gap-3 sm:gap-6 flex-wrap">
                      <TotalItem label="Bruto" value={fmt(totais.bruto)} />
                      <TotalItem label="Limpeza" value={fmt(totais.limpeza)} />
                      {totais.plataforma > 0 && (
                        <TotalItem label="Com. OTA" value={fmt(totais.plataforma)} />
                      )}
                      <TotalItem label="Comissão ADM" value={fmt(totais.comissao)} />
                      <div className="pl-6 border-l border-border">
                        <p className="text-[10px] text-primary uppercase tracking-widest mb-0.5">Seu Repasse</p>
                        <p className="font-display text-base text-primary font-semibold">{fmt(totais.proprietario)}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </BentoBox>

          {/* ── Ganhos Extras (full width) ── */}
          {ganhosFiltrados.length > 0 && (
            <BentoBox className="lg:col-span-4 !p-0 overflow-hidden" hover={false}>
              <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base text-foreground">Ganhos Extras</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Entradas avulsas — late checkout, hóspede extra, diárias extras
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-primary uppercase tracking-widest mb-0.5">Repasse Extra</p>
                  <p className="font-display text-base text-primary font-semibold">{fmt(totaisGanhos.proprietario)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imóvel</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Repasse</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ganhosFiltrados.map((g) => {
                      const regime = g.regime_comissao || (g.aplicar_comissao ? "com_comissao" : "sem_comissao");
                      const rate = getRateForImovel(g.imovel_id);
                      let com = 0;
                      let rep = 0;

                      if (regime === "com_comissao") {
                        com = g.valor * rate;
                        rep = g.valor - com;
                      } else if (regime === "sem_comissao") {
                        com = 0;
                        rep = g.valor;
                      } else if (regime === "exclusivo_adm") {
                        com = g.valor;
                        rep = 0;
                      }
                      return (
                        <TableRow key={g.id} className="border-border hover:bg-muted/20">
                          <TableCell className="text-foreground font-medium text-sm py-3">{g.imovel?.nome_imovel ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm py-3">{g.descricao}</TableCell>
                          <TableCell className="text-muted-foreground text-sm py-3 whitespace-nowrap">{g.tipo}</TableCell>
                          <TableCell className="text-muted-foreground text-sm py-3 whitespace-nowrap">
                            {(() => {
                              const effectiveDate = g.reservas?.data_fim || g.data;
                              return new Date(effectiveDate + "T12:00:00").toLocaleDateString("pt-BR");
                            })()}
                          </TableCell>
                          <TableCell className="text-foreground text-sm text-right py-3">{fmt(g.valor)}</TableCell>
                          <TableCell className="text-primary text-sm text-right font-semibold py-3">{fmt(rep)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </BentoBox>
          )}

          <div className="lg:col-span-4">
            <CustosFixosProprietario
              imoveis={imoveis}
              repasseMensal={totais.proprietario - totalDespesas}
              filterImovel={filterImovel}
              onTotalChange={setTotalCustosFixos}
            />
          </div>

          {/* ── KPIs / Ocupação (full width) ── */}
          <div className="lg:col-span-4">
            <OccupancyComparison
              mes={filterMes}
              ano={filterAno}
              imovelIds={filterImovel !== "todos" ? [filterImovel] : imoveis.map(i => i.id)}
            />
          </div>

          {/* ── Calendário de Ocupação (span 4) ── */}
          <BentoBox className="lg:col-span-4">
            <div className="mb-5">
              <h2 className="font-display text-base text-foreground">Calendário de Ocupação</h2>
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
                          const f = calcFinanceiro(r, comissaoRate, getRateForImovel);
                          const rate = r.taxa_comissao_reserva != null ? r.taxa_comissao_reserva / 100 : getRateForImovel(r.imovel_id);
                          const pctLabel = `${Math.round(rate * 100)}%`;
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
                                <span>{new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                              </div>
                            </div>
                            <div className="bg-muted/20 rounded-lg p-2.5 space-y-1.5 text-xs">
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
          </BentoBox>

        </div>{/* end bento grid */}
      </div>
    </PageTransition>
  );
};

/* ── Sub-components ─────────────────────────────────── */

const BentoBox: React.FC<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}> = ({ children, className, hover = true }) => (
  <div
    className={cn(
      "rounded-2xl border border-border bg-card p-5 sm:p-6 transition-all duration-300",
      hover && "hover:border-primary/20 hover:shadow-elevated hover:scale-[1.005]",
      className,
    )}
  >
    {children}
  </div>
);

// MetricCard kept for potential reuse
const MetricCard: React.FC<{
  label: string;
  sub: string;
  value: string | null;
  icon: React.ReactNode;
}> = ({ label, sub, value, icon }) => (
  <BentoBox>
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        {value === null ? (
          <div className="h-8 w-32 bg-muted animate-pulse rounded-lg" />
        ) : (
          <p className="font-display text-2xl sm:text-3xl text-foreground font-semibold tabular-nums">{value}</p>
        )}
        <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>
      </div>
      <div className="h-10 w-10 rounded-xl bg-primary/8 flex items-center justify-center">
        <span className="text-primary">{icon}</span>
      </div>
    </div>
  </BentoBox>
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
