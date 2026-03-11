import React, { useEffect, useState, useCallback } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TrendingUp, CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { ptBR } from "date-fns/locale";

interface Reserva {
  id: string;
  imovel_id: string;
  data_inicio: string;
  data_fim: string;
  valor_bruto: number | null;
  valor_liquido_proprietario: number | null;
  observacoes: string | null;
  imovel?: { nome_imovel: string };
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// Gerar todos os dias entre duas datas (inclusive)
const getDaysBetween = (start: string, end: string): Date[] => {
  const days: Date[] = [];
  const current = new Date(start + "T12:00:00");
  const endDate = new Date(end + "T12:00:00");
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const ProprietarioDashboard: React.FC = () => {
  const { user } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchReservas = async () => {
      const { data } = await supabase
        .from("reservas")
        .select("*, imoveis(nome_imovel)")
        .order("data_inicio", { ascending: true });

      setReservas((data || []).map((r: any) => ({ ...r, imovel: r.imoveis })));
      setLoading(false);
    };
    fetchReservas();
  }, [user]);

  // Calcular métricas
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const receitaMesAtual = reservas
    .filter((r) => {
      const fim = new Date(r.data_fim + "T12:00:00");
      return fim.getMonth() === currentMonth && fim.getFullYear() === currentYear;
    })
    .reduce((acc, r) => acc + (r.valor_liquido_proprietario || 0), 0);

  const previsaoFutura = reservas
    .filter((r) => {
      const fim = new Date(r.data_fim + "T12:00:00");
      return (
        fim > new Date() &&
        !(fim.getMonth() === currentMonth && fim.getFullYear() === currentYear)
      );
    })
    .reduce((acc, r) => acc + (r.valor_liquido_proprietario || 0), 0);

  // Dias ocupados para o calendário
  const occupiedDays = reservas.flatMap((r) =>
    getDaysBetween(r.data_inicio, r.data_fim)
  );

  // Encontrar reservas para um dia específico
  const getReservasForDay = useCallback(
    (day: Date) => {
      return reservas.filter((r) => {
        const inicio = new Date(r.data_inicio + "T12:00:00");
        const fim = new Date(r.data_fim + "T12:00:00");
        const d = new Date(day);
        d.setHours(12, 0, 0, 0);
        return d >= inicio && d <= fim;
      });
    },
    [reservas]
  );

  const handleDayClick = (day: Date) => {
    const reservasDay = getReservasForDay(day);
    if (reservasDay.length > 0) {
      setSelectedDay(day);
      setPopoverOpen(true);
    }
  };

  const selectedReservas = selectedDay ? getReservasForDay(selectedDay) : [];

  return (
    <PageTransition>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Sua visão financeira em{" "}
            {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Cards de métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                Receita do Mês Atual
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-36 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <p className="font-display text-3xl text-foreground">{fmt(receitaMesAtual)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reservas com checkout neste mês
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-luxury group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                Previsão Meses Seguintes
              </CardTitle>
              <CalendarCheck className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-36 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <p className="font-display text-3xl text-foreground">{fmt(previsaoFutura)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reservas futuras confirmadas
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calendário */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-display text-lg text-foreground mb-1">Calendário de Ocupação</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Dias marcados em dourado indicam período de reserva. Clique para ver detalhes.
          </p>

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
                    modifiersClassNames={{
                      occupied: "rdp-day-occupied",
                    }}
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
                  className="bg-card border border-primary/30 shadow-luxury w-72 p-4"
                  align="center"
                >
                  <div className="space-y-3">
                    <p className="font-display text-sm text-primary tracking-wide">
                      {selectedDay.toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    {selectedReservas.map((r) => (
                      <div key={r.id} className="border-t border-border pt-3 space-y-1.5">
                        <p className="text-foreground font-medium text-sm">
                          {r.imovel?.nome_imovel}
                        </p>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            Check-in: {new Date(r.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            Check-out: {new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        {r.valor_liquido_proprietario && (
                          <p className="text-primary font-semibold text-sm mt-1">
                            {fmt(r.valor_liquido_proprietario)}
                          </p>
                        )}
                        {r.observacoes && (
                          <p className="text-xs text-muted-foreground italic">{r.observacoes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default ProprietarioDashboard;
