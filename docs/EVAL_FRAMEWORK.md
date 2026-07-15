# LLM Eval & Orchestration Framework — Vision & Roadmap

> **Status:** Konzept abgelegt — 15. Juli 2026  
> **Verantwortlich:** Projektleiter (BDC)  
> **Scope:** Bros Developer Cockpit (BDC) + One L1fe Android App

---

## Was ist das?

Dieses Dokument beschreibt die Architektur und den Aufbauplan für ein **kostengünstiges, automatisiertes LLM-Evaluierungs- und Orchestrierungs-Framework**, das direkt im BDC verankert ist.

Ziel ist es, die wachsende Anzahl an AI-Agenten-Workflows (Projektleiter, UI Worker, Data Worker, Android Agent) so zu steuern, dass:

- **Qualität automatisch gemessen wird** — nicht erst wenn etwas schiefläuft
- **Modelle kostenbewusst eingesetzt werden** — billig wo billig reicht, teuer nur wo nötig
- **Regressionssicherheit besteht** — ein Model-Swap bricht nichts, ohne dass wir es merken
- **Der Workflow orchestrierbar bleibt** — klar getrennte Rollen, saubere Handoffs, messbare Outputs

---

## Warum jetzt?

Das System wächst. Wir haben:
- Zwei aktive Repos (`bros-developer-cockpit`, `01-One-L1fe`)
- Mehrere Agenten-Rollen (Projektleiter BDC, Projektleiter Android, UI Worker, Data Worker)
- Verschiedene Modelle (OpenRouter Free, Gemini 2.5 Flash, Coding Worker)
- Leere Cards im BDC-Dashboard, die noch auf echte Daten warten
- Einen Android-Strang, der parallel und unabhängig laufen soll

Ohne Eval-Framework werden wir bei jedem Modell-Swap oder Prompt-Update blind. Dieses Framework schafft die Grundlage, um den Workflow **messbar, reproduzierbar und kosteneffizient** zu skalieren.

---

## Architektur

