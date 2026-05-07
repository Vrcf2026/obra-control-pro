REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_gestor(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_obra(uuid, uuid) FROM authenticated;