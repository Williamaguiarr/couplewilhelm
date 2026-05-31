CREATE OR REPLACE FUNCTION public.calculate_reserva_liquido_proprietario(p_imovel_id uuid, p_valor_bruto numeric, p_taxa_limpeza numeric, p_comissao_plataforma numeric, p_taxa_comissao_reserva numeric DEFAULT NULL::numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
    v_taxa_comissao NUMERIC;
    v_base_comissao NUMERIC;
    v_comissao_adm NUMERIC;
BEGIN
    -- Se houver taxa específica na reserva, usa ela
    IF p_taxa_comissao_reserva IS NOT NULL THEN
        v_taxa_comissao := p_taxa_comissao_reserva / 100.0;
    ELSE
        -- Senão, busca no imóvel ou no perfil do proprietário
        SELECT 
            COALESCE(i.taxa_comissao, p.comissao_percentual, 25) / 100.0
        INTO v_taxa_comissao
        FROM imoveis i
        LEFT JOIN profiles p ON i.proprietario_id = p.id
        WHERE i.id = p_imovel_id;
    END IF;

    -- Nova Regra: Base Comissão ADM = Valor Bruto - Comissão OTA
    v_base_comissao := COALESCE(p_valor_bruto, 0) - COALESCE(p_comissao_plataforma, 0);
    
    -- Comissão ADM = Base Comissão ADM × Percentual ADM (Clamped to 0 if base is negative)
    v_comissao_adm := GREATEST(0, v_base_comissao) * COALESCE(v_taxa_comissao, 0.25);
    
    -- Novo Cálculo Proprietário: Valor Bruto - Comissão OTA - Comissão ADM - Taxa de Limpeza
    RETURN COALESCE(p_valor_bruto, 0) - COALESCE(p_comissao_plataforma, 0) - v_comissao_adm - COALESCE(p_taxa_limpeza, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_reserva_financeiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_taxa_comissao NUMERIC;
    v_base_comissao NUMERIC;
    v_comissao_adm NUMERIC;
    v_financial_changed BOOLEAN;
BEGIN
    -- 1. Determina se houve mudança em campos financeiros fundamentais
    v_financial_changed := (TG_OP = 'INSERT') OR
        (OLD.valor_bruto IS DISTINCT FROM NEW.valor_bruto OR
         OLD.taxa_limpeza IS DISTINCT FROM NEW.taxa_limpeza OR
         OLD.comissao_plataforma IS DISTINCT FROM NEW.comissao_plataforma);

    -- 2. TRAVA FINANCEIRA: Se a reserva já está auditada, impede alterações nos campos financeiros
    IF (TG_OP = 'UPDATE') THEN
        IF OLD.auditada = TRUE AND NEW.auditada = TRUE THEN
            -- Se houve tentativa de mudar campos financeiros, reverte para o valor auditado
            IF v_financial_changed OR 
               (OLD.taxa_comissao_reserva IS DISTINCT FROM NEW.taxa_comissao_reserva OR
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

    -- 3. CASO ESPECIAL: Apenas Auditoria (Marcar como auditada sem mudar valores base)
    IF (TG_OP = 'UPDATE') AND NOT v_financial_changed AND (OLD.auditada = FALSE AND NEW.auditada = TRUE) THEN
        -- Se não tem snapshot, cria um a partir do estado atual da reserva ou taxa informada
        IF NEW.percentual_comissao_aplicado IS NULL THEN
            NEW.percentual_comissao_aplicado := COALESCE(
                NEW.taxa_comissao_reserva, 
                ROUND((NEW.valor_comissao_admin / NULLIF(NEW.valor_base_comissao, 0) * 100)::numeric, 1),
                25
            );
        END IF;
        NEW.taxa_comissao_reserva := NEW.percentual_comissao_aplicado;
        
        -- Garante que valor_base_comissao esteja preenchido se possível (usando nova regra)
        IF NEW.valor_base_comissao IS NULL THEN
            NEW.valor_base_comissao := COALESCE(NEW.valor_bruto, 0) - COALESCE(NEW.comissao_plataforma, 0);
        END IF;

        RETURN NEW;
    END IF;

    -- 4. Proteção contra recálculos acidentais em UPDATES de campos não financeiros
    -- Adicionado check: se o percentual de comissão mudou, devemos recalcular
    IF (TG_OP = 'UPDATE') 
       AND NOT v_financial_changed 
       AND (OLD.auditada = NEW.auditada) 
       AND (NEW.taxa_comissao_reserva IS NOT DISTINCT FROM OLD.taxa_comissao_reserva)
       AND (NEW.percentual_comissao_aplicado IS NOT DISTINCT FROM OLD.percentual_comissao_aplicado) THEN
        RETURN NEW;
    END IF;

    -- 5. SNAPSHOT FINANCEIRO E MANUAL OVERRIDE
    -- Se a taxa manual mudou, atualiza o snapshot
    IF (TG_OP = 'UPDATE') AND (NEW.taxa_comissao_reserva IS DISTINCT FROM OLD.taxa_comissao_reserva) THEN
        NEW.percentual_comissao_aplicado := NEW.taxa_comissao_reserva;
    END IF;

    -- Se ainda não tem snapshot, busca a regra atual
    IF NEW.percentual_comissao_aplicado IS NULL THEN
        IF TG_OP = 'INSERT' THEN
            SELECT COALESCE(i.taxa_comissao, p.comissao_percentual, 25)
            INTO v_taxa_comissao
            FROM imoveis i
            LEFT JOIN profiles p ON i.proprietario_id = p.id
            WHERE i.id = NEW.imovel_id;
            
            NEW.percentual_comissao_aplicado := v_taxa_comissao;
            NEW.taxa_comissao_reserva := v_taxa_comissao;
        ELSE
            -- Para UPDATES sem snapshot, tenta deduzir
            NEW.percentual_comissao_aplicado := COALESCE(
                NEW.taxa_comissao_reserva,
                ROUND((NEW.valor_comissao_admin / NULLIF(NEW.valor_base_comissao, 0) * 100)::numeric, 1),
                25
            );
            NEW.taxa_comissao_reserva := NEW.percentual_comissao_aplicado;
        END IF;
    END IF;

    v_taxa_comissao := NEW.percentual_comissao_aplicado;
    NEW.taxa_comissao_reserva := v_taxa_comissao;

    -- 6. Recálculo Financeiro (Nova Regra)
    -- Base Comissão ADM = Valor Bruto - Comissão OTA
    NEW.valor_base_comissao := COALESCE(NEW.valor_bruto, 0) - COALESCE(NEW.comissao_plataforma, 0);
    
    -- Comissão ADM = Base Comissão ADM * Taxa do Snapshot (Mínimo 0)
    NEW.valor_comissao_admin := GREATEST(0, NEW.valor_base_comissao) * (COALESCE(v_taxa_comissao, 25) / 100.0);
    
    -- Proprietário = Valor Bruto - Comissão OTA - Comissão ADM - Taxa de Limpeza
    NEW.valor_liquido_proprietario := COALESCE(NEW.valor_bruto, 0) - COALESCE(NEW.comissao_plataforma, 0) - NEW.valor_comissao_admin - COALESCE(NEW.taxa_limpeza, 0);

    RETURN NEW;
END;
$function$;