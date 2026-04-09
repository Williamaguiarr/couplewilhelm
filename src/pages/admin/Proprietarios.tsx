import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Copy, RefreshCw } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Users, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/layout/PageTransition";

interface Proprietario {
  id: string;
  nome: string | null;
  email: string | null;
  created_at: string;
  comissao_percentual: number;
}

// Gera senha aleatória segura de 12 caracteres
const generatePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const Proprietarios: React.FC = () => {
  const { user } = useAuth();
  const [proprietarios, setProprietarios] = useState<Proprietario[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({ nome: "", email: "", password: generatePassword(), comissao: "25" });

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editTarget, setEditTarget] = useState<Proprietario | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "", password: "", comissao: "25" });

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Proprietario | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const { toast } = useToast();

  const fetchProprietarios = async () => {
    if (!user) return;

    // Busca proprietários vinculados a este admin via tabela de vínculo
    const { data: vinculos } = await supabase
      .from("admin_proprietarios" as any)
      .select("proprietario_id")
      .eq("admin_id", user.id);

    if (!vinculos || vinculos.length === 0) {
      setProprietarios([]);
      setLoading(false);
      return;
    }

    const ids = (vinculos as any[]).map((v) => v.proprietario_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", ids);

    setProprietarios(profiles || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProprietarios();
  }, [user]);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  // ── CREATE ──────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);

    const token = await getToken();
    const res = await supabase.functions.invoke("create-user", {
      body: {
        email: createForm.email,
        password: createForm.password,
        nome: createForm.nome,
        role: "proprietario",
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.error || res.data?.error) {
      toast({
        title: "Erro ao criar proprietário",
        description: res.data?.error || res.error?.message,
        variant: "destructive",
      });
    } else {
      // Atualizar comissão no perfil do proprietário criado
      const newUserId = res.data?.userId;
      if (newUserId) {
        const comissaoVal = parseFloat(createForm.comissao) || 25;
        await supabase
          .from("profiles")
          .update({ comissao_percentual: Math.min(100, Math.max(0, comissaoVal)) } as any)
          .eq("id", newUserId);
      }
      toast({ title: "Proprietário criado!", description: `${createForm.nome} foi adicionado.` });
      setCreateOpen(false);
      setCreateForm({ nome: "", email: "", password: generatePassword(), comissao: "25" });
      fetchProprietarios();
    }

    setCreateSubmitting(false);
  };

  // ── EDIT ──────────────────────────────────────────────
  const openEdit = (p: Proprietario) => {
    setEditTarget(p);
    setEditForm({ nome: p.nome || "", email: p.email || "", password: "", comissao: String(p.comissao_percentual ?? 25) });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSubmitting(true);

    const token = await getToken();
    const body: Record<string, string> = {
      action: "update",
      userId: editTarget.id,
      nome: editForm.nome,
    };
    // Only send email/password if they actually changed
    if (editForm.email !== editTarget.email) body.email = editForm.email;
    if (editForm.password) body.password = editForm.password;

    const res = await supabase.functions.invoke("manage-user", {
      body,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.error || res.data?.error) {
      toast({
        title: "Erro ao editar proprietário",
        description: res.data?.error || res.error?.message,
        variant: "destructive",
      });
    } else {
      // Atualizar comissão no perfil
      const comissaoVal = parseFloat(editForm.comissao) || 25;
      await supabase
        .from("profiles")
        .update({ comissao_percentual: Math.min(100, Math.max(0, comissaoVal)) } as any)
        .eq("id", editTarget.id);
      toast({ title: "Proprietário atualizado!" });
      setEditOpen(false);
      setEditTarget(null);
      fetchProprietarios();
    }

    setEditSubmitting(false);
  };

  // ── DELETE ──────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);

    const token = await getToken();
    const res = await supabase.functions.invoke("manage-user", {
      body: { action: "delete", userId: deleteTarget.id },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.error || res.data?.error) {
      toast({
        title: "Erro ao excluir proprietário",
        description: res.data?.error || res.error?.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Proprietário excluído.", description: `${deleteTarget.nome} foi removido.` });
      setDeleteTarget(null);
      fetchProprietarios();
    }

    setDeleteSubmitting(false);
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-foreground">Proprietários</h1>
            <p className="text-muted-foreground mt-1 text-sm">Gerencie os proprietários cadastrados no sistema</p>
          </div>

          {/* CREATE DIALOG */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Proprietário
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-foreground">
                  Cadastrar Proprietário
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Nome completo</Label>
                  <Input
                    value={createForm.nome}
                    onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                    placeholder="João da Silva"
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">E-mail</Label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="joao@email.com"
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Senha de acesso gerada</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={createForm.password}
                      readOnly
                      className="bg-muted font-mono text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setCreateForm({ ...createForm, password: generatePassword() })}
                      title="Gerar nova senha"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => { navigator.clipboard.writeText(createForm.password); toast({ title: "Senha copiada!" }); }}
                      title="Copiar senha"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Copie e compartilhe com o proprietário. Ele poderá redefinir pelo link "Esqueceu a senha".
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Comissão ADM (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={createForm.comissao}
                    onChange={(e) => setCreateForm({ ...createForm, comissao: e.target.value })}
                    placeholder="25"
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentual de comissão aplicado sobre o valor base líquido (0 a 100).
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createSubmitting} className="flex-1">
                    {createSubmitting ? "Criando..." : "Criar conta"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* TABLE */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : proprietarios.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <Users className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">Nenhum proprietário cadastrado</p>
              <p className="text-sm text-muted-foreground opacity-60">
                Clique em "Novo Proprietário" para começar
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proprietarios.map((p) => (
                  <TableRow key={p.id} className="border-border hover:bg-muted/30">
                    <TableCell className="text-foreground font-medium">{p.nome || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="text-muted-foreground">{p.comissao_percentual ?? 25}%</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(p)}
                          className="h-8 w-8 hover:text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(p)}
                          className="h-8 w-8 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
        </div>
      </div>

      {/* EDIT DIALOG */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-foreground">
              Editar Proprietário
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Nome completo</Label>
              <Input
                value={editForm.nome}
                onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                placeholder="João da Silva"
                required
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">E-mail</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="joao@email.com"
                required
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                Nova senha <span className="text-xs opacity-60">(deixe em branco para não alterar)</span>
              </Label>
              <Input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Nova senha (mínimo 6 caracteres)"
                minLength={editForm.password ? 6 : undefined}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Comissão ADM (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={editForm.comissao}
                onChange={(e) => setEditForm({ ...editForm, comissao: e.target.value })}
                placeholder="25"
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Percentual de comissão aplicado sobre o valor base líquido (0 a 100).
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={editSubmitting} className="flex-1">
                {editSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-foreground">
              Excluir proprietário?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Você está prestes a excluir <strong className="text-foreground">{deleteTarget?.nome}</strong>. Todos os imóveis vinculados perderão o proprietário. Esta ação não pode ser desfeita.
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

export default Proprietarios;
