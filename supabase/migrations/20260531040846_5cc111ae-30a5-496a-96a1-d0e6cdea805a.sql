-- 1. Create financial logs table
CREATE TABLE IF NOT EXISTS public.logs_financeiros_reservas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reserva_id UUID NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
    usuario_id UUID,
    campo_alterado TEXT NOT NULL,
    valor_anterior NUMERIC,
    valor_novo NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Permissions for the logs table
GRANT SELECT, INSERT ON public.logs_financeiros_reservas TO authenticated;
GRANT ALL ON public.logs_financeiros_reservas TO service_role;

-- Enable RLS
ALTER TABLE public.logs_financeiros_reservas ENABLE ROW LEVEL SECURITY;

-- Policy for logs visibility (Admins only)
CREATE POLICY "Logs financeiros são visíveis por admins"
ON public.logs_financeiros_reservas
FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 2. Add requested snapshot column if it doesn't exist (using user's preferred name)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'percentual_comissao_aplicado') THEN
        ALTER TABLE public.reservas ADD COLUMN percentual_comissao_aplicado NUMERIC;
    END IF;
END $$;

-- 3. Consolidated financial calculation and snapshot function
CREATE OR REPLACE FUNCTION public.process_reserva_financeiro()
RETURNS TRIGGER AS $$
DECLARE
    v_taxa_comissao NUMERIC;
    v_liquido_base NUMERIC;
BEGIN
    -- TRAVA FINANCEIRA: Se a reserva já está auditada, impede alterações nos campos financeiros
    IF (TG_OP = 'UPDATE') THEN
        IF OLD.auditada = TRUE AND NEW.auditada = TRUE THEN
            -- Se algum campo financeiro mudou, reverte para o valor antigo
            IF (OLD.valor_bruto IS DISTINCT FROM NEW.valor_bruto OR
                OLD.taxa_limpeza IS DISTINCT FROM NEW.taxa_limpeza OR
                OLD.comissao_plataforma IS DISTINCT FROM NEW.comissao_plataforma OR
                OLD.taxa_comissao_reserva IS DISTINCT FROM NEW.taxa_comissao_reserva OR
                OLD.percentual_comissao_aplicado IS DISTINCT FROM NEW.percentual_comissao_aplicado OR
                OLD.valor_liquido_proprietario IS DISTINCT FROM NEW.valor_liquido_proprietario OR
                OLD.valor_comissao_admin IS DISTINCT FROM NEW.valor_comissao_admin OR
                OLD.valor_base_comissao IS DISTINCT FROM NEW.valor_base_comissao) THEN
                
                NEW.valor_bruto := OLD.valor_bruto;
                NEW.taxa_limpeza := OLD.taxa_limpeza;
                NEW.comissao_plataforma := OLD.comissao_plataforma;
                NEW.taxa_comissao_reserva := OLD.taxa_comissao_reserva;
                NEW.percentual_comissao_aplicado := OLD.percentual_comissao_aplicado;
                NEW.valor_liquido_proprietario := OLD.valor_liquido_proprietario;
                NEW.valor_comissao_admin := OLD.valor_comissao_admin;
                NEW.valor_base_comissao := OLD.valor_base_comissao;
            END IF;
            RETURN NEW;
        END IF;
    END IF;

    -- SNAPSHOT FINANCEIRO: Captura a taxa de comissão atual se não estiver definida
    -- Prioriza percentual_comissao_aplicado, depois taxa_comissao_reserva
    IF NEW.percentual_comissao_aplicado IS NULL AND NEW.taxa_comissao_reserva IS NOT NULL THEN
        NEW.percentual_comissao_aplicado := NEW.taxa_comissao_reserva;
    END IF;

    IF NEW.percentual_comissao_aplicado IS NULL THEN
        SELECT COALESCE(i.taxa_comissao, p.comissao_percentual, 25)
        INTO v_taxa_comissao
        FROM imoveis i
        LEFT JOIN profiles p ON i.proprietario_id = p.id
        WHERE i.id = NEW.imovel_id;
        
        NEW.percentual_comissao_aplicado := v_taxa_comissao;
        NEW.taxa_comissao_reserva := v_taxa_comissao;
    ELSE
        v_taxa_comissao := NEW.percentual_comissao_aplicado;
        NEW.taxa_comissao_reserva := v_taxa_comissao;
    END IF;

    -- Cálculo base
    v_liquido_base := COALESCE(NEW.valor_bruto, 0) - COALESCE(NEW.taxa_limpeza, 0) - COALESCE(NEW.comissao_plataforma, 0);
    NEW.valor_base_comissao := v_liquido_base;
    
    -- Comissão ADM = Líquido Base * Taxa
    NEW.valor_comissao_admin := v_liquido_base * (COALESCE(v_taxa_comissao, 25) / 100.0);
    
    -- Proprietário = Líquido Base - Comissão ADM
    NEW.valor_liquido_proprietario := v_liquido_base - NEW.valor_comissao_admin;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4. Re-mapping triggers
-- Remove triggers que podem causar recálculos conflitantes
DROP TRIGGER IF EXISTS trg_update_reserva_liquido ON public.reservas;
DROP TRIGGER IF EXISTS trg_check_audited_booking_update ON public.reservas;

-- New consolidated trigger
CREATE TRIGGER trg_reserva_financeiro_main
BEFORE INSERT OR UPDATE ON public.reservas
FOR EACH ROW
EXECUTE FUNCTION process_reserva_financeiro();

-- 5. Logging function for financial changes
CREATE OR REPLACE FUNCTION public.log_reserva_financeiro_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log changes only for non-audited or newly audited bookings
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for logging
DROP TRIGGER IF EXISTS trg_log_reserva_financeiro ON public.reservas;
CREATE TRIGGER trg_log_reserva_financeiro
AFTER UPDATE ON public.reservas
FOR EACH ROW
WHEN (OLD.auditada IS NOT TRUE OR NEW.auditada IS DISTINCT FROM OLD.auditada)
EXECUTE FUNCTION log_reserva_financeiro_changes();
