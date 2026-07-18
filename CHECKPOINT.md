# BDC CHECKPOINT

_Last verified: 2026-07-18 CEST against `origin/main` `cfb2de7` and GitHub._

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
| #35 | Co-Dev Flow v2: one screen, OTA/APK pipeline, chat-ship | `058a94e` | 2026-07-18 |
| #36 | One L1fe brand alignment, light default, clearer copy, ideas naming | `cfb2de7` | 2026-07-18 |

## Open pull requests

| PR | Scope | Status | Rule |
|---|---|---|---|
| #28 | product-generalization handoff | Draft, clean | documentation draft; keep separate from readiness integration |
| #31 | Paxel Builder Profile self-reflection | Draft, based on the readiness branch (#21) | separate BDC draft, not mobile main; do not merge before #21 |

## Open issues

- **#34** extend ownership guard to PR-lifecycle label paths + robust `## Context` anchoring: the two lower-severity residuals left after #32; low exposure, gated, resolve before brother handoff.
- **#13** typed `dc.tsx` cleanup: real technical backlog; retain until a scoped fix is reviewed.
- **#8** original engine goal: probably stale as an owner topic because its old task list describes superseded work. Do not close automatically; owner must close it or rewrite it into current scope.

_Closed 2026-07-17:_ **#29** (ZIP size limits) and **#30** (close guard + context shadowing) — both fixed and verified in #32 (`83fee83`).

_Closed 2026-07-18:_ stale readiness drafts **#20** and **#21** were closed without merge after #35 superseded their integration story.

## Next safe sequence

1. `origin/main` now includes #35 (`058a94e`) and #36 (`cfb2de7`). Treat `cfb2de7` as the current BDC baseline.
2. Keep BDC paused. Do not weaken `BDC_PAUSED`, `BDC_SHIP_ENABLED`, or the external `bdc-ship` gate; preview and green CI are still not production/device proof.
3. Leave #28 and #31 separate unless the owner explicitly re-scopes them. #31 still targets the old readiness branch and must not be merged by assumption.
4. Next BDC work should improve non-technical comprehension and trust on top of the One L1fe-themed #36 baseline, then resolve issues #13 and #34 in scoped PRs.
5. Before any brother handoff, run the full fresh-worktree validation chain, test both PIN roles, and record real owner/browser/device evidence.

## Known follow-ups after #35/#36

- GitHub issue #289 may still need a manual record cleanup because the old test run mixed cockpit actions with direct GitHub clicks. Do not automate a repair by assumption.
- Prompt-effect remains a small-sample GitHub signal, not real runtime telemetry for the actually served prompts.
- The help/chat layer knows BDC workflow facts, but it still lacks a live One L1fe product-context packet. Add that only through an explicit BDC-owned scope; do not edit the One L1fe app repo from this checkpoint.

## Validation and cleanup rules

- Fresh BDC worktree: `bun install --frozen-lockfile` → `bun run build:dev` → `bun run typecheck` → `bun test` → `NITRO_PRESET=node-server bun run build`.
- Delete a local worktree or branch only after clean status and PR/ancestor proof. Never delete remote branches in a hygiene run.
- Old task briefs live in `docs/archive/tasks-2026-07/`; they are historical context, not active instructions.
