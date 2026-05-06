
-- 1. Faturas emitidas
CREATE TABLE public.faturas_emitidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  num_fatura TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.faturas_emitidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View faturas" ON public.faturas_emitidas FOR SELECT TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()) OR public.user_has_obra(auth.uid(), obra_id));

CREATE POLICY "Admin/gestor manage faturas" ON public.faturas_emitidas FOR ALL TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (public.is_admin_or_gestor(auth.uid()));

-- 2. Adenda rubricas
CREATE TABLE public.adenda_rubricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adenda_id UUID NOT NULL REFERENCES public.adendas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.adenda_rubricas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View adenda_rubricas" ON public.adenda_rubricas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adendas a
      WHERE a.id = adenda_id
        AND (public.is_admin_or_gestor(auth.uid()) OR public.user_has_obra(auth.uid(), a.obra_id))
    )
  );

CREATE POLICY "Admin manage adenda_rubricas" ON public.adenda_rubricas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
