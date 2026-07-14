# TASK CARD: WS3 — Orchestration Contract (Mode 1)
---
goal: Standardize delegation and task tracking between the BDC Orchestrator and worker instances, merge the Runs UI (PR #9), and set up explicit approval workflows.
tier: T2
paths:
  - src/routes/_authenticated/dc.tsx
  - src/routes/_authenticated/runs.tsx
  - src/lib/github-issues.server.ts
  - src/lib/ideas.functions.ts
constraints:
  - Avoid creating a custom rule engine, SemVer rulesets, or schema validators. Task cards remain in Markdown.
  - Avoid adding arbitrary new run states; retain the core pipeline and add only `needs_clarification` and `rejected` as necessary branches.
  - Configure the three risk tiers (T1, T2, T3) as standard GitHub Labels in OL1 rather than implementing custom code.
  - CODEOWNERS must be set up in OL1 to protect T3 paths (Health logic, Workflows, Secrets).
definition_of_done:
  - Task Card Markdown Template is adopted as the sole standard for worker delegation.
  - Cockpit Runs UI (PR #9) is merged, deployed, and displaying live data on `/runs` and `/dc`.
  - GitHub Labels (tier:T1, tier:T2, tier:T3) are active and applied to Cockpit-generated PRs.
  - Codebase test suite (`bun test`) includes coverage for the new status transitions (`needs_clarification`, `rejected`).
handoff_target: BDC Runs & Cockpit Dashboard
owner_dependency: Don/Owner must create the labels on OL1, set up CODEOWNERS in OL1, and perform manual approvals/merges for T2 and T3 changes.
---
