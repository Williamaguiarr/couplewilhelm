
CREATE OR REPLACE FUNCTION public.log_reserva_financeiro_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF (OLD.valor_bruto IS DISTINCT FROM NEW.valor_bruto) THEN
        INSERT INTO logs_financeiros_reservas (reserva_id, usuario_id, campo_alterado, valor_anterior, valor_novo)
        VALUES (NEW.id, auth.uid(), 'valor_bruto', OLD.valor_bruto, NEW.valor_bruto);
    END IF;
    IF (OLD.valor_liquido_proprietario IS DISTINCT FROM NEW.valor_liquido_proprietario) THEN
        INSERT INTO logs_financeiros_reservas (reserva_id, usuario_id, campo_alterado, valor_anterior, valor_novo)
        VALUES (NEW.id, auth.uid(), 'valor_liquido_proprietario', OLD.valor_liquido_proprietario, NEW.valor_liquido_proprietario);
    END IF;
    IF (OLD.percentual_comissao_aplicado IS DISTINCT FROM NEW.percentual_comissao_aplicado) THEN
        INSERT INTO logs_financeiros_reservas (reserva_id, usuario_id, campo_alterado, valor_anterior, valor_novo)
        VALUES (NEW.id, auth.uid(), 'percentual_comissao_aplicado', OLD.percentual_comissao_aplicado, NEW.percentual_comissao_aplicado);
    END IF;
    IF (OLD.valor_comissao_admin IS DISTINCT FROM NEW.valor_comissao_admin) THEN
        INSERT INTO logs_financeiros_reservas (reserva_id, usuario_id, campo_alterado, valor_anterior, valor_novo)
        VALUES (NEW.id, auth.uid(), 'valor_comissao_admin', OLD.valor_comissao_admin, NEW.valor_comissao_admin);
    END IF;
    RETURN NEW;
END;
$function$;

-- Garante que inserts via API direta também funcionem para admins/master
DROP POLICY IF EXISTS "Admins podem inserir logs financeiros" ON public.logs_financeiros_reservas;
CREATE POLICY "Admins podem inserir logs financeiros"
ON public.logs_financeiros_reservas
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role)
);

GRANT INSERT, SELECT ON public.logs_financeiros_reservas TO authenticated;
GRANT ALL ON public.logs_financeiros_reservas TO service_role;
