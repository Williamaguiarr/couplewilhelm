-- Add new columns to reservas table
ALTER TABLE public.reservas 
ADD COLUMN auditada BOOLEAN DEFAULT FALSE,
ADD COLUMN auditada_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN auditada_por UUID REFERENCES auth.users(id),
ADD COLUMN valor_comissao_admin NUMERIC,
ADD COLUMN valor_base_comissao NUMERIC;

-- Create historico_auditoria table
CREATE TABLE public.historico_auditoria (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reserva_id UUID NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES auth.users(id),
    data_auditoria TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    valores_anteriores JSONB,
    valores_congelados JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Use GRANT to set permissions
GRANT SELECT, INSERT ON public.historico_auditoria TO authenticated;
GRANT ALL ON public.historico_auditoria TO service_role;

-- Enable RLS
ALTER TABLE public.historico_auditoria ENABLE ROW LEVEL SECURITY;

-- Create policies for historico_auditoria
CREATE POLICY "Users can view audit history" 
ON public.historico_auditoria 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert audit history" 
ON public.historico_auditoria 
FOR INSERT 
WITH CHECK (auth.uid() = usuario_id);

-- Create a function to block updates on audited bookings for financial fields
CREATE OR REPLACE FUNCTION public.check_audited_booking_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.auditada = TRUE AND NEW.auditada = TRUE THEN
        -- Check if any financial or core fields are being changed
        IF (OLD.valor_bruto IS DISTINCT FROM NEW.valor_bruto OR
            OLD.taxa_limpeza IS DISTINCT FROM NEW.taxa_limpeza OR
            OLD.comissao_plataforma IS DISTINCT FROM NEW.comissao_plataforma OR
            OLD.taxa_comissao_reserva IS DISTINCT FROM NEW.taxa_comissao_reserva OR
            OLD.valor_liquido_proprietario IS DISTINCT FROM NEW.valor_liquido_proprietario OR
            OLD.valor_comissao_admin IS DISTINCT FROM NEW.valor_comissao_admin OR
            OLD.valor_base_comissao IS DISTINCT FROM NEW.valor_base_comissao OR
            OLD.data_inicio IS DISTINCT FROM NEW.data_inicio OR
            OLD.data_fim IS DISTINCT FROM NEW.data_fim OR
            OLD.imovel_id IS DISTINCT FROM NEW.imovel_id) THEN
            RAISE EXCEPTION 'Reserva auditada não pode ser alterada manualmente nos campos financeiros.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for blocking updates
CREATE TRIGGER trg_check_audited_booking_update
BEFORE UPDATE ON public.reservas
FOR EACH ROW
EXECUTE FUNCTION public.check_audited_booking_update();
