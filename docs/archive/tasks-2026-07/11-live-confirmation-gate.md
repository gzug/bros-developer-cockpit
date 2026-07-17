GOAL: Prevent Cockpit from recording an OL1 change as live before its held bridge PR is merged.
BRANCH: codex/live-confirmation-gate
CHANGES:
- src/lib/github-issues.server.ts -> export a pure predicate that permits live confirmation only for an existing merged PR.
- src/lib/ideas.functions.ts -> use the linked PR when handling approved -> live; reject the transition before labels/comments when no merged PR exists.
- src/lib/github-issues.test.ts -> cover no PR/open PR rejected and merged PR accepted; retain the rule that a merged PR alone is not live.
- src/routes/_authenticated/idea.$id.tsx -> make the owner action explicitly post-ship.
VALIDATE:
- bun test
- NITRO_PRESET=node-server bun run build
REPORT:
- Commit hash.
- Files changed.
- Validation commands with EXIT.
