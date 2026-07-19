# BDC start here / precedence

_Canonical documentation index. Last checked: 2026-07-19 against `origin/main`_
`35780ae4c39099b7b46e6552ec92adb3137a2444`._

## Current operating truth

- Repository: `gzug/bros-developer-cockpit`; integration baseline: `origin/main`.
- BDC is paused. A green build or preview is not production, device, or owner-flow proof.
- The current open lane is #67–#70. Draft PRs #72, #73, and #74 are review handoffs;
  they are not merged or deployed.
- GitHub Issues are the source of truth for brother-submitted intake and lifecycle labels.
- Neon is the observability layer. Local memory keeps the cockpit usable when
  `DATABASE_URL` is absent or a DB write fails; it is not durable truth.
- The One L1fe repository and its trusted `bdc-ship` workflow own the actual ship gate.
  BDC does not claim `shipped` as `live`; `live` requires owner/device confirmation.

## Precedence map

| Question | Canonical source | Mirrors / historical context | Freshness rule |
| --- | --- | --- | --- |
| Runtime behavior and access | `src/` plus colocated tests | `docs/MIGRATION.md`, route docs | Code and tests win; update docs in the same scoped PR. |
| Current BDC pause, baseline, PR/issue posture | `CHECKPOINT.md` plus live GitHub | `docs/HANDOFF.md`, archived task briefs | Refresh after a merge, lane change, or readiness decision. |
| Route names and role access | `src/components/AppHeader.tsx`, route `beforeLoad`, `src/routes/README.md` | `docs/OVERVIEW.html` | Route code wins; route matrix is maintained with route changes. |
| Environment inventory and setup | `.env.example`, `docs/setup-guide.md`, `AGENTS.md` | `docs/MIGRATION.md` | `.env.example` lists app-config keys; setup explains required/optional/deployment policy. |
| Skill upload limits and parsing | `src/lib/skill-export-parser.server.ts` plus tests | `docs/skill-measurement.md` | Numeric limits must match code and parser tests. |
| Skill score/eval behavior | `src/lib/skills-scoring.ts`, `src/lib/eval/`, tests | `docs/EVAL_FRAMEWORK.md`, learnings | Synthetic evals are evidence, not production telemetry. |
| Project overview | `docs/OVERVIEW.html` | `public/OVERVIEW.html` static mirror | Both are historical/status summaries; links to this index and CHECKPOINT win. |
| Session handoff | `docs/HANDOFF.md` | `docs/learnings/`, archived prompts | Prompt/coordination aid only; never overrides code or CHECKPOINT. |

## Freshness and retention

- `CHECKPOINT.md` is current operational state and must carry a verification date and
  baseline SHA.
- `docs/OVERVIEW.html` and `public/OVERVIEW.html` are retained as human-readable snapshots;
  they must visibly say when they were last checked and must not claim production/device proof.
- `docs/archive/` is historical. Archived briefs are not active instructions.
- `docs/audit/` records evidence and decisions. It does not become runtime authority.
- GitHub issue comments and PR bodies are the durable work log for lane progress; local
  `/tmp` validation logs are ephemeral evidence and are not a source of product truth.
- Generated `src/routeTree.gen.ts` is derived output; edit route files, not the generated file.

## New-worker path

1. Read this file, `CHECKPOINT.md`, and `AGENTS.md`.
2. Run `git fetch origin`; verify the worktree and branch before editing.
3. Read the exact issue/brief named by the PL. Work in an isolated worktree.
4. Install and validate in this order:
   `bun install --frozen-lockfile` → `bun run build:dev` → `bun run typecheck` →
   `bun test` → `NITRO_PRESET=node-server bun run build`.
5. Report exact commands and `EXIT=` results. Preview, CI, and local build do not replace
   owner, production, or device evidence.

## Deployment identity

BDC is the cockpit repository and deployment identity:

- URL: `https://bros-developer-cockpit.vercel.app`
- Vercel project: `bros-developer-cockpit`
- Target product repository: `gzug/01-One-L1fe`
- Actual OTA/merge authority: trusted `bdc-ship` workflow in `gzug/01-One-L1fe`

Do not mix BDC deployment facts with One L1fe production/device facts. The lane remains
paused until the owner explicitly reopens it.
