
-- Atualizar senha do admin para a nova senha fornecida
-- (usando crypt do pgcrypto como o Supabase usa internamente)
UPDATE auth.users
SET encrypted_password = crypt('@Brglos141464', gen_salt('bf'))
WHERE id = 'a382465d-0871-4b45-b20b-7626643b1eb9';
