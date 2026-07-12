# BDC Live-Setup (einmalig)

## 1. Supabase-Projekt

1. supabase.com > New Project > Name: `bros-cockpit` > Region: Sydney (oder egal)
2. Settings > API > kopiere:
   - **Project URL** → `SUPABASE_URL` + `VITE_SUPABASE_URL`
   - **anon/public key** → `SUPABASE_PUBLISHABLE_KEY` + `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
3. SQL Editor > New Query > paste den Inhalt von `supabase/migrations/combined.sql` > Run

## 2. Login-User anlegen

1. Authentication > Users > "Add user" (Email)
2. Email = eine beliebige Adresse (Owner oder Bruder — wird `ALLOWED_EMAIL`)
3. Password = der gemeinsame PIN (z.B. `1234` oder länger)

## 3. GitHub Fine-grained Token

1. github.com > Settings > Developer settings > Personal access tokens > Fine-grained
2. Token name: `bdc-engine`
3. Resource owner: `gzug`
4. Repository access: Only select > `gzug/01-One-L1fe`
5. Permissions:
   - **Contents**: Read and write
   - **Pull requests**: Read and write
   - Sonst alles aus — **wichtig: KEINE "Workflows"-Berechtigung.** Dadurch kann der
     DC-Token die Prüf-Workflows in 01-One-L1fe technisch nicht verändern (Sicherheitsanker).
6. Generate > kopiere den Token

## 4. OpenRouter

- Der Key `sk-or-v1-…` liegt bereits in der lokalen `.env`
- Credits > mit $10-20 aufladen (openrouter.ai/credits)

## 5. Deploy auf Vercel

1. vercel.com > Add New Project > Import `gzug/bros-developer-cockpit`
2. Framework Preset: Other (oder Vite — egal, Build Command aus vercel.json wird genutzt)
3. Environment Variables (ALLE 10 eintragen):

| Variable | Wert |
|----------|------|
| `VITE_SUPABASE_URL` | Project URL aus Schritt 1 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key aus Schritt 1 |
| `SUPABASE_URL` | Project URL aus Schritt 1 (gleich) |
| `SUPABASE_PUBLISHABLE_KEY` | anon key aus Schritt 1 (gleich) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key aus Schritt 1 |
| `ALLOWED_EMAIL` | Email aus Schritt 2 |
| `OPENROUTER_API_KEY` | `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` |
| `GITHUB_TOKEN` | Token aus Schritt 3 |
| `GITHUB_REPO_OWNER` | `gzug` |
| `GITHUB_REPO_NAME` | `01-One-L1fe` |

4. Deploy klicken

## Fertig

- Login-URL: `https://dein-projekt.vercel.app/auth`
- Owner + Bruder tippen denselben PIN
- KPI-Seite (nur du): `/owner-kpi`

## Ship-Lane (Owner-Entscheidung 2026-07-12: Check VOR dem Merge)

Die Engine mergt nie selbst. Ablauf pro Idee:

1. Engine baut den Code und öffnet einen PR auf `gzug/01-One-L1fe`
2. Der `bdc-ship`-Workflow dort prüft automatisch: Pfad-Guard + volle validate-Kette
3. **Grün:** Workflow mergt + schickt das OTA aufs Gerät (ca. 15 bis 25 Min. gesamt)
4. **Rot:** nichts wird gemergt, PR bekommt Label `bdc-failed`, Idee zeigt "blocked"

## Kill-Switch-Kriterien (was reviewed werden muss, nicht auto-shippt)

Die Engine klassifiziert jede Idee automatisch:

| Intent | Routing | Was passiert |
|--------|---------|-------------|
| **Wording** (Text) | auto (tier0) | Günstigstes Modell, auto-ship wenn Judge ok + Check grün |
| **Look** (Design) | auto (tier1) | Besseres Modell, auto-ship wenn Judge ok + Check grün |
| **Wrong** (Bug) | auto (tier1) | Besseres Modell, auto-ship wenn Judge ok + Check grün |
| **Idea** (Neue Funktion) | **Review-Hold** | Engine läuft gar nicht — du schaust zuerst drüber |
| **Judge sagt "risky"** | immer Hold | PR liegt auf `bdc-hold/*`, Workflow ignoriert ihn — du entscheidest |

Auto-Pause greift wenn ≥2 von 10 letzten PRs reverted wurden.
