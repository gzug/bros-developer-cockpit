// The BDC engine — turns a saved idea into a real Pull Request on the One L1fe
// repo via OpenRouter. Fail-closed: any error leaves the idea in a terminal
// 'failed'/'blocked' state with a reason, never a half-open PR path.
//
// Flow: load config -> kill-switch -> gather repo context -> PLANNER (which files)
// -> fetch files -> EDITOR (full new contents) -> path-validate -> branch/commit/PR
// -> log provenance. On parse/path failure, escalate one model tier and retry.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { callModel, nextTier, type Tier } from "./openrouter.server";
import { isPathAllowed } from "./paths.server";
import {
  getDefaultBranch,
  getBranchHeadSha,
  getRepoTree,
  getFileContent,
  createBranch,
  commitFiles,
  openPullRequest,
  type FileEdit,
} from "./github.server";

type Intent = Database["public"]["Enums"]["contribution_intent"];

type Config = {
  routingMap: Record<string, Tier>;
  allowed: string[];
  forbidden: string[];
  promptTemplate: string;
  templateVersion: string;
  bdcPaused: boolean;
  pauseReason: string | null;
};

const MAX_CONTEXT_FILES = 6;
const MAX_TREE_CANDIDATES = 600;

async function loadConfig(): Promise<Config> {
  const { data, error } = await supabaseAdmin
    .from("app_config")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(`app_config load failed: ${error.message}`);
  if (!data) throw new Error("app_config row missing (run the engine migration)");
  const rm = (data.routing_map ?? {}) as Record<string, string>;
  const routingMap: Record<string, Tier> = {};
  for (const [k, v] of Object.entries(rm)) {
    if (v === "tier0" || v === "tier1" || v === "tier2") routingMap[k] = v;
  }
  return {
    routingMap,
    allowed: data.allowed_paths ?? [],
    forbidden: data.forbidden_paths ?? [],
    promptTemplate: data.prompt_template ?? "",
    templateVersion: data.template_version ?? "v1",
    bdcPaused: data.bdc_paused ?? false,
    pauseReason: data.pause_reason ?? null,
  };
}

type IdeaRow = Database["public"]["Tables"]["ideas"]["Row"];

async function loadIdea(ideaId: string): Promise<IdeaRow> {
  const { data, error } = await supabaseAdmin
    .from("ideas")
    .select("*")
    .eq("id", ideaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("idea not found");
  return data;
}

async function setIdea(ideaId: string, patch: Database["public"]["Tables"]["ideas"]["Update"]) {
  await supabaseAdmin.from("ideas").update(patch).eq("id", ideaId);
}

async function logTask(row: Database["public"]["Tables"]["task_log"]["Insert"]) {
  await supabaseAdmin.from("task_log").insert(row);
}

function wishText(idea: IdeaRow): string {
  return [
    `Intent: ${idea.intent}`,
    `Where in the app: ${idea.screen ?? ""}`,
    `What is wrong now: ${idea.wrong ?? ""}`,
    `What should happen instead: ${idea.should ?? ""}`,
    idea.body ? `Extra note (user raw text): ${idea.body}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function safeJsonParse<T>(text: string): T | null {
  // Models sometimes wrap JSON in ```json fences or prose. Extract the first
  // balanced {...} block as a fallback.
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

const SYSTEM_PROMPT = `You are a senior React Native / TypeScript engineer working on the "One L1fe" health app (Expo, TypeScript, under apps/mobile/src). A non-developer user described a small UI change in plain words. Your job is to make the SMALLEST correct code change that satisfies the wish.

Hard rules:
- Only edit UI/presentation files under apps/mobile/src. NEVER touch data layer, database, native code, secrets, or config.
- Do not invent health values or fabricate data. Presentation only.
- Return COMPLETE file contents for every file you change (not a diff).
- Keep the change minimal and consistent with surrounding code.
Respond with JSON only, no prose outside the JSON.`;

type PlannerOut = { files: string[] };
type EditorOut = { summary: string; edits: Array<{ path: string; content: string }> };

async function runPlanner(
  tier: Tier,
  wish: string,
  candidatePaths: string[],
): Promise<{ files: string[]; tokensPrompt: number | null; tokensCompletion: number | null; modelServed: string; provider: string | null } | null> {
  const res = await callModel({
    tier,
    responseJson: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `WISH:\n${wish}\n\nCANDIDATE FILES (choose up to ${MAX_CONTEXT_FILES} that you need to read to make this change):\n${candidatePaths.join("\n")}\n\nReturn JSON: {"files": ["path", ...]} — only paths from the candidate list.`,
      },
    ],
  });
  const parsed = safeJsonParse<PlannerOut>(res.content);
  if (!parsed || !Array.isArray(parsed.files)) return null;
  return {
    files: parsed.files.slice(0, MAX_CONTEXT_FILES),
    tokensPrompt: res.tokensPrompt,
    tokensCompletion: res.tokensCompletion,
    modelServed: res.modelServed,
    provider: res.provider,
  };
}

async function runEditor(
  tier: Tier,
  wish: string,
  files: Array<{ path: string; content: string }>,
): Promise<{ out: EditorOut; tokensPrompt: number | null; tokensCompletion: number | null; modelServed: string; provider: string | null } | null> {
  const fileBlocks = files
    .map((f) => `=== FILE: ${f.path} ===\n${f.content}`)
    .join("\n\n");
  const res = await callModel({
    tier,
    responseJson: true,
    maxTokens: 8192,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `WISH:\n${wish}\n\nCURRENT FILES:\n${fileBlocks}\n\nReturn JSON: {"summary": "one sentence", "edits": [{"path": "<one of the files above>", "content": "<COMPLETE new file content>"}]}. Only include files you actually changed.`,
      },
    ],
  });
  const parsed = safeJsonParse<EditorOut>(res.content);
  if (!parsed || !Array.isArray(parsed.edits) || parsed.edits.length === 0) return null;
  return {
    out: parsed,
    tokensPrompt: res.tokensPrompt,
    tokensCompletion: res.tokensCompletion,
    modelServed: res.modelServed,
    provider: res.provider,
  };
}

