# BDC CHECKPOINT

_Last verified: 2026-07-17 CEST against `origin/main` `2e3b080` and GitHub._

## Operating truth

- BDC is paused for readiness. Do not deploy, merge, or represent a preview as production readiness.
- `origin/main` is the integration baseline. The primary checkout may contain local `.claude/` state; preserve it unless its owner and purpose are explicit.
- The app uses PIN access, GitHub-backed work intake, optional Neon run storage, and the One L1fe ship lane. Missing secrets or a green web build do not prove the owner flow, production, or a physical device.

## Merged into `origin/main`

| PR | Title | SHA | Date |
|---|---|---|---|
| #18 | BDC end-to-end connection | `e3a70da` | 2026-07-15 |
| #19 | approval routed through ship lane | `6db0540` | 2026-07-15 |
| #23 | skill-tracking radar chart | `43cfba1` | 2026-07-16 |
| #24 | idea pipeline v2 | `998c8c8` | 2026-07-16 |
| #25 | skill-export radar data | `b2b1a11` | 2026-07-17 |
| #26 | AI engine presets | `9677693` | 2026-07-16 |
| #27 | current PL prompt pointer | `488d4c0` | 2026-07-16 |
| #32 | ZIP limits + pipeline mutation guards (closed #29/#30) | `83fee83` | 2026-07-17 |

## Open pull requests

| PR | Scope | Status | Rule |
|---|---|---|---|
| #20 | readiness pipeline hardening | Draft, conflict | owner-gated; do not merge or repair by assumption |
| #21 | role and security readiness | Draft, conflict | owner-gated; do not merge or repair by assumption |
| #28 | product-generalization handoff | Draft, clean | documentation draft; keep separate from readiness integration |
| #31 | Paxel Builder Profile self-reflection | Draft, based on the readiness branch (#21) | separate BDC draft, not mobile main; do not merge before #21 |

## Open issues

- **#34** extend ownership guard to PR-lifecycle label paths + robust `## Context` anchoring: the two lower-severity residuals left after #32; low exposure, gated, resolve before brother handoff.
- **#13** typed `dc.tsx` cleanup: real technical backlog; retain until a scoped fix is reviewed.
- **#8** original engine goal: probably stale as an owner topic because its old task list describes superseded work. Do not close automatically; owner must close it or rewrite it into current scope.

_Closed 2026-07-17:_ **#29** (ZIP size limits) and **#30** (close guard + context shadowing) — both fixed and verified in #32 (`83fee83`).

## Next safe sequence

1. #32 integrated (ZIP + mutation-guard hardening); #29/#30 closed; residual tracked in #34.
2. Owner decisions still pending on #20, #21, and One L1fe PR #283 — all owner-gated.
3. After approval, integrate #21 role/PIN baseline, then #31 Builder Profile (needs #21 first).
4. Only then deploy with `BDC_PAUSED=true`, test the PIN flow with the owner, and record a real result.

## Validation and cleanup rules

- Fresh BDC worktree: `bun install --frozen-lockfile` → `bun run build:dev` → `bun run typecheck` → `bun test` → `NITRO_PRESET=node-server bun run build`.
- Delete a local worktree or branch only after clean status and PR/ancestor proof. Never delete remote branches in a hygiene run.
- Old task briefs live in `docs/archive/tasks-2026-07/`; they are historical context, not active instructions.
