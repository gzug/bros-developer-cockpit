# Idea Pipeline cleanup — 2026-07-19

## Verification

The current BDC source at `origin/main` (`35780ae`) projects ideas through
`listIdeas()` in `src/lib/github-issues.server.ts`:

- GitHub is queried with the `bdc-submitted` label.
- A second `from-brother` label is required before an issue becomes a cockpit
  idea.
- Pull requests are excluded.
- The Plan view renders only the resulting active, parked, and published
  groups.

The local Plan view was also opened at `http://localhost:8080/pipeline` in a
test-only owner session. It showed `Direct to phone 0`, `Next app version 0`,
and `Published 0`; none of issues #8, #13, #58, or #59 was visible.

## Decisions

| Issue | Evidence | Decision |
| --- | --- | --- |
| #58 | `skill-evidence` metadata only; no BDC submission labels | Close as `not_planned`; this is upload metadata, not a brother task. |
| #59 | Same metadata-only shape as #58 | Close as `not_planned`; this is upload metadata, not a brother task. |
| #8 | Old engine goal from 2026-07-13; its requested UI/security work is already represented by current merged work and it is not a BDC submission | Close as `not_planned` as stale/superseded. |
| #13 | Current `src/routes/_authenticated/dc.tsx` contains zero `any` casts; it is not a BDC submission | Close as `completed`; the requested type cleanup is already present. |

No new projection exclusion was added: the existing label contract already
keeps these records out of the Ideas/Plan view. The regression test records
that skill-evidence metadata and incomplete BDC labels remain ineligible.

The [BDC-64] queue remains separate. Issues #67–#70 were not changed by this
cleanup slice, and the Don Chat showcase integration was not started.
