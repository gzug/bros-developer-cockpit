GOAL: Integrate branches from tasks 09 and 10 into one verified Cockpit branch without touching OL1 or triggering DC bridge shipping.
BRANCH: codex/safety-batch-integration
CHANGES:
- Merge or cherry-pick task 09 and task 10 commits.
- Resolve conflicts by preserving: explicit approval/live semantics, working path allowlist, guardrails on submission, PIN throttling.
- Add minimal integration tests if merged behavior has a gap.
- Do not submit ideas, create GitHub issues, create OL1 branches, dispatch workflows, merge OL1 PRs, or deploy.
VALIDATE:
- bun test
- NITRO_PRESET=node-server bun run build
REPORT:
- Commit hash.
- Files changed.
- Validation commands with EXIT.
