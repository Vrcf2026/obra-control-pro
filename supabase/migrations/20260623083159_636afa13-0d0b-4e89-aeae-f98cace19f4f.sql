
-- Lock down SECURITY DEFINER functions: only callable where strictly needed
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_audit() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin_or_gestor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_gestor(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.user_has_obra(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_obra(uuid, uuid) TO authenticated;

-- Remove overly permissive INSERT policy on audit_log; trigger (SECURITY DEFINER) handles inserts
DROP POLICY IF EXISTS "Authenticated insert audit_log" ON public.audit_log;
