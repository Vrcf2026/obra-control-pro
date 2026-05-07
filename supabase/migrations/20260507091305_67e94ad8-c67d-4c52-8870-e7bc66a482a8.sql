CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  nif TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados vêem clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gere clientes" ON public.clientes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.obras ADD COLUMN cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;
CREATE INDEX idx_obras_cliente_id ON public.obras(cliente_id);