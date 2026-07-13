# BDC CHECKPOINT

_Last updated: 2026-07-10 — autonomous PL loop_

## Architecture

- **Stack:** TanStack Start + Drizzle ORM + Neon (GitHub-native auth)
- **DB:** Neon (owner must provision `DATABASE_URL` secret in repo settings)
- **Auth:** PIN via `APP_PIN` env var, timing-safe SHA-256 comparison
- **No Postgres/Drizzle migrations run by PL** — owner-only action

## Merged into main

| PR | Title | SHA | Date |
|----|-------|-----|------|
| #9 | feat: dc-ui — engine runs page | 368bbf6 | 2026-07-10 |

## Open PRs

_None as of last check._

## Owner Queue (blocked — requires owner action)

1. **Provision Neon DATABASE_URL** secret in `gzug/bros-developer-cockpit` repo settings → enables live data on `/runs` page
2. **Deploy** the app (no deployments recorded yet)

## Worker Queue (Jules)

- [x] P1: Secure PIN comparison in auth.server.ts (timing-safe SHA-256) — DONE
- [ ] P2: English i18n scan & verification — IN PROGRESS
- [ ] P3: N+1 fix (if applicable from PR #3 findings)

## Autonomous Backlog (PL-executable)

- Write CHECKPOINT.md (this file) — DONE
- Monitor Jules P2 completion, review diff, merge if gate green
- After P2 lands: check Issues for next Issue #8 (BDC Engine + Dashboard) sub-tasks

## State Snapshot

```
git log origin/main --oneline -5
368bbf6 Merge pull request #9 from gzug/feat/dc-ui
...

Open PRs: 0
Open Issues: 1 (Issue #8 BDC Engine + Dashboard)
```

## Rules Reference

- Ladder of Authority: git log > CHECKPOINT.md > AGENTS.md > briefs
- Git wins over docs — if doc contradicts live state, flag doc as STALE
- Never idle on owner-blockers; continue code track
- Merge only after gate green + diff re-read
