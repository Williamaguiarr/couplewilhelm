
-- Allow owners to insert expenses for their own properties
CREATE POLICY "Proprietario pode inserir despesas dos proprios imoveis"
ON public.despesas_extras
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM imoveis i
    WHERE i.id = despesas_extras.imovel_id
    AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
  )
);

-- Allow owners to delete expenses for their own properties
CREATE POLICY "Proprietario pode deletar despesas dos proprios imoveis"
ON public.despesas_extras
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM imoveis i
    WHERE i.id = despesas_extras.imovel_id
    AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
  )
);
