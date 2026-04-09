
CREATE TABLE public.custos_fixos_proprietario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  proprietario_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (imovel_id, proprietario_id, tipo)
);

ALTER TABLE public.custos_fixos_proprietario ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own fixed costs
CREATE POLICY "Proprietario gerencia proprios custos fixos"
ON public.custos_fixos_proprietario
FOR ALL
TO authenticated
USING (proprietario_id = auth.uid())
WITH CHECK (proprietario_id = auth.uid());

-- Admin can view fixed costs for properties they manage
CREATE POLICY "Admin pode ver custos fixos dos proprios imoveis"
ON public.custos_fixos_proprietario
FOR SELECT
TO authenticated
USING (
  is_active_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM imoveis i
    WHERE i.id = custos_fixos_proprietario.imovel_id
    AND i.admin_id = auth.uid()
  )
);

-- Master full access
CREATE POLICY "Master pode tudo em custos_fixos_proprietario"
ON public.custos_fixos_proprietario
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_custos_fixos_updated_at
BEFORE UPDATE ON public.custos_fixos_proprietario
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
