# BDC current architecture

_Replaces the historical Lovable-import plan. Verified against live code on 2026-07-15._

## Purpose

Bros Developer Cockpit is the private, brother-facing wishes channel for One L1fe. The brother uses
plain English and never sees GitHub or release controls. The owner reviews every generated change.

## Trust boundary

- `BROTHER_PIN`: four-digit brother session. May refine, submit, list, and read wishes.
- `APP_PIN`: distinct owner passphrase of at least 12 characters. May run the engine, inspect runs, approve or reject held PRs,
  and confirm an already-published update on the phone.
- Owner routes and mutations use server-side `requireOwner()` checks. Hidden navigation is only a UX aid.
- Sessions are HMAC-signed, expire after 30 days, and reject unknown roles or future timestamps.
- GitHub access is hard-coded to `gzug/01-One-L1fe`; the BDC PAT has no workflow permission.
- Brother input is checked on every submission path and fenced as untrusted text before model calls.

## Flow

1. A brother wish creates a GitHub issue labeled `from-brother` and `bdc-submitted`.
2. The owner starts processing. OpenRouter may edit only the configured presentation paths.
3. BDC writes all proposed files in one Git tree/commit and opens
   `bdc-hold/dc-issue-<issue-number>`.
4. The owner reviews and applies `bdc-approved` to that exact held PR.
5. One L1fe's trusted `bdc-ship` workflow validates without write credentials, rechecks the base,
   merges the exact reviewed head, and publishes only when the confirmed production baseline matches.
6. A successful EAS update is `shipped`, not `live`. `live` requires a separate phone check.

Lifecycle:

```text
submitted → processing → sent → approved → shipped → live
                       ↘ blocked       ↘ publish failed
```

## Operational limits

- Processing is owner-triggered/polled, not a durable background worker. A stuck `processing` item can
  be retried manually in `/dc`.
- GitHub Free private-repository rulesets are unavailable; the trusted workflow and owner review are the gate.
- A local build is not end-to-end proof. Keep the bridge disabled until one harmless production wish has
  produced an Action run, EAS update group, and phone confirmation.
- No health data belongs in BDC. Refinement text is processed through OpenRouter and accepted wishes are
  stored in the private GitHub repository.

## Current production identity

- URL: https://bros-developer-cockpit.vercel.app
- Vercel project: `bros-developer-cockpit`
- Project ID: `prj_S53pvisoyTbyrCx2Or0DVJsq4mwb`
- Team: `gzugang-8969s-projects`

Environment and acceptance steps are canonical in `docs/setup-guide.md`.
