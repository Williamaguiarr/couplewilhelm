-- Adicionar política para permitir que qualquer usuário autenticado veja seus próprios papéis
-- Isso é essencial para o funcionamento do AuthContext no frontend
CREATE POLICY "Usuário pode ver seus próprios papéis"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Adicionar política similar para Master
CREATE POLICY "Master pode ver todos os papéis"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'master'::app_role));
