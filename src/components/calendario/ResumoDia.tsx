import { LogIn, LogOut, Users, Sparkles } from "lucide-react";

interface Props {
  checkins: number;
  checkouts: number;
  hospedes: number;
  limpezasPendentes: number;
}

const Card = ({
  label,
  value,
  Icon,
  tone,
}: {
  label: string;
  value: number;
  Icon: typeof LogIn;
  tone: string;
}) => (
  <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${tone}`}>
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-xl text-foreground leading-tight">{value}</p>
    </div>
  </div>
);

export default function ResumoDia({ checkins, checkouts, hospedes, limpezasPendentes }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card label="Check-ins" value={checkins} Icon={LogIn} tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
      <Card label="Check-outs" value={checkouts} Icon={LogOut} tone="bg-rose-500/15 text-rose-600 dark:text-rose-400" />
      <Card label="Hóspedes" value={hospedes} Icon={Users} tone="bg-primary/15 text-primary" />
      <Card label="Limpezas pendentes" value={limpezasPendentes} Icon={Sparkles} tone="bg-amber-500/15 text-amber-600 dark:text-amber-400" />
    </div>
  );
}
