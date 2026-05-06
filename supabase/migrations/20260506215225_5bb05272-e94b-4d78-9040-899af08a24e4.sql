CREATE TABLE public.obra_estado_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  estado_anterior TEXT,
  estado_novo TEXT NOT NULL,
  alterado_por UUID REFERENCES auth.users(id),
  alterado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obra_estado_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin e gestor vêem log" ON public.obra_estado_log FOR SELECT TO authenticated USING (public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "Admin insere log" ON public.obra_estado_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_obra_estado_log_obra ON public.obra_estado_log(obra_id, alterado_em DESC);