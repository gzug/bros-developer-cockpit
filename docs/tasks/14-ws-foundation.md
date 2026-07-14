# TASK CARD: WS1 — Foundation: CI, DB, Deploy
---
goal: Establish continuous integration (CI) and automated deployment pipelines across BDC and OL1, and ensure Neon database schema persistence is live.
tier: T3
paths:
  - .github/workflows/ci.yml
  - vercel.json
constraints:
  - Avoid complex matrix builds, custom validation systems, or E2E suites. Focus on a single robust, green baseline path.
  - Automated deployment must occur via CI after merging to main, replacing the flaky Git-Vercel auto-deploy hook.
  - Require status check `ci` to pass before merging to `main` on both repos via Branch Protection.
definition_of_done:
  - CI workflow is active in both BDC and OL1 repos, running: `bun install` -> typecheck (`bun x tsc --noEmit --skipLibCheck`) -> test (`bun test`) -> build.
  - Vercel production deployment triggers autonomously on merge to main via CI, with verification that prod loads without console errors.
  - DB schema is migrated successfully using `drizzle-kit migrate` (or similar automated schema push).
handoff_target: BDC Runs Dashboard
owner_dependency: Don/Owner must provision the Neon `DATABASE_URL` secret in repository settings and Vercel environment variables, and configure the Vercel Deploy tokens for CI.
---