export type ProcessResult =
  | { ok: true; prNumber: number; prUrl: string }
  | { ok: false; status: "blocked" | "failed"; reason: string };

export async function processTask(ideaId: string): Promise<ProcessResult> {
  const idea = await loadIdea(ideaId);
  const config = await loadConfig();
  const rules = { allowed: config.allowed, forbidden: config.forbidden };
  const intent = (idea.intent ?? "idea") as Intent;
  const reqId = idea.req_id ?? "REQ-UNKNOWN";

  // Kill-switch.
  if (config.bdcPaused) {
    const reason = config.pauseReason || "BDC ist gerade pausiert.";
    await setIdea(ideaId, { status: "blocked", block_reason: reason });
    await logTask({ idea_id: ideaId, req_id: reqId, intent, validate_result: "paused", blocked_reason: reason, template_version: config.templateVersion });
    return { ok: false, status: "blocked", reason };
  }

  // Claim the idea atomically (generating -> shipping) so a second concurrent
  // run (double tab / reload) cannot start a duplicate PR on the same branch.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("ideas")
    .update({ status: "shipping" })
    .eq("id", ideaId)
    .eq("status", "generating")
    .select("id");
  if (claimErr) throw new Error(claimErr.message);
  if (!claimed || claimed.length === 0) {
    return { ok: false, status: "blocked", reason: "Wird bereits bearbeitet." };
  }

  // Repo context.
  const base = await getDefaultBranch();
  const baseSha = await getBranchHeadSha(base);
  const tree = await getRepoTree(baseSha);
  const candidates = tree.entries
    .filter((e) => e.type === "blob" && isPathAllowed(e.path, rules))
    .map((e) => e.path)
    .slice(0, MAX_TREE_CANDIDATES);

  if (candidates.length === 0) {
    const reason = "Keine bearbeitbaren Dateien gefunden (Pfadregeln zu eng?).";
    await setIdea(ideaId, { status: "failed", error_message: reason });
    await logTask({ idea_id: ideaId, req_id: reqId, intent, base_sha: baseSha, validate_result: "error", blocked_reason: reason, template_version: config.templateVersion });
    return { ok: false, status: "failed", reason };
  }

  const wish = wishText(idea);
  const startTier: Tier = config.routingMap[intent] ?? "tier1";

  let tier: Tier | null = startTier;
  let escalatedFrom: string | null = null;
  let attempt = 0;
  let lastReason = "Kein gültiger Patch erzeugt.";

  while (tier) {
    attempt++;
    const thisTier = tier;
    try {
      // PLANNER
      const plan = await runPlanner(thisTier, wish, candidates);
      const planFiles = (plan?.files ?? []).filter((p) => isPathAllowed(p, rules) && candidates.includes(p));
      if (!plan || planFiles.length === 0) {
        lastReason = "Modell konnte keine passenden Dateien wählen.";
        await logTask({ idea_id: ideaId, req_id: reqId, intent, tier: thisTier, model_requested: undefined, model_served: plan?.modelServed, provider: plan?.provider ?? null, attempt_number: attempt, escalated_from: escalatedFrom, base_sha: baseSha, template_version: config.templateVersion, tokens_prompt: plan?.tokensPrompt ?? null, tokens_completion: plan?.tokensCompletion ?? null, validate_result: "parse_fail", blocked_reason: lastReason });
        escalatedFrom = thisTier;
        tier = nextTier(thisTier);
        continue;
      }

      // FETCH
      const files: Array<{ path: string; content: string }> = [];
      for (const p of planFiles) {
        const content = await getFileContent(p, base);
        if (content != null) files.push({ path: p, content });
      }
      if (files.length === 0) {
        lastReason = "Ausgewählte Dateien konnten nicht gelesen werden.";
        escalatedFrom = thisTier;
        tier = nextTier(thisTier);
        continue;
      }

      // EDITOR
      const edited = await runEditor(thisTier, wish, files);
      if (!edited) {
        lastReason = "Modell lieferte keinen brauchbaren Patch.";
        await logTask({ idea_id: ideaId, req_id: reqId, intent, tier: thisTier, model_served: undefined, attempt_number: attempt, escalated_from: escalatedFrom, base_sha: baseSha, template_version: config.templateVersion, validate_result: "parse_fail", blocked_reason: lastReason });
        escalatedFrom = thisTier;
        tier = nextTier(thisTier);
        continue;
      }

      // PATH-VALIDATE every edit (security boundary). An edit must (a) pass the
      // allow/forbid rules AND (b) be one of the files we actually fetched — the
      // editor may only change files it was given, never introduce a new path.
      const fetchedSet = new Set(files.map((f) => f.path));
      const editList: FileEdit[] = [];
      let pathReject = false;
      for (const e of edited.out.edits) {
        if (
          !e.path ||
          typeof e.content !== "string" ||
          !fetchedSet.has(e.path) ||
          !isPathAllowed(e.path, rules)
        ) {
          pathReject = true;
          break;
        }
        editList.push({ path: e.path, content: e.content });
      }
      if (pathReject || editList.length === 0) {
        lastReason = "Patch wollte eine gesperrte Datei ändern — abgelehnt.";
        await logTask({ idea_id: ideaId, req_id: reqId, intent, tier: thisTier, model_served: edited.modelServed, provider: edited.provider, attempt_number: attempt, escalated_from: escalatedFrom, base_sha: baseSha, template_version: config.templateVersion, tokens_prompt: edited.tokensPrompt, tokens_completion: edited.tokensCompletion, validate_result: "path_reject", blocked_reason: lastReason });
        escalatedFrom = thisTier;
        tier = nextTier(thisTier);
        continue;
      }

      // OPEN PR
      const branch = `bdc/${reqId.toLowerCase()}`;
      await createBranch(branch, baseSha);
      const commitMsg = `bdc: ${idea.title ?? reqId}\n\n${edited.out.summary}\n\n${reqId}`;
      await commitFiles(branch, baseSha, editList, commitMsg);
      const prBody = [
        `Automated by **Bros Developer Cockpit** (${reqId}).`,
        ``,
        `**Wish**`,
        wish,
        ``,
        `**Change**: ${edited.out.summary}`,
        `**Files**: ${editList.map((e) => e.path).join(", ")}`,
        `**Model tier**: ${thisTier} (${edited.modelServed})`,
        ``,
        `> Must pass the reviewer lane before it can ship. Token: ${reqId}`,
      ].join("\n");
      const pr = await openPullRequest({
        head: branch,
        base,
        title: `${reqId}: ${idea.title ?? "BDC change"}`.slice(0, 200),
        body: prBody,
      });

      await setIdea(ideaId, { status: "sent", github_pr_number: pr.number, github_pr_url: pr.html_url, error_message: null });
      await logTask({ idea_id: ideaId, req_id: reqId, intent, tier: thisTier, model_served: edited.modelServed, provider: edited.provider, attempt_number: attempt, escalated_from: escalatedFrom, base_sha: baseSha, template_version: config.templateVersion, tokens_prompt: edited.tokensPrompt, tokens_completion: edited.tokensCompletion, validate_result: "ok", pr_number: pr.number, pr_url: pr.html_url });
      return { ok: true, prNumber: pr.number, prUrl: pr.html_url };
    } catch (e) {
      lastReason = e instanceof Error ? e.message : String(e);
      await logTask({ idea_id: ideaId, req_id: reqId, intent, tier: thisTier, attempt_number: attempt, escalated_from: escalatedFrom, base_sha: baseSha, template_version: config.templateVersion, validate_result: "error", blocked_reason: lastReason.slice(0, 400) });
      escalatedFrom = thisTier;
      tier = nextTier(thisTier);
    }
  }

  // User-facing message stays generic (technical detail lives in task_log).
  await setIdea(ideaId, {
    status: "failed",
    error_message: "Konnte gerade nicht automatisch umgesetzt werden. Dein Bruder schaut es sich an.",
  });
  return { ok: false, status: "failed", reason: lastReason };
}
