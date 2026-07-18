# Co-Dev Flow v2 — one screen, PIN-gated, OTA/APK split

Status: owner-confirmed 2026-07-17; implemented on `origin/main` by #35 (`058a94e`)
and visually aligned by #36 (`cfb2de7`) on 2026-07-18.
Supersedes: the light/heavy weight classes (pipeline-v2 point 4) and the
owner-approval-on-every-ship rule for OTA-scope surface changes. Both replaced by the
owner decisions recorded here (2026-07-17).

## Role and screen model

- ONE identical screen layout for both PINs. The PIN decides what is active.
- Auth (owner decision 2026-07-17): BOTH codes are four digits — `APP_PIN` (Main-Dev) and
  `BROTHER_PIN` (Co-Dev), which must differ. One login field; the server resolves the role from
  whichever code matches. A `RoleSwitch` control in the header re-authenticates via the same
  login path so the owner can move between the Main-Dev and Co-Dev setups without logging out.
  Env vars are owner-set on Vercel (Preview + Production); secret values never enter an agent.
- Owner PIN (Main-Dev): everything enabled.
- Brother PIN (Co-Dev): locked features stay VISIBLE, greyed out, with a short
  "unlocks later" hint — so he can see what more experience will unlock.
- Server-side enforcement stays authoritative and unchanged (`requireOwner` on every
  owner mutation). UI visibility never grants execution.
- Co-Dev visibility map:
  - Active: chat, wish submission, OTA Queue interactions (below), Next APK list, Shipped list, Costs (read-only).
  - Greyed out: engine control (/dc), Run Logs, Stats/KPIs.
  - Builder Profile: visible-inactive with plain-language explainer (per Paxel decision).

## Categories: OTA vs Next APK (replaces light/heavy)

- Every task is classified `ota` or `next-apk`.
- Surface changes (colors, text, layout, screens) = OTA by default.
- Beyond-surface but still OTA-capable: the AI examines the wish more closely and
  attaches a NOTE (a hint, not a warning) that the change is deeper, and says so in
  the chat dialog.
- APK-needed (native code, permissions, dependencies): cannot ship via BDC. The AI
  explains why in plain language in the chat and adds the task to the Next APK list.

## Brother flow (chat-driven, core unchanged)

Brother writes freely in chat. The AI clarifies what he really wants (if not obvious),
splits complex wishes into ordered tasks, walks him through them for his go, then
feeds each task into the existing pipeline (issue → scoped engine → held PR).

## Ship authority (NEW)

- The brother ships his OTA-capable tasks HIMSELF. Confirmation happens in chat:
  "Ship task '<title>' now?" — Yes triggers the ship, No aborts.
- The safety net is unchanged: scoped engine + guardrails (UI-only diffs), held PRs
  validated by the `bdc-ship` workflow, the Next-APK gate for deep changes, and global
  arming stays owner-gated (`BDC_SHIP_ENABLED` fail-closed; BDC paused until the
  owner's APK + device proof gates are complete).

## Lists (cockpit, visible to both roles)

- **OTA Queue** — the ONLY list of open shippable tasks. Per-task actions:
  - `Delete`: removes the task (issue closed as not planned, record kept).
  - `Ship`: opens the chat confirmation above.
  - `Change`: opens the advisory chat dialog; the AI checks whether the change is
    easily implementable or breaks guardrails (e.g. would become APK-needed → task
    moves to Next APK with an explanation).
- **Next APK** — APK-needed tasks collected for the next APK build; each entry shows
  the plain-language reason. Ship is disabled with a "needs next APK" note.
- **Shipped** — history of shipped tasks. Nothing shippable lives here.

## Backlog (separate, later — do not build now)

- Per-preset cost analysis (cost per Build/Review/etc. preset). Real per-run USD cost
  already exists (OpenRouter usage.cost → costUsd) and is shown as-is to both roles.
- Co-Dev coaching system prompt / check-chain refinement stays its own workstream.

## Build order and gate

1. Historical build path: #35 replaced the stale #20/#21 readiness integration story and
   landed this screen model on `main`.
2. Current follow-up path: make the merged cockpit easier for a non-technical brother to
   understand without opening any paused shipping lane.
Gate: `bun install --frozen-lockfile` → `bun run build:dev` → `bun run typecheck` →
`bun test` → `NITRO_PRESET=node-server bun run build`.
