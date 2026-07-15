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

| Variable             | Value                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `APP_PIN`            | eigene Owner-Passphrase mit mindestens 12 Zeichen; niemals mit dem Bruder teilen           |
| `BROTHER_PIN`        | eigener vierstelliger Bruder-Code; muss von `APP_PIN` verschieden sein                     |
| `APP_SECRET`         | zufälliger String, z. B. `openssl rand -hex 32`                                            |
| `OPENROUTER_API_KEY` | OpenRouter-Key                                                                             |
| `BDC_CHAT_MODEL`     | aktuelles OpenRouter-Modell für die kurze Wunsch-Hilfe; Standard `google/gemini-2.5-flash` |
| `GITHUB_TOKEN`       | PAT aus Schritt 1                                                                          |
| `DATABASE_URL`       | Neon Postgres URL für Run-/Task-Log                                                        |
| `BDC_PAUSED`         | bis zur Abnahme `true`; erst danach bewusst auf `false` setzen                             |

`APP_PIN` und `BROTHER_PIN` in **Production und Preview** setzen. Keine vierstellige Owner-PIN
verwenden: Owner-Zugriff kann Freigaben und GitHub-Mutationen auslösen. Vor der Übergabe beide Rollen im
Browser prüfen: Der Bruder darf nur Wünsche senden/lesen; `/dc`, `/runs`, `/owner-kpi`, Verarbeitung,
Freigabe und Live-Bestätigung müssen für ihn gesperrt sein. Den Bruder-Code getrennt vom Link schicken
und nie in Git, Logs oder Dokumentation schreiben.

`DATABASE_URL` ist zusätzlich die dauerhafte Login-Bremse für den öffentlichen vierstelligen
Bruder-Code. In Vercel verweigert der Login ohne Datenbank bewusst den Zugriff; eine lokale
prozessgebundene Sperre allein ist kein Sicherheitsrand.

Der normale Login zeigt nur den vierstelligen Bruder-Code. Der Owner nutzt bewusst
`/auth?owner=1`. Zum sofortigen Widerruf bestehender 30-Tage-Sitzungen `APP_SECRET` rotieren;
das Ändern von `APP_PIN` oder `BROTHER_PIN` allein beendet bereits ausgestellte Cookies nicht.

Die GitHub-Zielrepo-Verbindung ist im Code fest auf `gzug/01-One-L1fe` begrenzt. `GITHUB_REPO_OWNER`
und `GITHUB_REPO_NAME` werden nicht benötigt. Die OTA-Veröffentlichung läuft nicht über einen
BDC-Webhook, sondern über den trusted `bdc-ship` GitHub-Actions-Workflow im One-L1fe-Repo; dafür muss
`EXPO_TOKEN` dort als Actions Secret gesetzt sein. Die Repository-Variable
`BDC_PRODUCTION_BASE_SHA` muss auf den zuletzt absichtlich veröffentlichten und am Gerät bestätigten
`main`-Stand zeigen. Bei Abweichung muss der Workflow vor dem Merge stoppen.
Die Repository-Variable `BDC_SHIP_ENABLED` bleibt bis zur vollständigen Abnahme ungesetzt oder
`false`. Erst wenn `BDC_PAUSED=false`, der Android-Baseline-Stand am OnePlus bestätigt und der
Baseline-SHA gesetzt ist, darf sie bewusst auf `true` gesetzt werden. Der Workflow prüft sie erneut
direkt vor dem Merge.

## 4. Abnahme vor Bruder-Übergabe

1. https://bros-developer-cockpit.vercel.app im privaten Browser öffnen und den Bruder-Code testen.
2. Einen harmlosen Textwunsch senden.
3. Als Owner den gehaltenen PR prüfen und freigeben.
4. GitHub Action, EAS-Update-Gruppe und Status `shipped` belegen.
5. Auf dem OnePlus App vollständig schließen, zweimal öffnen, Änderung prüfen und erst dann `live` bestätigen.

Ohne diese fünf Belege ist die Pipeline nicht übergabefertig.
