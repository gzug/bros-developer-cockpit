import config from "./dc-config.json";
import { nextTier, type Tier, callModel } from "./openrouter.server";
import { isPathAllowed } from "./paths.server";
import {
  addLabelsToIssue,
  commitFiles,
  createBranch,
  getBranchHeadSha,
  getDefaultBranch,
  getFileContent,
  getRepoTree,
  openPullRequest,
  type FileEdit,
} from "./github.server";
import {
  addEngineRunComment,
  addIdeaComment,
  getIdeaWithPull,
  markIdeaGuardrailBlocked,
  setIdeaStatus,
} from "./github-issues.server";
import { finishRun, markRun, startRun, upsertTask } from "./db/runs.server";

type Intent = "wording" | "look" | "wrong" | "idea" | "change";
type RoutingValue = Tier | "review";

type ProcessResult =
  | { ok: true; prNumber: number; prUrl: string }
  | { ok: false; status: "blocked" | "failed"; reason: string };

type PlannerOut = { files: string[] };
type EditorOut = { summary: string; edits: Array<{ path: string; content: string }> };

const SYSTEM_PROMPT = `You are a scoped UI change agent for the One L1fe Android app (Expo, TypeScript, under apps/mobile/src).

Design preset: One L1fe v3 research-paper UI.

Hard rules:
- Only edit presentation-layer files: *.tsx components, *.css, design tokens, and UI string literals.
- NEVER change data logic, server functions, DB schema, auth, native code, secrets, dependencies, or config.
- Do not invent health values or fabricate data. Presentation only.
- Return COMPLETE file contents for every file you change.
- Keep the change minimal and consistent with surrounding code.
Respond with JSON only, no prose outside the JSON.`;

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function runPlanner(tier: Tier, wish: string, candidatePaths: string[]) {
  const result = await callModel({
    tier,
    responseJson: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `WISH:\n${wish}\n\nCANDIDATE FILES:\n${candidatePaths.join("\n")}\n\nReturn JSON: {"files":["path"]}`,
      },
    ],
  });
  const parsed = safeJsonParse<PlannerOut>(result.content);
  if (!parsed) return null;
  return { parsed, result };
}

async function runEditor(tier: Tier, wish: string, files: Array<{ path: string; content: string }>) {
  const fileBlocks = files.map((file) => `=== FILE: ${file.path} ===\n${file.content}`).join("\n\n");
  const result = await callModel({
    tier,
    responseJson: true,
    maxTokens: 8192,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `WISH:\n${wish}\n\nCURRENT FILES:\n${fileBlocks}\n\nReturn JSON: {"summary":"...","edits":[{"path":"...","content":"..."}]}`,
      },
    ],
  });
  const parsed = safeJsonParse<EditorOut>(result.content);
  if (!parsed) return null;
  return { parsed, result };
}

function wishText(title: string, intent: Intent, description: string): string {
  return [`Intent: ${intent}`, `Title: ${title}`, `Description: ${description}`].join("\n");
}

