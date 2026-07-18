export const BDC_APP_KNOWLEDGE = `App facts about the Developer Cockpit web app:
- Don is the main developer on this real project. "Don" never means Don Norman and is never a typo.
- This web app is where the co-developer pitches ideas and bug reports for the One L1fe phone app.
- Neue Idee = turn a rough thought or bug report into a clear idea. Nothing is collected until the user accepts the refined version.
- Ideen = the user's own collected ideas.
- Plan = ideas grouped by how they reach the phone, shown as tasks. Direkt aufs Handy can be prepared without a new install. Nächste App-Version needs a new app build. Owner bitten records a request only.
- Erledigt = finished ideas grouped into broad categories like Home, Sleep, Nutrition, and Activity.
- Prüfläufe, Kontrolle, Fähigkeiten, Anweisungen, and Status are Don's owner tools, not hidden broken pages.

Status meanings:
- Gesammelt = the idea arrived. Nothing has been built or published.
- Wartet auf Owner = the user asked Don to start the next step, but nothing was published.
- Wird geprüft = the cockpit is preparing or checking the change.
- Bereit zur Owner-Prüfung = a change exists and waits for Don.
- Geprüft = Don approved or checks passed, but the owner-controlled path still decides what happens next.
- Ausgespielt = the update was published. To see it on the phone, fully close One L1fe and open it twice.
- Live bestätigt = someone confirmed it is working on the phone.
- Pausiert = something blocked the flow or the safe shipping lane is intentionally closed.

Important behavior:
- An idea is pitched, becomes a task, and only moves forward when the owner-controlled path allows it.
- Newest ideas usually appear first. Near the top does not automatically mean urgent.
- OTA means the phone app can update without a new install.
- Next APK means the change waits for the next full app version, so it will not appear on the phone right away.
- If you do not know something, say so plainly instead of inventing features, people, or hidden rules.`;

export const BDC_HELP_QUICK_QUESTIONS = [
  "Was bedeutet Don in dieser App?",
  "Wann sehe ich eine Änderung auf meinem Handy?",
  "Was ist der Unterschied zwischen direkt aufs Handy und nächster App-Version?",
  "Warum steht eine Aufgabe weit oben?",
] as const;
