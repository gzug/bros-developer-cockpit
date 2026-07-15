# BDC engine migration — Lovable import → OpenRouter own-harness

Status: **import baseline** (code pulled verbatim out of the Lovable "Dev Companion"
project, commit `9ec3fc15`). This doc is the working spec for turning that import into the
decided engine. Canonical background lives in the One L1fe repo:
`docs/ops/worker-briefs/bdc-lovable-buildkit.md` (+ `bdc-lovable-openrouter.md`).

## What this app is

Single-user front door for the **One L1fe** Android health app. The brother logs in (owner's
one profile), types a scoped UI wish in plain words → the app turns it into an actual code
patch and opens a `bdc/*` **Pull Request** on the One L1fe repo. The repo's existing
**reviewer lane** (reviewer-validate / reviewer-ship / reviewer-revert workflows) validates
and ships it as an OTA update. The app only ever OPENS PRs — it never merges, labels, or ships.

## What the import already gives us (keep)

- **Auth + single-profile gate** — `src/lib/allowlist.server.ts` (`assertAllowedEmail`, env
  `ALLOWED_EMAIL`). Every server function that touches contribution data must call it.
- **Layer-1 guardrails** — `src/lib/guardrails.server.ts` (`checkGuardrails`,
  `sanitizeForFence`): destructive / scope / reask brakes. KEEP as-is.
- **Submit form, dashboard, idea detail** — `src/routes/_authenticated/*`.
- **Supabase schema** — `ideas` + `user_roles` tables (migrations under `supabase/migrations/`).
  The `ideas` row is already the task record (intent/screen/wrong/should/req_id/github_*).

## What gets replaced (the engine)

Current flow (`contribution.server.ts` → `buildBrief` → `github.server.ts createIssue`) opens a
GitHub **Issue** ending in `@codex please implement …`. That whole Codex-mention path is
**superseded**. Replace with:

### `processTask(ideaId)` — fail-closed
1. Load idea + `app_config` (routing map, path lists, prompt template, `bdc_paused`).
2. If `bdc_paused` → mark `blocked`, stop.
3. Route by **intent** to a model tier (`wording`→cheap tier, `look`/`idea`→higher). Cascade
   is fallback only, not the primary router.
4. Call **OpenRouter** (`OPENROUTER_API_KEY`, Supabase backend secret) for a patch: a set of
   `{path, newContent}` edits, constrained to the allowed paths.
5. **Validate the patch** (see path rules below). On parse/validation fail → escalate one tier
   and retry; on repeated fail → `blocked` with reason.
6. On success: create branch `bdc/<reqId>` → commit the files → open a PR referencing `reqId`.
7. Log provenance to `task_log` (model requested vs served, provider, base_sha, template
   version, attempts, escalations, tokens, validate result).

### Path validator (security boundary)
An **exact-path allow entry wins over a broad forbidden glob**; glob allows never override
forbids. (Bug already fixed in the buildkit spec — carry it over verbatim.)
```
isPathAllowed(p): exact-literal allow → true; forbidden glob → false; else allow-glob match
```
Forbidden: `src/data/**`, native (`android/**`, `ios/**`, `*.gradle`, `AndroidManifest.xml`),
schema/migrations, secrets/env. Editable carve-outs (e.g. `reviewerContent.ts`) are exact-path
allows. **Values-only-never-keys** for reviewer content.

### Kill-switch / interlock
`bdc_paused` flag in `app_config` + auto-pause on **2 reverts in the last 10** shipped PRs +
fail-closed on any engine error. Lead KPI = **rework-free rate** (not cost-per-task).

## Additive schema (new migration, never destructive)

- `app_config` (single-row living config): `routing_map jsonb`, `allowed_paths text[]`,
  `forbidden_paths text[]`, `prompt_template text`, `template_version text`,
  `bdc_paused boolean`, updated_at. Service-role write only.
- `task_log` (one row per model attempt): idea_id, req_id, model_requested, model_served,
  provider, tier, attempt_number, escalated_from, base_sha, template_version, tokens_prompt,
  tokens_completion, validate_result, blocked_reason, created_at.

## `github.server.ts` additions

Keep `createIssue` (may drop later) + `findPullRequestByReqId`. ADD:
- `getDefaultBranchSha()` — read the base SHA to stamp provenance + branch from.
- `createBranch(name, fromSha)`.
- `commitFiles(branch, files[], message)` — via the Git Data API (create blobs → tree → commit)
  or Contents API per file.
- `openPullRequest({head, base, title, body})` — returns number + html_url.
PAT stays fine-grained: THIS one repo, `contents:write` + `pull-requests:write`, no merge/admin.

## To remove (Lovable-runtime + superseded)

- MCP-server layer: `src/lib/mcp/*`, `src/routes/[.mcp]/*`,
  `src/routes/[.]lovable.oauth.consent.tsx`, `src/routes/[.well-known]/oauth-protected-resource.ts`.
- Lovable error reporting / capture shims if they block a clean off-Lovable build.
- Evaluate `@lovable.dev/cloud-auth-js`: if it hard-requires Lovable Cloud, swap for raw
  Supabase auth (magic-link or GitHub OAuth) against our own Supabase project.

## Owner-run before go-live (PL never sees the values)

- Stand up a Supabase project (or keep Lovable Cloud's), run migrations.
- Set backend secrets: `OPENROUTER_API_KEY` (+ load OpenRouter $10–20), `GITHUB_TOKEN`
  (fine-grained to `gzug/01-One-L1fe`), `APP_PIN`, `APP_SECRET`, `DATABASE_URL`,
  and `ONE_L1FE_OTA_DEPLOY_HOOK_URL`.
- 1-click deploy the frontend (Vercel / Cloudflare).

## Hard rules (inherited from One L1fe)

No secrets/PHI/.env in git. Additive-only schema. The app opens PRs only — the reviewer lane is
the sole path to the device. All brother-facing UI is plain English; owner chat is German.
