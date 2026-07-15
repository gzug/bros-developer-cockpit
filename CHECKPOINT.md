# BDC CHECKPOINT

_Last updated: 2026-07-15 07:31 CEST — BDC e2e connection branch_

## Architecture

- **Stack:** TanStack Start + Drizzle ORM + Neon (GitHub-native auth)
- **DB:** Neon (owner must provision `DATABASE_URL` secret in repo settings)
- **Auth:** PIN via `APP_PIN` env var, timing-safe SHA-256 comparison
- **No Postgres/Drizzle migrations run by PL** — owner-only action
- **Target repo:** GitHub writes are hard-limited in code to `gzug/01-One-L1fe`
- **Release lane:** BDC can call `ONE_L1FE_OTA_DEPLOY_HOOK_URL` after owner approval; One L1fe remains the Android app

## Merged into main

| PR | Title | SHA | Date |
|----|-------|-----|------|
| #9 | feat: dc-ui — engine runs page | 368bbf6 | 2026-07-10 |
| direct | fix(auth): PIN SHA-256 + timingSafeEqual | ea08a78 | 2026-07-10 |
| direct | fix(ErrorBoundary): capture and display error | 894dad5 | 2026-07-10 |
| direct | chore: add CHECKPOINT.md | — | 2026-07-10 |
| #10 | fix: PIN auth, ErrorBoundary, dark mode/PWA/responsive, DC dashboard | 71b71d0 | 2026-07-13 |

## Open PRs

_None — all merged as of 2026-07-13._

## Current branch in validation

| Branch | Scope | Local gates |
|--------|-------|-------------|
| `feat/bdc-e2e-connection` | `/submit` form, BDC issue labels, poll trigger, guarded `bdc-hold/*` PR creation, approve/request/live controls, OTA hook handoff | `bun run typecheck`, `bun test`, `bun run build` green on 2026-07-15 |

## Owner Queue (blocked — requires owner action)

1. **Provision Neon `DATABASE_URL`** secret in `gzug/bros-developer-cockpit` repo settings → enables live data on `/runs` and `/dc` pages
2. **Provision `ONE_L1FE_OTA_DEPLOY_HOOK_URL`** secret in `gzug/bros-developer-cockpit` repo settings → enables the post-merge OTA release trigger
3. **Ensure Production/Preview secrets are present:** `APP_PIN`, `APP_SECRET`, `OPENROUTER_API_KEY`, `GITHUB_TOKEN`, `DATABASE_URL`, `ONE_L1FE_OTA_DEPLOY_HOOK_URL`
4. **Deploy** the BDC web app after merge; after every merge to `main`, run `npx vercel --prod --yes` and verify prod loads

## Issue #8 Status

- [x] Task 1: Merge PR #7 prerequisites — DONE (already merged)
- [x] Task 2a: `timingSafeEqual` for PIN auth — DONE (SHA-256 hash)
- [x] Task 2b: Localize UI to English — DONE (100% confirmed)
- [ ] Task 2c: Fix N+1 API calls on KPI page — PENDING CHECK
- [x] Task 3: Polish branch — DONE (dark mode, PWA, skeletons, ErrorBoundary, responsive)
- [x] Task 4: Minimal DC operational UI (`dc.tsx`) — DONE (Queue, Run Log, Costs, Approvals)

## Autonomous Backlog (PL-executable)

- [ ] owner-kpi.tsx: verify N+1 fix (Issue #8 Task 2c)
- [ ] gzug/01-One-L1fe track: sync issue status
- [ ] After DATABASE_URL provisioned: verify /runs and /dc live data
- [ ] After OTA hook provisioned: approve one held PR and verify the OTA trigger reaches the One L1fe release lane

## Live flow

PIN unlock opens the BDC web app. `/submit?context=<screen>&type=idea|change` creates one structured issue in `gzug/01-One-L1fe` with `from-brother`, `bdc-submitted`, `idea|change`, `ui-only`, and `one-l1fe-design`. `/dc` polls for unclaimed submissions, labels them `bdc-engine-started`, runs the scoped OpenRouter engine, blocks out-of-scope diffs before any GitHub write, and opens a held PR from `bdc-hold/dc-issue-<nr>`. Owner approval in `/dc` squash-merges the PR, labels the issue `bdc-approved`, calls the OTA hook if configured, and leaves final `bdc-live` confirmation to the owner/device check.

## State Snapshot

```
git log origin/main --oneline -5
71b71d0 Merge pull request #10 from gzug/fix/issue-8-bdc-engine-polish-...
9cd37e4 Merge branch 'main' into fix/issue-8-bdc-engine-polish-...
...

Open PRs: 0
Open Issues: 1 (Issue #8 — Task 2c pending)
Branches: main only (all feature branches deleted)
```

## Rules Reference

- Ladder of Authority: git log > CHECKPOINT.md > AGENTS.md > briefs
- Git wins over docs — if doc contradicts live state, flag doc as STALE
- Never idle on owner-blockers; continue code track
- Merge only after gate green + diff re-read
