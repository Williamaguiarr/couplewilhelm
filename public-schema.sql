--
-- PostgreSQL database dump
--

\restrict LoLSRITQf05DgFoDMU8ORnYTasF6ql7ZryU4wYEsBRxilFzYHWCov4akp1gsX4g

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'proprietario',
    'master'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', new.email)
  );
  return new;
end;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;


--
-- Name: is_active_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_active_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: set_reserva_validacao_financeira(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_reserva_validacao_financeira() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Se valor preenchido, está validada
  IF NEW.valor_bruto IS NOT NULL THEN
    NEW.validada_financeiramente := true;
  ELSE
    -- Sem valor: pendente se vier de iCal, validada caso contrário (manual/direto)
    IF NEW.plataforma_origem IN ('airbnb', 'booking') THEN
      NEW.validada_financeiramente := false;
    ELSE
      NEW.validada_financeiramente := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: validate_comissao_percentual(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_comissao_percentual() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.comissao_percentual < 0 OR NEW.comissao_percentual > 100 THEN
    RAISE EXCEPTION 'comissao_percentual must be between 0 and 100';
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    slug text NOT NULL,
    nome_empresa text,
    cor_primaria text DEFAULT '#0A192F'::text NOT NULL,
    cor_secundaria text DEFAULT '#A38B5E'::text NOT NULL,
    logo_url text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    comissao_cw numeric DEFAULT 0.25 NOT NULL,
    ultimo_pagamento date,
    cor_texto text DEFAULT '#FFFFFF'::text NOT NULL
);


--
-- Name: admin_proprietarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_proprietarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    proprietario_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: custos_fixos_proprietario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custos_fixos_proprietario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    imovel_id uuid NOT NULL,
    proprietario_id uuid NOT NULL,
    tipo text NOT NULL,
    valor numeric DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    label text
);


--
-- Name: despesas_extras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.despesas_extras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    imovel_id uuid NOT NULL,
    descricao text NOT NULL,
    valor numeric DEFAULT 0 NOT NULL,
    data date DEFAULT CURRENT_DATE NOT NULL,
    tipo text DEFAULT 'manutencao'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ganhos_extras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ganhos_extras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    imovel_id uuid NOT NULL,
    tipo text DEFAULT 'outros'::text NOT NULL,
    descricao text NOT NULL,
    data date DEFAULT CURRENT_DATE NOT NULL,
    valor numeric DEFAULT 0 NOT NULL,
    aplicar_comissao boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reserva_id uuid,
    regime_comissao text DEFAULT 'com_comissao'::text
);


--
-- Name: ical_sync_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ical_sync_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reserva_id uuid NOT NULL,
    imovel_id uuid NOT NULL,
    plataforma text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: imoveis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imoveis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome_imovel text NOT NULL,
    endereco text,
    proprietario_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    proprietario_id_2 uuid,
    ical_url_airbnb text,
    ical_url_booking text,
    ical_last_sync timestamp with time zone,
    admin_id uuid,
    taxa_comissao numeric,
    hora_checkin time without time zone,
    hora_checkout time without time zone,
    tempo_limpeza_min integer,
    max_hospedes integer,
    observacoes_operacionais text
);


--
-- Name: COLUMN imoveis.taxa_comissao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.imoveis.taxa_comissao IS 'Taxa de comissão específica para este imóvel (0 a 100). Se nulo, usa a taxa do proprietário.';


--
-- Name: limpezas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.limpezas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reserva_id uuid NOT NULL,
    imovel_id uuid NOT NULL,
    data_limpeza date NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    responsavel text,
    observacoes text,
    concluida_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    nome text,
    created_at timestamp with time zone DEFAULT now(),
    comissao_percentual numeric
);


--
-- Name: reservas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    imovel_id uuid NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    valor_bruto numeric(10,2),
    valor_liquido_proprietario numeric(10,2),
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    taxa_limpeza numeric,
    comissao_plataforma numeric,
    num_hospedes integer,
    nome_hospede text,
    plataforma_origem text,
    ical_uid text,
    taxa_comissao_reserva numeric(5,2),
    hora_checkin_override time without time zone,
    hora_checkout_override time without time zone,
    validada_financeiramente boolean DEFAULT true NOT NULL
);


