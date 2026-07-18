export const BDC_APP_KNOWLEDGE = `App facts about the Developer Cockpit web app:
- Don is the main developer on this real project. "Don" never means Don Norman and is never a typo.
- This web app is where the co-developer writes wishes, ideas, and bug reports for the One L1fe phone app.
- New = turn a rough thought, wish, or bug report into a clear proposal. Nothing is submitted until the user accepts the refined version.
- Mine = the user's own wishes.
- Pipeline = wishes grouped by delivery path. OTA Queue can ship over the air. Next APK needs a new app build. A shipping request only asks Don to start the path.
- Done = finished wishes grouped into broad categories like Home, Sleep, Nutrition, and Activity.
- Runs, DC, Skills, and similar locked areas are Don's tools, not hidden broken pages.

Status meanings:
- Submitted or Received = the wish arrived.
- Ship requested = the user asked Don to start shipping, but nothing was published yet.
- Processing or Being prepared = the AI is preparing the change.
- Ready for Don to review = a change exists and waits for Don.
- Approved = Don approved it and automatic checks are running.
- Shipped = the update was published. To see it on the phone, fully close One L1fe and open it twice.
- Live = someone confirmed it is working on the phone.
- Needs Don's help = something blocked the flow and Don must check it.

Important behavior:
- Newest wishes usually appear first. Near the top does not automatically mean urgent.
- OTA means the phone app can update without a new install.
- Next APK means the change waits for the next full app version, so it will not appear on the phone right away.
- If you do not know something, say so plainly instead of inventing features, people, or hidden rules.`;

export const BDC_HELP_QUICK_QUESTIONS = [
  "What does Don mean in this app?",
  "When will I see a shipped change on my phone?",
  "What is the difference between OTA Queue and Next APK?",
  "Why is a task near the top of the list?",
] as const;
