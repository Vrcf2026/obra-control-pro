
-- Add orcamento_cliente to obras
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS orcamento_cliente NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Simplify rubricas: drop tipo and orcamento_cliente
ALTER TABLE public.rubricas DROP COLUMN IF EXISTS tipo;
ALTER TABLE public.rubricas DROP COLUMN IF EXISTS orcamento_cliente;

-- Simplify lancamentos: drop num_homens and num_documento
ALTER TABLE public.lancamentos DROP COLUMN IF EXISTS num_homens;
ALTER TABLE public.lancamentos DROP COLUMN IF EXISTS num_documento;

-- Add FK constraint on lancamentos.rubrica_id if missing (already referenced via existing FK)
-- (Existing schema already has FK lancamentos_rubrica_id_fkey)
