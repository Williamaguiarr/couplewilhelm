-- Adicionar novas colunas à tabela imoveis
ALTER TABLE public.imoveis 
ADD COLUMN IF NOT EXISTS airbnb_link TEXT,
ADD COLUMN IF NOT EXISTS airbnb_title TEXT,
ADD COLUMN IF NOT EXISTS airbnb_image_url TEXT,
ADD COLUMN IF NOT EXISTS last_airbnb_sync TIMESTAMP WITH TIME ZONE;

-- Grant permissions (standard practice for this project)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imoveis TO authenticated;
GRANT ALL ON public.imoveis TO service_role;
