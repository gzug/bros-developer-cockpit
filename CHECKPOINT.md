# BDC CHECKPOINT

_Last verified: 2026-07-22 CEST against `origin/main` `2cee3a5603748d4f43cb4d443db04774edba7f5d` and GitHub._

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
| #71 | canonical BDC idea display projection | `35780ae` | 2026-07-19 |
| #72 | clean stale idea pipeline entries | `53291ca` | 2026-07-19 |
| #73 | cockpit data states explicit (#67) | `c6d00da` | 2026-07-19 |
| #74 | executable BDC boundary matrix (#68) | `2df6262` | 2026-07-19 |
| #75 | canonical BDC truth index (#69) | `52667dc` | 2026-07-19 |
| #79 | thin cockpit shell + measure build budget (#70) | `058efee` | 2026-07-20 |
| #80 | surface concrete GitHub error to owner (closes #78) | `67a61d9` | 2026-07-20 |
| #81 | add showcase link (closes #77) | `2917939` | 2026-07-20 |
| #82 | home landing with icon dock, slim header | `e6e7de4` | 2026-07-20 |
| #83 | co-dev can read prep log; owner keeps all actions | `5eefa94` | 2026-07-20 |
| #84 | fix header showcase About link | `626576f` | 2026-07-21 |
| #85 | replace icon dock with labelled section landing page | `058d751` | 2026-07-21 |
| #86 | fix stale nav copy labels after #85 | `d8a19f6` | 2026-07-21 |
| #87 | remove unused shadcn scaffolding + dead deps | `2cee3a5` | 2026-07-21 |

## Open pull requests

| PR | Scope | Status | Rule |
|---|---|---|---|
| #28 | product-generalization handoff | Draft, stale base | docs draft; keep separate, not blocking |
| #31 | Paxel Builder Profile self-reflection | Draft, stale base (readiness branch) | do not merge; retarget to main if wanted |

## Open issues

- **#34** remains the separate security-hardening backlog: extend ownership guard to PR-lifecycle label paths + robust `## Context` anchoring. Do not silently absorb it into a docs/test slice.

_Closed 2026-07-19 after live Ideas/Pipeline verification:_ **#8** stale goal (`not_planned`),
**#13** completed typed cleanup (`completed`), and **#58/#59** skill-evidence metadata noise
(`not_planned`). They are not current product tasks.

_Closed 2026-07-17:_ **#29** (ZIP size limits) and **#30** (close guard + context shadowing) — both fixed and verified in #32 (`83fee83`).

_Closed 2026-07-18:_ stale readiness drafts **#20** and **#21** were closed without merge after #35 superseded their integration story.

## Next safe sequence

1. `origin/main` now includes #87 (`2cee3a5`). Treat `2cee3a5603748d4f43cb4d443db04774edba7f5d` as the current BDC baseline (2026-07-22).
2. Keep BDC paused. Do not weaken `BDC_PAUSED`, `BDC_SHIP_ENABLED`, or the external `bdc-ship` gate; preview and green CI are still not production/device proof.
3. Leave #28 and #31 separate unless the owner explicitly re-scopes them. #31 still targets the old readiness branch and must not be merged by assumption.
4. The oldest-first BDC-64 lane is #67, #68, #69, #70. Resolve #34 separately with its own security brief.
5. Before any brother handoff, run the full fresh-worktree validation chain, test both PIN roles, and record real owner/browser/device evidence.

## Known follow-ups after #35/#36

- GitHub issue #289 may still need a manual record cleanup because the old test run mixed cockpit actions with direct GitHub clicks. Do not automate a repair by assumption.
- Prompt-effect remains a small-sample GitHub signal, not real runtime telemetry for the actually served prompts.
- The help/chat layer knows BDC workflow facts, but it still lacks a live One L1fe product-context packet. Add that only through an explicit BDC-owned scope; do not edit the One L1fe app repo from this checkpoint.

## Validation and cleanup rules

- Fresh BDC worktree: `bun install --frozen-lockfile` → `bun run build:dev` → `bun run typecheck` → `bun test` → `NITRO_PRESET=node-server bun run build`.
- Delete a local worktree or branch only after clean status and PR/ancestor proof. Never delete remote branches in a hygiene run.
- Old task briefs live in `docs/archive/tasks-2026-07/`; they are historical context, not active instructions.
