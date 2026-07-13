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

## Ops facts (verified 2026-07-13)
- Live: https://01-one-l1fe.vercel.app — Vercel project `01-one-l1fe`,
  team `gzugang-8969s-projects`, id `prj_7vvLn43fRC6nwbH3hDNtpC8soKfF`. Repo is `vercel link`ed.
- Git auto-deploy is FLAKY. After every merge to `main`: `npx vercel --prod --yes`,
  then verify prod loads with zero console errors.
- `vercel.json` bakes `NITRO_PRESET=vercel` (required — default preset emits the wrong
  output dir → 404). Reproduce the Vercel runtime locally with `NITRO_PRESET=node-server bun run build`.
- Cookie/request helpers: import from `@tanstack/react-start/server`, NEVER `vinxi/http`
  (crashes under the Vercel/Nitro runtime → 500 on server fns → client error boundary).
- `curl` against `/_serverFn/*` GET endpoints is not representative; verify server fns in a real browser.
- All 6 env vars (see `docs/setup-guide.md`) are set in Production + Preview. Secrets are Don's job only.
