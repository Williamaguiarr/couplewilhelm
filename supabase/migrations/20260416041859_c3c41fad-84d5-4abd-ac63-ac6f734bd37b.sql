
ALTER TABLE public.reservas 
  ADD COLUMN IF NOT EXISTS nome_hospede text,
  ADD COLUMN IF NOT EXISTS plataforma_origem text;
