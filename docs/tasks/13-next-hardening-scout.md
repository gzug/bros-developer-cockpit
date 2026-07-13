GOAL: Find the highest-yield autonomous improvement after the safety batch if full bridge E2E still cannot be completed without Don.
BRANCH: codex/autonomous-round-2
CHANGES:
- No repository edits.
- Inspect repo docs, source, tests, and recent commits for weak spots, missing verification, or unsafe wording in the Cockpit pipeline.
- Prefer tasks that are self-contained in this repo and reduce risk or operator confusion.
VALIDATE:
- `git status --short` unchanged.
- Every recommendation names owned files and a concrete reason.
REPORT:
- Top 3 candidate tasks ordered by impact/risk.
- For the top task: exact files, intended behavior change, and validation plan.
- Note if any candidate depends on Don, OL1, or external state.
