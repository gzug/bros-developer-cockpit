import config from "./dc-config.json";
import { nextTier, type Tier, callModel } from "./openrouter.server";
import { isPathAllowed } from "./paths.server";
import {
  commitFiles,
  createBranch,
  getBranchHeadSha,
  getDefaultBranch,
  getFileContent,
  getRepoTree,
  openPullRequest,
  type FileEdit,
} from "./github.server";
import { addEngineRunComment, addIdeaComment, getIdeaWithPull, setIdeaStatus } from "./github-issues.server";

type Intent = "wording" | "look" | "wrong" | "idea";
type RoutingValue = Tier | "review";

type ProcessResult =
  | { ok: true; prNumber: number; prUrl: string }
  | { ok: false; status: "blocked" | "failed"; reason: string };

type PlannerOut = { files: string[] };
type EditorOut = { summary: string; edits: Array<{ path: string; content: string }> };

const SYSTEM_PROMPT = `You are a senior React Native / TypeScript engineer working on the "One L1fe" health app (Expo, TypeScript, under apps/mobile/src). A non-developer user described a small UI change in plain words. Your job is to make the SMALLEST correct code change that satisfies the wish.

Hard rules:
- Only edit UI/presentation files under apps/mobile/src. NEVER touch data layer, database, native code, secrets, or config.
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
  return [`Intent: ${intent}`, `Titel: ${title}`, `Beschreibung: ${description}`].join("\n");
}

function totalCost(...values: Array<number | null>): number {
  return values.reduce((sum, value) => sum + (value ?? 0), 0);
}

export async function processTask(issueNumber: number): Promise<ProcessResult> {
  const paused = process.env.BDC_PAUSED?.toLowerCase() === "true";
  const { idea, pr } = await getIdeaWithPull(issueNumber);

  if (paused) {
    const reason = "BDC ist gerade pausiert.";
    await setIdeaStatus(issueNumber, "blocked", idea.intent);
    await addIdeaComment(issueNumber, reason);
    return { ok: false, status: "blocked", reason };
  }

  if (pr) {
    return { ok: false, status: "blocked", reason: "Dazu gibt es bereits einen Pull Request." };
  }

  const intentRoute = (config.routingMap[idea.intent] ?? "tier1") as RoutingValue;
  if (intentRoute === "review") {
    const reason = "Diese Idee ist für manuelles Review vorgemerkt.";
    await setIdeaStatus(issueNumber, "blocked", idea.intent);
    await addIdeaComment(issueNumber, reason);
    return { ok: false, status: "blocked", reason };
  }

  await setIdeaStatus(issueNumber, "sent", idea.intent);

  const base = await getDefaultBranch();
  const baseSha = await getBranchHeadSha(base);
  const tree = await getRepoTree(baseSha);
  const candidates = tree.entries
    .filter((entry) => entry.type === "blob" && isPathAllowed(entry.path, { allowed: config.allowed, forbidden: config.forbidden }))
    .map((entry) => entry.path)
    .slice(0, 600);

  const wish = wishText(idea.title, idea.intent, idea.description);
  let tier: Tier | null = intentRoute;
  let lastError = "Kein Patch erzeugt.";

  while (tier) {
    try {
      const plan = await runPlanner(tier, wish, candidates);
      const filesToRead = (plan?.parsed.files ?? []).filter((path) =>
        candidates.includes(path) &&
        isPathAllowed(path, { allowed: config.allowed, forbidden: config.forbidden }),
      );
      if (!plan || filesToRead.length === 0) {
        lastError = "Keine passenden Dateien gefunden.";
        tier = nextTier(tier);
        continue;
      }

      const files = (
        await Promise.all(filesToRead.map(async (path) => ({ path, content: await getFileContent(path, base) })))
      )
        .filter((file): file is { path: string; content: string } => typeof file.content === "string");

      const edited = await runEditor(tier, wish, files);
      if (!edited || edited.parsed.edits.length === 0) {
        lastError = "Kein brauchbarer Patch.";
        tier = nextTier(tier);
        continue;
      }

      const fetched = new Set(files.map((file) => file.path));
      const edits: FileEdit[] = edited.parsed.edits
        .filter((edit) => fetched.has(edit.path))
        .map((edit) => ({ path: edit.path, content: edit.content }));
      if (edits.length === 0) {
        lastError = "Patch ausserhalb des erlaubten Bereichs.";
        tier = nextTier(tier);
        continue;
      }

      const branch = `bdc/dc-issue-${issueNumber}`;
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
        title: `BDC: ${idea.title}`.slice(0, 200),
        body: [
          `Automated by Bros Developer Cockpit.`,
          ``,
          `Closes #${issueNumber}`,
          ``,
          `Wish:`,
          wish,
          ``,
          `Change: ${edited.parsed.summary}`,
          `Files: ${edits.map((edit) => edit.path).join(", ")}`,
        ].join("\n"),
      });

      await addEngineRunComment(issueNumber, {
        model: edited.result.modelServed,
        promptTokens: (plan.result.tokensPrompt ?? 0) + (edited.result.tokensPrompt ?? 0),
        completionTokens: (plan.result.tokensCompletion ?? 0) + (edited.result.tokensCompletion ?? 0),
        costUsd: totalCost(plan.result.costUsd, edited.result.costUsd),
        prNumber: pullRequest.number,
      });
      await setIdeaStatus(issueNumber, "sent", idea.intent);
      return { ok: true, prNumber: pullRequest.number, prUrl: pullRequest.html_url };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      tier = nextTier(tier);
    }
  }

  await setIdeaStatus(issueNumber, "blocked", idea.intent);
  await addIdeaComment(issueNumber, `Automatische Verarbeitung fehlgeschlagen: ${lastError}`);
  return { ok: false, status: "failed", reason: lastError };
}
