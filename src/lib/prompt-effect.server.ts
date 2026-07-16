import { createServerFn } from "@tanstack/react-start";
import { listIssues, listPullRequests, type PullState, type RepoIssue } from "./github.server";

export type PromptVersionEffect = {
  version: string;
  date: string;
  promptFile: string;
  issuesCreated: number;
  prsCreated: number;
  accepted: number;
  reworked: number;
};

export type SkillSnapshotTrend = {
  id: number;
  title: string;
  createdAt: string;
  url: string;
};

export type PromptEffectSummary = {
  label: "Experimental, small sample";
  versions: PromptVersionEffect[];
  skillSnapshots: SkillSnapshotTrend[];
  sampleSize: number;
};

const PROMPT_VERSIONS = [
  {
    version: "v1",
    date: "2026-07-16",
    promptFile: "docs/prompts/pl-prompt-v1.md",
  },
] as const;

function hasLabel(issue: Pick<RepoIssue, "labels">, label: string): boolean {
  return issue.labels.some((entry) => entry.name === label);
}

function statusLabels(issue: Pick<RepoIssue, "labels">): Set<string> {
  return new Set(issue.labels.map((entry) => entry.name));
}

function isAccepted(issue: Pick<RepoIssue, "labels">): boolean {
  const labels = statusLabels(issue);
  return labels.has("bdc-approved") || labels.has("bdc-live") || labels.has("dc:status:approved") || labels.has("dc:status:live");
}

function isReworked(issue: Pick<RepoIssue, "labels">): boolean {
  const labels = statusLabels(issue);
  return labels.has("bdc-changes-requested") || labels.has("bdc-blocked-guardrails") || labels.has("bdc-failed") || labels.has("dc:status:blocked");
}

function pullBelongsToIssue(pull: Pick<PullState, "body" | "title" | "headRef">, issueNumber: number): boolean {
  const ref = `#${issueNumber}`;
  const branch = `bdc-hold/dc-issue-${issueNumber}`;
  return pull.headRef === branch || pull.title.includes(ref) || pull.body.includes(ref);
}

export function buildPromptEffectSummary(input: {
  issues: RepoIssue[];
  pulls: PullState[];
  skillSnapshots: RepoIssue[];
}): PromptEffectSummary {
  const bdcIssues = input.issues.filter((issue) => !issue.pull_request && hasLabel(issue, "bdc-submitted"));
  const versions = PROMPT_VERSIONS.map((version) => {
    const start = new Date(`${version.date}T00:00:00.000Z`);
    const versionIssues = bdcIssues.filter((issue) => new Date(issue.created_at) >= start);
    const versionIssueNumbers = new Set(versionIssues.map((issue) => issue.number));
    const prsCreated = input.pulls.filter((pull) =>
      Array.from(versionIssueNumbers).some((issueNumber) => pullBelongsToIssue(pull, issueNumber)),
    ).length;
    return {
      ...version,
      issuesCreated: versionIssues.length,
      prsCreated,
      accepted: versionIssues.filter(isAccepted).length,
      reworked: versionIssues.filter(isReworked).length,
    };
  });

  return {
    label: "Experimental, small sample",
    versions,
    skillSnapshots: input.skillSnapshots
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        id: issue.number,
        title: issue.title,
        createdAt: issue.created_at,
        url: issue.html_url,
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 5),
    sampleSize: bdcIssues.length,
  };
}

export async function loadPromptEffectSummary(): Promise<PromptEffectSummary> {
  const [issues, pulls, skillSnapshots] = await Promise.all([
    listIssues({ state: "all", sort: "created", direction: "desc", perPage: 100 }),
    listPullRequests("all"),
    listIssues({ labels: "skill-snapshot", state: "all", sort: "created", direction: "desc", perPage: 20 }),
  ]);
  return buildPromptEffectSummary({ issues, pulls, skillSnapshots });
}

export const getPromptEffectSummary = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("./auth-session.server");
  requireAuth();
  return loadPromptEffectSummary();
});
