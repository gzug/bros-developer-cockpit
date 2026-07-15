import { claimIdeaForEngine, listNewBdcIssues } from "./github-issues.server";
import { triggerEngineRun } from "./engine.server";

export type IssuePollResult = {
  ok: true;
  claimed: number;
  results: Array<{
    issueNumber: number;
    status: "sent" | "blocked" | "failed";
    prNumber?: number;
    prUrl?: string;
    reason?: string;
  }>;
};

export async function pollNewBdcIssues(): Promise<IssuePollResult> {
  const issues = await listNewBdcIssues();
  const results: IssuePollResult["results"] = [];

  for (const issue of issues) {
    await claimIdeaForEngine(issue.number);
    const result = await triggerEngineRun({
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueBody: issue.body,
      issueUrl: issue.html_url,
    });

    if (result.ok) {
      results.push({
        issueNumber: issue.number,
        status: "sent",
        prNumber: result.prNumber,
        prUrl: result.prUrl,
      });
    } else {
      results.push({
        issueNumber: issue.number,
        status: result.status,
        reason: result.reason,
      });
    }
  }

  return { ok: true, claimed: issues.length, results };
}
