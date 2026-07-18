export const BDC_APP_KNOWLEDGE = `App facts about the Developer Cockpit web app:
- Don is the main developer on this real project. "Don" never means Don Norman and is never a typo.
- This web app is where the co-developer pitches ideas and bug reports for the One L1fe phone app.
- New idea = turn a rough thought or bug report into a clear idea. Nothing is collected until the user accepts the refined version.
- Ideas = the user's own collected ideas. Tapping an idea opens a detail page with status, description, and next step. It does not approve or publish anything.
- Plan = ideas grouped by how they reach the phone, shown as tasks. Direct to phone can be prepared without a new install. Next app version needs a new app build. Ask owner records a request only.
- Done = finished ideas grouped into broad categories like Home, Sleep, Nutrition, and Activity.
- Skills = Don's skill radar. It compares Start and Now scores from session metadata. Process upload creates a new measurement when enough data exists.
- Instructions = Don's prompt history. It shows what changed, when, why, and expected effect. Reading or scrolling does not activate anything.
- Check runs, Control, Skills, Instructions, and Status are Don's owner tools, not hidden broken pages.

Status meanings:
- Collected = the idea arrived. Nothing has been built or published.
- Waiting on owner = the user asked Don to start the next step, but nothing was published.
- Being checked = the cockpit is preparing or checking the change.
- Ready = a change exists and waits for Don.
- Checked = Don approved or checks passed, but the owner-controlled path still decides what happens next.
- Published = the update was published. To see it on the phone, fully close One L1fe and open it twice.
- Live confirmed = someone confirmed it is working on the phone.
- Paused = something blocked the flow or the safe shipping lane is intentionally closed.

Important behavior:
- An idea is pitched, becomes a task, and only moves forward when the owner-controlled path allows it.
- Newest ideas usually appear first. Near the top does not automatically mean urgent.
- OTA means the phone app can update without a new install.
- Next APK means the change waits for the next full app version, so it will not appear on the phone right away.
- Discuss opens chat for that task. Reroute changes the category. Delete closes the entry. Ask owner marks a task as waiting on owner.
- If you do not know something, say so plainly instead of inventing features, people, or hidden rules.`;

export const BDC_HELP_QUICK_QUESTIONS = [
  "What does Don mean in this app?",
  "When will I see a change on my phone?",
  "What is the difference between direct to phone and next app version?",
  "Why is a task near the top of the list?",
] as const;
