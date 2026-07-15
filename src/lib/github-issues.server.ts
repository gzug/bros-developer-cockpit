import {
  addIssueComment,
  addLabelsToIssue,
  createIssue,
  getIssue,
  getPullRequest,
  listAllIssueComments,
  listIssueComments,
  listIssues,
  listPullRequests,
  updateIssueLabels,
  type PullState,
  type RepoComment,
  type RepoIssue,
  type RepoIssueComment,
} from "./github.server";

export type DCIdeaIntent = "wording" | "look" | "wrong" | "idea" | "change";
export type DCIdeaStatus = "submitted" | "processing" | "sent" | "approved" | "live" | "blocked" | "closed";
export type BdcSubmissionType = "idea" | "change";

export interface DCIdea {
  id: number;
  title: string;
  description: string;
  intent: DCIdeaIntent;
  status: DCIdeaStatus;
  statusSummary: string;
  createdAt: string;
  issueUrl: string;
  prNumber?: number;
  prUrl?: string;
  blockReason?: string;
  labels: string[];
}

export interface DCIdeaActivity {
  id: number;
  body: string;
  createdAt: string;
  url: string;
}

export type OwnerActionIdea = Pick<DCIdea, "id" | "title" | "status" | "statusSummary" | "prNumber" | "prUrl" | "issueUrl">;

export type EngineRunStats = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  prNumber?: number;
};

type ParsedMeta = {
  intent: DCIdeaIntent;
};

