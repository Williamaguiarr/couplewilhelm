import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Building2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/layout/PageTransition";

interface Imovel {
  id: string;
  nome_imovel: string;
  endereco: string | null;
  proprietario_id: string | null;
  proprietario?: { nome: string | null; email: string | null };
}

interface Proprietario {
  id: string;
  nome: string | null;
  email: string | null;
}

const Imoveis: React.FC = () => {
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
  });
  const { toast } = useToast();

  const fetchData = async () => {
    const [{ data: imoveisData }, { data: rolesData }] = await Promise.all([
      supabase.from("imoveis").select("*, profiles!imoveis_proprietario_id_fkey(nome, email)"),
      supabase.from("user_roles").select("user_id").eq("role", "proprietario"),
    ]);

    setImoveis(
      (imoveisData || []).map((i: any) => ({
        ...i,
        proprietario: i.profiles,
      }))
    );

    if (rolesData && rolesData.length > 0) {
      const ids = rolesData.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", ids);
      setProprietarios(profiles || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openEdit = (imovel: Imovel) => {
    setEditId(imovel.id);
    setForm({
      nome_imovel: imovel.nome_imovel,
      endereco: imovel.endereco || "",
      proprietario_id: imovel.proprietario_id || "",
    });
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      nome_imovel: form.nome_imovel,
      endereco: form.endereco || null,
      proprietario_id: form.proprietario_id || null,
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

    setForm({ nome_imovel: "", endereco: "", proprietario_id: "" });
    setSubmitting(false);
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-foreground tracking-wide">Imóveis</h1>
            <p className="text-muted-foreground mt-1">Gerencie os imóveis da carteira</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ nome_imovel: "", endereco: "", proprietario_id: "" }); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Novo Imóvel
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-foreground">
                  {editId ? "Editar Imóvel" : "Cadastrar Imóvel"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Nome do imóvel</Label>
                  <Input value={form.nome_imovel} onChange={(e) => setForm({ ...form, nome_imovel: e.target.value })} placeholder="Ex: Apartamento Ipanema 101" required className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Endereço</Label>
                  <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, bairro" className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Proprietário</Label>
                  <Select value={form.proprietario_id} onValueChange={(v) => setForm({ ...form, proprietario_id: v })}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecione o proprietário" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {proprietarios.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-foreground">
                          {p.nome || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancelar</Button>
                  <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Salvando..." : "Salvar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : imoveis.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">Nenhum imóvel cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">Imóvel</TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">Endereço</TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">Proprietário</TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imoveis.map((imovel) => (
                  <TableRow key={imovel.id} className="border-border hover:bg-muted/30">
                    <TableCell className="text-foreground font-medium">{imovel.nome_imovel}</TableCell>
                    <TableCell className="text-muted-foreground">{imovel.endereco || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{imovel.proprietario?.nome || imovel.proprietario?.email || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(imovel)} className="h-8 w-8 hover:text-primary">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default Imoveis;
