-- Função para calcular o valor líquido do proprietário de uma reserva
CREATE OR REPLACE FUNCTION calculate_reserva_liquido_proprietario(
    p_imovel_id UUID,
    p_valor_bruto NUMERIC,
    p_taxa_limpeza NUMERIC,
    p_comissao_plataforma NUMERIC,
    p_taxa_comissao_reserva NUMERIC DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
    v_taxa_comissao NUMERIC;
    v_proprietario_id UUID;
    v_liquido_base NUMERIC;
BEGIN
    -- Se o valor bruto for nulo ou zero, o líquido é zero
    IF p_valor_bruto IS NULL OR p_valor_bruto = 0 THEN
        RETURN 0;
    END IF;

    -- Se houver taxa específica na reserva, usa ela
    IF p_taxa_comissao_reserva IS NOT NULL THEN
        v_taxa_comissao := p_taxa_comissao_reserva / 100;
    ELSE
        -- Senão, busca no imóvel ou no perfil do proprietário
        SELECT 
            COALESCE(i.taxa_comissao, p.comissao_percentual, 25) / 100.0,
            i.proprietario_id
        INTO v_taxa_comissao, v_proprietario_id
        FROM imoveis i
        LEFT JOIN profiles p ON i.proprietario_id = p.id
        WHERE i.id = p_imovel_id;
    END IF;

    -- Cálculo: Bruto - Limpeza - Plataforma = Líquido Base
    -- Comissão ADM = Líquido Base * Taxa
    -- Proprietário = Líquido Base - Comissão ADM
    v_liquido_base := COALESCE(p_valor_bruto, 0) - COALESCE(p_taxa_limpeza, 0) - COALESCE(p_comissao_plataforma, 0);
    
    RETURN v_liquido_base * (1 - COALESCE(v_taxa_comissao, 0.25));
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger para atualizar automaticamente o valor líquido
CREATE OR REPLACE FUNCTION trigger_update_reserva_liquido()
RETURNS TRIGGER AS $$
BEGIN
    NEW.valor_liquido_proprietario := calculate_reserva_liquido_proprietario(
        NEW.imovel_id,
        NEW.valor_bruto,
        NEW.taxa_limpeza,
        NEW.comissao_plataforma,
        NEW.taxa_comissao_reserva
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_reserva_liquido ON reservas;
CREATE TRIGGER trg_update_reserva_liquido
BEFORE INSERT OR UPDATE OF valor_bruto, taxa_limpeza, comissao_plataforma, taxa_comissao_reserva, imovel_id
ON reservas
FOR EACH ROW
EXECUTE FUNCTION trigger_update_reserva_liquido();

-- Atualizar todos os registros atuais para garantir consistência
UPDATE reservas SET id = id;

-- Função para calcular a previsão futura de um proprietário
CREATE OR REPLACE FUNCTION calculate_owner_future_forecast(p_owner_id UUID, p_imovel_id UUID DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
    v_limit_date DATE;
    v_total NUMERIC;
BEGIN
    -- Regra: Hoje até o final dos próximos 3 meses completos
    -- Ex: Se hoje é 15/Mai, vai até 31/Ago
    v_limit_date := (date_trunc('month', CURRENT_DATE) + interval '4 months' - interval '1 day')::date;

    SELECT COALESCE(SUM(valor_liquido_proprietario), 0)
    INTO v_total
    FROM reservas r
    JOIN imoveis i ON r.imovel_id = i.id
    WHERE (i.proprietario_id = p_owner_id OR i.proprietario_id_2 = p_owner_id)
      AND (p_imovel_id IS NULL OR r.imovel_id = p_imovel_id)
      AND r.data_fim >= CURRENT_DATE
      AND r.data_fim <= v_limit_date;

    RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;
