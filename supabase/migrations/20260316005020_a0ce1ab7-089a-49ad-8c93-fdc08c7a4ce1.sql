ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS ical_url_airbnb text;
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS ical_url_booking text;
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS ical_last_sync timestamptz;