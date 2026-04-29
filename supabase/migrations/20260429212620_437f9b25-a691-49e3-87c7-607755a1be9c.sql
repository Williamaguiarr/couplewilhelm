-- Allow master and admin to update profiles (needed to set commission per owner)
CREATE POLICY "Master e admin podem atualizar perfis"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Remove the 25 default so each owner uses their chosen value
ALTER TABLE public.profiles ALTER COLUMN comissao_percentual DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN comissao_percentual DROP NOT NULL;