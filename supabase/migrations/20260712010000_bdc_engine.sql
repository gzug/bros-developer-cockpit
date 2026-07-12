-- BDC engine migration — additive only. Adds the living-config + provenance-log
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
  '{"wording":"tier0","look":"tier1","wrong":"tier1","idea":"tier1"}'::jsonb,
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
