DELETE FROM public.admin_proprietarios
WHERE proprietario_id NOT IN (SELECT id FROM public.profiles);