-- Permite que reserva_id seja nulo para alertas de erro de sincronização do imóvel/plataforma
ALTER TABLE public.ical_sync_alerts ALTER COLUMN reserva_id DROP NOT NULL;

-- Adiciona coluna para mensagem de erro detalhada
ALTER TABLE public.ical_sync_alerts ADD COLUMN IF NOT EXISTS mensagem_erro TEXT;

-- Limpeza: remover alertas pendentes de reservas que já terminaram
DELETE FROM public.ical_sync_alerts
WHERE id IN (
  SELECT a.id 
  FROM public.ical_sync_alerts a
  JOIN public.reservas r ON a.reserva_id = r.id
  WHERE r.data_fim < CURRENT_DATE
);
