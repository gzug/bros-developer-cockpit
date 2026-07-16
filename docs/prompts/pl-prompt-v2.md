# Projektleiter prompt — v2 (supersedes v1)

`pl-prompt-v1.md` is **STALE** and must not be used: it claims the app is "live and healthy" and
describes retired systems (the batch gate, `bdc-hold/*` lanes, the reviewer era). After the 2026-07-16
re-orientation those statements are false.

**The canonical, current PL session-start prompt is a single source — do not copy it here.** It lives in
the `01-One-L1fe` repo:
`docs/planning/next-session-mission-board.md` → "Session-start prompt (paste to launch the next session)".

It reflects today's reality: the project is **NOT READY**, the mission board is **FROZEN**, and the one
priority is getting one production APK onto the brother's phone (owner-gated steps in
`docs/ops/owner-apk-handoff-plain.md`). Truth files: `AGENTS.md` (wins over everything), `CHECKPOINT.md`,
the mission board, and `git log origin/main` + open PRs.

## Codex-fallback delta

If **Codex** (rather than Claude) steps in as PL: it has no `/grill` skill and no in-chat question
widget — so ask the owner decisions as **plain-text options with a recommended default**. Everything else
is identical to the canonical prompt above.
