-- Revogar execução pública de funções críticas (Segurança SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_comissao_percentual() FROM PUBLIC;

-- Garantir execução apenas para usuários autenticados e service_role
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_comissao_percentual() TO authenticated, service_role;
