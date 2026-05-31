-- Remove a agenda antiga de 30 minutos
SELECT cron.unschedule('ical-sync-every-30min');

-- Cria a nova agenda de 10 minutos
SELECT cron.schedule(
  'ical-sync-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogtijrskgwlkqevoencg.supabase.co/functions/v1/ical-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndGlqcnNrZ3dsa3Fldm9lbmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTYyNzUsImV4cCI6MjA4ODc3MjI3NX0.BTrQHKVNLXXDVqnBqSj263_gJtqfs0OL2qPy0fzYgkE"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);