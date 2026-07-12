
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

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;-- Drop old pipeline tables (patches, deployments) — replaced by GitHub-Issue-Flow
DROP TABLE IF EXISTS public.deployments CASCADE;
DROP TABLE IF EXISTS public.patches CASCADE;
DROP TYPE IF EXISTS public.deployment_status;
DROP TYPE IF EXISTS public.patch_status;

-- Intent picker enum
CREATE TYPE public.contribution_intent AS ENUM ('wording', 'look', 'wrong', 'idea');

-- Extend idea_status with new lifecycle values (must be committed before use)
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'saved';
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'reviewing';
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'live';
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'reverted';
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'blocked';

-- Extend ideas table with structured contribution fields + GitHub tracking
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS intent public.contribution_intent,
  ADD COLUMN IF NOT EXISTS screen text,
  ADD COLUMN IF NOT EXISTS wrong text,
  ADD COLUMN IF NOT EXISTS should text,
  ADD COLUMN IF NOT EXISTS req_id text,
  ADD COLUMN IF NOT EXISTS github_issue_number integer,
  ADD COLUMN IF NOT EXISTS github_issue_url text,
  ADD COLUMN IF NOT EXISTS github_pr_number integer,
  ADD COLUMN IF NOT EXISTS github_pr_url text,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS last_polled_at timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS ideas_req_id_key ON public.ideas (req_id) WHERE req_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ideas_user_created_idx ON public.ideas (user_id, created_at DESC);-- BDC engine migration — additive only. Adds the living-config + provenance-log
-- tables for the OpenRouter own-harness. Does NOT touch ideas / user_roles.

-- ---------- app_config: single-row living rules (no redeploy to change) ----------
CREATE TABLE IF NOT EXISTS public.app_config (
  id boolean PRIMARY KEY DEFAULT true,          -- single-row table: id is always true
  routing_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  forbidden_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  prompt_template text NOT NULL DEFAULT '',
  template_version text NOT NULL DEFAULT 'v1',
  bdc_paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_config_singleton CHECK (id = true)
);
GRANT SELECT ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- Any authenticated (allow-listed) user may READ the config; only service_role writes.
CREATE POLICY "app_config: read" ON public.app_config FOR SELECT TO authenticated USING (true);
CREATE TRIGGER app_config_updated_at BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the single config row with safe defaults. Paths target the One L1fe repo
-- (monorepo: the mobile app lives under apps/mobile). These are runtime-editable.
INSERT INTO public.app_config (id, routing_map, allowed_paths, forbidden_paths, template_version, bdc_paused)
VALUES (
  true,
  '{"wording":"tier0","look":"tier1","wrong":"tier1","idea":"review"}'::jsonb,
  ARRAY[
    'apps/mobile/src/**'
  ]::text[],
  ARRAY[
    'apps/mobile/src/data/**',
    'apps/mobile/android/**',
    'apps/mobile/ios/**',
    '**/*.gradle',
    '**/AndroidManifest.xml',
    'apps/mobile/supabase/**',
    '**/*.sql',
    '**/.env*',
    '**/*.keystore'
  ]::text[],
  'v1',
  false
)
ON CONFLICT (id) DO NOTHING;

