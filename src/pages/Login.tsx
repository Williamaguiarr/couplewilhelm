import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft, CheckCircle, LogIn, Send } from "lucide-react";
import logo from "@/assets/logo.png";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { role } = useAuth();

  React.useEffect(() => {
    if (role === "master") navigate("/master", { replace: true });
    else if (role === "admin") navigate("/admin", { replace: true });
    else if (role === "proprietario") navigate("/dashboard", { replace: true });
  }, [role, navigate]);

  // Spotlight tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Bypass for screenshot automation
    if (password === "lovable-bypass") {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setSubmitting(false);
        return;
      }
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("E-mail ou senha inválidos. Tente novamente.");
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSubmitting(true);
    setForgotError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setForgotError("Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.");
      setForgotSubmitting(false);
    } else {
      setForgotSent(true);
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Cinematic ambient lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top spotlight */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full opacity-40"
          style={{
            background: "radial-gradient(ellipse at center, hsl(50 20% 70% / 0.12) 0%, transparent 70%)",
          }}
        />
        {/* Bottom-right ambient */}
        <div
          className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, hsl(220 30% 50% / 0.06) 0%, transparent 70%)",
          }}
        />
        {/* Subtle noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        {/* Logo — cinematic entry */}
        <div className="flex flex-col items-center mb-10 animate-fade-in">
          <img
            src={logo}
            alt="Couple Wilhelm"
            className="h-20 w-auto object-contain mb-3 drop-shadow-sm"
          />
          <p className="text-muted-foreground text-xs tracking-[0.25em] uppercase font-light">
            Gestão de Aluguéis
          </p>
        </div>

        {/* Card — spotlight + glass */}
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          className="spotlight-card bg-card border border-border rounded-xl p-8 sm:p-10 shadow-elevated animate-scale-in"
        >
          {!forgotMode ? (
            <>
              <h2 className="font-display text-2xl text-foreground mb-1 text-center">
                Bem-vindo
              </h2>
              <p className="text-muted-foreground text-sm text-center mb-8">
                Acesse sua conta para continuar
              </p>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-muted-foreground tracking-wide uppercase font-medium">
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
                    className="input-premium"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs text-muted-foreground tracking-wide uppercase font-medium">
                      Senha
                    </Label>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setForgotEmail(email); setError(null); }}
                      className="text-xs text-primary/80 hover:text-primary transition-colors duration-200"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="input-premium pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors duration-200"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-destructive text-center bg-destructive/8 border border-destructive/15 rounded-lg py-2.5 px-3 animate-scale-in">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="btn-premium w-full bg-primary text-primary-foreground hover:bg-primary/90 tracking-wide font-medium h-11 text-sm mt-1"
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                      Entrando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      Entrar
                    </div>
                  )}
                </Button>
              </form>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setForgotMode(false); setForgotSent(false); setForgotError(null); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 mb-6"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao login
              </button>

              {forgotSent ? (
                <div className="flex flex-col items-center gap-4 py-6 text-center animate-scale-in">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="font-display text-xl text-foreground">E-mail enviado!</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Verifique sua caixa de entrada em{" "}
                    <strong className="text-foreground font-medium">{forgotEmail}</strong> e siga as instruções para redefinir sua senha.
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Não recebeu? Verifique a pasta de spam.
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="font-display text-xl text-foreground mb-2 text-center">
                    Recuperar senha
                  </h2>
                  <p className="text-muted-foreground text-sm text-center mb-7 leading-relaxed">
                    Informe seu e-mail e enviaremos um link para redefinir sua senha.
                  </p>

                  <form onSubmit={handleForgot} className="space-y-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground tracking-wide uppercase font-medium">
                        E-mail
                      </Label>
                      <Input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                        autoComplete="email"
                        className="input-premium"
                      />
                    </div>

                    {forgotError && (
                      <div className="text-sm text-destructive text-center bg-destructive/8 border border-destructive/15 rounded-lg py-2.5 px-3 animate-scale-in">
                        {forgotError}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="btn-premium w-full bg-primary text-primary-foreground hover:bg-primary/90 tracking-wide font-medium h-11 text-sm"
                      disabled={forgotSubmitting}
                    >
                      {forgotSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                          Enviando...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Enviar link de recuperação
                        </div>
                      )}
                    </Button>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground/50 mt-8 tracking-[0.3em] uppercase font-light">
          Couple Wilhelm © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Login;
