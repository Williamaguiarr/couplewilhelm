-- Tabela de vínculo entre admin e proprietários que ele criou/gerencia
CREATE TABLE IF NOT EXISTS public.admin_proprietarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  proprietario_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (admin_id, proprietario_id)
);

ALTER TABLE public.admin_proprietarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia proprios proprietarios"
  ON public.admin_proprietarios
  FOR ALL
  TO authenticated
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Master pode tudo em admin_proprietarios"
  ON public.admin_proprietarios
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Proprietário pode ver seu próprio vínculo
CREATE POLICY "Proprietario pode ver proprio vinculo"
  ON public.admin_proprietarios
  FOR SELECT
  TO authenticated
  USING (proprietario_id = auth.uid());
