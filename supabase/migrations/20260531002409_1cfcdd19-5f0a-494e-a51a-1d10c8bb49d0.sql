-- 1. Corrigir plataforma_origem nula para registros com identificadores claros
UPDATE public.reservas
SET plataforma_origem = 'booking'
WHERE plataforma_origem IS NULL 
  AND (observacoes LIKE '[BOOKING]%' OR ical_uid LIKE '%@booking.com');

UPDATE public.reservas
SET plataforma_origem = 'airbnb'
WHERE plataforma_origem IS NULL 
  AND (observacoes LIKE '[AIRBNB]%' OR ical_uid LIKE '%@airbnb.com');

-- 2. Atribuir nomes de hóspedes para reservas da Booking que estão marcadas como "CLOSED - Not available"
UPDATE public.reservas
SET nome_hospede = 'Hóspede Booking'
WHERE plataforma_origem = 'booking'
  AND (nome_hospede IS NULL OR nome_hospede = '')
  AND (observacoes LIKE '%CLOSED - Not available%' OR observacoes LIKE '%[BOOKING] CLOSED%');

-- 3. Atribuir nomes de hóspedes para reservas do Airbnb que estão marcadas como "Reserved" ou similares
UPDATE public.reservas
SET nome_hospede = 'Hóspede Airbnb'
WHERE plataforma_origem = 'airbnb'
  AND (nome_hospede IS NULL OR nome_hospede = '' OR nome_hospede IN ('Reserved', 'Airbnb (Not available)'))
  AND (observacoes LIKE '%[AIRBNB] Reserved%' OR observacoes LIKE '%[AIRBNB] Airbnb (Not available)%');