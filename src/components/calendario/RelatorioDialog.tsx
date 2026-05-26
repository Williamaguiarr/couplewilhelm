import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { EventoOperacional } from "./types";

interface RelatorioDialogProps {
  eventos: EventoOperacional[];
}

export default function RelatorioDialog({ eventos }: RelatorioDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const gerarTextoRelatorio = () => {
    const hoje = new Date().toISOString().split("T")[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const formatarDia = (data: string) => {
      if (data === hoje) return "HOJE";
      if (data === amanha) return "AMANHÃ";
      return data;
    };

    const filtrarEventos = (data: string) => eventos.filter((e) => e.data === data);

    const formatarLista = (titulo: string, lista: EventoOperacional[]) => {
      if (lista.length === 0) return `${titulo}: Nenhuma movimentação\n`;
      let texto = `${titulo}:\n`;
      lista.forEach((e) => {
        const tipo = e.tipo === "checkin" ? "📥 IN" : "📤 OUT";
        texto += `${tipo} ${e.hora} - ${e.imovel.nome_imovel} (${e.reserva.nome_hospede || "N/A"})\n`;
      });
      return texto + "\n";
    };

    let relatorio = `📊 *RELATÓRIO OPERACIONAL*\n\n`;

    relatorio += `📅 *${formatarDia(hoje)}*\n`;
    relatorio += formatarLista("Check-outs", filtrarEventos(hoje).filter(e => e.tipo === 'checkout'));
    relatorio += formatarLista("Check-ins", filtrarEventos(hoje).filter(e => e.tipo === 'checkin'));

    relatorio += `📅 *${formatarDia(amanha)}*\n`;
    relatorio += formatarLista("Check-outs", filtrarEventos(amanha).filter(e => e.tipo === 'checkout'));
    relatorio += formatarLista("Check-ins", filtrarEventos(amanha).filter(e => e.tipo === 'checkin'));

    return relatorio;
  };

  const handleCopy = () => {
    const texto = gerarTextoRelatorio();
    navigator.clipboard.writeText(texto);
    setCopied(true);
    toast({
      title: "Copiado!",
      description: "O relatório foi copiado para a área de transferência.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const texto = encodeURIComponent(gerarTextoRelatorio());
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Gerar Relatório
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Relatório Operacional (Hoje e Amanhã)</DialogTitle>
        </DialogHeader>
        <div className="bg-muted p-4 rounded-lg font-mono text-xs whitespace-pre-wrap max-h-[400px] overflow-y-auto">
          {gerarTextoRelatorio()}
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar Texto"}
          </Button>
          <Button onClick={handleWhatsApp} className="gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-none">
            <Share2 className="h-4 w-4" />
            Enviar WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
