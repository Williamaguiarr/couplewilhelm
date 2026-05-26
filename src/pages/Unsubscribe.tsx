import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const resp = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await resp.json();
        if (!resp.ok) {
          setState("invalid");
          setErrorMsg(data.error || "Link inválido");
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState("already");
        } else if (data.valid) {
          setState("valid");
        } else {
          setState("invalid");
        }
      } catch (e: any) {
        setState("error");
        setErrorMsg(e.message);
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    setState("submitting");
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ token }),
      });
      const data = await resp.json();
      if (data.success || data.reason === "already_unsubscribed") {
        setState("done");
      } else {
        setState("error");
        setErrorMsg(data.error || "Falha ao processar");
      }
    } catch (e: any) {
      setState("error");
      setErrorMsg(e.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Cancelar inscrição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando link…
            </div>
          )}
          {state === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">
                Confirme que você deseja parar de receber e-mails deste endereço.
              </p>
              <Button onClick={handleConfirm} className="w-full">Confirmar cancelamento</Button>
            </>
          )}
          {state === "submitting" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Processando…
            </div>
          )}
          {state === "done" && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" /> Inscrição cancelada com sucesso.
            </div>
          )}
          {state === "already" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5" /> Este endereço já estava cancelado.
            </div>
          )}
          {(state === "invalid" || state === "error") && (
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <span>{errorMsg || "Link inválido ou expirado."}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
