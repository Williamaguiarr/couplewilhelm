
-- Apenas adicionar o novo valor ao enum em uma transação separada
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master';