```
┌────────────────────────────────────────────────────────────┐
│                     BDC Orchestrator                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ PL BDC   │  │ PL Andr. │  │UI Worker │  │Data Work.│  │
│  │Gemini 2.5│  │Gemini 2.5│  │Free/Cheap│  │Free/Cheap│  │
│  │Flash     │  │Flash     │  │Coder     │  │Coder     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │              │        │
│  ┌────▼──────────────▼──────────────▼──────────────▼─────┐ │
│  │              Eval Gate (CI/CD)                        │ │
│  │  Golden Dataset → Score → Pass/Fail → Merge/Block     │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Modell-Routing

| Task-Typ | Modell | Kosten-Niveau |
|---|---|---|
| Routing, Extraktion, Klassifikation | `openrouter/free` oder günstiger Coder | ~$0 |
| UI-Text, kleine Code-Diffs | Günstiges Coding-Modell (z.B. Qwen/Kimi) | Sehr niedrig |
| Planung, Architektur, Review | Gemini 2.5 Flash | Niedrig–Mittel |
| Eskalation, Blocker, kritische Review | Gemini 2.5 Pro (selten) | Mittel |

### Eval Gates

| Agenten-Rolle | Mindest-Score | Rollback bei |
|---|---|---|
| BDC Orchestrator / Planung | ≥ 0.85 | < 0.80 oder −5% zur Baseline |
| UI Worker | ≥ 0.75 | < 0.70 oder −5% zur Baseline |
| Data Worker | ≥ 0.80 | < 0.75 oder −5% zur Baseline |
| Android Agent | ≥ 0.80 | < 0.75 oder −5% zur Baseline |
| Scope-Check / Auth / Deploy | ≥ 0.90 | < 0.85 |

---

## Golden Dataset

Struktur eines Eintrags:

```json
{
  "id": "bdc-001",
  "input": "Analysiere den aktuellen PR-Status und erstelle eine priorisierte Task-Liste.",
  "context": "BDC Orchestrator, Scope: Webapp only",
  "expected_output": null,
  "rubric": ["Korrekte Priorisierung", "Scope eingehalten", "Kein Datenlayer angetastet"],
  "category": "orchestration",
  "source": "real",
  "privacy_status": "clean",
  "version": "v1",
  "reviewed_by": "gzug",
  "label_confidence": "high"
}
```

Speicherort: `data/golden/bdc/v1/cases.jsonl`  
Größe Start: 50–100 Fälle manuell kuriert, dann synthetisch erweitert.  
Versionierung: Git für kleine Datensätze, DVC für große Rohdaten.

---

## Aufbauplan (Step by Step)

### Phase 1 — Fundament (sofort)
- [ ] Golden Dataset Ordnerstruktur anlegen
- [ ] Erste 10–20 reale Testfälle aus Produktionslogs kurieren
- [ ] `validate.py` Skript: Schema-Check für JSONL-Einträge
- [ ] GitHub Actions Workflow: Schema-Validation bei jedem PR

### Phase 2 — Eval-Basis (nächste 1–2 Wochen)
- [ ] `score_eval.py` mit DeepEval oder Promptfoo integrieren
- [ ] Baseline-Score auf goldenem Datensatz ermitteln
- [ ] Eval Gates als `eval-gates.yaml` definieren
- [ ] CI-Gate: PR wird geblockt wenn Score unter Schwellenwert

### Phase 3 — Modell-Routing (danach)
- [ ] Routing-Logik im BDC-Orchestrator: Task-Typ → Modell
- [ ] OpenRouter Free als Default, Gemini Flash für Planung
- [ ] Gemini Prompt-Caching: statischer System-Prompt, variabler Task
- [ ] Token-Usage Logging in DB (costUsd, tokens, model)

### Phase 4 — Android-Strang (parallel)
- [ ] Projektleiter 2 Prompt (Gemini 2.5 Flash) finalisieren
- [ ] Eigenes Golden Dataset für Android-Analyse
- [ ] Prompt-Kette: PL 2 → Analyse → Auftrag → Android Studio AI Agent
- [ ] Getrennte Eval-Suite für Android-Scope

### Phase 5 — Automatisierung & Drift
- [ ] DVC für große Rohdaten einrichten
- [ ] Nightly Eval Job
- [ ] Drift-Detection bei Datensatz-Erweiterungen
- [ ] Langfuse oder Arize Phoenix für Live-Tracing

---

## Was wir uns davon versprechen

### Kosten
- **Ziel:** 80–90% aller Tasks über Free-/Low-Cost-Modelle abwickeln
- **Gemini Flash** nur für ~10–15% (Planung, Review)
- **Gemini Pro** für < 5% (Eskalation, Blocker)
- **Schätzung:** bei ~100 Tasks/Tag deutlich unter $1–2/Tag operationale AI-Kosten

### Qualität
- Keine stillen Regressionen durch Modell-Swaps
- Automatische Erkennung wenn ein Modell schlechter wird
- Reproduzierbare Ergebnisse durch versionierte Datasets und Gates

### Geschwindigkeit
- Zwei parallele Stränge (BDC + Android) ohne gegenseitige Blockierung
- Klare Handoffs zwischen Agenten-Rollen
- CI gibt grünes Licht ohne manuellen Review für Low-Risk-Changes

### Langfristiger Wert
- Ausbaubar auf mehr Agenten-Rollen ohne Framework-Wechsel
- Basis für spätere Empfehlungen, Autonomie-Grade und Budget-Tracking
- Dokumentierte Entscheidungshistorie durch versionierte Golden Datasets

---

## Tech Stack

| Komponente | Tool |
|---|---|
| Dataset-Verwaltung | Git + DVC |
| Eval-Framework | DeepEval oder Promptfoo |
| CI/CD | GitHub Actions |
| Modell-Routing | OpenRouter |
| Planning-Model | Gemini 2.5 Flash |
| Live-Tracing | Langfuse (Phase 5) |
| Persistenz | Neon/Postgres via BDC |

---

## Fundort

Dieses Dokument liegt unter:
```
gzug/bros-developer-cockpit → docs/EVAL_FRAMEWORK.md
```

Es ist die Basis für alle weiteren Eval-, Routing- und Orchestrierungs-Entscheidungen im Projekt.
