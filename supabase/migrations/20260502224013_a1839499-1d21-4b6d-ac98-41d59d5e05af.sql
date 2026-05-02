ALTER TABLE public.imoveis ADD COLUMN taxa_comissao NUMERIC;

COMMENT ON COLUMN public.imoveis.taxa_comissao IS 'Taxa de comissão específica para este imóvel (0 a 100). Se nulo, usa a taxa do proprietário.';