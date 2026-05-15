import { LogIn, LogOut, Users, Clock, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { detectarPlataforma, PLATAFORMA_LABEL, type EventoOperacional } from "./types";

interface Props {
  evento: EventoOperacional;
  onAbrirLimpeza: (e: EventoOperacional) => void;
}

const PLAT_STYLE: Record<string, string> = {
  airbnb: "bg-[#FF385C]/10 text-[#FF385C] border-[#FF385C]/20",
  booking: "bg-[#003580]/15 text-[#4A90D9] border-[#4A90D9]/20",
  direto: "bg-primary/10 text-primary border-primary/20",
  manual: "bg-muted text-muted-foreground border-border",
};

export default function EventoCard({ evento, onAbrirLimpeza }: Props) {
  const isCheckin = evento.tipo === "checkin";
  const plataforma = detectarPlataforma(evento.reserva);
  const numHospedes = evento.reserva.num_hospedes ?? 0;
  const muitosHospedes = numHospedes >= 5;
  const limpezaConcluida = evento.limpeza?.status === "concluida";

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card p-3 sm:p-4 transition-all",
        "hover:shadow-elevated hover:border-border/80",
        isCheckin
          ? "border-l-4 border-l-emerald-500"
          : "border-l-4 border-l-rose-500"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
                isCheckin
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              )}
            >
              {isCheckin ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
              {isCheckin ? "Check-in" : "Check-out"}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
              <Clock className="h-3 w-3" /> {evento.hora}
            </span>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", PLAT_STYLE[plataforma])}>
              {PLATAFORMA_LABEL[plataforma]}
            </Badge>
          </div>

          <p className="text-sm font-semibold text-foreground truncate">
            {evento.imovel.nome_imovel}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {evento.reserva.nome_hospede || "Hóspede não informado"}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full",
                muitosHospedes
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Users className="h-3 w-3" />
              {numHospedes} {numHospedes === 1 ? "hóspede" : "hóspedes"}
              {muitosHospedes && <AlertTriangle className="h-3 w-3 ml-0.5" />}
            </span>

            {!isCheckin && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium",
                  limpezaConcluida
                    ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                )}
              >
                <Sparkles className="h-3 w-3" />
                {limpezaConcluida ? "Limpeza concluída" : "Limpeza pendente"}
              </span>
            )}

            {evento.limpeza?.responsavel && !isCheckin && (
              <span className="text-[11px] text-muted-foreground italic">
                · {evento.limpeza.responsavel}
              </span>
            )}
          </div>

          {evento.limpeza?.observacoes && !isCheckin && (
            <p className="mt-2 text-[11px] text-muted-foreground bg-muted/40 rounded-md px-2 py-1.5">
              {evento.limpeza.observacoes}
            </p>
          )}
        </div>

        {!isCheckin && (
          <Button
            size="sm"
            variant={limpezaConcluida ? "outline" : "default"}
            onClick={() => onAbrirLimpeza(evento)}
            className="flex-shrink-0 h-8 text-xs"
          >
            {limpezaConcluida ? "Editar" : "Limpeza"}
          </Button>
        )}
      </div>
    </div>
  );
}
