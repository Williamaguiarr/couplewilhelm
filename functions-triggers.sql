                                      ?column?                                       
-------------------------------------------------------------------------------------
 CREATE OR REPLACE FUNCTION public.update_updated_at_column()                       +
  RETURNS trigger                                                                   +
  LANGUAGE plpgsql                                                                  +
  SET search_path TO 'public'                                                       +
 AS $function$                                                                      +
 BEGIN                                                                              +
   NEW.updated_at = now();                                                          +
   RETURN NEW;                                                                      +
 END;                                                                               +
 $function$                                                                         +
 ;
 CREATE OR REPLACE FUNCTION public.set_reserva_validacao_financeira()               +
  RETURNS trigger                                                                   +
  LANGUAGE plpgsql                                                                  +
  SET search_path TO 'public'                                                       +
 AS $function$                                                                      +
 BEGIN                                                                              +
   -- Se valor preenchido, está validada                                            +
   IF NEW.valor_bruto IS NOT NULL THEN                                              +
     NEW.validada_financeiramente := true;                                          +
   ELSE                                                                             +
     -- Sem valor: pendente se vier de iCal, validada caso contrário (manual/direto)+
     IF NEW.plataforma_origem IN ('airbnb', 'booking') THEN                         +
       NEW.validada_financeiramente := false;                                       +
     ELSE                                                                           +
       NEW.validada_financeiramente := true;                                        +
     END IF;                                                                        +
   END IF;                                                                          +
   RETURN NEW;                                                                      +
 END;                                                                               +
 $function$                                                                         +
 ;
 CREATE OR REPLACE FUNCTION public.is_active_admin(_user_id uuid)                   +
  RETURNS boolean                                                                   +
  LANGUAGE sql                                                                      +
  STABLE SECURITY DEFINER                                                           +
  SET search_path TO 'public'                                                       +
 AS $function$                                                                      +
   SELECT EXISTS (                                                                  +
     SELECT 1                                                                       +
     FROM public.user_roles ur                                                      +
     JOIN public.admin_configs ac ON ac.admin_id = ur.user_id                       +
     WHERE ur.user_id = _user_id                                                    +
       AND ur.role = 'admin'                                                        +
       AND ac.ativo = true                                                          +
   )                                                                                +
 $function$                                                                         +
 ;
 CREATE OR REPLACE FUNCTION public.validate_comissao_percentual()                   +
  RETURNS trigger                                                                   +
  LANGUAGE plpgsql                                                                  +
  SET search_path TO 'public'                                                       +
 AS $function$                                                                      +
 BEGIN                                                                              +
   IF NEW.comissao_percentual < 0 OR NEW.comissao_percentual > 100 THEN             +
     RAISE EXCEPTION 'comissao_percentual must be between 0 and 100';               +
   END IF;                                                                          +
   RETURN NEW;                                                                      +
 END;                                                                               +
 $function$                                                                         +
 ;
 CREATE OR REPLACE FUNCTION public.handle_new_user()                                +
  RETURNS trigger                                                                   +
  LANGUAGE plpgsql                                                                  +
  SECURITY DEFINER                                                                  +
  SET search_path TO 'public'                                                       +
 AS $function$                                                                      +
 begin                                                                              +
   insert into public.profiles (id, email, nome)                                    +
   values (                                                                         +
     new.id,                                                                        +
     new.email,                                                                     +
     coalesce(new.raw_user_meta_data->>'nome', new.email)                           +
   );                                                                               +
   return new;                                                                      +
 end;                                                                               +
 $function$                                                                         +
 ;
 CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)          +
  RETURNS boolean                                                                   +
  LANGUAGE sql                                                                      +
  STABLE SECURITY DEFINER                                                           +
  SET search_path TO 'public'                                                       +
 AS $function$                                                                      +
   select exists (                                                                  +
     select 1                                                                       +
     from public.user_roles                                                         +
     where user_id = _user_id                                                       +
       and role = _role                                                             +
   )                                                                                +
 $function$                                                                         +
 ;
(6 rows)

