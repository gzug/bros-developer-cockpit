# BDC CHECKPOINT

_Updated 2026-07-15 — readiness/security repair merged to `claude/brother-readiness-handoff-4b0kt7`; production handoff remains blocked pending owner secrets and device proof._

## Current verdict

The web app and local build are functional, but the brother handoff is **not complete**. No real BDC
wish has yet passed issue → held PR → owner approval → GitHub Action → EAS update group → phone
confirmation. Do not send the production PIN or claim the pipeline works end to end until that proof exists.

## Verified production identity

- URL: https://bros-developer-cockpit.vercel.app
- Vercel project: `bros-developer-cockpit`
- Project ID: `prj_S53pvisoyTbyrCx2Or0DVJsq4mwb`
- Team: `gzugang-8969s-projects`
- The previously documented `https://01-one-l1fe.vercel.app` deployment is not the BDC production app.

## Readiness repair

- Separate signed `brother` and `owner` sessions.
- Same-origin CSRF middleware protects every TanStack server-function request.
- Login attempts and brother actions have durable database-backed quotas in production.
- `BROTHER_PIN` is the four-digit brother code; `APP_PIN` is an owner-only passphrase of at least
  12 characters. Malformed credentials fail closed.
- Owner-only server guards cover `/dc`, `/runs`, `/owner-kpi`, polling, processing, approvals,
  change requests, run data, KPI data, and live confirmation.
- Brother navigation contains only wishes and new submission; idea details expose no GitHub/PR controls.
- Direct contextual submission links survive login.
- Both submission routes apply server-side guardrails; model input is fenced as untrusted text.
- The engine defaults to paused unless `BDC_PAUSED=false` is set explicitly.
- Approval is also blocked while paused; GitHub must separately have `BDC_SHIP_ENABLED=true`.
- Multi-file engine patches use one atomic Git tree/commit and abort if the held branch moved.
- Model retries finish before GitHub mutation; deterministic issue branches reconcile lost responses and
  concurrent retries instead of creating duplicate branches, commits, or PRs.
- Lifecycle now distinguishes `approved`, `shipped` (OTA published), `live` (phone-confirmed), and
  post-merge `publish failed`.
- Unknown dashboard usage and GitHub failures no longer render as reassuring zero/empty states.
- Correct privacy copy discloses private GitHub/OpenRouter processing and asks for no health data.

## Validation evidence

- `bun test`: 129 passed, 0 failed.
- `bun run typecheck`: passed after route generation/build.
- `NITRO_PRESET=node-server bun run build`: passed.
- Local browser smoke at 390 × 844:
  - brother code lands on `/dashboard`;
  - brother `/dc` access redirects to `/dashboard`;
  - owner code lands on `/dc` and owner navigation is available;
  - logged-out `/submit?context=Home&type=change` returns to the same populated form after login;
  - landing, auth, wish picker, submission form, dashboard errors, and owner console were visually checked.

## Blocking owner/release actions

1. Set a distinct four-digit `BROTHER_PIN` in Vercel Production and Preview. Do not share `APP_PIN`.
2. Redeploy and repeat the two-role browser smoke on production.
3. Resolve the One L1fe Android native-baseline/runtime gap and establish an intentional, phone-confirmed
   production baseline before any BDC shipment.
4. Set One L1fe repository variable `BDC_PRODUCTION_BASE_SHA` to that exact confirmed main SHA.
5. Run one harmless copy-only wish through the full production path and retain the issue, PR, Action run,
   EAS group, runtime, merge SHA, and phone confirmation as evidence.

## Open PR disposition

Stale Jules PRs #16 (Paxel analytics) and #17 (context consolidation) were closed 2026-07-15 — both were several commits behind main and unreviewed. Branches are preserved.

The readiness repair (PR #20, branch `fix/readiness-pipeline-20260715`) is merged into the integration branch `claude/brother-readiness-handoff-4b0kt7`. A draft PR is open for owner review.

Canonical architecture: `docs/MIGRATION.md`. Environment and acceptance: `docs/setup-guide.md`.
