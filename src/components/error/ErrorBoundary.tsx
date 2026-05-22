import React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full glass p-8 rounded-2xl border border-destructive/20 text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-display font-semibold text-foreground">
                Ops! Algo deu errado
              </h2>
              <p className="text-sm text-muted-foreground">
                Ocorreu um erro inesperado ao carregar esta página. Nossa equipe foi notificada.
              </p>
              {this.state.error && (
                <div className="mt-4 p-3 bg-destructive/5 rounded-lg border border-destructive/10 text-left">
                  <p className="text-[10px] font-mono text-destructive uppercase tracking-widest mb-1 opacity-70">
                    Detalhes do erro
                  </p>
                  <p className="text-xs font-mono text-destructive break-all line-clamp-3">
                    {this.state.error.message}
                  </p>
                </div>
              )}
            </div>
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
              className="gap-2 group transition-all duration-300"
            >
              <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              Recarregar página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
