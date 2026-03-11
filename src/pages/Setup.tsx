import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";

const Setup: React.FC = () => {
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { count } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      setAdminExists((count || 0) > 0);
      setChecking(false);
    };
    checkAdmin();
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await supabase.functions.invoke("create-user", {
      body: {
        email: form.email,
        password: form.password,
        nome: form.nome,
        role: "admin",
        bootstrap_secret: "couple-bootstrap-2024",
      },
    });

    if (res.error || res.data?.error) {
      setError(res.data?.error || res.error?.message || "Erro ao criar administrador");
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    }

    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (adminExists) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-foreground font-display text-xl">Sistema já configurado</p>
          <Button onClick={() => navigate("/login")}>Ir para o Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-page-enter">
        <div className="flex flex-col items-center mb-10">
          <img src={logo} alt="Couple Wilhelm" className="h-16 w-auto object-contain mb-4" />
          <h1 className="font-display text-2xl tracking-[0.3em] text-primary uppercase">Couple Wilhelm</h1>
          <p className="text-muted-foreground text-sm mt-1 tracking-wider">Configuração Inicial</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 shadow-luxury">
          <h2 className="font-display text-xl text-foreground mb-2">Criar Administrador</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Configure o primeiro acesso ao sistema.
          </p>

          {success ? (
            <div className="text-center space-y-3">
              <p className="text-primary font-display text-lg">✓ Administrador criado!</p>
              <p className="text-muted-foreground text-sm">Redirecionando para o login...</p>
            </div>
          ) : (
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Administrador" required className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@couplewilhelm.com" required className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Senha</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" minLength={6} required className="bg-background" />
              </div>
              {error && <p className="text-destructive text-sm bg-destructive/10 rounded p-2">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Criando..." : "Criar Administrador"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Setup;
