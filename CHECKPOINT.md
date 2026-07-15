# BDC CHECKPOINT

_Last updated: 2026-07-15 08:18 CEST — BDC approval routed through One L1fe ship lane_

## Architecture

- **Stack:** TanStack Start + Drizzle ORM + Neon (GitHub-native auth)
- **DB:** Neon (owner must provision `DATABASE_URL` secret in repo settings)
- **Auth:** PIN via `APP_PIN` env var, timing-safe SHA-256 comparison
- **No Postgres/Drizzle migrations run by PL** — owner-only action
- **Target repo:** GitHub writes are hard-limited in code to `gzug/01-One-L1fe`
- **Release lane:** BDC approval labels the held PR `bdc-approved`; the trusted One L1fe `bdc-ship` GitHub Action validates, merges, and publishes production OTA to the Android app

## Merged into main

| PR | Title | SHA | Date |
|----|-------|-----|------|
| #9 | feat: dc-ui — engine runs page | 368bbf6 | 2026-07-10 |
| direct | fix(auth): PIN SHA-256 + timingSafeEqual | ea08a78 | 2026-07-10 |
| direct | fix(ErrorBoundary): capture and display error | 894dad5 | 2026-07-10 |
| direct | chore: add CHECKPOINT.md | — | 2026-07-10 |
| #10 | fix: PIN auth, ErrorBoundary, dark mode/PWA/responsive, DC dashboard | 71b71d0 | 2026-07-13 |
| #18 | feat: wire BDC end-to-end connection | e3a70da | 2026-07-15 |

## Deployment

- Production deploy completed 2026-07-15 via `npx vercel --prod --yes`
- Production alias: https://bros-developer-cockpit.vercel.app
- HTTP smoke: `/auth` 200, `/submit?context=Home&type=change` 200, unauthenticated `POST /api/poll-issues` returns `Not logged in`

## Owner Queue (blocked — requires owner action)

1. **Run one owner PIN smoke:** submit a harmless test wish, verify the issue appears in `gzug/01-One-L1fe`, then decide whether to close it or let BDC process it
2. **Approve one held PR from `/dc`:** verify the One L1fe `bdc-ship` workflow validates, merges, publishes EAS production OTA, and comments the update group

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
- [ ] With owner PIN: verify /runs and /dc live DB-backed data
- [ ] With owner PIN: approve one held PR and verify the One L1fe `bdc-ship` workflow publishes the OTA

## Live flow

PIN unlock opens the BDC web app. `/submit?context=<screen>&type=idea|change` creates one structured issue in `gzug/01-One-L1fe` with `from-brother`, `bdc-submitted`, `idea|change`, `ui-only`, and `one-l1fe-design`. `/dc` polls for unclaimed submissions, labels them `bdc-engine-started`, runs the scoped OpenRouter engine, blocks out-of-scope diffs before any GitHub write, and opens a held PR from `bdc-hold/dc-issue-<nr>`. Owner approval in `/dc` labels the held PR and issue `bdc-approved`; the One L1fe `bdc-ship` workflow then validates, squash-merges, publishes the production EAS OTA, and comments the update group. Final `bdc-live` confirmation remains manual after the owner/device check.

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
