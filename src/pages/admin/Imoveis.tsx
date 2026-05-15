import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchLinkedProprietarioIds } from "@/lib/supabase-helpers";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Building2, Pencil, Trash2, RefreshCw, Link, Copy, Check, ExternalLink, Clock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/layout/PageTransition";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface Imovel {
  id: string;
  nome_imovel: string;
  endereco: string | null;
  proprietario_id: string | null;
  proprietario_id_2: string | null;
  ical_url_airbnb: string | null;
  ical_url_booking: string | null;
  ical_last_sync: string | null;
  taxa_comissao: number | null;
  proprietario?: { nome: string | null; email: string | null };
  proprietario2?: { nome: string | null; email: string | null };
}

interface Proprietario {
  id: string;
  nome: string | null;
  email: string | null;
}

const NONE = "__none__";

const Imoveis: React.FC = () => {
  const { user } = useAuth();
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [proprietarios, setProprietarios] = useState<Proprietario[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome_imovel: "",
    endereco: "",
    proprietario_id: "",
    proprietario_id_2: "",
    ical_url_airbnb: "",
    ical_url_booking: "",
    taxa_comissao: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<Imovel | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [calendarLinkOpen, setCalendarLinkOpen] = useState<Imovel | null>(null);
  const [copied, setCopied] = useState<"airbnb" | "booking" | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    if (!user) return;

    // Imóveis do admin logado (RLS já filtra por admin_id)
    const { data: imoveisData } = await supabase.from("imoveis").select(
      "*, proprietario:profiles!imoveis_proprietario_id_fkey(nome, email), proprietario2:profiles!imoveis_proprietario_id_2_fkey(nome, email)"
    );

    setImoveis(
      (imoveisData || []).map((i: any) => ({
        ...i,
        proprietario: i.proprietario,
        proprietario2: i.proprietario2,
      }))
    );

    // Proprietários: apenas os vinculados a este admin via tabela de vínculo
    const propIds = await fetchLinkedProprietarioIds(user.id);

    if (propIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", propIds);
      setProprietarios(profiles || []);
    } else {
      setProprietarios([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const resetForm = () =>
    setForm({
      nome_imovel: "",
      endereco: "",
      proprietario_id: "",
      proprietario_id_2: "",
      ical_url_airbnb: "",
      ical_url_booking: "",
      taxa_comissao: "",
    });

  const openEdit = (imovel: Imovel) => {
    setEditId(imovel.id);
    setForm({
      nome_imovel: imovel.nome_imovel,
      endereco: imovel.endereco || "",
      proprietario_id: imovel.proprietario_id || "",
      proprietario_id_2: imovel.proprietario_id_2 || "",
      ical_url_airbnb: imovel.ical_url_airbnb || "",
      ical_url_booking: imovel.ical_url_booking || "",
      taxa_comissao: imovel.taxa_comissao?.toString() || "",
    });
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      form.proprietario_id &&
      form.proprietario_id_2 &&
      form.proprietario_id === form.proprietario_id_2
    ) {
      toast({
        title: "Proprietários iguais",
        description: "O 2º proprietário deve ser diferente do 1º.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      nome_imovel: form.nome_imovel,
      endereco: form.endereco || null,
      proprietario_id: form.proprietario_id || null,
      proprietario_id_2: form.proprietario_id_2 || null,
      ical_url_airbnb: form.ical_url_airbnb || null,
      ical_url_booking: form.ical_url_booking || null,
      taxa_comissao: form.taxa_comissao ? parseFloat(form.taxa_comissao.replace(",", ".")) : null,
    };

    if (editId) {
      const { error } = await supabase.from("imoveis").update(payload).eq("id", editId);
      if (error) {
        toast({ title: "Erro ao atualizar imóvel", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Imóvel atualizado!" });
        setOpen(false);
        setEditId(null);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("imoveis").insert(payload);
      if (error) {
        toast({ title: "Erro ao criar imóvel", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Imóvel cadastrado!" });
        setOpen(false);
        fetchData();
      }
    }

    resetForm();
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);

    const { error } = await supabase.from("imoveis").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Erro ao excluir imóvel", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Imóvel excluído.", description: `${deleteTarget.nome_imovel} foi removido.` });
      setDeleteTarget(null);
      fetchData();
    }

    setDeleteSubmitting(false);
  };

  const handleSync = async (imovel: Imovel) => {
    if (!imovel.ical_url_airbnb && !imovel.ical_url_booking) {
      toast({ title: "Nenhuma URL iCal configurada", variant: "destructive" });
      return;
    }

    setSyncingId(imovel.id);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/ical-sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ imovel_id: imovel.id }),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Erro ao sincronizar");
      }

      const totalSynced = result.results?.reduce(
        (acc: number, r: any) => acc + (r.synced ?? 0),
        0
      ) ?? 0;

      toast({
        title: "Sincronização concluída",
        description: totalSynced > 0
          ? `${totalSynced} nova(s) reserva(s) importada(s).`
          : "Nenhuma reserva nova encontrada.",
      });

      fetchData();
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
    } finally {
      setSyncingId(null);
    }
  };

  const propLabel = (p?: { nome: string | null; email: string | null } | null) =>
    p?.nome || p?.email || null;

  const getIcalUrl = (imovel: Imovel, source: "airbnb" | "booking") => {
    return source === "airbnb" ? imovel.ical_url_airbnb : imovel.ical_url_booking;
  };

  const handleCopy = async (imovel: Imovel, source: "airbnb" | "booking") => {
    const url = getIcalUrl(imovel, source);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(source);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: "Erro ao copiar URL", variant: "destructive" });
    }
  };

  const opcoesProprietario2 = proprietarios.filter((p) => p.id !== form.proprietario_id);
  const opcoesProprietario1 = proprietarios.filter((p) => p.id !== form.proprietario_id_2);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-foreground">Imóveis</h1>
            <p className="text-muted-foreground mt-1 text-sm">Gerencie os imóveis da carteira</p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                setEditId(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Novo Imóvel
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-foreground">
                  {editId ? "Editar Imóvel" : "Cadastrar Imóvel"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Nome do imóvel</Label>
                  <Input
                    value={form.nome_imovel}
                    onChange={(e) => setForm({ ...form, nome_imovel: e.target.value })}
                    placeholder="Ex: Apartamento Ipanema 101"
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Taxa de Comissão (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={form.taxa_comissao}
                    onChange={(e) => setForm({ ...form, taxa_comissao: e.target.value })}
                    placeholder="Ex: 25 (deixe vazio para usar a taxa do proprietário)"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Endereço</Label>
                  <Input
                    value={form.endereco}
                    onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                    placeholder="Rua, número, bairro"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">1º Proprietário</Label>
                  <Select
                    value={form.proprietario_id || NONE}
                    onValueChange={(v) =>
                      setForm({ ...form, proprietario_id: v === NONE ? "" : v })
                    }
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecione o proprietário" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value={NONE} className="text-muted-foreground">
                        Nenhum
                      </SelectItem>
                      {opcoesProprietario1.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-foreground">
                          {p.nome || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    2º Proprietário{" "}
                    <span className="text-xs text-muted-foreground/60">(opcional)</span>
                  </Label>
                  <Select
                    value={form.proprietario_id_2 || NONE}
                    onValueChange={(v) =>
                      setForm({ ...form, proprietario_id_2: v === NONE ? "" : v })
                    }
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecione o 2º proprietário" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value={NONE} className="text-muted-foreground">
                        Nenhum
                      </SelectItem>
                      {opcoesProprietario2.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-foreground">
                          {p.nome || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* iCal Section */}
                <div className="border border-border rounded-md p-3 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Link className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Sincronização iCal
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">URL iCal — Airbnb</Label>
                    <Input
                      value={form.ical_url_airbnb}
                      onChange={(e) => setForm({ ...form, ical_url_airbnb: e.target.value })}
                      placeholder="https://www.airbnb.com/calendar/ical/..."
                      className="bg-background text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">URL iCal — Booking.com</Label>
                    <Input
                      value={form.ical_url_booking}
                      onChange={(e) => setForm({ ...form, ical_url_booking: e.target.value })}
                      placeholder="https://admin.booking.com/hotel/hoteladmin/ical.html?..."
                      className="bg-background text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : imoveis.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">Nenhum imóvel cadastrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Proprietário(s)</TableHead>
                  <TableHead>iCal</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imoveis.map((imovel) => {
                  const p1 = propLabel(imovel.proprietario);
                  const p2 = propLabel(imovel.proprietario2);
                  const hasIcal = !!(imovel.ical_url_airbnb || imovel.ical_url_booking);
                  return (
                    <TableRow key={imovel.id} className="border-border hover:bg-muted/30">
                      <TableCell className="text-foreground font-medium">{imovel.nome_imovel}</TableCell>
                      <TableCell className="text-muted-foreground">{imovel.endereco || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p1 && p2 ? (
                          <span>
                            {p1}{" "}
                            <span className="text-xs text-muted-foreground/60">e</span>{" "}
                            {p2}
                          </span>
                        ) : (
                          p1 || p2 || "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {hasIcal ? (
                          <div className="flex flex-col gap-1">
                            {imovel.ical_url_airbnb && (
                              <Badge variant="secondary" className="text-xs w-fit">Airbnb</Badge>
                            )}
                            {imovel.ical_url_booking && (
                              <Badge variant="secondary" className="text-xs w-fit">Booking</Badge>
                            )}
                            {imovel.ical_last_sync && (
                              <span className="text-xs text-muted-foreground/60">
                                Sync:{" "}
                                {format(new Date(imovel.ical_last_sync), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {hasIcal && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setCalendarLinkOpen(imovel)}
                              className="h-8 w-8 hover:text-primary"
                              title="Ver / copiar URLs iCal"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {hasIcal && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSync(imovel)}
                              disabled={syncingId === imovel.id}
                              className="h-8 w-8 hover:text-primary"
                              title="Sincronizar iCal agora"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${syncingId === imovel.id ? "animate-spin" : ""}`} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(imovel)}
                            className="h-8 w-8 hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(imovel)}
                            className="h-8 w-8 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </div>

      {/* iCal Export Dialog */}
      <Dialog open={!!calendarLinkOpen} onOpenChange={(v) => { if (!v) { setCalendarLinkOpen(null); setCopied(null); } }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-foreground flex items-center gap-2">
              <Link className="h-4 w-4 text-primary" />
              URLs iCal — {calendarLinkOpen?.nome_imovel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Copie as URLs abaixo e cole nas respectivas plataformas para sincronizar o calendário deste imóvel.
            </p>

            {calendarLinkOpen?.ical_url_airbnb ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Airbnb</span>
                  <Badge variant="secondary" className="text-xs">iCal URL</Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={calendarLinkOpen.ical_url_airbnb}
                    className="bg-muted/30 text-xs font-mono text-muted-foreground border-border"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopy(calendarLinkOpen, "airbnb")}
                    className="shrink-0 border-border"
                    title="Copiar URL Airbnb"
                  >
                    {copied === "airbnb" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground/70">
                  No Airbnb: <span className="font-medium text-muted-foreground">Anúncio → Calendário → Exportar calendário</span>
                </p>
              </div>
            ) : null}

            {calendarLinkOpen?.ical_url_booking ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking.com</span>
                  <Badge variant="secondary" className="text-xs">iCal URL</Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={calendarLinkOpen.ical_url_booking}
                    className="bg-muted/30 text-xs font-mono text-muted-foreground border-border"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopy(calendarLinkOpen, "booking")}
                    className="shrink-0 border-border"
                    title="Copiar URL Booking"
                  >
                    {copied === "booking" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground/70">
                  No Booking.com: <span className="font-medium text-muted-foreground">Extranet → Calendário → Sincronizar calendário → Exportar</span>
                </p>
              </div>
            ) : null}

            {calendarLinkOpen?.ical_last_sync && (
              <p className="text-xs text-muted-foreground/60 pt-1 border-t border-border">
                Última sincronização:{" "}
                {format(new Date(calendarLinkOpen.ical_last_sync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-foreground">
              Excluir imóvel?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Você está prestes a excluir{" "}
              <strong className="text-foreground">{deleteTarget?.nome_imovel}</strong>. As
              reservas vinculadas também serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border text-foreground hover:bg-muted/30">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubmitting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
};

export default Imoveis;
