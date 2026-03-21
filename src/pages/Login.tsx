import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react";
import logo from "@/assets/logo.png";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { role } = useAuth();

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

        {/* Card */}
        <div className="bg-card border border-border rounded-lg p-8 shadow-luxury">
          {!forgotMode ? (
            <>
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm text-muted-foreground tracking-wide">
                      Senha
                    </Label>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setForgotEmail(email); setError(null); }}
                      className="text-xs text-primary hover:opacity-75 transition-opacity"
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
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setForgotMode(false); setForgotSent(false); setForgotError(null); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao login
              </button>

              {forgotSent ? (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <CheckCircle className="h-12 w-12 text-primary" />
                  <h2 className="font-display text-xl text-foreground">E-mail enviado!</h2>
                  <p className="text-muted-foreground text-sm">
                    Verifique sua caixa de entrada em{" "}
                    <strong className="text-foreground">{forgotEmail}</strong> e siga as instruções para redefinir sua senha.
                  </p>
                  <p className="text-xs text-muted-foreground opacity-70">
                    Não recebeu? Verifique a pasta de spam.
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="font-display text-xl text-foreground mb-2 text-center">
                    Recuperar senha
                  </h2>
                  <p className="text-muted-foreground text-sm text-center mb-6">
                    Informe seu e-mail e enviaremos um link para redefinir sua senha.
                  </p>

                  <form onSubmit={handleForgot} className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground tracking-wide">
                        E-mail
                      </Label>
                      <Input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                        autoComplete="email"
                        className="bg-background border-border focus:border-primary/50"
                      />
                    </div>

                    {forgotError && (
                      <div className="text-sm text-destructive text-center bg-destructive/10 rounded-md py-2 px-3">
                        {forgotError}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 tracking-wider font-medium"
                      disabled={forgotSubmitting}
                    >
                      {forgotSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary-foreground/50 border-t-primary-foreground rounded-full animate-spin" />
                          Enviando...
                        </div>
                      ) : (
                        "Enviar link de recuperação"
                      )}
                    </Button>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 tracking-wider">
          COUPLE WILHELM © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Login;
