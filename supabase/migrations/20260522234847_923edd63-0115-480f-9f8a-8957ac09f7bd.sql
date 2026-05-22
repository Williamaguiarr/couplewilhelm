-- ==========================================
-- CRÍTICO 1 & 2: REFORÇO DE PERFIS E ROLES
-- ==========================================

-- Remover políticas antigas de profiles
DROP POLICY IF EXISTS "Usuarios podem ver proprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Master e admin podem inserir perfis" ON public.profiles;
DROP POLICY IF EXISTS "Master e admin podem atualizar perfis" ON public.profiles;

-- Novas políticas para PROFILES
CREATE POLICY "Profiles - Master tem acesso total"
    ON public.profiles FOR ALL
    TO authenticated
    USING (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Profiles - Usuario ve e atualiza proprio perfil"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Admin vê apenas perfis relacionados (ele mesmo e seus proprietários)
CREATE POLICY "Profiles - Admin vê perfis vinculados"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        has_role(auth.uid(), 'admin'::app_role) AND (
            id = auth.uid() OR 
            EXISTS (
                SELECT 1 FROM public.imoveis i 
                WHERE i.admin_id = auth.uid() 
                AND (i.proprietario_id = public.profiles.id OR i.proprietario_id_2 = public.profiles.id)
            )
        )
    );

-- Remover políticas antigas de user_roles
DROP POLICY IF EXISTS "Master e admin e proprio usuario podem ver roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin pode inserir roles nao-master" ON public.user_roles;
DROP POLICY IF EXISTS "Admin pode deletar roles nao-master" ON public.user_roles;

-- Novas políticas para USER_ROLES
CREATE POLICY "User Roles - Admin vê roles vinculadas"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (
        has_role(auth.uid(), 'admin'::app_role) AND (
            user_id = auth.uid() OR 
            EXISTS (
                SELECT 1 FROM public.imoveis i 
                WHERE i.admin_id = auth.uid() 
                AND (i.proprietario_id = public.user_roles.user_id OR i.proprietario_id_2 = public.user_roles.user_id)
            )
        )
    );

-- ==========================================
-- CRÍTICO 3, 4 & 5: AUDITORIA FINANCEIRA E ACESSOS CRUZADOS
-- ==========================================

-- DESPESAS EXTRAS: Restringir Proprietários de inserir/editar
DROP POLICY IF EXISTS "Admin gerencia despesas dos proprios imoveis" ON public.despesas_extras;
DROP POLICY IF EXISTS "Proprietario pode ver despesas dos proprios imoveis" ON public.despesas_extras;

CREATE POLICY "Despesas - Admin gerencia despesas vinculadas"
    ON public.despesas_extras FOR ALL
    TO authenticated
    USING (
        is_active_admin(auth.uid()) AND 
        EXISTS (SELECT 1 FROM public.imoveis i WHERE i.id = despesas_extras.imovel_id AND i.admin_id = auth.uid())
    )
    WITH CHECK (
        is_active_admin(auth.uid()) AND 
        EXISTS (SELECT 1 FROM public.imoveis i WHERE i.id = despesas_extras.imovel_id AND i.admin_id = auth.uid())
    );

CREATE POLICY "Despesas - Proprietario apenas visualiza"
    ON public.despesas_extras FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.imoveis i 
            WHERE i.id = despesas_extras.imovel_id 
            AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
        )
    );

-- GANHOS EXTRAS: Mesma lógica
DROP POLICY IF EXISTS "Admin gerencia ganhos dos proprios imoveis" ON public.ganhos_extras;
DROP POLICY IF EXISTS "Proprietario pode ver ganhos dos proprios imoveis" ON public.ganhos_extras;

CREATE POLICY "Ganhos - Admin gerencia ganhos vinculados"
    ON public.ganhos_extras FOR ALL
    TO authenticated
    USING (
        is_active_admin(auth.uid()) AND 
        EXISTS (SELECT 1 FROM public.imoveis i WHERE i.id = ganhos_extras.imovel_id AND i.admin_id = auth.uid())
    )
    WITH CHECK (
        is_active_admin(auth.uid()) AND 
        EXISTS (SELECT 1 FROM public.imoveis i WHERE i.id = ganhos_extras.imovel_id AND i.admin_id = auth.uid())
    );

CREATE POLICY "Ganhos - Proprietario apenas visualiza"
    ON public.ganhos_extras FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.imoveis i 
            WHERE i.id = ganhos_extras.imovel_id 
            AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
        )
    );

-- RESERVAS: Garantir que admin não veja de outros admins
DROP POLICY IF EXISTS "Admin gerencia reservas dos proprios imoveis" ON public.reservas;
DROP POLICY IF EXISTS "Proprietario pode ver reservas dos proprios imoveis" ON public.reservas;

CREATE POLICY "Reservas - Admin gerencia vinculadas"
    ON public.reservas FOR ALL
    TO authenticated
    USING (
        is_active_admin(auth.uid()) AND 
        EXISTS (SELECT 1 FROM public.imoveis i WHERE i.id = reservas.imovel_id AND i.admin_id = auth.uid())
    )
    WITH CHECK (
        is_active_admin(auth.uid()) AND 
        EXISTS (SELECT 1 FROM public.imoveis i WHERE i.id = reservas.imovel_id AND i.admin_id = auth.uid())
    );

CREATE POLICY "Reservas - Proprietario apenas visualiza"
    ON public.reservas FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.imoveis i 
            WHERE i.id = reservas.imovel_id 
            AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
        )
    );

-- ==========================================
-- CRÍTICO 4: REVISÃO DE INSERT (VETO A 'USING TRUE')
-- ==========================================

-- Validar inserção de imoveis (exige admin/master)
DROP POLICY IF EXISTS "Admin gerencia proprios imoveis" ON public.imoveis;
CREATE POLICY "Imoveis - Admin gerencia vinculados"
    ON public.imoveis FOR ALL
    TO authenticated
    USING (
        (admin_id = auth.uid() AND is_active_admin(auth.uid()))
    )
    WITH CHECK (
        (admin_id = auth.uid() AND is_active_admin(auth.uid()))
    );

-- Segurança extra para ADMIN_CONFIGS
DROP POLICY IF EXISTS "Admin pode ver propria config" ON public.admin_configs;
DROP POLICY IF EXISTS "Admin pode atualizar propria config" ON public.admin_configs;

CREATE POLICY "Admin Configs - Acesso restrito"
    ON public.admin_configs FOR SELECT
    TO authenticated
    USING (
        has_role(auth.uid(), 'master'::app_role) OR 
        (admin_id = auth.uid() AND is_active_admin(auth.uid()))
    );

CREATE POLICY "Admin Configs - Update restrito"
    ON public.admin_configs FOR UPDATE
    TO authenticated
    USING (
        has_role(auth.uid(), 'master'::app_role) OR 
        (admin_id = auth.uid() AND is_active_admin(auth.uid()))
    )
    WITH CHECK (
        has_role(auth.uid(), 'master'::app_role) OR 
        (admin_id = auth.uid() AND is_active_admin(auth.uid()))
    );
