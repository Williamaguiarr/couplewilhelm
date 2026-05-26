-- Habilita a extensão pg_cron se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agenda a execução da função para as 07:00 BRT (10:00 UTC)
SELECT cron.schedule(
  'send-daily-operational-report',
  '0 10 * * *',
  $$ 
  SELECT net.http_post(
    url := 'https://ogtijrskgwlkqevoencg.supabase.co/functions/v1/send-daily-operational-report',
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) 
  $$
);