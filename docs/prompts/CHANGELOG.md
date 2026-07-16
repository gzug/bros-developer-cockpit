# Projektleiter Prompt Versions

Rule: every future adjustment of the PL prompt must create one new version file and one changelog row. Use at most one prompt version per session.

| Version | Date | What changed | Why | Expected effect |
|---|---|---|---|---|
| v1 | 2026-07-16 | Snapshotted the current `docs/HANDOFF.md` Projektleiter prompt into `docs/prompts/pl-prompt-v1.md`. | Resume prompt versioning on top of the BDC eval-framework concept. | Establish a stable baseline for later prompt-effect comparisons. |
| v2 | 2026-07-16 | Superseded v1 with a pointer to the canonical current session-start prompt (01-One-L1fe mission board) + a Codex-fallback delta; banner-marked v1 stale. | v1 had gone false after the re-orientation: it claimed the app is live and described retired lanes (batch gate, bdc-hold, reviewer). A single current source avoids drift. | Future PLs read the true current state (NOT READY, board frozen, APK-first), not a stale "live" prompt. |
