-- 1) Privilege escalation: only master can delete master roles
DROP POLICY IF EXISTS "Master e admin podem deletar roles" ON public.user_roles;

CREATE POLICY "Master pode deletar qualquer role"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Admin pode deletar roles nao-master"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'master'::app_role
);

-- Also tighten INSERT so admins cannot grant master
DROP POLICY IF EXISTS "Master e admin podem inserir roles" ON public.user_roles;

CREATE POLICY "Master pode inserir qualquer role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Admin pode inserir roles nao-master"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'master'::app_role
);

-- 2) Storage ownership check on admin-logos bucket
DROP POLICY IF EXISTS "Admin pode atualizar logos" ON storage.objects;
DROP POLICY IF EXISTS "Admin pode deletar logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update admin-logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete admin-logos" ON storage.objects;
DROP POLICY IF EXISTS "Admin pode inserir logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can insert admin-logos" ON storage.objects;

-- INSERT: admin can only upload files inside a folder matching their own admin_id (or master)
CREATE POLICY "Admin pode inserir proprio logo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'admin-logos'
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

-- UPDATE: admin can only update files inside their own folder (or master)
CREATE POLICY "Admin pode atualizar proprio logo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'admin-logos'
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
)
WITH CHECK (
  bucket_id = 'admin-logos'
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

-- DELETE: admin can only delete files in their own folder (or master)
CREATE POLICY "Admin pode deletar proprio logo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'admin-logos'
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

-- 3) Allow admins to manage fixed costs of their own properties' owners
CREATE POLICY "Admin gerencia custos fixos dos proprios imoveis"
ON public.custos_fixos_proprietario
FOR ALL
TO authenticated
USING (
  is_active_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.imoveis i
    WHERE i.id = custos_fixos_proprietario.imovel_id
      AND i.admin_id = auth.uid()
  )
)
WITH CHECK (
  is_active_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.imoveis i
    WHERE i.id = custos_fixos_proprietario.imovel_id
      AND i.admin_id = auth.uid()
  )
);