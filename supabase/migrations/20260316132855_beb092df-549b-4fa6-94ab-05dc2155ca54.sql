
-- ============================================================
-- Tabela admin_configs (white-label por admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  nome_empresa TEXT,
  cor_primaria TEXT NOT NULL DEFAULT '#0A192F',
  cor_secundaria TEXT NOT NULL DEFAULT '#A38B5E',
  logo_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master pode tudo em admin_configs"
  ON public.admin_configs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Admin pode ver propria config"
  ON public.admin_configs FOR SELECT
  TO authenticated
  USING (admin_id = auth.uid());

CREATE POLICY "Admin pode atualizar propria config"
  ON public.admin_configs FOR UPDATE
  TO authenticated
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

-- ============================================================
-- Adicionar admin_id na tabela imoveis
-- ============================================================
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS admin_id UUID;

-- ============================================================
-- Funções auxiliares
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_active_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.admin_configs ac ON ac.admin_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'
      AND ac.ativo = true
  )
$$;

-- ============================================================
-- Atualizar RLS de imoveis para multi-tenant
-- ============================================================
DROP POLICY IF EXISTS "Admin pode fazer tudo em imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Proprietario pode ver proprios imoveis" ON public.imoveis;

CREATE POLICY "Master pode tudo em imoveis"
  ON public.imoveis FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Admin gerencia proprios imoveis"
  ON public.imoveis FOR ALL
  TO authenticated
  USING (admin_id = auth.uid() AND is_active_admin(auth.uid()))
  WITH CHECK (admin_id = auth.uid() AND is_active_admin(auth.uid()));

CREATE POLICY "Proprietario pode ver proprios imoveis"
  ON public.imoveis FOR SELECT
  TO authenticated
  USING ((proprietario_id = auth.uid()) OR (proprietario_id_2 = auth.uid()));

-- ============================================================
-- Atualizar RLS de reservas
-- ============================================================
DROP POLICY IF EXISTS "Admin pode fazer tudo em reservas" ON public.reservas;
DROP POLICY IF EXISTS "Proprietario pode ver reservas dos proprios imoveis" ON public.reservas;

CREATE POLICY "Master pode tudo em reservas"
  ON public.reservas FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Admin gerencia reservas dos proprios imoveis"
  ON public.reservas FOR ALL
  TO authenticated
  USING (
    is_active_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = reservas.imovel_id AND i.admin_id = auth.uid()
    )
  )
  WITH CHECK (
    is_active_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = reservas.imovel_id AND i.admin_id = auth.uid()
    )
  );

CREATE POLICY "Proprietario pode ver reservas dos proprios imoveis"
  ON public.reservas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = reservas.imovel_id
        AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
    )
  );

-- ============================================================
-- Atualizar RLS de despesas_extras
-- ============================================================
DROP POLICY IF EXISTS "Admin pode fazer tudo em despesas_extras" ON public.despesas_extras;
DROP POLICY IF EXISTS "Proprietario pode ver despesas dos proprios imoveis" ON public.despesas_extras;

CREATE POLICY "Master pode tudo em despesas_extras"
  ON public.despesas_extras FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Admin gerencia despesas dos proprios imoveis"
  ON public.despesas_extras FOR ALL
  TO authenticated
  USING (
    is_active_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = despesas_extras.imovel_id AND i.admin_id = auth.uid()
    )
  )
  WITH CHECK (
    is_active_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = despesas_extras.imovel_id AND i.admin_id = auth.uid()
    )
  );

CREATE POLICY "Proprietario pode ver despesas dos proprios imoveis"
  ON public.despesas_extras FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = despesas_extras.imovel_id
        AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
    )
  );

-- ============================================================
-- Atualizar RLS de profiles
-- ============================================================
DROP POLICY IF EXISTS "Admin pode inserir perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios podem ver proprio perfil" ON public.profiles;

CREATE POLICY "Master e admin podem inserir perfis"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'master'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Usuarios podem ver proprio perfil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = id) OR
    has_role(auth.uid(), 'master'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================
-- Atualizar RLS de user_roles
-- ============================================================
DROP POLICY IF EXISTS "Admin e proprio usuario podem ver roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin pode deletar roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin pode inserir roles" ON public.user_roles;

CREATE POLICY "Master e admin e proprio usuario podem ver roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'master'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    (user_id = auth.uid())
  );

CREATE POLICY "Master e admin podem inserir roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'master'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Master e admin podem deletar roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'master'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================
-- Storage bucket para logos
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('admin-logos', 'admin-logos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Logos sao publicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'admin-logos');

CREATE POLICY "Admin pode fazer upload da propria logo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'admin-logos' AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role))
  );

CREATE POLICY "Admin pode atualizar propria logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'admin-logos' AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role))
  );

CREATE POLICY "Admin pode deletar propria logo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'admin-logos' AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role))
  );

-- ============================================================
-- Trigger updated_at em admin_configs
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_admin_configs_updated_at
  BEFORE UPDATE ON public.admin_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
