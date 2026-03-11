
DROP POLICY IF EXISTS "Proprietario pode ver reservas dos proprios imoveis" ON public.reservas;

CREATE POLICY "Proprietario pode ver reservas dos proprios imoveis"
ON public.reservas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.imoveis
    WHERE imoveis.id = reservas.imovel_id
      AND (imoveis.proprietario_id = auth.uid() OR imoveis.proprietario_id_2 = auth.uid())
  )
);
