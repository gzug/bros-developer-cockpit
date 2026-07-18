
# Companion-App für 01-One-L1fe — historischer Plan

Status: superseded. This file is kept as historical Lovable planning context only.
Current BDC truth lives in `CHECKPOINT.md`, `AGENTS.md`, `docs/setup-guide.md`, and
`docs/planning/codev-flow-v2-spec.md`. As of 2026-07-18, #35 (`058a94e`) and #36
(`cfb2de7`) are merged into `origin/main`; BDC remains paused and all shipping paths
stay fail-closed until explicit owner approval and real device evidence.

## Historische Entscheidungen (nicht als aktuelle Bauanweisung verwenden)

| # | Entscheidung |
|---|---|
| Channel | Ein einziger `production`-Channel. Kein separater `brother-preview` — Bro ist einziger User, macht keinen Unterschied. |
| CI-Gate | TS-Check + Build sind Pflicht vor jedem OTA. ~2-3 Min Delay, dafür kein bricked App. |
| Rollback | Update-History-Liste. Er sieht letzte N Deployments, wählt Ziel-Version. |
| EAS-Setup | Ich schreibe dir eine Schritt-für-Schritt-Anleitung als `.md`-Datei. Du führst sie einmalig im 01-One-L1fe-Repo aus. |
| Code-Gen | Companion darf selbst Code generieren + committen (Lovable AI Gateway, `openai/gpt-5.5`). |
| Native-Changes | Nicht via OTA. Auto-Sammlung in `NEXT_APK.md` im Repo bis zum nächsten Sammel-APK-Build. |

## Was wird gebaut (Companion-App)

### Backend (Lovable Cloud)

**DB-Tabellen:**
- `ideas` — Text-Input vom Bruder, Status, Timestamps.
- `patches` — AI-generierte Diffs, Prompt, Model, Kosten.
- `deployments` — EAS-Update-IDs, Commit-SHA, Status, Rollback-Ziel.
- `user_roles` (owner/reviewer) via `has_role`-Function.

**Server Functions (`createServerFn`):**
1. `submitIdea(text)` → speichert Idee, triggert `generatePatch`.
2. `generatePatch(ideaId)` → holt Repo-Kontext via GitHub API, ruft Lovable AI, speichert Diff.
3. `applyGuardrails(patch)` → prüft Pfade gegen Whitelist/Blacklist. Blacklist → NEXT_APK.md-Flow.
4. `shipPatch(patchId)` → Branch + Commit + PR im 01-One-L1fe-Repo, triggert GitHub Action.
5. `pollDeploymentStatus(deploymentId)` → GitHub Action + EAS-Status abrufen.
6. `rollbackTo(deploymentId)` → EAS `update:republish` auf gewählte Version.
7. `appendToNextApkEpic(ideaId)` → hängt Idee an `NEXT_APK.md` an.

**Guardrails:**
- Whitelist: `src/**`, `assets/**` (außer `assets/native/**`).
- Blacklist: `app.json`, `app.config.*`, `package.json`, `package-lock.json`, `bun.lock`, `android/**`, `ios/**`, `eas.json`, `.github/workflows/**`.

### Frontend (TanStack Start)

**Routes:**
- `/` — Landing, redirect zu `/dashboard` wenn eingeloggt.
- `/auth` — Login (Google + Email/Password).
- `/_authenticated/dashboard` — Aktive Ideen + neuer Idee-Input.
- `/_authenticated/idea/$id` — Detail: Idee, generierter Diff, Guardrail-Check, Ship-Button, Live-Status.
- `/_authenticated/history` — Alle Deployments mit Rollback-Button.

**UI-Design:**
- Mobile-first (er nutzt es am Handy).
- Dunkles Theme, ruhig, fokussiert. Kein AI-Purple-Gradient-Look.
- Kern-Screens: Textarea groß, Ship-Button prominent, Live-Status als Timeline.

### Voraussetzungen (Secrets, die ich anfragen werde)

- `GITHUB_TOKEN` (Fine-grained PAT, nur `01-One-L1fe`, Contents+PR write)
- `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`
- `EXPO_TOKEN` (Expo Personal Access Token, für EAS Update)
- `EAS_PROJECT_ID`

`LOVABLE_API_KEY` ist bereits provisioniert.

### Vorarbeit im 01-One-L1fe-Repo (deine Handarbeit, nicht Companion)

Ich schreibe dir `docs/EAS_SETUP.md` mit exakten Commands:
1. `expo-updates` installieren + konfigurieren.
2. `eas.json` anlegen mit `production`-Channel + Runtime-Version-Policy.
3. `.github/workflows/companion-ota.yml` — bei Push auf `brother/*`-Branches: `bun install` → `tsc --noEmit` → `bun run build` → `eas update --branch production`.
4. Neuen APK bauen und Bro installieren lassen (letztes Mal manuell).

Danach fließt alles über die Companion.

## Ausbau-Reihenfolge

**Etappe 1 (jetzt):**
- Secrets anfordern.
- DB-Migration.
- Auth (Google + Email/PW, user_roles).
- EAS-Setup-Guide als `docs/EAS_SETUP.md`.
- UI-Skelett: Landing, Auth, Dashboard, Idee-Detail, History.
- Server Fn `submitIdea` (speichert nur, kein AI-Call).

**Etappe 2 (nach Secrets):**
- `generatePatch` (Lovable AI + GitHub API Repo-Kontext).
- `applyGuardrails` + NEXT_APK-Flow.
- `shipPatch` (GitHub PR + Branch).
- GitHub-Action-Template im 01-One-L1fe-Repo.
- Live-Status-Polling.
- Rollback-Flow.

## Was NICHT im MVP ist

Multi-user Rollen komplex, PR-Reviews in-app, Model-Auswahl-UI, Voice-Input, Screenshot-Upload, Notifications.

Bestätige mit "Los" und ich starte Etappe 1.
