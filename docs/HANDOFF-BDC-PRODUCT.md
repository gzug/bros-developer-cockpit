# Handoff: BDC als eigenständiges Produkt — technische Generalisierung

_Erstellt: 2026-07-17 | Kontext: Strategie-Review (PR #287 in 01-One-L1fe) hat BDC als die stärkere Produktidee identifiziert_

---

## Entscheidung

Der Owner hat nach einem umfassenden Strategie-Review entschieden:
- **BDC wird als eigenständiges Produkt weiterentwickelt**, nicht nur als internes Tool
- **One L1fe bleibt Familienprojekt** und dient als erster Kunde / Testfeld für BDC
- Die Insight Engine (One L1fe) wird beibehalten, aber nicht priorisiert
- **Fokus: technische Generalisierung** von BDC (Multi-Repo, Multi-Tenant, konfigurierbare Zonen)

## Warum BDC die bessere Wette ist (Kurzfassung)

- Kein Produkt weltweit macht das: nicht-technische Person → Feedback → AI implementiert innerhalb harter Dateizonen → auto-ship → ein-Klick-Revert
- Feedback-Tools (Canny, Productboard) stoppen bei Priorisierung — keins implementiert oder shippt
- Coding-Agents (Devin $26B, Cursor $29B, OpenHands) sind für Entwickler gebaut, nicht für nicht-technische Stakeholder
- Sweep.dev versuchte das Issue-to-PR-Modell und gab auf — aber ohne Zone Guard (BDCs Kernarchitektur-Einsicht)
- No-Code-Builder (Lovable, v0) bauen neu; keiner pflegt sicher eine bestehende Codebasis
- Vollständige Analyse: `01-One-L1fe/docs/strategy/project-research-strategy-2026-07.md`

## Was BDC heute ist (IST-Zustand)

### Architektur
- **Stack:** TanStack Start + Drizzle ORM + Neon DB
- **Auth:** PIN via `APP_PIN` env var (SHA-256 + timingSafeEqual)
- **Target Repo:** Hard-coded auf `gzug/01-One-L1fe`
- **AI Engine:** OpenRouter API (Model-Cascade), Zone Guard (green/yellow/red Dateipfad-Allowlist)
- **Ship Pipeline:** `bdc-ship.yml` GitHub Action → validate → squash-merge → EAS OTA publish
- **Deploy:** Vercel (manuell via `npx vercel --prod --yes`)

### Was funktioniert
1. PIN-Login → Web-UI
2. `/submit?context=<screen>&type=idea|change` → strukturiertes GitHub Issue in `gzug/01-One-L1fe`
3. AI Engine scoped Request, öffnet PR auf `bdc-hold/*` Branch
4. Owner-Approval in `/dc` → labelt PR `bdc-approved`
5. `bdc-ship` Workflow → validate → squash-merge → EAS OTA → Kommentar mit Update-Group
6. Revert: ein Befehl

### Harte Beschränkungen (aktuell)
- 1 Repo (`gzug/01-One-L1fe`)
- 1 Stakeholder (PIN, kein User-Management)
- Zone Guard ist hard-coded, nicht konfigurierbar
- Keine Multi-Tenant-Architektur
- Kein BYOK (Bring Your Own Key) für OpenRouter/LLM

## Was generalisiert werden muss (SOLL-Zustand)

### Prio 1 — Kern-Generalisierung
1. **Multi-Repo:** Target-Repo als Konfiguration statt Hard-Code. Repo-Verbindung via GitHub App oder PAT.
2. **Konfigurierbare Zone Guards:** Zone-Definitionen (green/yellow/red) pro Repo konfigurierbar, nicht hard-coded. UI zum Definieren der Zonen.
3. **User-Management:** Echte Auth (OAuth/GitHub Login) statt PIN. Mehrere User pro Workspace.
4. **Multi-Tenant:** Workspace-Konzept. Ein BDC-Deployment bedient mehrere Kunden/Repos.

### Prio 2 — Produktreife
5. **BYOK (LLM-Keys):** User bringt eigenen OpenRouter/Anthropic/OpenAI Key mit.
6. **Konfigurierbare Ship-Pipeline:** Nicht jeder nutzt EAS OTA. Generische "was passiert nach Approval"-Hooks.
7. **Dashboard/Analytics:** Was wurde submitted, implemented, approved, shipped, reverted.
8. **Onboarding:** Repo verbinden → Zonen definieren → erster Test-Submit → fertig.

### Prio 3 — Differenzierung
9. **Audit Trail:** Vollständige Historie: wer hat was vorgeschlagen, was hat die AI daraus gemacht, wer hat approved, was wurde shipped.
10. **Revert-UI:** Ein-Klick-Revert direkt in der Web-UI (aktuell CLI-only).
11. **Skill-Tracking:** Welche Arten von Änderungen schafft die AI zuverlässig vs. wo braucht sie Hilfe (langfristig).

## Dateien die relevant sind

| Was | Wo |
|---|---|
| BDC Codebase | `bros-developer-cockpit/` (dieses Repo) |
| BDC CHECKPOINT | `bros-developer-cockpit/CHECKPOINT.md` |
| BDC AGENTS | `bros-developer-cockpit/AGENTS.md` |
| Zone Guard Design | `01-One-L1fe/docs/planning/bro-contribution-pipeline.md` |
| Ship Pipeline (GitHub Action) | `01-One-L1fe/.github/workflows/bdc-ship.yml` |
| Strategie-Review | `01-One-L1fe/docs/strategy/project-research-strategy-2026-07.md` |
| Cross-Validation Prompt | `01-One-L1fe/docs/strategy/cross-validation-prompt.md` |
| One L1fe MAP | `01-One-L1fe/session/MAP.md` |
| One L1fe CHECKPOINT | `01-One-L1fe/CHECKPOINT.md` |

## Session-Start-Prompt für die nächste Session

Paste das hier in eine neue Claude Code Session mit beiden Repos:

```
Du bist Projektleiter für die technische Generalisierung von BDC (Bros Developer Cockpit)
als eigenständiges Produkt.

Lies zuerst:
1. bros-developer-cockpit/docs/HANDOFF-BDC-PRODUCT.md (dieses Dokument — Kontext + Entscheidungen)
2. bros-developer-cockpit/CHECKPOINT.md (aktueller Stand)
3. bros-developer-cockpit/AGENTS.md (Betriebsregeln)
4. 01-One-L1fe/docs/strategy/project-research-strategy-2026-07.md (warum BDC die bessere Wette ist)
5. 01-One-L1fe/docs/planning/bro-contribution-pipeline.md (Zone Guard Design)

Dann: starte mit Prio 1 der Generalisierung. Erster Schritt: Multi-Repo-Unterstützung
(Target-Repo als Konfiguration statt Hard-Code). Analysiere den aktuellen Code, identifiziere
alle Stellen wo `gzug/01-One-L1fe` hard-coded ist, und erstelle einen Plan.
```
