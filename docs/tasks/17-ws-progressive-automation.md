# TASK CARD: WS4 — Progressive Automation (Mode 2)
---
goal: Implement safe, autonomous auto-merging for low-risk T1 changes while enforcing human gates on T2/T3, introducing a system Kill Switch, and setting up failure escalation.
tier: T3
paths:
  - src/lib/engine.server.ts
  - src/lib/github-issues.server.ts
constraints:
  - Auto-merge must be enabled ONLY for changes labeled `tier:T1` with green CI. Under no circumstances should T2 or T3 changes be auto-merged.
  - Do not write complex custom auto-merging scripts; utilize GitHub's native "Auto-Merge" pull request feature to avoid security risks.
  - Require a clean run history of ~20 manual T1 runs before enabling autonomous mode in production.
  - Introduce a system Kill Switch (environment variable `BDC_KILL_SWITCH=true` or similar) that completely halts all automated Cockpit operations.
  - Implement an Escalation Rule: If the CI check fails twice on the same task, the engine must halt operations, stop automated retry attempts, and notify the owner.
definition_of_done:
  - T1 auto-merge is successfully demonstrated and verified.
  - Kill Switch functionality is covered by tests and proven to instantly block autonomous merging when active.
  - Escalation rule is covered by tests and verified to stop retries upon double CI failure.
  - End-to-end telemetry and end-of-batch notifications are working correctly.
handoff_target: Fully autonomous execution for T1 changes.
owner_dependency: Don/Owner must enable "Allow auto-merge" in OL1 repository settings on GitHub, and manage the `BDC_KILL_SWITCH` environment variable if needed.
---
