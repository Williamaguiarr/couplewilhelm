
-- Esta migration não cria usuários no auth (só o Supabase Auth Admin API pode fazer isso)
-- Verificar estado atual
SELECT id, email FROM auth.users ORDER BY created_at;
