
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('owner', 'reviewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Ideas
CREATE TYPE public.idea_status AS ENUM ('draft','generating','ready','shipping','shipped','failed','blocked_native');

CREATE TABLE public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status public.idea_status NOT NULL DEFAULT 'draft',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ideas TO authenticated;
GRANT ALL ON public.ideas TO service_role;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own ideas: select" ON public.ideas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own ideas: insert" ON public.ideas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own ideas: update" ON public.ideas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own ideas: delete" ON public.ideas FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER ideas_updated_at BEFORE UPDATE ON public.ideas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Patches
CREATE TYPE public.patch_status AS ENUM ('pending','ready','blocked_native','failed');

CREATE TABLE public.patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.patch_status NOT NULL DEFAULT 'pending',
  model TEXT,
  prompt TEXT,
  diff TEXT,
  files_changed TEXT[],
  blocked_reason TEXT,
  cost_credits NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patches TO authenticated;
GRANT ALL ON public.patches TO service_role;
ALTER TABLE public.patches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own patches: select" ON public.patches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own patches: insert" ON public.patches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own patches: update" ON public.patches FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own patches: delete" ON public.patches FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER patches_updated_at BEFORE UPDATE ON public.patches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Deployments
CREATE TYPE public.deployment_status AS ENUM ('queued','building','updating','success','failed','rolled_back');

CREATE TABLE public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id UUID REFERENCES public.patches(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.deployment_status NOT NULL DEFAULT 'queued',
  branch TEXT,
  commit_sha TEXT,
  pr_url TEXT,
  workflow_run_id TEXT,
  eas_update_id TEXT,
  eas_update_group_id TEXT,
  rollback_of UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deployments TO authenticated;
GRANT ALL ON public.deployments TO service_role;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own deployments: select" ON public.deployments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own deployments: insert" ON public.deployments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own deployments: update" ON public.deployments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER deployments_updated_at BEFORE UPDATE ON public.deployments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-assign 'owner' role on first user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
