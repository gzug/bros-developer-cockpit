import type { PaxelSnapshot } from "./types";

const GH = "https://api.github.com";
const REPO = "gzug/bros-developer-cockpit";
export const PAXEL_SNAPSHOT_LABEL = "skill-snapshot";

type RepoIssue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: "open" | "closed";
  created_at: string;
  labels: Array<{ name: string }>;
  pull_request?: unknown;
};

function headers(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is missing.");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "bros-developer-cockpit-paxel",
    "Content-Type": "application/json",
  };
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GH}${path}`, { ...init, headers: headers() });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub ${response.status} ${path}: ${body.slice(0, 400)}`);
  }
  return (await response.json()) as T;
}

async function ensureLabel(): Promise<void> {
  const response = await fetch(`${GH}/repos/${REPO}/labels`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name: PAXEL_SNAPSHOT_LABEL,
      color: "1D76DB",
      description: "Derived local Builder Profile snapshot; no raw transcripts",
    }),
  });
  if (!response.ok && response.status !== 422) {
    throw new Error(`GitHub ${response.status} could not ensure ${PAXEL_SNAPSHOT_LABEL}.`);
  }
}

export function snapshotIssueBody(snapshot: PaxelSnapshot): string {
  return [
    "## Builder Profile snapshot",
    "",
    "Derived locally from Claude Code and Codex CLI session metadata. Raw transcripts never leave the owner's Mac.",
    "",
    "<!-- paxel-snapshot-json",
    JSON.stringify(snapshot, null, 2),
    "-->",
  ].join("\n");
}

export function parsePaxelSnapshotIssueBody(body: string | null | undefined): PaxelSnapshot | null {
  const match = body?.match(/<!--\s*paxel-snapshot-json\s*([\s\S]*?)\s*-->/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as PaxelSnapshot;
    if (parsed.schemaVersion !== 1 || parsed.subjectId !== "owner" || !Array.isArray(parsed.metrics)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createPaxelSnapshotIssue(snapshot: PaxelSnapshot): Promise<{ number: number; url: string }> {
  await ensureLabel();
  const issue = await gh<{ number: number; html_url: string }>(`/repos/${REPO}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: `Builder Profile snapshot ${snapshot.recordedAt}`,
      body: snapshotIssueBody(snapshot),
      labels: [PAXEL_SNAPSHOT_LABEL],
    }),
  });
  return { number: issue.number, url: issue.html_url };
}

export async function listPaxelSnapshots(): Promise<Array<PaxelSnapshot & { issueNumber: number; issueUrl: string }>> {
  const query = new URLSearchParams({ labels: PAXEL_SNAPSHOT_LABEL, state: "all", sort: "created", direction: "asc", per_page: "100" });
  const issues = await gh<RepoIssue[]>(`/repos/${REPO}/issues?${query.toString()}`);
  return issues
    .filter((issue) => !issue.pull_request)
    .map((issue) => {
      const snapshot = parsePaxelSnapshotIssueBody(issue.body);
      return snapshot ? { ...snapshot, issueNumber: issue.number, issueUrl: issue.html_url } : null;
    })
    .filter((snapshot): snapshot is PaxelSnapshot & { issueNumber: number; issueUrl: string } => Boolean(snapshot))
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}
