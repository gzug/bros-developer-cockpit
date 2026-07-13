import {
  addIssueComment,
  createIssue,
  getIssue,
  getPullRequest,
  listIssueComments,
  listIssues,
  listPullRequests,
  updateIssueLabels,
  type PullState,
  type RepoComment,
  type RepoIssue,
} from "./github.server";

export type DCIdeaIntent = "wording" | "look" | "wrong" | "idea";
export type DCIdeaStatus = "submitted" | "sent" | "approved" | "live" | "blocked" | "closed";

export interface DCIdea {
  id: number;
  title: string;
  description: string;
  intent: DCIdeaIntent;
  status: DCIdeaStatus;
  createdAt: string;
  issueUrl: string;
  prNumber?: number;
  prUrl?: string;
  blockReason?: string;
  labels: string[];
}

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
  const labelIntent = labels.find(
    (label) => label.startsWith(INTENT_PREFIX) && label !== DC_LABEL && !label.startsWith(STATUS_PREFIX),
  );
  if (labelIntent) {
    const candidate = labelIntent.slice(INTENT_PREFIX.length);
    if (candidate === "wording" || candidate === "look" || candidate === "wrong" || candidate === "idea") {
      return { intent: candidate };
    }
  }

  const match = issue.body.match(META_RE);
  if (!match) return { intent: "idea" };
  try {
    const parsed = JSON.parse(match[1]) as Partial<ParsedMeta>;
    if (parsed.intent === "wording" || parsed.intent === "look" || parsed.intent === "wrong" || parsed.intent === "idea") {
      return { intent: parsed.intent };
    }
  } catch {}
  return { intent: "idea" };
}

function matchPullRequest(issueNumber: number, pulls: PullState[]): PullState | undefined {
  return pulls.find((pull) => {
    const ref = `#${issueNumber}`;
    return pull.body.includes(`Closes ${ref}`) || pull.title.includes(ref) || pull.body.includes(ref);
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

  if (labels.has("bdc-failed")) return "blocked";
  if (labels.has(statusLabel("live"))) return "live";
  if (labels.has(statusLabel("approved"))) return "approved";
  if (labels.has(statusLabel("blocked"))) return "blocked";
  if (input.pr) return "sent";
  if (input.issueState === "closed") return "closed";
  return "submitted";
}

export function canTransitionIdeaStatus(from: DCIdeaStatus, to: DCIdeaStatus): boolean {
  if (from === to) return true;

  switch (from) {
    case "sent":
      return to === "approved" || to === "blocked";
    case "approved":
      return to === "live" || to === "blocked";
    default:
      return false;
  }
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

export async function createIdea(
  intent: DCIdeaIntent,
  title: string,
  description: string,
): Promise<DCIdea> {
  const issue = await createIssue({
    title: truncateTitle(title),
    body: `${description.trim()}\n\n<!-- dc:${JSON.stringify({ intent })} -->`,
    labels: [DC_LABEL, `${INTENT_PREFIX}${intent}`, statusLabel("submitted")],
  });
  return {
    id: issue.number,
    title: issue.title,
    description: description.trim(),
    intent,
    status: "submitted",
    createdAt: issue.created_at,
    issueUrl: issue.html_url,
    labels: [DC_LABEL, `${INTENT_PREFIX}${intent}`, statusLabel("submitted")],
  };
}

export async function listIdeas(): Promise<DCIdea[]> {
  const [issues, pulls] = await Promise.all([
    listIssues({ labels: DC_LABEL, state: "all", sort: "created", direction: "desc", perPage: 50 }),
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
    labels: DC_LABEL,
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
  const next = labels.filter((label) => !label.startsWith(STATUS_PREFIX));
  next.push(statusLabel(status));
  if (!next.includes(DC_LABEL)) next.push(DC_LABEL);
  if (intent && !next.includes(`${INTENT_PREFIX}${intent}`)) next.push(`${INTENT_PREFIX}${intent}`);
  await updateIssueLabels(issueNumber, Array.from(new Set(next)));
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

export async function getEngineRunStats(issueNumber: number): Promise<EngineRunStats[]> {
  const comments = await listIssueComments(issueNumber);
  return comments
    .map((comment) => {
      const match = comment.body.match(ENGINE_RE);
      if (!match) return null;
      return {
        model: match[1].trim(),
        promptTokens: Number(match[2]),
        completionTokens: Number(match[3]),
        costUsd: Number(match[4]),
        prNumber: match[5] ? Number(match[5]) : undefined,
      } satisfies EngineRunStats;
    })
    .filter((entry): entry is EngineRunStats => entry != null);
}

export async function getIdeaWithPull(issueNumber: number) {
  const idea = await getIdea(issueNumber);
  const pr = idea.prNumber ? await getPullRequest(idea.prNumber) : null;
  return { idea, pr };
}
