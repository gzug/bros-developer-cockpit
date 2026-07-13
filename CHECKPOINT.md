# BDC CHECKPOINT

_Last updated: 2026-07-13 16:00 CEST — autonomous PL loop_

## Architecture

- **Stack:** TanStack Start + Drizzle ORM + Neon (GitHub-native auth)
- **DB:** Neon (owner must provision `DATABASE_URL` secret in repo settings)
- **Auth:** PIN via `APP_PIN` env var, timing-safe SHA-256 comparison
- **No Postgres/Drizzle migrations run by PL** — owner-only action

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

## Owner Queue (blocked — requires owner action)

1. **Provision Neon `DATABASE_URL`** secret in `gzug/bros-developer-cockpit` repo settings → enables live data on `/runs` and `/dc` pages
2. **Deploy** the app (no deployments recorded yet)

## Issue #8 Status

- [x] Task 1: Merge PR #7 prerequisites — DONE (already merged)
- [x] Task 2a: `timingSafeEqual` for PIN auth — DONE (SHA-256 hash)
- [x] Task 2b: Localize UI to English — DONE (100% confirmed)
- [ ] Task 2c: Fix N+1 API calls on KPI page — PENDING CHECK
- [x] Task 3: Polish branch — DONE (dark mode, PWA, skeletons, ErrorBoundary, responsive)
- [x] Task 4: Minimal DC operational UI (`dc.tsx`) — DONE (Queue, Run Log, Costs, Approvals)

## Autonomous Backlog (PL-executable)

- [ ] AppHeader: add "DC" nav-link to `/dc`
- [ ] owner-kpi.tsx: verify N+1 fix (Issue #8 Task 2c)
- [ ] gzug/01-One-L1fe track: sync issue status
- [ ] After DATABASE_URL provisioned: verify /runs and /dc live data

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