function totalCost(...values: Array<number | null>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function bridgeBranchName(issueNumber: number): string {
  return `bdc-hold/dc-issue-${issueNumber}`;
}

export async function processTask(issueNumber: number): Promise<ProcessResult> {
  const paused = process.env.BDC_PAUSED?.toLowerCase() === "true";
  const { idea, pr } = await getIdeaWithPull(issueNumber);
  await upsertTask({ issueNumber, title: idea.title, intent: idea.intent, status: "queued" });
  const runId = await startRun({ issueNumber });

  if (paused) {
    const reason = "BDC is currently paused.";
    await setIdeaStatus(issueNumber, "blocked", idea.intent);
    await addIdeaComment(issueNumber, reason);
    await finishRun(runId, { status: "blocked", error: reason });
    return { ok: false, status: "blocked", reason };
  }

  if (pr) {
    const reason = "There is already a pull request for this idea.";
    await finishRun(runId, { status: "blocked", error: reason });
    return { ok: false, status: "blocked", reason };
  }

  const intentRoute = (config.routingMap[idea.intent] ?? "tier1") as RoutingValue;
  if (intentRoute === "review") {
    const reason = "This idea is flagged for manual review.";
    await setIdeaStatus(issueNumber, "blocked", idea.intent);
    await addIdeaComment(issueNumber, reason);
    await finishRun(runId, { status: "blocked", error: reason });
    return { ok: false, status: "blocked", reason };
  }

  await setIdeaStatus(issueNumber, "processing", idea.intent);
  await upsertTask({ issueNumber, title: idea.title, intent: idea.intent, status: "processing" });

  const base = await getDefaultBranch();
  const baseSha = await getBranchHeadSha(base);
  const tree = await getRepoTree(baseSha);
  const candidates = tree.entries
    .filter((entry) => entry.type === "blob" && isPathAllowed(entry.path, { allowed: config.allowed, forbidden: config.forbidden }))
    .map((entry) => entry.path)
    .slice(0, 600);

  const wish = wishText(idea.title, idea.intent, idea.description);
  let tier: Tier | null = intentRoute;
  let lastError = "No patch was generated.";

  while (tier) {
    try {
      await markRun(runId, "running", { tier });
      const plan = await runPlanner(tier, wish, candidates);
      const filesToRead = (plan?.parsed.files ?? []).filter((path) =>
        candidates.includes(path) &&
        isPathAllowed(path, { allowed: config.allowed, forbidden: config.forbidden }),
      );
      if (!plan || filesToRead.length === 0) {
        lastError = "No matching files were found.";
        tier = nextTier(tier);
        continue;
      }

      const files = (
        await Promise.all(filesToRead.map(async (path) => ({ path, content: await getFileContent(path, base) })))
      )
        .filter((file): file is { path: string; content: string } => typeof file.content === "string");

      const edited = await runEditor(tier, wish, files);
      if (!edited || edited.parsed.edits.length === 0) {
        lastError = "No usable patch was returned.";
        tier = nextTier(tier);
        continue;
      }

      const fetched = new Set(files.map((file) => file.path));
      const blockedPaths = edited.parsed.edits
        .map((edit) => edit.path)
        .filter(
          (path) =>
            !fetched.has(path) ||
            !isPathAllowed(path, { allowed: config.allowed, forbidden: config.forbidden }),
        );
      if (blockedPaths.length > 0) {
        const reason = `AI proposed out-of-scope files: ${blockedPaths.join(", ")}`;
        await markIdeaGuardrailBlocked(issueNumber, reason);
        await finishRun(runId, { status: "blocked", error: reason });
        return { ok: false, status: "blocked", reason };
      }

      const edits: FileEdit[] = edited.parsed.edits
        .filter((edit) => fetched.has(edit.path))
        .map((edit) => ({ path: edit.path, content: edit.content }));
      if (edits.length === 0) {
        lastError = "The patch did not contain any allowed file edits.";
        tier = nextTier(tier);
        continue;
      }

      const branch = bridgeBranchName(issueNumber);
      await createBranch(branch, baseSha);
      await commitFiles(
        branch,
        baseSha,
        edits,
        `bdc: ${idea.title}\n\n${edited.parsed.summary}\n\nIssue #${issueNumber}`,
      );

      const pullRequest = await openPullRequest({
        head: branch,
        base,
        title: `[BDC] ${idea.title} (Issue #${issueNumber})`.slice(0, 200),
        body: [
          "## BDC Automated Change",
          `Resolves: gzug/01-One-L1fe#${issueNumber}`,
          "Design preset: One L1fe v3 · research-paper UI",
          "Scope: UI-only (presentation layer)",
          "---",
          edited.parsed.summary,
          "",
          `Files: ${edits.map((edit) => edit.path).join(", ")}`,
          "---",
          "_Auto-generated by Bros Developer Cockpit._",
        ].join("\n"),
      });
      await addLabelsToIssue(pullRequest.number, ["bdc-auto", "ui-only", "awaiting-owner-review"]);

      await addEngineRunComment(issueNumber, {
        model: edited.result.modelServed,
        promptTokens: (plan.result.tokensPrompt ?? 0) + (edited.result.tokensPrompt ?? 0),
        completionTokens: (plan.result.tokensCompletion ?? 0) + (edited.result.tokensCompletion ?? 0),
        costUsd: totalCost(plan.result.costUsd, edited.result.costUsd),
        prNumber: pullRequest.number,
      });
      await setIdeaStatus(issueNumber, "sent", idea.intent);
      await finishRun(runId, {
        status: "completed",
        model: edited.result.modelServed,
        tokensPrompt: (plan.result.tokensPrompt ?? 0) + (edited.result.tokensPrompt ?? 0),
        tokensCompletion: (plan.result.tokensCompletion ?? 0) + (edited.result.tokensCompletion ?? 0),
        costUsd: totalCost(plan.result.costUsd, edited.result.costUsd),
        githubBranchRef: branch,
        githubPrNumber: pullRequest.number,
      });
      return { ok: true, prNumber: pullRequest.number, prUrl: pullRequest.html_url };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      tier = tier ? nextTier(tier) : null;
    }
  }

  await setIdeaStatus(issueNumber, "blocked", idea.intent);
  await addIdeaComment(issueNumber, `Automatic processing failed: ${lastError}`);
  await finishRun(runId, { status: "failed", error: lastError });
  return { ok: false, status: "failed", reason: lastError };
}

export async function triggerEngineRun(input: {
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  issueUrl: string;
}): Promise<ProcessResult> {
  void input.issueTitle;
  void input.issueBody;
  void input.issueUrl;
  return processTask(input.issueNumber);
}
