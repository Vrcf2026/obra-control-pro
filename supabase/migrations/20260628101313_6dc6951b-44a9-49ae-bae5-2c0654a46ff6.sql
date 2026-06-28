
-- =========================================================
-- 1. ANEXOS
-- =========================================================
CREATE TABLE public.anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL CHECK (entidade IN ('obra','lancamento','fatura','fornecedor','cliente')),
  entidade_id uuid NOT NULL,
  nome text NOT NULL,
  path text NOT NULL UNIQUE,
  mime text,
  tamanho bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anexos TO authenticated;
GRANT ALL ON public.anexos TO service_role;

ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;

-- Helper: pode aceder ao anexo?
CREATE OR REPLACE FUNCTION public.pode_ver_anexo(_user_id uuid, _entidade text, _entidade_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obra_id uuid;
BEGIN
  IF public.is_admin_or_gestor(_user_id) THEN
    RETURN true;
  END IF;

  IF _entidade = 'obra' THEN
    v_obra_id := _entidade_id;
  ELSIF _entidade = 'lancamento' THEN
    SELECT obra_id INTO v_obra_id FROM public.lancamentos WHERE id = _entidade_id;
  ELSIF _entidade = 'fatura' THEN
    SELECT obra_id INTO v_obra_id FROM public.faturas_emitidas WHERE id = _entidade_id;
  ELSE
    RETURN false;
  END IF;

  IF v_obra_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.user_has_obra(_user_id, v_obra_id);
END;
$$;

CREATE POLICY "anexos_select" ON public.anexos FOR SELECT TO authenticated
  USING (public.pode_ver_anexo(auth.uid(), entidade, entidade_id));

CREATE POLICY "anexos_insert" ON public.anexos FOR INSERT TO authenticated
  WITH CHECK (public.pode_ver_anexo(auth.uid(), entidade, entidade_id) AND uploaded_by = auth.uid());

CREATE POLICY "anexos_delete" ON public.anexos FOR DELETE TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()) OR uploaded_by = auth.uid());

-- Storage policies (bucket 'anexos' já criado)
CREATE POLICY "anexos_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'anexos'
    AND EXISTS (SELECT 1 FROM public.anexos a WHERE a.path = name AND public.pode_ver_anexo(auth.uid(), a.entidade, a.entidade_id))
  );

CREATE POLICY "anexos_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anexos' AND auth.uid() IS NOT NULL);

CREATE POLICY "anexos_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'anexos'
    AND (
      public.is_admin_or_gestor(auth.uid())
      OR EXISTS (SELECT 1 FROM public.anexos a WHERE a.path = name AND a.uploaded_by = auth.uid())
    )
  );

-- Audit
CREATE TRIGGER tr_anexos_audit
AFTER INSERT OR UPDATE OR DELETE ON public.anexos
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- =========================================================
-- 2. NOTIFICAÇÕES
-- =========================================================
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  corpo text,
  link text,
  lida boolean NOT NULL DEFAULT false,
  chave text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notificacoes_user_lida ON public.notificacoes(user_id, lida, created_at DESC);
CREATE UNIQUE INDEX idx_notificacoes_dedup ON public.notificacoes(user_id, chave) WHERE chave IS NOT NULL;

GRANT SELECT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_own_select" ON public.notificacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notif_own_update" ON public.notificacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "notif_own_delete" ON public.notificacoes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Função geradora
CREATE OR REPLACE FUNCTION public.gerar_notificacoes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
  u record;
BEGIN
  -- 1) Rubricas > 90% do orçamento (custos vs orçamento da rubrica na obra)
  FOR r IN
    SELECT
      o.id AS obra_id, o.nome AS obra_nome,
      rb.id AS rubrica_id, rb.nome AS rubrica_nome,
      COALESCE(SUM(l.valor_total) FILTER (WHERE l.tipo = 'custo'), 0) AS gasto,
      COALESCE(rb.orcamento_total, 0) AS orcamento
    FROM public.obras o
    JOIN public.rubricas rb ON rb.obra_id = o.id
    LEFT JOIN public.lancamentos l ON l.obra_id = o.id AND l.rubrica_id = rb.id
    WHERE o.estado IN ('adjudicada','em_curso')
    GROUP BY o.id, o.nome, rb.id, rb.nome
    HAVING COALESCE(rb.orcamento_total,0) > 0
       AND COALESCE(SUM(l.valor_total) FILTER (WHERE l.tipo = 'custo'),0) / NULLIF(rb.orcamento_total,0) > 0.9
  LOOP
    FOR u IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','gestor')
      UNION
      SELECT user_id FROM public.obra_utilizadores WHERE obra_id = r.obra_id
    LOOP
      INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, link, chave)
      VALUES (
        u.user_id, 'rubrica_orcamento',
        'Rubrica acima de 90% do orçamento',
        format('Obra %s — rubrica "%s": %s%% do orçamento usado.',
               r.obra_nome, r.rubrica_nome,
               round((r.gasto / NULLIF(r.orcamento,0))::numeric * 100, 1)),
        '/obras/' || r.obra_id,
        format('rub90:%s:%s:%s', r.obra_id, r.rubrica_id, to_char(now(), 'YYYY-MM'))
      )
      ON CONFLICT (user_id, chave) WHERE chave IS NOT NULL DO NOTHING;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    END LOOP;
  END LOOP;

  -- 2) Obras sem lançamentos há > 30 dias
  FOR r IN
    SELECT o.id AS obra_id, o.nome AS obra_nome,
           COALESCE(MAX(l.data), o.created_at::date) AS ultimo
    FROM public.obras o
    LEFT JOIN public.lancamentos l ON l.obra_id = o.id
    WHERE o.estado IN ('adjudicada','em_curso')
    GROUP BY o.id, o.nome, o.created_at
    HAVING COALESCE(MAX(l.data), o.created_at::date) < (current_date - 30)
  LOOP
    FOR u IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','gestor')
      UNION
      SELECT user_id FROM public.obra_utilizadores WHERE obra_id = r.obra_id
    LOOP
      INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, link, chave)
      VALUES (
        u.user_id, 'obra_inativa',
        'Obra sem movimentos',
        format('Obra "%s" não tem lançamentos desde %s.', r.obra_nome, r.ultimo),
        '/obras/' || r.obra_id,
        format('inativa:%s:%s', r.obra_id, to_char(now(), 'YYYY-MM-DD'))
      )
      ON CONFLICT (user_id, chave) WHERE chave IS NOT NULL DO NOTHING;
    END LOOP;
  END LOOP;

  -- 3) Faturas emitidas vencidas
  FOR r IN
    SELECT f.id, f.numero, f.obra_id, f.data_vencimento, o.nome AS obra_nome
    FROM public.faturas_emitidas f
    LEFT JOIN public.obras o ON o.id = f.obra_id
    WHERE f.data_vencimento IS NOT NULL
      AND f.data_vencimento < current_date
      AND COALESCE(f.estado, 'emitida') <> 'paga'
  LOOP
    FOR u IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','gestor')
    LOOP
      INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, link, chave)
      VALUES (
        u.user_id, 'fatura_vencida',
        'Fatura vencida',
        format('Fatura %s da obra "%s" venceu em %s.', r.numero, COALESCE(r.obra_nome,'—'), r.data_vencimento),
        CASE WHEN r.obra_id IS NOT NULL THEN '/obras/' || r.obra_id ELSE '/relatorios' END,
        format('fatvenc:%s:%s', r.id, to_char(now(), 'YYYY-MM-DD'))
      )
      ON CONFLICT (user_id, chave) WHERE chave IS NOT NULL DO NOTHING;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_notificacoes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_notificacoes() TO service_role;

