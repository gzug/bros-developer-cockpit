import type { PngEvidence, SkillSnapshot } from "./skills-scoring";

const GH = "https://api.github.com";
const TARGET_OWNER = "gzug";
const TARGET_REPO = "bros-developer-cockpit";
const SKILL_SNAPSHOT_LABEL = "skill-snapshot";
const SKILL_EVIDENCE_LABEL = "skill-evidence";
const ensuredLabels = new Set<string>();

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

function headers(extra?: HeadersInit): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is missing.");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "bros-developer-cockpit",
    "Content-Type": "application/json",
    ...extra,
  };
}

function repoPath(): string {
  return `${TARGET_OWNER}/${TARGET_REPO}`;
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GH}${path}`, {
    ...init,
    headers: headers(init?.headers),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} ${path}: ${body.slice(0, 400)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function labelMeta(label: string): { color: string; description: string } {
  if (label === SKILL_SNAPSHOT_LABEL) {
    return { color: "1D76DB", description: "Computed BDC skill snapshot" };
  }
  if (label === SKILL_EVIDENCE_LABEL) {
    return { color: "C2E0C6", description: "BDC skill evidence metadata" };
  }
  return { color: "EDEDED", description: "Managed by Bros Developer Cockpit" };
}

async function ensureRepoLabels(labels: string[]): Promise<void> {
  for (const label of Array.from(new Set(labels))) {
    if (ensuredLabels.has(label)) continue;
    const meta = labelMeta(label);
    const res = await fetch(`${GH}/repos/${repoPath()}/labels`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        name: label,
        color: meta.color,
        description: meta.description,
      }),
    });
    if (res.ok || res.status === 422) {
      ensuredLabels.add(label);
      continue;
    }
    const body = await res.text();
    throw new Error(`GitHub ${res.status} create label ${label}: ${body.slice(0, 400)}`);
  }
}

function snapshotIssueBody(snapshot: SkillSnapshot): string {
  return [
    "## Skill snapshot",
    "",
    "Computed from uploaded AI-session export metadata. Raw conversation text is not stored.",
    "",
    "<!-- skill-snapshot-json",
    JSON.stringify(snapshot, null, 2),
    "-->",
  ].join("\n");
}

function evidenceIssueBody(input: { evidence: PngEvidence[]; note?: string }): string {
  return [
    "## Skill evidence",
    "",
    "PNG screenshots are not parsed in v1. Only metadata is stored.",
    "",
    "<!-- skill-evidence-json",
    JSON.stringify(
      {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        note: input.note?.trim() || undefined,
        pngEvidence: input.evidence,
      },
      null,
      2,
    ),
    "-->",
  ].join("\n");
}

export function parseSkillSnapshotIssueBody(body: string | null | undefined): SkillSnapshot | null {
  const match = body?.match(/<!--\s*skill-snapshot-json\s*([\s\S]*?)\s*-->/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as SkillSnapshot;
    if (parsed.schemaVersion !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createSkillSnapshotIssue(snapshot: SkillSnapshot): Promise<{ number: number; url: string }> {
  await ensureRepoLabels([SKILL_SNAPSHOT_LABEL]);
  const issue = await gh<{ number: number; html_url: string }>(`/repos/${repoPath()}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: `Skill snapshot ${snapshot.createdAt}`,
      body: snapshotIssueBody(snapshot),
      labels: [SKILL_SNAPSHOT_LABEL],
    }),
  });
  return { number: issue.number, url: issue.html_url };
}

export async function createSkillEvidenceIssue(input: {
  evidence: PngEvidence[];
  note?: string;
}): Promise<{ number: number; url: string }> {
  await ensureRepoLabels([SKILL_EVIDENCE_LABEL]);
  const issue = await gh<{ number: number; html_url: string }>(`/repos/${repoPath()}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: `Skill evidence ${new Date().toISOString()}`,
      body: evidenceIssueBody(input),
      labels: [SKILL_EVIDENCE_LABEL],
    }),
  });
  return { number: issue.number, url: issue.html_url };
}

export async function listSkillSnapshots(): Promise<Array<SkillSnapshot & { issueNumber: number; issueUrl: string }>> {
  const search = new URLSearchParams({
    labels: SKILL_SNAPSHOT_LABEL,
    state: "all",
    sort: "created",
    direction: "asc",
    per_page: "100",
  });
  const issues = await gh<RepoIssue[]>(`/repos/${repoPath()}/issues?${search.toString()}`);
  return issues
    .filter((issue) => !issue.pull_request)
    .map((issue) => {
      const snapshot = parseSkillSnapshotIssueBody(issue.body);
      return snapshot ? { ...snapshot, issueNumber: issue.number, issueUrl: issue.html_url } : null;
    })
    .filter((snapshot): snapshot is SkillSnapshot & { issueNumber: number; issueUrl: string } => Boolean(snapshot))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
