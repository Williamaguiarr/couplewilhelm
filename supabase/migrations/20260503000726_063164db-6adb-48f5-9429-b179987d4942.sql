ALTER TABLE public.reservas 
ADD COLUMN taxa_comissao_reserva NUMERIC(5,2);

COMMENT ON COLUMN public.reservas.taxa_comissao_reserva IS 'Taxa de comissão personalizada para esta reserva específica. Se NULL, usa a comissão padrão.';