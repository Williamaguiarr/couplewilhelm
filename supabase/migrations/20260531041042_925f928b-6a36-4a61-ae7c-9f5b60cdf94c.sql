CREATE OR REPLACE FUNCTION public.process_reserva_financeiro()
RETURNS TRIGGER AS $$
DECLARE
    v_taxa_comissao NUMERIC;
    v_liquido_base NUMERIC;
    v_financial_changed BOOLEAN;
BEGIN
    -- Determina se houve mudança em campos financeiros
    v_financial_changed := (TG_OP = 'INSERT') OR
        (OLD.valor_bruto IS DISTINCT FROM NEW.valor_bruto OR
         OLD.taxa_limpeza IS DISTINCT FROM NEW.taxa_limpeza OR
         OLD.comissao_plataforma IS DISTINCT FROM NEW.comissao_plataforma OR
         OLD.taxa_comissao_reserva IS DISTINCT FROM NEW.taxa_comissao_reserva OR
         OLD.percentual_comissao_aplicado IS DISTINCT FROM NEW.percentual_comissao_aplicado);

    -- TRAVA FINANCEIRA: Se a reserva já está auditada, impede alterações nos campos financeiros
    IF (TG_OP = 'UPDATE') THEN
        IF OLD.auditada = TRUE AND NEW.auditada = TRUE THEN
            IF v_financial_changed OR 
               (OLD.valor_liquido_proprietario IS DISTINCT FROM NEW.valor_liquido_proprietario OR
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

    -- Se não houve mudança financeira e não está sendo auditada agora, não faz nada
    -- Isso protege reservas históricas de recálculos acidentais em updates de outros campos
    IF (TG_OP = 'UPDATE') AND NOT v_financial_changed AND (OLD.auditada = NEW.auditada) THEN
        RETURN NEW;
    END IF;

    -- SNAPSHOT FINANCEIRO: Captura a taxa de comissão atual
    IF NEW.percentual_comissao_aplicado IS NULL THEN
        -- Se já existe taxa_comissao_reserva, usa ela como snapshot inicial
        IF NEW.taxa_comissao_reserva IS NOT NULL THEN
            NEW.percentual_comissao_aplicado := NEW.taxa_comissao_reserva;
        ELSE
            -- Senão, busca no imóvel/proprietário (apenas para novas ou quando explicitamente solicitado)
            SELECT COALESCE(i.taxa_comissao, p.comissao_percentual, 25)
            INTO v_taxa_comissao
            FROM imoveis i
            LEFT JOIN profiles p ON i.proprietario_id = p.id
            WHERE i.id = NEW.imovel_id;
            
            NEW.percentual_comissao_aplicado := v_taxa_comissao;
            NEW.taxa_comissao_reserva := v_taxa_comissao;
        END IF;
    END IF;

    v_taxa_comissao := NEW.percentual_comissao_aplicado;
    NEW.taxa_comissao_reserva := v_taxa_comissao;

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