-- =========================================================
-- 3. SNAPSHOTS DE MARGEM
-- =========================================================
CREATE TABLE public.obra_snapshots_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  orcamento_total numeric(14,2) NOT NULL DEFAULT 0,
  custo_acumulado numeric(14,2) NOT NULL DEFAULT 0,
  faturado_acumulado numeric(14,2) NOT NULL DEFAULT 0,
  margem numeric(14,2) NOT NULL DEFAULT 0,
  margem_pct numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, ano, mes)
);

CREATE INDEX idx_snap_obra_periodo ON public.obra_snapshots_mensais(obra_id, ano, mes);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_snapshots_mensais TO authenticated;
GRANT ALL ON public.obra_snapshots_mensais TO service_role;

ALTER TABLE public.obra_snapshots_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snap_select" ON public.obra_snapshots_mensais FOR SELECT TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()) OR public.user_has_obra(auth.uid(), obra_id));

CREATE POLICY "snap_manage" ON public.obra_snapshots_mensais FOR ALL TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (public.is_admin_or_gestor(auth.uid()));

-- Função de snapshot
CREATE OR REPLACE FUNCTION public.snapshot_obras_mes(_ano integer, _mes integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fim date := (make_date(_ano, _mes, 1) + interval '1 month - 1 day')::date;
  v_n integer := 0;
BEGIN
  INSERT INTO public.obra_snapshots_mensais
    (obra_id, ano, mes, orcamento_total, custo_acumulado, faturado_acumulado, margem, margem_pct)
  SELECT
    o.id,
    _ano, _mes,
    COALESCE(o.valor_adjudicado, 0) AS orcamento_total,
    COALESCE((SELECT SUM(valor_total) FROM public.lancamentos
              WHERE obra_id = o.id AND tipo = 'custo' AND data <= v_fim), 0) AS custo,
    COALESCE((SELECT SUM(valor_total) FROM public.faturas_emitidas
              WHERE obra_id = o.id AND data_emissao <= v_fim), 0) AS faturado,
    COALESCE((SELECT SUM(valor_total) FROM public.faturas_emitidas
              WHERE obra_id = o.id AND data_emissao <= v_fim), 0)
    - COALESCE((SELECT SUM(valor_total) FROM public.lancamentos
                WHERE obra_id = o.id AND tipo = 'custo' AND data <= v_fim), 0) AS margem,
    CASE WHEN COALESCE((SELECT SUM(valor_total) FROM public.faturas_emitidas
                        WHERE obra_id = o.id AND data_emissao <= v_fim), 0) > 0
         THEN round((
              (COALESCE((SELECT SUM(valor_total) FROM public.faturas_emitidas
                         WHERE obra_id = o.id AND data_emissao <= v_fim), 0)
               - COALESCE((SELECT SUM(valor_total) FROM public.lancamentos
                           WHERE obra_id = o.id AND tipo = 'custo' AND data <= v_fim), 0))
              / NULLIF((SELECT SUM(valor_total) FROM public.faturas_emitidas
                        WHERE obra_id = o.id AND data_emissao <= v_fim), 0)
              * 100)::numeric, 2)
         ELSE NULL END
  FROM public.obras o
  ON CONFLICT (obra_id, ano, mes) DO UPDATE SET
    orcamento_total = EXCLUDED.orcamento_total,
    custo_acumulado = EXCLUDED.custo_acumulado,
    faturado_acumulado = EXCLUDED.faturado_acumulado,
    margem = EXCLUDED.margem,
    margem_pct = EXCLUDED.margem_pct;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_obras_mes(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_obras_mes(integer, integer) TO service_role;
