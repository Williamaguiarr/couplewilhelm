import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import logo from "@/assets/logo.png";

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  // Supabase injeta a sessão de recovery automaticamente via URL hash
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Não foi possível redefinir a senha. Tente solicitar um novo link.");
      setSubmitting(false);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-page-enter">
        <div className="flex flex-col items-center mb-10">
          <img src={logo} alt="Couple Wilhelm" className="h-16 w-auto object-contain mb-4" />
          <p className="text-muted-foreground text-sm tracking-wider">Gestão de Aluguéis</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 shadow-luxury">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle className="h-12 w-12 text-green-600" />
              <h2 className="font-display text-xl text-foreground">Senha redefinida!</h2>
              <p className="text-muted-foreground text-sm">
                Sua senha foi atualizada com sucesso. Você será redirecionado para o login.
              </p>
            </div>
          ) : !ready ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">Verificando link de redefinição...</p>
              <p className="text-xs text-muted-foreground opacity-70">
                Se demorar muito,{" "}
                <button
                  onClick={() => navigate("/login")}
                  className="text-primary underline hover:opacity-80"
                >
                  solicite um novo link
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-display text-xl text-foreground mb-2 text-center">
                Redefinir senha
              </h2>
              <p className="text-muted-foreground text-sm text-center mb-6">
                Escolha uma nova senha para sua conta.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground tracking-wide">Nova senha</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
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

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground tracking-wide">
                    Confirmar nova senha
                  </Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    required
                    className="bg-background border-border focus:border-primary/50"
                  />
                </div>

                {error && (
                  <div className="text-sm text-destructive text-center bg-destructive/10 rounded-md py-2 px-3">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 tracking-wider font-medium"
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground/50 border-t-primary-foreground rounded-full animate-spin" />
                      Salvando...
                    </div>
                  ) : (
                    "Redefinir senha"
                  )}
                </Button>
              </form>
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

export default ResetPassword;
