ALTER TABLE public.admin_configs
  ADD COLUMN IF NOT EXISTS relatorio_diario_email text,
  ADD COLUMN IF NOT EXISTS relatorio_diario_ativo boolean NOT NULL DEFAULT false;