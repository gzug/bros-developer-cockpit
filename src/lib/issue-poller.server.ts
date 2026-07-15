import { claimIdeaForEngine, listNewBdcIssues } from "./github-issues.server";
import { isBdcPaused, triggerEngineRun } from "./engine.server";

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

const POLL_REQUEST_DEADLINE_MS = 55_000;

function pollAbortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("BDC poll aborted.");
}

function throwIfPollAborted(signal: AbortSignal): void {
  if (signal.aborted) throw pollAbortReason(signal);
}

async function pollNewBdcIssuesWithinDeadline(signal: AbortSignal): Promise<IssuePollResult> {
  if (isBdcPaused()) return { ok: true, claimed: 0, results: [] };
  const issues = (await listNewBdcIssues()).slice(0, 1);
  throwIfPollAborted(signal);
  const results: IssuePollResult["results"] = [];

  for (const issue of issues) {
    try {
      throwIfPollAborted(signal);
      await claimIdeaForEngine(issue.number);
      throwIfPollAborted(signal);
      const result = await triggerEngineRun(
        {
          issueNumber: issue.number,
          issueTitle: issue.title,
          issueBody: issue.body,
          issueUrl: issue.html_url,
        },
        signal,
      );

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
    } catch (error) {
      results.push({
        issueNumber: issue.number,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, claimed: issues.length, results };
}

export async function pollNewBdcIssues(): Promise<IssuePollResult> {
  const controller = new AbortController();
  const timeoutError = new Error(
    `BDC poll request deadline exceeded after ${POLL_REQUEST_DEADLINE_MS}ms.`,
  );
  const timer = setTimeout(() => controller.abort(timeoutError), POLL_REQUEST_DEADLINE_MS);
  let onAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(pollAbortReason(controller.signal));
    controller.signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([pollNewBdcIssuesWithinDeadline(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
    if (onAbort) controller.signal.removeEventListener("abort", onAbort);
  }
}
