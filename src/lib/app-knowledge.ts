import { IDEA_STATUS_REFERENCE_LINES } from "./idea-status";

export const BDC_APP_KNOWLEDGE = `App facts about the Developer Cockpit web app:
- Don is the main developer on this real project. "Don" never means Don Norman and is never a typo.
- This web app is where the co-developer pitches ideas and bug reports for the One L1fe phone app.
- New idea = turn a rough thought or bug report into a clear idea. Nothing is collected until the user accepts a suggestion or saves their own text.
- Ideas = the user's own collected ideas. Tapping an idea opens a detail page with status, description, and next step. It does not approve or publish anything.
- Plan = ideas grouped by how they reach the phone, shown as tasks. Direct to phone can be prepared without a new install. Next app version needs a new app build. Ask owner records a request only.
- Done = finished ideas grouped into broad categories like Home, Sleep, Nutrition, and Activity.
- Skills = Don's owner-only skill radar. It compares Start and Now scores from session metadata. The Export files field accepts supported Claude, ChatGPT, or Google/Gemini session exports; Process upload creates a new measurement when enough conversation data exists. PNG metadata can be recorded as evidence, but screenshots do not change skill scores in v1. This is for measuring Don's skills, not for uploading files to the phone or to an idea.
- Instructions = Don's prompt history. It shows what changed, when, why, and expected effect. Reading or scrolling does not activate anything.
- Control, Skills, Instructions, and Status are Don's owner tools, not hidden broken pages.
- Prep log can be read by anyone logged in, but only Don can start or change a preparation.
- Home (\`/home\`) is the start screen right after login. It shows an icon dock to jump to each section.

Status meanings:
${IDEA_STATUS_REFERENCE_LINES.map((line) => `- ${line}`).join("\n")}

Important behavior:
- An idea is pitched, becomes a task, and only moves forward when the owner-controlled path allows it.
- Publishing paused means the global safe shipping lane is intentionally closed. Blocked means one idea needs Don's help.
- Collected, checking, approved, ready for owner, blocked, and waiting on owner are working states, not publication.
- Newest ideas usually appear first. Near the top does not automatically mean urgent.
- OTA means the phone app can update without a new install.
- Next APK means the change waits for the next full app version, so it will not appear on the phone right away.
- Discuss opens chat for that task. Reroute changes the category. Delete closes the entry. Ask owner marks a task as waiting on owner; it does not publish.
- If you do not know something, say so plainly instead of inventing features, people, or hidden rules.`;

export const BDC_HELP_QUICK_QUESTIONS = [
  "What does Don mean in this app?",
  "When will I see a change on my phone?",
  "What is the difference between direct to phone and next app version?",
  "Why is a task near the top of the list?",
] as const;
