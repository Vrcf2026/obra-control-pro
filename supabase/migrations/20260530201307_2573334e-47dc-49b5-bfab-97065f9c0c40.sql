
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['obras','lancamentos','rubricas','adendas','adenda_rubricas','faturas_emitidas','clientes','user_roles','obra_utilizadores','rubricas_padrao','profiles'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit()', t, t);
  END LOOP;
END $$;
