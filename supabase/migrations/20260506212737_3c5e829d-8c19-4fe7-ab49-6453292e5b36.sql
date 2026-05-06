CREATE TABLE public.rubricas_padrao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rubricas_padrao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos autenticados podem ver" ON public.rubricas_padrao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Só admin gere" ON public.rubricas_padrao FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.rubricas_padrao (nome, ordem) VALUES
  ('Mão de obra própria', 1),
  ('Mão de obra subempreitada', 2),
  ('Materiais', 3),
  ('Equipamentos e aluguer', 4),
  ('Transportes', 5),
  ('Segurança e EPI', 6),
  ('Topografia e levantamentos', 7),
  ('Ensaios e fiscalização', 8),
  ('Imprevistos', 9);