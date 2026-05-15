
CREATE TABLE public.limpezas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id uuid NOT NULL UNIQUE,
  imovel_id uuid NOT NULL,
  data_limpeza date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  responsavel text,
  observacoes text,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_limpezas_imovel_data ON public.limpezas(imovel_id, data_limpeza);
CREATE INDEX idx_limpezas_data ON public.limpezas(data_limpeza);

ALTER TABLE public.limpezas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master pode tudo em limpezas"
ON public.limpezas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Admin gerencia limpezas dos proprios imoveis"
ON public.limpezas FOR ALL TO authenticated
USING (is_active_admin(auth.uid()) AND EXISTS (
  SELECT 1 FROM imoveis i WHERE i.id = limpezas.imovel_id AND i.admin_id = auth.uid()
))
WITH CHECK (is_active_admin(auth.uid()) AND EXISTS (
  SELECT 1 FROM imoveis i WHERE i.id = limpezas.imovel_id AND i.admin_id = auth.uid()
));

CREATE POLICY "Proprietario pode ver limpezas dos proprios imoveis"
ON public.limpezas FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM imoveis i
  WHERE i.id = limpezas.imovel_id
    AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
));

CREATE TRIGGER trg_limpezas_updated_at
BEFORE UPDATE ON public.limpezas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
