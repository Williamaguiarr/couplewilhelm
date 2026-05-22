
-- 1. Coluna de validação financeira
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS validada_financeiramente boolean NOT NULL DEFAULT true;

-- 2. Backfill: marcar reservas iCal sem valor como pendentes
UPDATE public.reservas
   SET validada_financeiramente = false
 WHERE valor_bruto IS NULL
   AND plataforma_origem IN ('airbnb', 'booking');

-- 3. Trigger: auto definir validação na inserção/atualização
CREATE OR REPLACE FUNCTION public.set_reserva_validacao_financeira()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_set_reserva_validacao_financeira ON public.reservas;
CREATE TRIGGER trg_set_reserva_validacao_financeira
  BEFORE INSERT OR UPDATE OF valor_bruto, plataforma_origem ON public.reservas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reserva_validacao_financeira();

-- 4. RLS: proprietário só vê reservas validadas
DROP POLICY IF EXISTS "Proprietario pode ver reservas dos proprios imoveis" ON public.reservas;
CREATE POLICY "Proprietario pode ver reservas dos proprios imoveis"
  ON public.reservas
  FOR SELECT
  TO authenticated
  USING (
    validada_financeiramente = true
    AND EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = reservas.imovel_id
        AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
    )
  );

-- 5. RLS: proprietário só vê limpezas vinculadas a reservas validadas
DROP POLICY IF EXISTS "Proprietario pode ver limpezas dos proprios imoveis" ON public.limpezas;
CREATE POLICY "Proprietario pode ver limpezas dos proprios imoveis"
  ON public.limpezas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = limpezas.imovel_id
        AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
    )
    AND (
      limpezas.reserva_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.reservas r
        WHERE r.id = limpezas.reserva_id
          AND r.validada_financeiramente = true
      )
    )
  );

-- 6. RLS: proprietário só vê ganhos extras de reservas validadas (ou ganhos sem reserva vinculada)
DROP POLICY IF EXISTS "Proprietario pode ver ganhos extras dos proprios imoveis" ON public.ganhos_extras;
CREATE POLICY "Proprietario pode ver ganhos extras dos proprios imoveis"
  ON public.ganhos_extras
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = ganhos_extras.imovel_id
        AND (i.proprietario_id = auth.uid() OR i.proprietario_id_2 = auth.uid())
    )
    AND (
      ganhos_extras.reserva_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.reservas r
        WHERE r.id = ganhos_extras.reserva_id
          AND r.validada_financeiramente = true
      )
    )
  );

-- 7. Índice para performance
CREATE INDEX IF NOT EXISTS idx_reservas_validada ON public.reservas(validada_financeiramente);
