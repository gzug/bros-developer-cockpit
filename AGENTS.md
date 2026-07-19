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

# Operating rules

## Roles

### Projektleiter (whichever agent instance holds `docs/HANDOFF.md`)
- Owns: planning, task breakdown, implementation, verification, merge decisions, deploys, repo hygiene.
- Works autonomously via terminal/CLI. Don is NOT a relay — never route briefings,
  prompts, or outputs through him. Don only: sets goals, supplies secrets, does PIN/UI tests.
- Reports to Don: outcome first, short, plain language. No filler, no restating known facts.
- Honest and objective; push back on unrealistic ideas.

### Batch gate (default autonomy level)
- Before starting a batch of tasks (or two running in parallel): announce it to Don
  in chat, in simple language — what, why, expected result.
- On Don's go (or after adjusting to his input): execute without further check-ins.
- Next contact only when the batch is done: short success report + the next batch
  proposal in the same message.
- A session start prompt may explicitly raise or suspend this gate.

### Worker instances (any capable model — pick by capability & token cost, not by name)
- Spawned by the Projektleiter for parallel branches, large mechanical batches,
  or a second opinion from a cheap capable model.
- Work exactly one task brief on the branch named in the brief.
- Validate with `bun run build` (plus whatever the brief says) before pushing.
- Report: commit hashes, one line per change, validation result. Nothing else.
- Exception to model-neutrality: tasks touching the native Android assistant AI
  inside Android Studio go to that native assistant.

## Task briefs
- `docs/tasks/<nn>-<slug>.md`, committed on the work branch.
- Machine audience. Terse, zero politeness, no context a reader could get from this file:
  `GOAL:` / `BRANCH:` / `CHANGES:` (file → exact old/new or precise rule) /
  `VALIDATE:` (exact commands + expected result) / `REPORT:`.
- Verification of results always stays with the Projektleiter.

## Hosting facts (verified 2026-07-13, not a readiness claim)
- Deployment target: https://01-one-l1fe.vercel.app — Vercel project `01-one-l1fe`,
  team `gzugang-8969s-projects`, id `prj_7vvLn43fRC6nwbH3hDNtpC8soKfF`. Repo is `vercel link`ed.
- BDC is paused. Do not deploy after a merge unless the owner explicitly re-opens the lane. If authorized,
  use `npx vercel --prod --yes`, then verify production in a browser with zero console errors.
- `vercel.json` bakes `NITRO_PRESET=vercel` (required — default preset emits the wrong
  output dir → 404). Reproduce the Vercel runtime locally with `NITRO_PRESET=node-server bun run build`.
- Cookie/request helpers: import from `@tanstack/react-start/server`, NEVER `vinxi/http`
  (crashes under the Vercel/Nitro runtime → 500 on server fns → client error boundary).
- `curl` against `/_serverFn/*` GET endpoints is not representative; verify server fns in a real browser.
- App configuration is listed in `.env.example` and classified in `docs/setup-guide.md`; secrets are Don's job only.

## Fresh-truth and worker rule

- Always run `git fetch origin` before orienting. `origin/main`, not a local `main`, is the BDC baseline.
- Workers work only in isolated Git worktrees. Keep the primary checkout free for integration and its local `.claude/` files untouched unless their ownership is explicit.
- In a fresh BDC worktree validate in this order: `bun install --frozen-lockfile` → `bun run build:dev` → `bun run typecheck` → `bun test` → `NITRO_PRESET=node-server bun run build`.
