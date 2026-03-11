
-- Adiciona segundo proprietário
ALTER TABLE public.imoveis ADD COLUMN proprietario_id_2 uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Atualiza a política do proprietário para incluir proprietario_id_2
DROP POLICY IF EXISTS "Proprietario pode ver proprios imoveis" ON public.imoveis;

CREATE POLICY "Proprietario pode ver proprios imoveis"
ON public.imoveis
FOR SELECT
TO authenticated
USING (
  proprietario_id = auth.uid() OR proprietario_id_2 = auth.uid()
);
