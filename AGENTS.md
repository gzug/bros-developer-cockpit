<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Developer Cockpit (BDC) operating rules

## 1. NOW
- **Status:** Main branch is clean and active. App is localized to English. Local development and tests are fully functional.
- **Blocked:** Neon DATABASE_URL needs provisioning in GitHub settings by the owner to enable live run data on /runs.
- **Backlog:** Add "DC" navigation link to AppHeader; verify owner-kpi.tsx N+1 fix (Issue #8 Task 2c); sync issue status.
- **Active Tasks:** Task briefs 12 (E2E audit) and 13 (scout) are open in `docs/tasks/`. 14-17 are added as future workstreams.

## 2. RULES (Condition → Consequence)
- **Commit is pushed** → Never force-push, rebase, amend, or squash on the connected branch (protects Lovable history).
- **Secrets required** → Store secrets strictly at execution site (Vercel env for BDC, GitHub Actions/EAS for OL1). Never set EXPO_TOKEN in BDC, never set DATABASE_URL in OL1. Never commit secrets, keys, or PINs to git/docs.
- **Merge to main complete** → Manually deploy via `npx vercel --prod --yes` and verify production loads with zero console errors (replaces flaky Vercel auto-deploy). This rule will be replaced by the WS1-CI automation.
- **PR or branch created** → Verify build using `bun x tsc --noEmit --skipLibCheck` and run `bun test` to ensure zero regressions.
- **Risk classification**:
  - **tier:T3 (Health-Logik / Tracking-Schema / Workflows / Secrets)** → Always requires human owner approval and manual merge.
  - **tier:T2 (Other Application Code)** → Requires developer/agent verification and owner confirmation before merging.
  - **tier:T1 (Docs / Copy / UI-Kosmetik)** → Eligible for auto-merging and auto-shipping once WS4 automated flow is active.
- **Observability Layer (Neon / Postgres)** → Keep DB-writes completely null-safe and wrapped in `safe()` helpers. DB-write failures or missing DATABASE_URL must never block engine execution or run creation (GitHub remains sole source of truth).
- **Single Source of Truth** → Maintain exactly one canonical source per fact. Current session-state resides strictly in the NOW section of `AGENTS.md`. Cross-repo: OL1's AGENTS.md points to BDC as orchestrator, BDC's points to OL1 as execution target.

## 3. MAP
- `src/routes/`           TanStack Start file routes (_authenticated/* = PIN-gated)
- `src/lib/`              Server functions (*.functions.ts = client-callable)
- `src/lib/db/`           Drizzle schema + runs persistence (null-safe helpers)
- `src/components/`       Shared UI (AppHeader, …)
- `docs/tasks/`           Active task briefs (current: 12-17)
- `docs/archive/`         Completed sessions & historical docs
- `docs/MIGRATION.md`     Reference: repo migration history
- `docs/setup-guide.md`   Reference: local setup
- `.claude/launch.json`   Dev servers (dev :3001, preview :4173)
- `drizzle/`              Migrations

## 4. HANDOFF

### Task Card Template (Markdown format)
```markdown
# TASK CARD: <Title>
---
goal: <Clear statement of what needs to be achieved>
tier: <T1 | T2 | T3>
paths:
  - <allowed/modified files relative path>
constraints:
  - <strict bounds, allowed libraries, forbidden operations>
definition_of_done:
  - <verifications, exact tests, compile checks, exit criteria>
handoff_target: <where to report or transition status>
owner_dependency: <Optional: Don/Owner actions needed, e.g. secrets or approvals>
---
```

### 5-Point Session-Close Checklist
1. **Verification:** All tests pass (`bun test`) and TypeScript compilation is error-free (`bun x tsc --noEmit --skipLibCheck`).
2. **Build:** Production build compiles locally (`NITRO_PRESET=node-server bun run build`) with zero runtime errors.
3. **Deployment:** If main was merged, production is updated via CLI and validated live (zero browser/console errors).
4. **State Sync:** Active session state has been captured and updated in the **NOW** section of `AGENTS.md`.
5. **Clean Archiving:** All completed task briefs are moved to `docs/archive/` with unique names.
