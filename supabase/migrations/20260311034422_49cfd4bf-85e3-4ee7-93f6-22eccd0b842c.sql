
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
BEGIN
  -- Criar usuário Leonardo no auth
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data,
    created_at, updated_at, role, aud
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'leoaraujodeoliveira@gmail.com',
    crypt('ledtruck', gen_salt('bf')),
    now(),
    '{"nome": "Leonardo Araújo"}'::jsonb,
    now(), now(),
    'authenticated', 'authenticated'
  );

  -- Perfil
  INSERT INTO public.profiles (id, email, nome)
  VALUES (v_user_id, 'leoaraujodeoliveira@gmail.com', 'Leonardo Araújo')
  ON CONFLICT (id) DO UPDATE SET nome = 'Leonardo Araújo', email = 'leoaraujodeoliveira@gmail.com';

  -- Role de proprietário
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'proprietario')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
