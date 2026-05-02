-- 1. Adicionar ical_uid na tabela de reservas para rastreio
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS ical_uid TEXT;
CREATE INDEX IF NOT EXISTS idx_reservas_ical_uid ON public.reservas(ical_uid);

-- 2. Atualizar ganhos_extras para suportar vinculação e regimes de comissão
DO $$ 
BEGIN 
  -- Adicionar reserva_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ganhos_extras' AND column_name = 'reserva_id') THEN
    ALTER TABLE public.ganhos_extras ADD COLUMN reserva_id UUID REFERENCES public.reservas(id) ON DELETE CASCADE;
  END IF;

  -- Adicionar regime_comissao se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ganhos_extras' AND column_name = 'regime_comissao') THEN
    ALTER TABLE public.ganhos_extras ADD COLUMN regime_comissao TEXT DEFAULT 'com_comissao';
  END IF;
END $$;

-- 3. Criar tabela de alertas de sincronização iCal (cancelamentos)
CREATE TABLE IF NOT EXISTS public.ical_sync_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reserva_id UUID NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
    imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
    plataforma TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, resolved, dismissed
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.ical_sync_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas para ical_sync_alerts (apenas admins)
CREATE POLICY "Admins can view iCal sync alerts" 
ON public.ical_sync_alerts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'master')
  )
);

CREATE POLICY "Admins can update iCal sync alerts" 
ON public.ical_sync_alerts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'master')
  )
);

CREATE POLICY "Admins can delete iCal sync alerts" 
ON public.ical_sync_alerts 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'master')
  )
);
