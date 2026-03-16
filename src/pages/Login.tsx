import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { role } = useAuth();

  // Redirecionar quando o role estiver disponível
  React.useEffect(() => {
    if (role === "master") navigate("/master", { replace: true });
    else if (role === "admin") navigate("/admin", { replace: true });
    else if (role === "proprietario") navigate("/dashboard", { replace: true });
  }, [role, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("E-mail ou senha inválidos. Tente novamente.");
      setSubmitting(false);
    }
    // Se OK, submitting fica true enquanto o role chega e o useEffect redireciona
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Gradiente decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-page-enter">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img
            src={logo}
            alt="Couple Wilhelm"
            className="h-16 w-auto object-contain mb-4"
          />
          <p className="text-muted-foreground text-sm tracking-wider">
            Gestão de Aluguéis
          </p>
        </div>

        {/* Card de login */}
        <div className="bg-card border border-border rounded-lg p-8 shadow-luxury">
          <h2 className="font-display text-xl text-foreground mb-6 text-center">
            Bem-vindo
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-muted-foreground tracking-wide">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className="bg-background border-border focus:border-primary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-muted-foreground tracking-wide">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="bg-background border-border focus:border-primary/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive text-center bg-destructive/10 rounded-md py-2 px-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 tracking-wider font-medium mt-2"
              disabled={submitting}
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/50 border-t-primary-foreground rounded-full animate-spin" />
                  Entrando...
                </div>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 tracking-wider">
          COUPLE WILHELM © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Login;