const DC_LABEL = "dc";
const FROM_BROTHER_LABEL = "from-brother";
const BDC_SUBMITTED_LABEL = "bdc-submitted";
const BDC_ENGINE_STARTED_LABEL = "bdc-engine-started";
const BDC_BLOCKED_GUARDRAILS_LABEL = "bdc-blocked-guardrails";
const BDC_CHANGES_REQUESTED_LABEL = "bdc-changes-requested";
const BDC_APPROVED_LABEL = "bdc-approved";
const BDC_LIVE_LABEL = "bdc-live";
const UI_ONLY_LABEL = "ui-only";
const DESIGN_LABEL = "one-l1fe-design";
const STATUS_PREFIX = "dc:status:";
const INTENT_PREFIX = "dc:";
const META_RE = /<!--\s*dc:(\{[\s\S]*?\})\s*-->/;
const ENGINE_RE =
  /🤖\s*Model:\s*(.+?)\s*\|\s*Tokens:\s*(\d+)\+(\d+)\s*\|\s*\$([0-9.]+)(?:\s*\|\s*PR\s+#(\d+))?/;

function statusLabel(status: DCIdeaStatus): string {
  return `${STATUS_PREFIX}${status}`;
}

function cleanDescription(body: string): string {
  return body.replace(META_RE, "").trim();
}

function parseMeta(issue: RepoIssue): ParsedMeta {
  const labels = issue.labels.map((label) => label.name);
  if (labels.includes("change")) return { intent: "change" };
  if (labels.includes("idea")) return { intent: "idea" };

  const labelIntent = labels.find(
    (label) => label.startsWith(INTENT_PREFIX) && label !== DC_LABEL && !label.startsWith(STATUS_PREFIX),
  );
  if (labelIntent) {
    const candidate = labelIntent.slice(INTENT_PREFIX.length);
    if (candidate === "wording" || candidate === "look" || candidate === "wrong" || candidate === "idea" || candidate === "change") {
      return { intent: candidate };
    }
  }

  const match = issue.body.match(META_RE);
  if (!match) return { intent: "idea" };
  try {
    const parsed = JSON.parse(match[1]) as Partial<ParsedMeta>;
    if (parsed.intent === "wording" || parsed.intent === "look" || parsed.intent === "wrong" || parsed.intent === "idea" || parsed.intent === "change") {
      return { intent: parsed.intent };
    }
  } catch {}
  return { intent: "idea" };
}

function matchPullRequest(issueNumber: number, pulls: PullState[]): PullState | undefined {
  return pulls.find((pull) => {
    const ref = `#${issueNumber}`;
    const fullRef = `gzug/01-One-L1fe#${issueNumber}`;
    const branch = `bdc-hold/dc-issue-${issueNumber}`;
    return (
      pull.headRef === branch ||
      pull.body.includes(`Closes ${ref}`) ||
      pull.body.includes(`Resolves: ${fullRef}`) ||
      pull.body.includes(fullRef) ||
      pull.title.includes(ref) ||
      pull.body.includes(ref)
    );
  });
}

function parseBlockReason(comments: RepoComment[]): string | undefined {
  const last = [...comments].reverse().find((comment) => comment.body.trim());
  return last?.body.trim();
}

export function deriveIdeaStatus(input: {
  issueLabels: string[];
  issueState: RepoIssue["state"];
  pr?: Pick<PullState, "labels" | "merged"> | null;
}): DCIdeaStatus {
  const labels = new Set([...input.issueLabels, ...(input.pr?.labels ?? [])]);

  if (labels.has("bdc-failed") || labels.has(BDC_BLOCKED_GUARDRAILS_LABEL) || labels.has(BDC_CHANGES_REQUESTED_LABEL)) {
    return "blocked";
  }
  if (labels.has(BDC_LIVE_LABEL)) return "live";
  if (labels.has(BDC_APPROVED_LABEL)) return "approved";
  if (labels.has(statusLabel("live"))) return "live";
  if (labels.has(statusLabel("approved"))) return "approved";
  if (labels.has(statusLabel("blocked"))) return "blocked";
  if (input.pr) return "sent";
  if (labels.has(BDC_ENGINE_STARTED_LABEL)) return "processing";
  if (input.issueState === "closed") return "closed";
  return "submitted";
}

export function canTransitionIdeaStatus(from: DCIdeaStatus, to: DCIdeaStatus): boolean {
  if (from === to) return true;

  switch (from) {
    case "processing":
      return to === "sent" || to === "blocked";
    case "sent":
      return to === "approved" || to === "blocked";
    case "approved":
      return to === "live" || to === "blocked";
    default:
      return false;
  }
}

export function canConfirmIdeaLive(pr?: Pick<PullState, "merged"> | null): boolean {
  return pr?.merged === true;
}

export function describeIdeaStatus(status: DCIdeaStatus): string {
  switch (status) {
    case "submitted":
      return "Ready to start the bridge pipeline.";
    case "processing":
      return "BDC is preparing a held PR.";
    case "sent":
      return "A held PR exists. Review it and either approve shipping or return it to manual review.";
    case "approved":
      return "Approved in Cockpit. The One L1fe ship lane will validate, merge, and publish OTA.";
    case "live":
      return "Confirmed live in OL1.";
    case "blocked":
      return "Stopped for manual review.";
    case "closed":
      return "Closed without a live confirmation.";
  }
}

export function toIdeaActivity(comments: RepoComment[]): DCIdeaActivity[] {
  return comments
    .filter((comment) => comment.body.trim())
    .map((comment) => ({
      id: comment.id,
      body: comment.body.trim(),
      createdAt: comment.created_at,
      url: comment.html_url,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

const OWNER_ACTION_PRIORITY: Partial<Record<DCIdeaStatus, number>> = {
  approved: 0,
  sent: 1,
  blocked: 2,
};

export function getOwnerActionQueue(ideas: DCIdea[]): OwnerActionIdea[] {
  return ideas
    .filter((idea) => OWNER_ACTION_PRIORITY[idea.status] != null)
    .sort((a, b) => {
      const priorityDiff = (OWNER_ACTION_PRIORITY[a.status] ?? 99) - (OWNER_ACTION_PRIORITY[b.status] ?? 99);
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt < b.createdAt ? 1 : -1;
    })
    .map(({ id, title, status, statusSummary, prNumber, prUrl, issueUrl }) => ({
      id,
      title,
      status,
      statusSummary,
      prNumber,
      prUrl,
      issueUrl,
    }));
}

async function deriveIdea(issue: RepoIssue, pulls: PullState[]): Promise<DCIdea> {
  const labels = issue.labels.map((label) => label.name);
  const meta = parseMeta(issue);
  const pr = matchPullRequest(issue.number, pulls);

  const status = deriveIdeaStatus({ issueLabels: labels, issueState: issue.state, pr });
  let blockReason: string | undefined;

  if (status === "blocked") {
    blockReason = parseBlockReason(await listIssueComments(pr?.labels.includes("bdc-failed") ? pr.number : issue.number));
  }

  return {
    id: issue.number,
    title: issue.title,
    description: cleanDescription(issue.body),
    intent: meta.intent,
    status,
    statusSummary: describeIdeaStatus(status),
    createdAt: issue.created_at,
    issueUrl: issue.html_url,
    prNumber: pr?.number,
    prUrl: pr?.html_url,
    blockReason,
    labels,
  };
}

function truncateTitle(title: string): string {
  return title.trim().slice(0, 80);
}

function submissionTypeForIntent(intent: DCIdeaIntent): BdcSubmissionType {
  return intent === "idea" ? "idea" : "change";
}

function issueTitle(type: BdcSubmissionType, title: string): string {
  return `[${type === "idea" ? "Idea" : "Change"}] ${truncateTitle(title)}`;
}

function issueBody(input: {
  type: BdcSubmissionType;
  title: string;
  description: string;
  screen?: string;
}): string {
  const screen = input.screen?.trim() || "not specified";
  return [
    "## Description",
    input.description.trim(),
    "",
    "## Context",
    `Screen: ${screen}`,
    `Type: ${input.type}`,
    "",
    "---",
    `_Submitted via BDC on ${new Date().toISOString()}_`,
    "",
    `<!-- dc:${JSON.stringify({ intent: input.type })} -->`,
  ].join("\n");
}

function baseSubmissionLabels(type: BdcSubmissionType): string[] {
  return [FROM_BROTHER_LABEL, BDC_SUBMITTED_LABEL, type, UI_ONLY_LABEL, DESIGN_LABEL];
}

export async function createIdea(
  intent: DCIdeaIntent,
  title: string,
  description: string,
): Promise<DCIdea> {
  const type = submissionTypeForIntent(intent);
  return createSubmittedIdea({ type, title, description });
}

export async function createSubmittedIdea(input: {
  type: BdcSubmissionType;
  title: string;
  description: string;
  screen?: string;
}): Promise<DCIdea> {
  const issue = await createIssue({
    title: issueTitle(input.type, input.title),
    body: issueBody(input),
    labels: baseSubmissionLabels(input.type),
  });
  return {
    id: issue.number,
    title: issue.title,
    description: input.description.trim(),
    intent: input.type,
    status: "submitted",
    statusSummary: describeIdeaStatus("submitted"),
    createdAt: issue.created_at,
    issueUrl: issue.html_url,
    labels: baseSubmissionLabels(input.type),
  };
}

export async function listIdeas(): Promise<DCIdea[]> {
  const [issues, pulls] = await Promise.all([
    listIssues({ labels: BDC_SUBMITTED_LABEL, state: "all", sort: "created", direction: "desc", perPage: 50 }),
    listPullRequests("all"),
  ]);
  const realIssues = issues.filter((issue) => !issue.pull_request);
  return Promise.all(realIssues.map((issue) => deriveIdea(issue, pulls)));
}

export async function getIdea(issueNumber: number): Promise<DCIdea> {
  const [issue, pulls] = await Promise.all([getIssue(issueNumber), listPullRequests("all")]);
  return deriveIdea(issue, pulls);
}

export async function recentIdeaCount(): Promise<number> {
  const sinceDate = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const issues = await listIssues({
    labels: BDC_SUBMITTED_LABEL,
    state: "all",
    sort: "created",
    direction: "desc",
    perPage: 100,
    since: sinceDate.toISOString(),
  });
  return issues.filter((issue) => !issue.pull_request && new Date(issue.created_at) >= sinceDate).length;
}

export async function setIdeaStatus(issueNumber: number, status: DCIdeaStatus, intent?: DCIdeaIntent): Promise<void> {
  const issue = await getIssue(issueNumber);
  const labels = issue.labels.map((label) => label.name);
  const next = labels.filter(
    (label) =>
      !label.startsWith(STATUS_PREFIX) &&
      label !== BDC_APPROVED_LABEL &&
      label !== BDC_LIVE_LABEL &&
      label !== BDC_CHANGES_REQUESTED_LABEL &&
      label !== BDC_BLOCKED_GUARDRAILS_LABEL,
  );
  if (!next.includes(FROM_BROTHER_LABEL)) next.push(FROM_BROTHER_LABEL);
  if (!next.includes(BDC_SUBMITTED_LABEL)) next.push(BDC_SUBMITTED_LABEL);
  if (!next.includes(UI_ONLY_LABEL)) next.push(UI_ONLY_LABEL);
  if (!next.includes(DESIGN_LABEL)) next.push(DESIGN_LABEL);
  const type = intent ? submissionTypeForIntent(intent) : "idea";
  if (!next.includes(type)) next.push(type);
  if (status === "processing" || status === "sent") {
    if (!next.includes(BDC_ENGINE_STARTED_LABEL)) next.push(BDC_ENGINE_STARTED_LABEL);
  }
  if (status === "approved") next.push(BDC_APPROVED_LABEL);
  if (status === "live") next.push(BDC_LIVE_LABEL);
  if (status === "blocked") next.push(BDC_CHANGES_REQUESTED_LABEL);
  await updateIssueLabels(issueNumber, Array.from(new Set(next)));
}

export async function claimIdeaForEngine(issueNumber: number): Promise<void> {
  await addLabelsToIssue(issueNumber, [BDC_ENGINE_STARTED_LABEL]);
}

export async function markIdeaGuardrailBlocked(issueNumber: number, reason: string): Promise<void> {
  await addLabelsToIssue(issueNumber, [BDC_BLOCKED_GUARDRAILS_LABEL]);
  await addIssueComment(issueNumber, `Blocked by BDC guardrails.\n\n${reason}`);
}

export async function markIdeaApproved(issueNumber: number): Promise<void> {
  await addLabelsToIssue(issueNumber, [BDC_APPROVED_LABEL]);
  await addIssueComment(issueNumber, "Approved by owner. The One L1fe BDC ship lane will validate, merge, and publish the OTA.");
}

export async function markIdeaLive(issueNumber: number): Promise<void> {
  await addLabelsToIssue(issueNumber, [BDC_LIVE_LABEL]);
  await addIssueComment(issueNumber, "Owner confirmed this OTA is live on the brother device.");
}

export async function requestIdeaChanges(issueNumber: number): Promise<void> {
  await addLabelsToIssue(issueNumber, [BDC_CHANGES_REQUESTED_LABEL]);
  await addIssueComment(issueNumber, "Owner requested changes. Check /dc for details.");
}

export async function listNewBdcIssues(): Promise<RepoIssue[]> {
  const issues = await listIssues({
    labels: BDC_SUBMITTED_LABEL,
    state: "open",
    sort: "created",
    direction: "asc",
    perPage: 50,
  });
  return issues.filter((issue) => {
    if (issue.pull_request) return false;
    const labels = new Set(issue.labels.map((label) => label.name));
    return !labels.has(BDC_ENGINE_STARTED_LABEL) && !labels.has(BDC_BLOCKED_GUARDRAILS_LABEL);
  });
}

export async function addIdeaComment(issueNumber: number, body: string): Promise<void> {
  await addIssueComment(issueNumber, body);
}

export async function addEngineRunComment(issueNumber: number, stats: EngineRunStats): Promise<void> {
  const prPart = stats.prNumber ? ` | PR #${stats.prNumber}` : "";
  await addIssueComment(
    issueNumber,
    `🤖 Model: ${stats.model} | Tokens: ${stats.promptTokens}+${stats.completionTokens} | $${stats.costUsd.toFixed(4)}${prPart}`,
  );
}

function parseEngineRunStats(body: string): EngineRunStats | null {
  const match = body.match(ENGINE_RE);
  if (!match) return null;
  return {
    model: match[1].trim(),
    promptTokens: Number(match[2]),
    completionTokens: Number(match[3]),
    costUsd: Number(match[4]),
    prNumber: match[5] ? Number(match[5]) : undefined,
  };
}

export async function getEngineRunStats(issueNumber: number): Promise<EngineRunStats[]> {
  const comments = await listIssueComments(issueNumber);
  return comments
    .map((comment) => parseEngineRunStats(comment.body))
    .filter((entry): entry is EngineRunStats => entry != null);
}

export function groupEngineRunStats(
  issueNumbers: number[],
  comments: Array<Pick<RepoIssueComment, "issue_url" | "body">>,
): Map<number, EngineRunStats[]> {
  const stats = new Map<number, EngineRunStats[]>(issueNumbers.map((n) => [n, []]));
  for (const comment of comments) {
    const issueNumber = Number(comment.issue_url.split("/").pop());
    const bucket = stats.get(issueNumber);
    if (!bucket) continue;
    const parsed = parseEngineRunStats(comment.body);
    if (parsed) bucket.push(parsed);
  }
  return stats;
}

export async function getEngineRunStatsBatch(
  issueNumbers: number[],
): Promise<Map<number, EngineRunStats[]>> {
  if (issueNumbers.length === 0) return new Map();
  const comments = await listAllIssueComments();
  return groupEngineRunStats(issueNumbers, comments);
}

export async function getIdeaWithPull(issueNumber: number) {
  const idea = await getIdea(issueNumber);
  const pr = idea.prNumber ? await getPullRequest(idea.prNumber) : null;
  return { idea, pr };
}

export async function listIdeaActivity(issueNumber: number): Promise<DCIdeaActivity[]> {
  return toIdeaActivity(await listIssueComments(issueNumber));
}