--
-- Name: COLUMN reservas.taxa_comissao_reserva; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reservas.taxa_comissao_reserva IS 'Taxa de comissão personalizada para esta reserva específica. Se NULL, usa a comissão padrão.';


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


--
-- Name: admin_configs admin_configs_admin_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_configs
    ADD CONSTRAINT admin_configs_admin_id_key UNIQUE (admin_id);


--
-- Name: admin_configs admin_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_configs
    ADD CONSTRAINT admin_configs_pkey PRIMARY KEY (id);


--
-- Name: admin_configs admin_configs_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_configs
    ADD CONSTRAINT admin_configs_slug_key UNIQUE (slug);


--
-- Name: admin_proprietarios admin_proprietarios_admin_id_proprietario_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_proprietarios
    ADD CONSTRAINT admin_proprietarios_admin_id_proprietario_id_key UNIQUE (admin_id, proprietario_id);


--
-- Name: admin_proprietarios admin_proprietarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_proprietarios
    ADD CONSTRAINT admin_proprietarios_pkey PRIMARY KEY (id);


--
-- Name: custos_fixos_proprietario custos_fixos_proprietario_imovel_id_proprietario_id_tipo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custos_fixos_proprietario
    ADD CONSTRAINT custos_fixos_proprietario_imovel_id_proprietario_id_tipo_key UNIQUE (imovel_id, proprietario_id, tipo);


--
-- Name: custos_fixos_proprietario custos_fixos_proprietario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custos_fixos_proprietario
    ADD CONSTRAINT custos_fixos_proprietario_pkey PRIMARY KEY (id);


--
-- Name: despesas_extras despesas_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despesas_extras
    ADD CONSTRAINT despesas_extras_pkey PRIMARY KEY (id);


--
-- Name: ganhos_extras ganhos_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ganhos_extras
    ADD CONSTRAINT ganhos_extras_pkey PRIMARY KEY (id);


--
-- Name: ical_sync_alerts ical_sync_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ical_sync_alerts
    ADD CONSTRAINT ical_sync_alerts_pkey PRIMARY KEY (id);


--
-- Name: imoveis imoveis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imoveis
    ADD CONSTRAINT imoveis_pkey PRIMARY KEY (id);


--
-- Name: limpezas limpezas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.limpezas
    ADD CONSTRAINT limpezas_pkey PRIMARY KEY (id);


