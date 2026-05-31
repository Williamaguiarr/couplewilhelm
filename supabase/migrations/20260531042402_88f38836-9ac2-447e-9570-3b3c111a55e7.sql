-- Atualiza a função process_reserva_financeiro para proteger reservas históricas
CREATE OR REPLACE FUNCTION public.process_reserva_financeiro()
RETURNS TRIGGER AS $$
DECLARE
    v_taxa_comissao NUMERIC;
    v_liquido_base NUMERIC;
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
    -- Para reservas antigas (sem snapshot), congela os valores ATUAIS sem recalcular com taxas novas.
    IF (TG_OP = 'UPDATE') AND NOT v_financial_changed AND (OLD.auditada = FALSE AND NEW.auditada = TRUE) THEN
        -- Se não tem snapshot, cria um a partir do estado atual da reserva
        IF NEW.percentual_comissao_aplicado IS NULL THEN
            NEW.percentual_comissao_aplicado := COALESCE(
                NEW.taxa_comissao_reserva, 
                ROUND((NEW.valor_comissao_admin / NULLIF(NEW.valor_base_comissao, 0) * 100)::numeric, 1),
                25
            );
        END IF;
        NEW.taxa_comissao_reserva := NEW.percentual_comissao_aplicado;
        
        -- Garante que valor_base_comissao esteja preenchido se possível
        IF NEW.valor_base_comissao IS NULL THEN
            NEW.valor_base_comissao := COALESCE(NEW.valor_bruto, 0) - COALESCE(NEW.taxa_limpeza, 0) - COALESCE(NEW.comissao_plataforma, 0);
        END IF;

        -- Importante: Retorna sem passar pelo bloco de recálculo abaixo
        RETURN NEW;
    END IF;

    -- 4. Proteção contra recálculos acidentais em UPDATES de campos não financeiros
    IF (TG_OP = 'UPDATE') AND NOT v_financial_changed AND (OLD.auditada = NEW.auditada) AND (NEW.taxa_comissao_reserva IS NOT DISTINCT FROM OLD.taxa_comissao_reserva) THEN
        RETURN NEW;
    END IF;

    -- 5. SNAPSHOT FINANCEIRO
    -- Prioriza o snapshot existente se for um UPDATE de reserva antiga/existente
    IF NEW.percentual_comissao_aplicado IS NULL THEN
        IF TG_OP = 'INSERT' THEN
            -- Apenas para NOVAS reservas buscamos a regra atual do imóvel/proprietário
            SELECT COALESCE(i.taxa_comissao, p.comissao_percentual, 25)
            INTO v_taxa_comissao
            FROM imoveis i
            LEFT JOIN profiles p ON i.proprietario_id = p.id
            WHERE i.id = NEW.imovel_id;
            
            NEW.percentual_comissao_aplicado := v_taxa_comissao;
            NEW.taxa_comissao_reserva := v_taxa_comissao;
        ELSE
            -- Para UPDATES de reservas antigas sem snapshot, tentamos manter o que já existe nela
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

    -- 6. Cálculo Financeiro (Garante que se houve mudança, os totais batam com o percentual aplicado)
    v_liquido_base := COALESCE(NEW.valor_bruto, 0) - COALESCE(NEW.taxa_limpeza, 0) - COALESCE(NEW.comissao_plataforma, 0);
    NEW.valor_base_comissao := v_liquido_base;
    
    -- Comissão ADM = Líquido Base * Taxa do Snapshot
    NEW.valor_comissao_admin := v_liquido_base * (COALESCE(v_taxa_comissao, 25) / 100.0);
    
    -- Proprietário = Líquido Base - Comissão ADM
    NEW.valor_liquido_proprietario := v_liquido_base - NEW.valor_comissao_admin;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;