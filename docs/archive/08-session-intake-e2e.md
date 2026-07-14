GOAL: Reconstruct the current joint E2E flow from brother PIN login and idea submission through GitHub issue/PR, `bdc-ship`, merge, deploy, and OTA; identify the next executable test.
BRANCH: codex/session-intake-20260713
CHANGES:
- No repository edits.
- Inspect Cockpit docs/source/tests/config, GitHub repository state, Vercel configuration/status, and any locally available pipeline evidence relevant to the flow.
- Do not expose secret values or perform writes, merges, deployments, workflow dispatches, idea submissions, or PIN/UI actions.
- Distinguish verified current facts from assumptions and stale documentation.
VALIDATE:
- `git status --short` remains unchanged.
- Every flow step has evidence, an identified gap, or a named human-only action.
REPORT:
- Step-by-step E2E chain with owner and evidence.
- Exact next safe test procedure.
- Blockers and questions for Don.
