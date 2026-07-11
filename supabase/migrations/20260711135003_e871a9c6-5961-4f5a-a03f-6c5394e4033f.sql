-- Drop old pipeline tables (patches, deployments) — replaced by GitHub-Issue-Flow
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
CREATE INDEX IF NOT EXISTS ideas_user_created_idx ON public.ideas (user_id, created_at DESC);