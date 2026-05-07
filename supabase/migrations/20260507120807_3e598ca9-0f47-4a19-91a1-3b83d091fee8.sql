GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_gestor(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_obra(uuid, uuid) TO authenticated, anon;