
-- Atualizar email e nome do admin existente
UPDATE auth.users 
SET email = 'couplewilhelm@outlook.com',
    raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{nome}', '"Couple Wilhelm"')
WHERE id = 'a382465d-0871-4b45-b20b-7626643b1eb9';

UPDATE public.profiles
SET email = 'couplewilhelm@outlook.com',
    nome = 'Couple Wilhelm'
WHERE id = 'a382465d-0871-4b45-b20b-7626643b1eb9';
