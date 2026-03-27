
ALTER TABLE public.profiles ADD COLUMN comissao_percentual numeric NOT NULL DEFAULT 25;

CREATE OR REPLACE FUNCTION public.validate_comissao_percentual()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.comissao_percentual < 0 OR NEW.comissao_percentual > 100 THEN
    RAISE EXCEPTION 'comissao_percentual must be between 0 and 100';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_comissao_percentual
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_comissao_percentual();
