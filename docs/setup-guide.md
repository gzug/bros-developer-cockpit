# BDC Live-Setup (einmalig)

## 1. Supabase-Projekt

1. supabase.com > New Project > Name: `bros-cockpit` > Region: Sydney (oder egal)
2. Settings > API > kopiere:
   - **Project URL** = `SUPABASE_URL`
   - **anon/public key** = `SUPABASE_PUBLISHABLE_KEY`
   - **service_role key** = `SUPABASE_SECRET_KEY`
3. SQL Editor > New Query > paste den Inhalt von `supabase/migrations/combined.sql` > Run

## 2. Login-User anlegen

1. Authentication > Users > "Add user" (Email)
2. Email = die Adresse deines Bruders (wird auch ALLOWED_EMAIL)
3. Password = sein PIN (z.B. `1234` oder was Laengeres)

## 3. GitHub Fine-grained Token

1. github.com > Settings > Developer settings > Personal access tokens > Fine-grained
2. Token name: `bdc-engine`
3. Resource owner: `gzug`
4. Repository access: Only select > `gzug/One-L1fe`
5. Permissions:
   - **Contents**: Read and write
   - **Pull requests**: Read and write
   - Sonst alles aus (kein Admin, kein Merge)
6. Generate > kopiere den Token

## 4. OpenRouter

- openrouter.ai > Keys > neuen Key > kopiere
- Credits > mit $10-20 aufladen

## 5. Deploy auf Vercel

1. vercel.com > Add New Project > Import `gzug/bros-developer-cockpit`
2. Framework Preset: Vite (auto-detected)
3. Environment Variables (ALLE eintragen):

| Variable | Wert |
|----------|------|
| `SUPABASE_URL` | aus Schritt 1 |
| `SUPABASE_PUBLISHABLE_KEY` | aus Schritt 1 |
| `SUPABASE_SECRET_KEY` | aus Schritt 1 |
| `ALLOWED_EMAIL` | Bruders Email aus Schritt 2 |
| `OPENROUTER_API_KEY` | aus Schritt 4 |
| `GITHUB_TOKEN` | aus Schritt 3 |
| `GITHUB_REPO_OWNER` | `gzug` |
| `GITHUB_REPO_NAME` | `One-L1fe` |

4. Deploy klicken

## Fertig

- Login-URL: `https://dein-projekt.vercel.app/auth`
- Bruder tippt seinen PIN ein
- KPI-Seite: `/owner-kpi`
