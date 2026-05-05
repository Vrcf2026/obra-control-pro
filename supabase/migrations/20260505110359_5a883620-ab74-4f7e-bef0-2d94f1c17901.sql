
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'encarregado');
CREATE TYPE public.obra_estado AS ENUM ('orcamentacao', 'adjudicada', 'em_curso', 'concluida', 'faturada');
CREATE TYPE public.rubrica_tipo AS ENUM ('mao_de_obra', 'materiais', 'subempreitada', 'equipamento', 'outro');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_gestor(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','gestor'))
$$;

-- Obras
CREATE TABLE public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cliente TEXT NOT NULL,
  localizacao TEXT,
  estado obra_estado NOT NULL DEFAULT 'orcamentacao',
  data_inicio DATE,
  data_fim_previsto DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

-- Obra utilizadores
CREATE TABLE public.obra_utilizadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil app_role NOT NULL DEFAULT 'encarregado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, user_id)
);
ALTER TABLE public.obra_utilizadores ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_obra(_user_id UUID, _obra_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.obra_utilizadores WHERE user_id = _user_id AND obra_id = _obra_id)
$$;

-- Rubricas
CREATE TABLE public.rubricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo rubrica_tipo NOT NULL,
  orcamento_cliente NUMERIC(14,2) NOT NULL DEFAULT 0,
  orcamento_interno NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rubricas ENABLE ROW LEVEL SECURITY;

-- Lancamentos
CREATE TABLE public.lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubrica_id UUID NOT NULL REFERENCES public.rubricas(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao TEXT NOT NULL DEFAULT '',
  fornecedor TEXT,
  num_documento TEXT,
  num_homens INTEGER,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  registado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

-- Adendas
CREATE TABLE public.adendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor_cliente NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_interno NUMERIC(14,2) NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.adendas ENABLE ROW LEVEL SECURITY;

-- Trigger: criar profile + role admin para 1º utilizador, encarregado para os restantes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email);

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'encarregado');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== RLS Policies =====

-- profiles
CREATE POLICY "Users see own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Admin manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "Admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- obras
CREATE POLICY "View obras" ON public.obras FOR SELECT TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()) OR public.user_has_obra(auth.uid(), id));
CREATE POLICY "Admin manage obras" ON public.obras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- obra_utilizadores
CREATE POLICY "View obra_utilizadores" ON public.obra_utilizadores FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_gestor(auth.uid()));
CREATE POLICY "Admin manage obra_utilizadores" ON public.obra_utilizadores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- rubricas
CREATE POLICY "View rubricas" ON public.rubricas FOR SELECT TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()) OR public.user_has_obra(auth.uid(), obra_id));
CREATE POLICY "Admin manage rubricas" ON public.rubricas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- lancamentos
CREATE POLICY "View lancamentos" ON public.lancamentos FOR SELECT TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()) OR public.user_has_obra(auth.uid(), obra_id));
CREATE POLICY "Insert lancamentos" ON public.lancamentos FOR INSERT TO authenticated
  WITH CHECK (
    registado_por = auth.uid() AND
    (public.has_role(auth.uid(),'admin') OR public.user_has_obra(auth.uid(), obra_id))
  );
CREATE POLICY "Admin update lancamentos" ON public.lancamentos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete lancamentos" ON public.lancamentos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- adendas
CREATE POLICY "View adendas" ON public.adendas FOR SELECT TO authenticated
  USING (public.is_admin_or_gestor(auth.uid()) OR public.user_has_obra(auth.uid(), obra_id));
CREATE POLICY "Admin manage adendas" ON public.adendas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Indexes
CREATE INDEX idx_lancamentos_rubrica ON public.lancamentos(rubrica_id);
CREATE INDEX idx_lancamentos_obra ON public.lancamentos(obra_id);
CREATE INDEX idx_rubricas_obra ON public.rubricas(obra_id);
CREATE INDEX idx_adendas_obra ON public.adendas(obra_id);
CREATE INDEX idx_obra_user ON public.obra_utilizadores(user_id);
