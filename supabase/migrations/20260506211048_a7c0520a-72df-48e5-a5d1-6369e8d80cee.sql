ALTER TABLE public.adendas ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'extra';
ALTER TABLE public.adendas ADD CONSTRAINT adendas_tipo_check CHECK (tipo IN ('extra', 'principal'));