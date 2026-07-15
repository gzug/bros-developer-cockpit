# Setup Guide

## 1. GitHub Fine-grained PAT

- Token name: `dc-engine`
- Scope: `gzug/01-One-L1fe`
- Permissions:
  - `Contents`: Read and write
  - `Pull requests`: Read and write
  - `Issues`: Read and write
- Keine `Workflows`-Berechtigung vergeben. Das ist der Sicherheitsanker.

## 2. OpenRouter

- Bei [openrouter.ai/credits](https://openrouter.ai/credits) etwa `$10-20` Guthaben laden.
- Den API-Key als `OPENROUTER_API_KEY` in Vercel setzen.

## 3. Vercel Deploy

Diese Variablen setzen:

| Variable | Value |
| --- | --- |
| `APP_PIN` | gemeinsamer vierstelliger Code, z. B. `1234` |
| `APP_SECRET` | zufälliger String, z. B. `openssl rand -hex 32` |
| `OPENROUTER_API_KEY` | OpenRouter-Key |
| `GITHUB_TOKEN` | PAT aus Schritt 1 |
| `DATABASE_URL` | Neon Postgres URL für Run-/Task-Log |

Die GitHub-Zielrepo-Verbindung ist im Code fest auf `gzug/01-One-L1fe` begrenzt. `GITHUB_REPO_OWNER`
und `GITHUB_REPO_NAME` werden nicht mehr benötigt. Die OTA-Veröffentlichung läuft nicht über einen
BDC-Webhook, sondern über den trusted `bdc-ship` GitHub-Actions-Workflow im One-L1fe-Repo; dafür muss
`EXPO_TOKEN` dort als Actions Secret gesetzt sein.
