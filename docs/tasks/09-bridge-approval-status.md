GOAL: Make DC bridge changes require explicit owner approval before OL1 merge/OTA and stop calling merged PRs live.
BRANCH: codex/bridge-approval-status
CHANGES:
- src/lib/github-issues.server.ts -> add `approved` to `DCIdeaStatus`; derive `sent` for merged PRs unless PR or issue has `dc:status:live`; derive `approved` when labels include `dc:status:approved`; never map `pr.merged` directly to `live`.
- src/lib/engine.server.ts -> after opening a PR, set idea status `approved` only when the route has passed approval; otherwise leave/send status as `sent`; do not auto-merge or dispatch workflows.
- src/routes/_authenticated/idea.$id.tsx -> replace "Send now" wording with approval-safe copy. Submitted ideas can start the engine. Sent/approved ideas show PR link and "waiting for owner/ship confirmation" copy. Live only means explicit `dc:status:live`.
- src/routes/_authenticated/dashboard.tsx and src/lib/ideas.functions.ts -> status labels/KPIs include `approved`; `live` means confirmed live only.
- Add or update tests for status derivation: PR open -> sent, PR merged without live label -> sent/approved not live, live label -> live, approved label -> approved.
VALIDATE:
- bun test
- NITRO_PRESET=node-server bun run build
REPORT:
- Commit hash.
- Files changed.
- Validation commands with EXIT.
