import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  ShieldCheck,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Users,
  Percent,
  CalendarCheck,
  CalendarX,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/layout/PageTransition";

interface AdminConfig {
  id: string;
  admin_id: string;
  slug: string;
  nome_empresa: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  logo_url: string | null;
  ativo: boolean;
  comissao_cw: number;
  ultimo_pagamento: string | null;
  created_at: string;
  profile?: { nome: string | null; email: string | null };
}

const AdminsList: React.FC = () => {
  const [admins, setAdmins] = useState<AdminConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    nome: "",
    email: "",
    password: "",
    slug: "",
    nome_empresa: "",
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminConfig | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "",
    email: "",
    password: "",
    slug: "",
    nome_empresa: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<AdminConfig | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<AdminConfig | null>(null);
  const { toast } = useToast();

  const fetchAdmins = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      setAdmins([]);
      setLoading(false);
      return;
    }

    const ids = roles.map((r) => r.user_id);

    const [{ data: configs }, { data: profiles }] = await Promise.all([
      supabase
        .from("admin_configs" as any)
        .select("*")
        .in("admin_id", ids)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, nome, email").in("id", ids),
    ]);

    const profileMap = Object.fromEntries(
      (profiles || []).map((p) => [p.id, p])
    );

    const merged = (configs || []).map((c: any) => ({
      ...c,
      profile: profileMap[c.admin_id] || null,
    }));

    // Admins sem config ainda (recém criados via setup bootstrap)
    const configAdminIds = new Set((configs || []).map((c: any) => c.admin_id));
    const adminsWithoutConfig = ids
      .filter((id) => !configAdminIds.has(id))
      .map((id) => ({
        id: id,
        admin_id: id,
        slug: "",
        nome_empresa: null,
        cor_primaria: "#0A192F",
        cor_secundaria: "#A38B5E",
        logo_url: null,
        ativo: true,
        comissao_cw: 0.25,
        ultimo_pagamento: null,
        created_at: new Date().toISOString(),
        profile: profileMap[id] || null,
      }));

    setAdmins([...merged, ...adminsWithoutConfig]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);

    const token = await getToken();
    const res = await supabase.functions.invoke("create-user", {
      body: {
        email: createForm.email,
        password: createForm.password,
        nome: createForm.nome,
        role: "admin",
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.error || res.data?.error) {
      toast({
        title: "Erro ao criar admin",
        description: res.data?.error || res.error?.message,
        variant: "destructive",
      });
      setCreateSubmitting(false);
      return;
    }

    const newUserId = res.data?.user_id;
    const slug = createForm.slug || slugify(createForm.nome_empresa || createForm.nome);

    await supabase.from("admin_configs" as any).insert({
      admin_id: newUserId,
      slug,
      nome_empresa: createForm.nome_empresa || createForm.nome,
      cor_primaria: "#0A192F",
      cor_secundaria: "#A38B5E",
      ativo: true,
    });

    toast({ title: "Admin criado!", description: `${createForm.nome} foi adicionado.` });
    setCreateOpen(false);
    setCreateForm({ nome: "", email: "", password: "", slug: "", nome_empresa: "" });
    fetchAdmins();
    setCreateSubmitting(false);
  };

  const openEdit = (admin: AdminConfig) => {
    setEditTarget(admin);
    setEditForm({
      nome: admin.profile?.nome || "",
      email: admin.profile?.email || "",
      password: "",
      slug: admin.slug || "",
      nome_empresa: admin.nome_empresa || "",
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    const token = await getToken();

    // Atualiza credenciais via edge function
    const body: Record<string, string> = {
      action: "update",
      userId: editTarget.admin_id,
      nome: editForm.nome,
    };
    if (editForm.email !== editTarget.profile?.email) body.email = editForm.email;
    if (editForm.password) body.password = editForm.password;

    const res = await supabase.functions.invoke("manage-user", {
      body,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.error || res.data?.error) {
      toast({
        title: "Erro ao editar admin",
        description: res.data?.error || res.error?.message,
        variant: "destructive",
      });
      return;
    }

    // Atualiza ou cria config
    const configPayload = {
      slug: editForm.slug || slugify(editForm.nome_empresa || editForm.nome),
      nome_empresa: editForm.nome_empresa || editForm.nome,
    };

    if (editTarget.slug) {
      await supabase
        .from("admin_configs" as any)
        .update(configPayload)
        .eq("admin_id", editTarget.admin_id);
    } else {
      await supabase.from("admin_configs" as any).insert({
        admin_id: editTarget.admin_id,
        ...configPayload,
        cor_primaria: "#0A192F",
        cor_secundaria: "#A38B5E",
        ativo: true,
      });
    }

    toast({ title: "Admin atualizado!" });
    setEditOpen(false);
    fetchAdmins();
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    const novoStatus = !toggleTarget.ativo;
    await supabase
      .from("admin_configs" as any)
      .update({ ativo: novoStatus })
      .eq("admin_id", toggleTarget.admin_id);

    toast({
      title: novoStatus ? "Admin reativado" : "Admin desativado",
      description: `${toggleTarget.profile?.nome || toggleTarget.slug} foi ${novoStatus ? "reativado" : "pausado"}.`,
    });
    setToggleTarget(null);
    fetchAdmins();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);

    const token = await getToken();
    const res = await supabase.functions.invoke("manage-user", {
      body: { action: "delete", userId: deleteTarget.admin_id },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.error || res.data?.error) {
      toast({
        title: "Erro ao excluir admin",
        description: res.data?.error || res.error?.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Admin excluído." });
      setDeleteTarget(null);
      fetchAdmins();
    }

    setDeleteSubmitting(false);
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-foreground tracking-wide">
              Administradores
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os admins da plataforma
            </p>
          </div>

          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Admin
          </Button>
        </div>

        {/* TABLE */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : admins.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">Nenhum administrador cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">
                    Admin
                  </TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">
                    Empresa / Slug
                  </TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">
                    Cores
                  </TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground tracking-wider text-xs uppercase">
                    Cadastrado
                  </TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.admin_id} className="border-border hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="text-foreground font-medium text-sm">
                          {admin.profile?.nome || "—"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {admin.profile?.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-foreground text-sm">
                          {admin.nome_empresa || "—"}
                        </p>
                        {admin.slug && (
                          <p className="text-muted-foreground text-xs font-mono">
                            /{admin.slug}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-5 w-5 rounded-full border border-border flex-shrink-0 shadow-sm"
                          style={{ background: admin.cor_primaria }}
                          title={`Primária: ${admin.cor_primaria}`}
                        />
                        <span
                          className="h-5 w-5 rounded-full border border-border flex-shrink-0 shadow-sm"
                          style={{ background: admin.cor_secundaria }}
                          title={`Secundária: ${admin.cor_secundaria}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={admin.ativo ? "default" : "secondary"}
                        className={
                          admin.ativo
                            ? "bg-green-500/15 text-green-700 border-green-500/30 hover:bg-green-500/15"
                            : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/10"
                        }
                      >
                        {admin.ativo ? "Ativo" : "Pausado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(admin.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(admin)}
                          className="h-8 w-8 hover:text-primary"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setToggleTarget(admin)}
                          className={`h-8 w-8 ${admin.ativo ? "hover:text-amber-600" : "hover:text-green-600"}`}
                          title={admin.ativo ? "Pausar" : "Reativar"}
                        >
                          {admin.ativo ? (
                            <PowerOff className="h-3.5 w-3.5" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(admin)}
                          className="h-8 w-8 hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-foreground">
              Novo Administrador
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                  Nome completo
                </Label>
                <Input
                  value={createForm.nome}
                  onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                  placeholder="João da Silva"
                  required
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="admin@empresa.com"
                  required
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                  Senha temporária
                </Label>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                  Nome da empresa
                </Label>
                <Input
                  value={createForm.nome_empresa}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      nome_empresa: e.target.value,
                      slug: slugify(e.target.value),
                    })
                  }
                  placeholder="Minha Imobiliária"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                  Slug (URL)
                </Label>
                <Input
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: slugify(e.target.value) })}
                  placeholder="minha-imobiliaria"
                  className="bg-background font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createSubmitting} className="flex-1">
                {createSubmitting ? "Criando..." : "Criar admin"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditTarget(null);
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-foreground">
              Editar Administrador
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                  Nome completo
                </Label>
                <Input
                  value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                  required
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                  Nova senha{" "}
                  <span className="text-xs opacity-60">(deixe em branco para não alterar)</span>
                </Label>
                <Input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Nova senha"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                  Nome da empresa
                </Label>
                <Input
                  value={editForm.nome_empresa}
                  onChange={(e) => setEditForm({ ...editForm, nome_empresa: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                  Slug (URL)
                </Label>
                <Input
                  value={editForm.slug}
                  onChange={(e) =>
                    setEditForm({ ...editForm, slug: slugify(e.target.value) })
                  }
                  className="bg-background font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* TOGGLE CONFIRMATION */}
      <AlertDialog
        open={!!toggleTarget}
        onOpenChange={(v) => { if (!v) setToggleTarget(null); }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-foreground">
              {toggleTarget?.ativo ? "Pausar acesso?" : "Reativar acesso?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {toggleTarget?.ativo
                ? `${toggleTarget.profile?.nome || toggleTarget.slug} não conseguirá mais acessar o sistema até ser reativado.`
                : `${toggleTarget?.profile?.nome || toggleTarget?.slug} poderá acessar o sistema normalmente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggle}
              className={
                toggleTarget?.ativo
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : "bg-green-600 text-white hover:bg-green-700"
              }
            >
              {toggleTarget?.ativo ? "Pausar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DELETE CONFIRMATION */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-foreground">
              Excluir administrador?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Você está prestes a excluir{" "}
              <strong className="text-foreground">
                {deleteTarget?.profile?.nome || deleteTarget?.slug}
              </strong>
              . Todos os imóveis vinculados ficarão sem admin. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border text-foreground">
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

// Helper inline para slugify no JSX
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default AdminsList;