--
-- Name: limpezas limpezas_reserva_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.limpezas
    ADD CONSTRAINT limpezas_reserva_id_key UNIQUE (reserva_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: reservas reservas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_ganhos_extras_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ganhos_extras_data ON public.ganhos_extras USING btree (data);


--
-- Name: idx_ganhos_extras_imovel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ganhos_extras_imovel ON public.ganhos_extras USING btree (imovel_id);


--
-- Name: idx_limpezas_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_limpezas_data ON public.limpezas USING btree (data_limpeza);


--
-- Name: idx_limpezas_imovel_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_limpezas_imovel_data ON public.limpezas USING btree (imovel_id, data_limpeza);


--
-- Name: idx_reservas_ical_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_ical_uid ON public.reservas USING btree (ical_uid);


--
-- Name: idx_reservas_validada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservas_validada ON public.reservas USING btree (validada_financeiramente);


--
-- Name: limpezas trg_limpezas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_limpezas_updated_at BEFORE UPDATE ON public.limpezas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reservas trg_set_reserva_validacao_financeira; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_reserva_validacao_financeira BEFORE INSERT OR UPDATE OF valor_bruto, plataforma_origem ON public.reservas FOR EACH ROW EXECUTE FUNCTION public.set_reserva_validacao_financeira();


--
-- Name: profiles trg_validate_comissao_percentual; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_comissao_percentual BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_comissao_percentual();


--
-- Name: admin_configs update_admin_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_admin_configs_updated_at BEFORE UPDATE ON public.admin_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: custos_fixos_proprietario update_custos_fixos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_custos_fixos_updated_at BEFORE UPDATE ON public.custos_fixos_proprietario FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ganhos_extras update_ganhos_extras_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ganhos_extras_updated_at BEFORE UPDATE ON public.ganhos_extras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: custos_fixos_proprietario custos_fixos_proprietario_imovel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custos_fixos_proprietario
    ADD CONSTRAINT custos_fixos_proprietario_imovel_id_fkey FOREIGN KEY (imovel_id) REFERENCES public.imoveis(id) ON DELETE CASCADE;


--
-- Name: despesas_extras despesas_extras_imovel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despesas_extras
    ADD CONSTRAINT despesas_extras_imovel_id_fkey FOREIGN KEY (imovel_id) REFERENCES public.imoveis(id) ON DELETE CASCADE;


--
-- Name: ganhos_extras ganhos_extras_imovel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ganhos_extras
    ADD CONSTRAINT ganhos_extras_imovel_id_fkey FOREIGN KEY (imovel_id) REFERENCES public.imoveis(id) ON DELETE CASCADE;


--
-- Name: ganhos_extras ganhos_extras_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ganhos_extras
    ADD CONSTRAINT ganhos_extras_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reservas(id) ON DELETE CASCADE;


--
-- Name: ical_sync_alerts ical_sync_alerts_imovel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ical_sync_alerts
    ADD CONSTRAINT ical_sync_alerts_imovel_id_fkey FOREIGN KEY (imovel_id) REFERENCES public.imoveis(id) ON DELETE CASCADE;


--
-- Name: ical_sync_alerts ical_sync_alerts_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ical_sync_alerts
    ADD CONSTRAINT ical_sync_alerts_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reservas(id) ON DELETE CASCADE;


--
-- Name: imoveis imoveis_proprietario_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imoveis
    ADD CONSTRAINT imoveis_proprietario_id_2_fkey FOREIGN KEY (proprietario_id_2) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: imoveis imoveis_proprietario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imoveis
    ADD CONSTRAINT imoveis_proprietario_id_fkey FOREIGN KEY (proprietario_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reservas reservas_imovel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas
    ADD CONSTRAINT reservas_imovel_id_fkey FOREIGN KEY (imovel_id) REFERENCES public.imoveis(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: custos_fixos_proprietario Admin gerencia custos fixos dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia custos fixos dos proprios imoveis" ON public.custos_fixos_proprietario TO authenticated USING ((public.is_active_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = custos_fixos_proprietario.imovel_id) AND (i.admin_id = auth.uid())))))) WITH CHECK ((public.is_active_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = custos_fixos_proprietario.imovel_id) AND (i.admin_id = auth.uid()))))));


--
-- Name: despesas_extras Admin gerencia despesas dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia despesas dos proprios imoveis" ON public.despesas_extras TO authenticated USING ((public.is_active_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = despesas_extras.imovel_id) AND (i.admin_id = auth.uid())))))) WITH CHECK ((public.is_active_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = despesas_extras.imovel_id) AND (i.admin_id = auth.uid()))))));


--
-- Name: ganhos_extras Admin gerencia ganhos extras dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia ganhos extras dos proprios imoveis" ON public.ganhos_extras TO authenticated USING ((public.is_active_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = ganhos_extras.imovel_id) AND (i.admin_id = auth.uid())))))) WITH CHECK ((public.is_active_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = ganhos_extras.imovel_id) AND (i.admin_id = auth.uid()))))));


--
-- Name: limpezas Admin gerencia limpezas dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia limpezas dos proprios imoveis" ON public.limpezas TO authenticated USING ((public.is_active_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = limpezas.imovel_id) AND (i.admin_id = auth.uid())))))) WITH CHECK ((public.is_active_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = limpezas.imovel_id) AND (i.admin_id = auth.uid()))))));


--
-- Name: imoveis Admin gerencia proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia proprios imoveis" ON public.imoveis TO authenticated USING (((admin_id = auth.uid()) AND public.is_active_admin(auth.uid()))) WITH CHECK (((admin_id = auth.uid()) AND public.is_active_admin(auth.uid())));


--
-- Name: admin_proprietarios Admin gerencia proprios proprietarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia proprios proprietarios" ON public.admin_proprietarios TO authenticated USING ((admin_id = auth.uid())) WITH CHECK ((admin_id = auth.uid()));


--
-- Name: reservas Admin gerencia reservas dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia reservas dos proprios imoveis" ON public.reservas TO authenticated USING ((public.is_active_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = reservas.imovel_id) AND (i.admin_id = auth.uid())))))) WITH CHECK ((public.is_active_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = reservas.imovel_id) AND (i.admin_id = auth.uid()))))));


--
-- Name: admin_configs Admin pode atualizar propria config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin pode atualizar propria config" ON public.admin_configs FOR UPDATE TO authenticated USING ((admin_id = auth.uid())) WITH CHECK ((admin_id = auth.uid()));


--
-- Name: user_roles Admin pode deletar roles nao-master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin pode deletar roles nao-master" ON public.user_roles FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (role <> 'master'::public.app_role)));


--
-- Name: user_roles Admin pode inserir roles nao-master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin pode inserir roles nao-master" ON public.user_roles FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (role <> 'master'::public.app_role)));


--
-- Name: custos_fixos_proprietario Admin pode ver custos fixos dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin pode ver custos fixos dos proprios imoveis" ON public.custos_fixos_proprietario FOR SELECT TO authenticated USING ((public.is_active_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = custos_fixos_proprietario.imovel_id) AND (i.admin_id = auth.uid()))))));


--
-- Name: admin_configs Admin pode ver propria config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin pode ver propria config" ON public.admin_configs FOR SELECT TO authenticated USING ((admin_id = auth.uid()));


--
-- Name: ical_sync_alerts Admins can delete iCal sync alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete iCal sync alerts" ON public.ical_sync_alerts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'master'::public.app_role]))))));


--
-- Name: ical_sync_alerts Admins can update iCal sync alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update iCal sync alerts" ON public.ical_sync_alerts FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'master'::public.app_role]))))));


--
-- Name: ical_sync_alerts Admins can view iCal sync alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view iCal sync alerts" ON public.ical_sync_alerts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'master'::public.app_role]))))));


--
-- Name: user_roles Master e admin e proprio usuario podem ver roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master e admin e proprio usuario podem ver roles" ON public.user_roles FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'master'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR (user_id = auth.uid())));


--
-- Name: profiles Master e admin podem atualizar perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master e admin podem atualizar perfis" ON public.profiles FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'master'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'master'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles Master e admin podem inserir perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master e admin podem inserir perfis" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'master'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: user_roles Master pode deletar qualquer role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master pode deletar qualquer role" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: user_roles Master pode inserir qualquer role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master pode inserir qualquer role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: admin_configs Master pode tudo em admin_configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master pode tudo em admin_configs" ON public.admin_configs TO authenticated USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: admin_proprietarios Master pode tudo em admin_proprietarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master pode tudo em admin_proprietarios" ON public.admin_proprietarios TO authenticated USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: custos_fixos_proprietario Master pode tudo em custos_fixos_proprietario; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master pode tudo em custos_fixos_proprietario" ON public.custos_fixos_proprietario TO authenticated USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: despesas_extras Master pode tudo em despesas_extras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master pode tudo em despesas_extras" ON public.despesas_extras TO authenticated USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: ganhos_extras Master pode tudo em ganhos_extras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master pode tudo em ganhos_extras" ON public.ganhos_extras TO authenticated USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: imoveis Master pode tudo em imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master pode tudo em imoveis" ON public.imoveis TO authenticated USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: limpezas Master pode tudo em limpezas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master pode tudo em limpezas" ON public.limpezas TO authenticated USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: reservas Master pode tudo em reservas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master pode tudo em reservas" ON public.reservas TO authenticated USING (public.has_role(auth.uid(), 'master'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));


--
-- Name: custos_fixos_proprietario Proprietario gerencia proprios custos fixos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Proprietario gerencia proprios custos fixos" ON public.custos_fixos_proprietario TO authenticated USING ((proprietario_id = auth.uid())) WITH CHECK ((proprietario_id = auth.uid()));


--
-- Name: despesas_extras Proprietario pode deletar despesas dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Proprietario pode deletar despesas dos proprios imoveis" ON public.despesas_extras FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = despesas_extras.imovel_id) AND ((i.proprietario_id = auth.uid()) OR (i.proprietario_id_2 = auth.uid()))))));


--
-- Name: despesas_extras Proprietario pode inserir despesas dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Proprietario pode inserir despesas dos proprios imoveis" ON public.despesas_extras FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = despesas_extras.imovel_id) AND ((i.proprietario_id = auth.uid()) OR (i.proprietario_id_2 = auth.uid()))))));


--
-- Name: despesas_extras Proprietario pode ver despesas dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Proprietario pode ver despesas dos proprios imoveis" ON public.despesas_extras FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = despesas_extras.imovel_id) AND ((i.proprietario_id = auth.uid()) OR (i.proprietario_id_2 = auth.uid()))))));


--
-- Name: ganhos_extras Proprietario pode ver ganhos extras dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Proprietario pode ver ganhos extras dos proprios imoveis" ON public.ganhos_extras FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = ganhos_extras.imovel_id) AND ((i.proprietario_id = auth.uid()) OR (i.proprietario_id_2 = auth.uid()))))) AND ((reserva_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.reservas r
  WHERE ((r.id = ganhos_extras.reserva_id) AND (r.validada_financeiramente = true)))))));