-- ---------- task_log: one row per model attempt (provenance + KPI) ----------
CREATE TABLE IF NOT EXISTS public.task_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid REFERENCES public.ideas(id) ON DELETE CASCADE,
  req_id text,
  intent public.contribution_intent,
  tier text,
  model_requested text,
  model_served text,
  provider text,
  attempt_number integer NOT NULL DEFAULT 1,
  escalated_from text,
  base_sha text,
  template_version text,
  tokens_prompt integer,
  tokens_completion integer,
  cost_usd numeric,                   -- real spend from OpenRouter usage accounting
  validate_result text,               -- 'ok' | 'parse_fail' | 'path_reject' | 'error'
  blocked_reason text,
  pr_number integer,
  pr_url text,
  review_verdict text,                -- 'ok' | 'risky' — filled by post-PR judge
  review_reason text,                 -- one-sentence explanation from judge
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.task_log TO authenticated;
GRANT ALL ON public.task_log TO service_role;
ALTER TABLE public.task_log ENABLE ROW LEVEL SECURITY;
-- Provenance is owner/PL KPI data; allow-listed authenticated read is fine (single user).
CREATE POLICY "task_log: read" ON public.task_log FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS task_log_idea_idx ON public.task_log (idea_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_log_created_idx ON public.task_log (created_at DESC);

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

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;-- Drop old pipeline tables (patches, deployments) — replaced by GitHub-Issue-Flow
DROP TABLE IF EXISTS public.deployments CASCADE;
DROP TABLE IF EXISTS public.patches CASCADE;
DROP TYPE IF EXISTS public.deployment_status;
DROP TYPE IF EXISTS public.patch_status;

-- Intent picker enum
CREATE TYPE public.contribution_intent AS ENUM ('wording', 'look', 'wrong', 'idea');

-- Extend idea_status with new lifecycle values (must be committed before use)
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'saved';
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'reviewing';
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'live';
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'reverted';
ALTER TYPE public.idea_status ADD VALUE IF NOT EXISTS 'blocked';

-- Extend ideas table with structured contribution fields + GitHub tracking
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS intent public.contribution_intent,
  ADD COLUMN IF NOT EXISTS screen text,
  ADD COLUMN IF NOT EXISTS wrong text,
  ADD COLUMN IF NOT EXISTS should text,
  ADD COLUMN IF NOT EXISTS req_id text,
  ADD COLUMN IF NOT EXISTS github_issue_number integer,
  ADD COLUMN IF NOT EXISTS github_issue_url text,
  ADD COLUMN IF NOT EXISTS github_pr_number integer,
  ADD COLUMN IF NOT EXISTS github_pr_url text,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS last_polled_at timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS ideas_req_id_key ON public.ideas (req_id) WHERE req_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ideas_user_created_idx ON public.ideas (user_id, created_at DESC);-- BDC engine migration — additive only. Adds the living-config + provenance-log
-- tables for the OpenRouter own-harness. Does NOT touch ideas / user_roles.

-- ---------- app_config: single-row living rules (no redeploy to change) ----------
CREATE TABLE IF NOT EXISTS public.app_config (
  id boolean PRIMARY KEY DEFAULT true,          -- single-row table: id is always true
  routing_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  forbidden_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  prompt_template text NOT NULL DEFAULT '',
  template_version text NOT NULL DEFAULT 'v1',
  bdc_paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_config_singleton CHECK (id = true)
);
GRANT SELECT ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- Any authenticated (allow-listed) user may READ the config; only service_role writes.
CREATE POLICY "app_config: read" ON public.app_config FOR SELECT TO authenticated USING (true);
CREATE TRIGGER app_config_updated_at BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the single config row with safe defaults. Paths target the One L1fe repo
-- (monorepo: the mobile app lives under apps/mobile). These are runtime-editable.
INSERT INTO public.app_config (id, routing_map, allowed_paths, forbidden_paths, template_version, bdc_paused)
VALUES (
  true,
  '{"wording":"tier0","look":"tier1","wrong":"tier1","idea":"review"}'::jsonb,
  ARRAY[
    'apps/mobile/src/**'
  ]::text[],
  ARRAY[
    'apps/mobile/src/data/**',
    'apps/mobile/android/**',
    'apps/mobile/ios/**',
    '**/*.gradle',
    '**/AndroidManifest.xml',
    'apps/mobile/supabase/**',
    '**/*.sql',
    '**/.env*',
    '**/*.keystore'
  ]::text[],
  'v1',
  false
)
ON CONFLICT (id) DO NOTHING;

-- ---------- task_log: one row per model attempt (provenance + KPI) ----------
CREATE TABLE IF NOT EXISTS public.task_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid REFERENCES public.ideas(id) ON DELETE CASCADE,
  req_id text,
  intent public.contribution_intent,
  tier text,
  model_requested text,
  model_served text,
  provider text,
  attempt_number integer NOT NULL DEFAULT 1,
  escalated_from text,
  base_sha text,
  template_version text,
  tokens_prompt integer,
  tokens_completion integer,
  cost_usd numeric,                   -- real spend from OpenRouter usage accounting
  validate_result text,               -- 'ok' | 'parse_fail' | 'path_reject' | 'error'
  blocked_reason text,
  pr_number integer,
  pr_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.task_log TO authenticated;
GRANT ALL ON public.task_log TO service_role;
ALTER TABLE public.task_log ENABLE ROW LEVEL SECURITY;
-- Provenance is owner/PL KPI data; allow-listed authenticated read is fine (single user).
CREATE POLICY "task_log: read" ON public.task_log FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS task_log_idea_idx ON public.task_log (idea_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_log_created_idx ON public.task_log (created_at DESC);
