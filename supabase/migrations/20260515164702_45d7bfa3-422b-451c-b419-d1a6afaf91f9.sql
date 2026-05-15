ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS hora_checkin TIME,
  ADD COLUMN IF NOT EXISTS hora_checkout TIME,
  ADD COLUMN IF NOT EXISTS tempo_limpeza_min INTEGER,
  ADD COLUMN IF NOT EXISTS max_hospedes INTEGER,
  ADD COLUMN IF NOT EXISTS observacoes_operacionais TEXT;

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS hora_checkin_override TIME,
  ADD COLUMN IF NOT EXISTS hora_checkout_override TIME;