--
-- Name: limpezas Proprietario pode ver limpezas dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Proprietario pode ver limpezas dos proprios imoveis" ON public.limpezas FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = limpezas.imovel_id) AND ((i.proprietario_id = auth.uid()) OR (i.proprietario_id_2 = auth.uid()))))) AND ((reserva_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.reservas r
  WHERE ((r.id = limpezas.reserva_id) AND (r.validada_financeiramente = true)))))));


--
-- Name: admin_proprietarios Proprietario pode ver proprio vinculo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Proprietario pode ver proprio vinculo" ON public.admin_proprietarios FOR SELECT TO authenticated USING ((proprietario_id = auth.uid()));


--
-- Name: imoveis Proprietario pode ver proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Proprietario pode ver proprios imoveis" ON public.imoveis FOR SELECT TO authenticated USING (((proprietario_id = auth.uid()) OR (proprietario_id_2 = auth.uid())));


--
-- Name: reservas Proprietario pode ver reservas dos proprios imoveis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Proprietario pode ver reservas dos proprios imoveis" ON public.reservas FOR SELECT TO authenticated USING (((validada_financeiramente = true) AND (EXISTS ( SELECT 1
   FROM public.imoveis i
  WHERE ((i.id = reservas.imovel_id) AND ((i.proprietario_id = auth.uid()) OR (i.proprietario_id_2 = auth.uid())))))));


--
-- Name: profiles Usuarios podem atualizar proprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios podem atualizar proprio perfil" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Usuarios podem ver proprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios podem ver proprio perfil" ON public.profiles FOR SELECT TO authenticated USING (((auth.uid() = id) OR public.has_role(auth.uid(), 'master'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: admin_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_proprietarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_proprietarios ENABLE ROW LEVEL SECURITY;

--
-- Name: custos_fixos_proprietario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custos_fixos_proprietario ENABLE ROW LEVEL SECURITY;

--
-- Name: despesas_extras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.despesas_extras ENABLE ROW LEVEL SECURITY;

--
-- Name: ganhos_extras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ganhos_extras ENABLE ROW LEVEL SECURITY;

--
-- Name: ical_sync_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ical_sync_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: imoveis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;

--
-- Name: limpezas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.limpezas ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: reservas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict LoLSRITQf05DgFoDMU8ORnYTasF6ql7ZryU4wYEsBRxilFzYHWCov4akp1gsX4g

