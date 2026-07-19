# BDC boundary matrix — 2026-07-19

This is the executable boundary index for BDC-64-03 / #68. It records current
caller expectations and points to the contract tests that protect them. This
PR documents the current behavior; it does not redesign protected flows.

## Caller and role boundaries

| Capability                                                                  | Anonymous           | Brother                       | Owner                         | Evidence                                                                         |
| --------------------------------------------------------------------------- | ------------------- | ----------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| Login with a valid brother PIN                                              | rejected            | session role `brother`        | n/a                           | `boundary-matrix.test.ts`                                                        |
| Login with a valid owner PIN                                                | rejected            | n/a                           | session role `owner`          | `boundary-matrix.test.ts`                                                        |
| Ideas, Plan, Done, idea detail, Chat, Help                                  | no session          | allowed after `requireAuth()` | allowed after `requireAuth()` | server functions in `ideas.functions.ts`, `chat.server.ts`, `app-help.server.ts` |
| Submit/create/update/delete idea actions                                    | no session          | allowed after `requireAuth()` | allowed after `requireAuth()` | `ideas.functions.ts` + auth tests                                                |
| Complete, process, poll, approve, request changes, confirm live, owner KPIs | no session          | rejected by `requireOwner()`  | allowed by `requireOwner()`   | `ideas.functions.ts` and owner route `beforeLoad` guards                         |
| Control, Runs, Skills, Prompts, Owner KPI routes                            | redirected/rejected | redirected to `/dashboard`    | allowed                       | route `beforeLoad` guards                                                        |

Partial PIN configuration is intentional: one valid four-digit role may be
configured alone. Missing, malformed, or equal credentials fail closed.
Session values require a signed cookie, a known role, a positive timestamp,
and a thirty-day lifetime with a one-minute future-skew allowance. `safeNext`
accepts local paths and rejects cross-origin or backslash redirects.

## Ownership and lifecycle boundaries

| Boundary                  | Current contract                                                                                                                                                                                           | Test evidence                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| BDC issue ownership       | A pipeline issue must be an Issue (not a PR) and carry both `bdc-submitted` and `from-brother`.                                                                                                            | `boundary-matrix.test.ts`, `github-issues.test.ts`              |
| Held PR ownership         | Exact branch `bdc-hold/dc-issue-N`, base `main`, author `gzug`, and an exact `Resolves: gzug/01-One-L1fe#N` marker are required.                                                                           | `github-issues.test.ts`                                         |
| Duplicate/closed held PRs | Current selection is the first exact match returned by GitHub; state is checked by the owner action before approval/request-changes. This is exposed as a contract so a later policy change is deliberate. | `github-issues.test.ts`                                         |
| Approval/live authority   | Approval and live confirmation are owner-only; paused shipping and merged-PR/device confirmation remain separate gates.                                                                                    | `ideas.functions.ts`, `engine.test.ts`, `github-issues.test.ts` |

## Model honesty boundaries

| Context               | Allowed                                                              | Must not imply                                                      | Evidence                                         |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| App Help              | short explanation of real cockpit screens/statuses                   | invented people/screens or unsupported published/live status        | `bdc-honesty.test.ts`, `boundary-matrix.test.ts` |
| Chat Q&A              | direct answer without forced rewrite metadata                        | a `Refined version:` label for a pure question                      | `chat.server.ts`, `bdc-honesty.test.ts`          |
| Chat rewrite          | concise refined version preserving the user meaning                  | invented status/person claims                                       | `chat.server.ts`, `bdc-honesty.test.ts`          |
| Engine prepared patch | JSON summary plus path/content edits, then protected-path validation | arbitrary files, missing fetched context, or non-string edit fields | `bdc-honesty.test.ts`, `engine.server.ts`        |

## External-error boundaries

- GitHub HTTP failures remain explicit (`GitHub <status> ...`) and do not turn
  into a successful lifecycle result.
- Missing `DATABASE_URL` and DB write failures are observability failures only:
  the in-process memory record remains available and the caller does not fail.
  GitHub remains the source of truth.
- Unknown GitHub labels are preserved by the issue projection rather than
  treated as proof of a supported BDC lifecycle state.

## Protected-path review

No changes in this PR alter auth/session implementation, `requireOwner`, PIN
policy, pause behavior, approval writes, paths, workflows, schema/migrations,
secrets/env values, or shipping authority. The only runtime export added is a
pure PR-selection helper used to make the existing first-match rule testable.

Overlap with #34: this PR adds executable evidence around the existing
boundary assumptions; it does not implement the separate security hardening
scope represented by #34.
