
CREATE TABLE public.ganhos_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'outros',
  descricao TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  valor NUMERIC NOT NULL DEFAULT 0,
  aplicar_comissao BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ganhos_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master pode tudo em ganhos_extras"
ON public.ganhos_extras FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Admin gerencia ganhos extras dos proprios imoveis"
ON public.ganhos_extras FOR ALL TO authenticated
USING (
  is_active_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM imoveis i
    WHERE i.id = ganhos_extras.imovel_id AND i.admin_id = auth.uid()
  )
)
WITH CHECK (
  is_active_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM imoveis i
    WHERE i.id = ganhos_extras.imovel_id AND i.admin_id = auth.uid()
  )
);

CREATE POLICY "Proprietario pode ver ganhos extras dos proprios imoveis"
ON public.ganhos_extras FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM imoveis i
    WHERE i.id = ganhos_extras.imovel_id
      AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
  )
);

CREATE TRIGGER update_ganhos_extras_updated_at
BEFORE UPDATE ON public.ganhos_extras
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ganhos_extras_imovel ON public.ganhos_extras(imovel_id);
CREATE INDEX idx_ganhos_extras_data ON public.ganhos_extras(data);
