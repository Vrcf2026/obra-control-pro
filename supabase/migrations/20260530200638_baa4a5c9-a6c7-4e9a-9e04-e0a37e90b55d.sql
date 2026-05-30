
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  user_email text,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  dados_antes jsonb,
  dados_depois jsonb
);

CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_entidade ON public.audit_log(entidade, entidade_id);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);

GRANT SELECT, INSERT, DELETE ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view audit_log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete audit_log" ON public.audit_log
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated insert audit_log" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF v_user IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_user;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    BEGIN v_id := (to_jsonb(OLD)->>'id')::uuid; EXCEPTION WHEN OTHERS THEN v_id := NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    BEGIN v_id := (to_jsonb(NEW)->>'id')::uuid; EXCEPTION WHEN OTHERS THEN v_id := NULL; END;
  ELSE
    v_after := to_jsonb(NEW);
    BEGIN v_id := (to_jsonb(NEW)->>'id')::uuid; EXCEPTION WHEN OTHERS THEN v_id := NULL; END;
  END IF;

  INSERT INTO public.audit_log(user_id, user_email, acao, entidade, entidade_id, dados_antes, dados_depois)
  VALUES (v_user, COALESCE(v_email, 'sistema'), TG_OP, TG_TABLE_NAME, v_id, v_before, v_after);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_obras AFTER INSERT OR UPDATE OR DELETE ON public.obras FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_lancamentos AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_rubricas AFTER INSERT OR UPDATE OR DELETE ON public.rubricas FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_adendas AFTER INSERT OR UPDATE OR DELETE ON public.adendas FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_adenda_rubricas AFTER INSERT OR UPDATE OR DELETE ON public.adenda_rubricas FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_faturas_emitidas AFTER INSERT OR UPDATE OR DELETE ON public.faturas_emitidas FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_clientes AFTER INSERT OR UPDATE OR DELETE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_obra_utilizadores AFTER INSERT OR UPDATE OR DELETE ON public.obra_utilizadores FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_rubricas_padrao AFTER INSERT OR UPDATE OR DELETE ON public.rubricas_padrao FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_profiles AFTER UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_audit();
