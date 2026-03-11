
-- Criar tabela de despesas extras vinculadas a imóveis
CREATE TABLE public.despesas_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT 'manutencao',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.despesas_extras ENABLE ROW LEVEL SECURITY;

-- Admin pode fazer tudo
CREATE POLICY "Admin pode fazer tudo em despesas_extras"
ON public.despesas_extras
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Proprietário pode ver despesas dos seus imóveis
CREATE POLICY "Proprietario pode ver despesas dos proprios imoveis"
ON public.despesas_extras
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.imoveis
    WHERE imoveis.id = despesas_extras.imovel_id
      AND (imoveis.proprietario_id = auth.uid() OR imoveis.proprietario_id_2 = auth.uid())
  )
);
