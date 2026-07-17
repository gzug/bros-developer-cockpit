GOAL: Produce a read-only map of the authoritative `01-One-L1fe` repository surfaces that the Cockpit code-ship pipeline integrates with.
BRANCH: codex/session-intake-20260713
CHANGES:
- No repository edits in either repository.
- Use `/Users/zar/Projects/01-One-L1fe`; explicitly reject the stale `/Users/zar/Projects/One L1fe` checkout.
- Read applicable AGENTS/session/ops/workflow docs plus only the source and automation files relevant to issue intake, `bdc/*` branches, PR validation/merge, `bdc-ship`, OTA, Android/device verification, and repo safety gates.
- Verify current branch, status, origin/main, open PR/worktree state, and relevant GitHub Actions.
- Report exact paths and live evidence; identify mismatches with Cockpit assumptions.
VALIDATE:
- Both repositories remain unmodified.
- Claims are tied to current files, git, or GitHub state.
REPORT:
- Integration contract map.
- Current shipping-lane truth.
- Safety gates and blockers.
- Minimum context the Projektleiter must retain.
