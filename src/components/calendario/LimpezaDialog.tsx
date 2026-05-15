import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { EventoOperacional } from "./types";

interface Props {
  evento: EventoOperacional | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function LimpezaDialog({ evento, onClose, onSaved }: Props) {
  const [responsavel, setResponsavel] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState<"pendente" | "concluida">("pendente");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (evento?.limpeza) {
      setResponsavel(evento.limpeza.responsavel || "");
      setObservacoes(evento.limpeza.observacoes || "");
      setStatus(evento.limpeza.status);
    } else {
      setResponsavel("");
      setObservacoes("");
      setStatus("pendente");
    }
  }, [evento?.id]);

  if (!evento) return null;

  const handleSave = async (novoStatus?: "pendente" | "concluida") => {
    setSaving(true);
    const finalStatus = novoStatus ?? status;
    const payload = {
      reserva_id: evento.reserva.id,
      imovel_id: evento.imovel.id,
      data_limpeza: evento.data,
      status: finalStatus,
      responsavel: responsavel.trim() || null,
      observacoes: observacoes.trim() || null,
      concluida_em: finalStatus === "concluida" ? new Date().toISOString() : null,
    };
    const { error } = await supabase
      .from("limpezas")
      .upsert(payload, { onConflict: "reserva_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Limpeza atualizada" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={!!evento} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Gerenciar limpeza</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <p className="font-medium text-foreground">{evento.imovel.nome_imovel}</p>
            <p className="text-muted-foreground text-xs">
              Check-out: {new Date(evento.data + "T12:00:00").toLocaleDateString("pt-BR")} às {evento.hora}
            </p>
            {evento.reserva.nome_hospede && (
              <p className="text-muted-foreground text-xs">Hóspede: {evento.reserva.nome_hospede}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="responsavel">Responsável</Label>
            <Input
              id="responsavel"
              placeholder="Nome da pessoa da equipe"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações internas</Label>
            <Textarea
              id="obs"
              rows={3}
              placeholder="Ex: trocar enxoval extra, levar produtos..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          {status === "concluida" ? (
            <Button variant="outline" onClick={() => handleSave("pendente")} disabled={saving}>
              Reabrir limpeza
            </Button>
          ) : (
            <Button onClick={() => handleSave("concluida")} disabled={saving}>
              Marcar como concluída
            </Button>
          )}
          <Button variant="secondary" onClick={() => handleSave()} disabled={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
