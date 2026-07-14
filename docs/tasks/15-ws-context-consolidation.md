# TASK CARD: WS2 — Context Consolidation
---
goal: Streamline the repository entry points by consolidating context, deleting obsolete or duplicate documents, and structuring AGENTS.md as the single model-neutral source of truth.
tier: T1
paths:
  - AGENTS.md
  - CHECKPOINT.md
  - docs/OVERVIEW.html
  - docs/HANDOFF.md
  - docs/tasks/
  - docs/archive/
constraints:
  - Maintain absolute canonical separation of facts: current session status must live ONLY in the NOW section of AGENTS.md.
  - Completed tasks must be cleanly moved to `docs/archive/`. Duplicate task numbers (such as the two 11s) must be resolved uniquely.
  - Do not delete MIGRATION.md or setup-guide.md; maintain them as reference documents.
definition_of_done:
  - CHECKPOINT.md and docs/OVERVIEW.html are deleted.
  - docs/HANDOFF.md is reduced to a 3-line pointer pointing to AGENTS.md.
  - Completed task files (06-11) are renamed and archived under docs/archive/.
  - AGENTS.md is updated and restructured into NOW, RULES, MAP, and HANDOFF sections.
  - All repository tests (`bun test`) and TypeScript compilation run green.
handoff_target: Completed and validated in the current session.
owner_dependency: None. Fully executable by the Projektleiter.
---
