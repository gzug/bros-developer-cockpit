# BDC CHECKPOINT

_Last verified: 2026-07-17 CEST against `origin/main` `f94ac79` and GitHub._

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
| #33 | sync CHECKPOINT to post-#32 truth | `2e3b080` | 2026-07-17 |

## Open pull requests

| PR | Scope | Status | Rule |
|---|---|---|---|
| #35 | Co-Dev Flow v2 draft on the #21 foundation; includes honest shipping semantics, prompt/help cleanup, prompt versions, import checks, and timeline tracking | Draft, clean | owner-gated; current integration path, do not merge before owner go |
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

1. `origin/main` now includes the post-#32 checkpoint sync (#33) and the owner-confirmed Co-Dev Flow v2 spec commit `f94ac79`.
2. PR #35 is the active draft implementation path. It supersedes the old integration story of #20/#21 but remains owner-gated until explicitly approved.
3. After PR #35 is reviewed and merged, close or rewrite the superseded readiness drafts (#20/#21) deliberately instead of letting them drift.
4. Then integrate #31 Builder Profile if still wanted; it depends on the readiness/roles foundation.
5. Only then deploy with `BDC_PAUSED=true`, test the PIN flow with the owner, and record a real result.

## Known follow-ups after PR #35

- GitHub issue #289 may still need a manual record cleanup because the old test run mixed cockpit actions with direct GitHub clicks. Do not automate a repair by assumption.
- Prompt-effect remains a small-sample GitHub signal, not real runtime telemetry for the actually served prompts.
- The help/chat layer knows BDC workflow facts, but it still lacks a live One L1fe product-context packet. That is the next high-value truth upgrade after the current draft lands.

## Validation and cleanup rules

- Fresh BDC worktree: `bun install --frozen-lockfile` → `bun run build:dev` → `bun run typecheck` → `bun test` → `NITRO_PRESET=node-server bun run build`.
- Delete a local worktree or branch only after clean status and PR/ancestor proof. Never delete remote branches in a hygiene run.
- Old task briefs live in `docs/archive/tasks-2026-07/`; they are historical context, not active instructions.
