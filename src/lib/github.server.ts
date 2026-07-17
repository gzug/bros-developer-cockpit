const GH = "https://api.github.com";
const TARGET_OWNER = "gzug";
const TARGET_REPO = "01-One-L1fe";
const ensuredLabels = new Set<string>();

const LABEL_META: Record<string, { color: string; description: string }> = {
  "from-brother": { color: "0E8A16", description: "Submitted from the brother-facing BDC flow" },
  "bdc-submitted": { color: "C2E0C6", description: "Submitted to Bros Developer Cockpit" },
  "bdc-engine-started": { color: "1D76DB", description: "BDC engine has claimed this issue" },
  "bdc-blocked-guardrails": {
    color: "B60205",
    description: "BDC guardrails blocked the requested change",
  },
  "bdc-changes-requested": { color: "D93F0B", description: "Owner requested changes in BDC" },
  "bdc-approved": { color: "0E8A16", description: "Owner approved this held BDC PR to ship" },
  "bdc-shipped": {
    color: "1D76DB",
    description: "Production OTA published; device confirmation pending",
  },
  "bdc-publish-failed": {
    color: "B60205",
    description: "Merged, but production OTA publication failed",
  },
  "bdc-live": { color: "006B75", description: "Owner confirmed the BDC change is live on device" },
  "bdc-auto": { color: "5319E7", description: "Automated BDC pull request" },
  "bdc-failed": { color: "D93F0B", description: "BDC ship check failed" },
  parked: { color: "FBCA04", description: "Parked idea in BDC" },
  archived: { color: "BFD4F2", description: "Archived parked idea in BDC" },
  "weight:light": { color: "C2E0C6", description: "Lightweight BDC idea" },
  "weight:heavy": { color: "D93F0B", description: "Heavyweight BDC idea" },
  "ui-only": { color: "BFDADC", description: "Presentation-layer-only change" },
  "one-l1fe-design": { color: "BFD4F2", description: "Preserve One L1fe design preset" },
  "awaiting-owner-review": { color: "FBCA04", description: "Held for owner review" },
  idea: { color: "D4C5F9", description: "New idea submitted through BDC" },
  change: { color: "C5DEF5", description: "Change proposal submitted through BDC" },
};

export type PullState = {
  number: number;
  html_url: string;
  state: "open" | "closed";
  merged: boolean;
  merged_at: string | null;
  labels: string[];
  body: string;
  title: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  author: string;
};

export type RepoIssue = {
  number: number;
  title: string;
  body: string;
  html_url: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  labels: Array<{ name: string }>;
  pull_request?: unknown;
};

export type RepoComment = {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
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

export function repo() {
  const owner = TARGET_OWNER;
  const name = TARGET_REPO;
  return { owner, name, path: `${owner}/${name}` };
}

function normalizeLabels(labels: string[]): string[] {
  return Array.from(new Set(labels.map((label) => label.trim()).filter(Boolean)));
}

function labelMeta(label: string): { color: string; description: string } {
  if (LABEL_META[label]) return LABEL_META[label];
  if (label.startsWith("dc:status:")) {
    return { color: "C2E0C6", description: "BDC lifecycle status" };
  }
  if (label.startsWith("done-category:")) {
    return { color: "C5DEF5", description: "BDC done retro category" };
  }
  if (label.startsWith("dc:")) {
    return { color: "D4C5F9", description: "BDC metadata" };
  }
  return { color: "EDEDED", description: "Managed by Bros Developer Cockpit" };
}

export async function gh<T>(path: string, init?: RequestInit): Promise<T> {
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

export async function ensureRepoLabels(labels: string[]): Promise<void> {
  const r = repo();
  for (const label of normalizeLabels(labels)) {
    if (ensuredLabels.has(label)) continue;
    const meta = labelMeta(label);
    const res = await fetch(`${GH}/repos/${r.path}/labels`, {
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

export async function createIssue(input: {
  title: string;
  body: string;
  labels?: string[];
}): Promise<{ number: number; html_url: string; body: string; title: string; created_at: string }> {
  const r = repo();
  if (input.labels?.length) await ensureRepoLabels(input.labels);
  return gh(`/repos/${r.path}/issues`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listIssues(params: {
  labels?: string;
  state?: "open" | "closed" | "all";
  sort?: "created" | "updated" | "comments";
  direction?: "asc" | "desc";
  perPage?: number;
  since?: string;
}): Promise<RepoIssue[]> {
  const r = repo();
  const search = new URLSearchParams();
  if (params.labels) search.set("labels", params.labels);
  search.set("state", params.state ?? "all");
  search.set("sort", params.sort ?? "created");
  search.set("direction", params.direction ?? "desc");
  search.set("per_page", String(params.perPage ?? 50));
  if (params.since) search.set("since", params.since);
  return gh(`/repos/${r.path}/issues?${search.toString()}`);
}

export async function getIssue(number: number): Promise<RepoIssue> {
  const r = repo();
  return gh(`/repos/${r.path}/issues/${number}`);
}

export async function listIssueComments(number: number): Promise<RepoComment[]> {
  const r = repo();
  return gh(`/repos/${r.path}/issues/${number}/comments?per_page=100`);
}

export type RepoIssueComment = RepoComment & { issue_url: string };

export async function listAllIssueComments(maxPages = 10): Promise<RepoIssueComment[]> {
  const r = repo();
  const all: RepoIssueComment[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await gh<RepoIssueComment[]>(
      `/repos/${r.path}/issues/comments?per_page=100&page=${page}`,
    );
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

export async function addIssueComment(number: number, body: string): Promise<RepoComment> {
  const r = repo();
  return gh(`/repos/${r.path}/issues/${number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function updateIssueLabels(number: number, labels: string[]): Promise<void> {
  const r = repo();
  await ensureRepoLabels(labels);
  await gh(`/repos/${r.path}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ labels }),
  });
}

export async function updateIssueBody(number: number, body: string): Promise<void> {
  const r = repo();
  await gh(`/repos/${r.path}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

export async function closeIssue(number: number, stateReason: "completed" | "not_planned"): Promise<void> {
  const r = repo();
  await gh(`/repos/${r.path}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed", state_reason: stateReason }),
  });
}

export async function addLabelsToIssue(number: number, labels: string[]): Promise<void> {
  const r = repo();
  await ensureRepoLabels(labels);
  await gh(`/repos/${r.path}/issues/${number}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels }),
  });
}

export async function removeIssueLabel(number: number, label: string): Promise<void> {
  const r = repo();
  try {
    await gh(`/repos/${r.path}/issues/${number}/labels/${encodeURIComponent(label)}`, {
      method: "DELETE",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("GitHub 404")) return;
    throw error;
  }
}

export async function listPullRequests(
  state: "open" | "closed" | "all" = "all",
): Promise<PullState[]> {
  const r = repo();
  const pulls = await gh<
    Array<{
      number: number;
      html_url: string;
      state: "open" | "closed";
      merged_at: string | null;
      title: string;
      body?: string | null;
      labels?: Array<{ name: string }>;
      head: { ref: string; sha: string };
      base: { ref: string };
      user: { login: string };
    }>
  >(`/repos/${r.path}/pulls?state=${state}&per_page=100`);
  return pulls.map((pr) => ({
    number: pr.number,
    html_url: pr.html_url,
    state: pr.state,
    merged: pr.merged_at != null,
    merged_at: pr.merged_at,
    labels: (pr.labels ?? []).map((label) => label.name),
    body: pr.body ?? "",
    title: pr.title,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    baseRef: pr.base.ref,
    author: pr.user.login,
  }));
}

export async function getPullRequest(number: number): Promise<PullState> {
  const r = repo();
  const pr = await gh<{
    number: number;
    html_url: string;
    state: "open" | "closed";
    merged_at: string | null;
    title: string;
    body?: string | null;
    labels?: Array<{ name: string }>;
    head: { ref: string; sha: string };
    base: { ref: string };
    user: { login: string };
  }>(`/repos/${r.path}/pulls/${number}`);
  return {
    number: pr.number,
    html_url: pr.html_url,
    state: pr.state,
    merged: pr.merged_at != null,
    merged_at: pr.merged_at,
    labels: (pr.labels ?? []).map((label) => label.name),
    body: pr.body ?? "",
    title: pr.title,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    baseRef: pr.base.ref,
    author: pr.user.login,
  };
}

export async function getDefaultBranch(): Promise<string> {
  const r = repo();
  const meta = await gh<{ default_branch: string }>(`/repos/${r.path}`);
  return meta.default_branch;
}

export async function getBranchHeadSha(branch: string): Promise<string> {
  const r = repo();
  const result = await gh<{ commit: { sha: string } }>(
    `/repos/${r.path}/branches/${encodeURIComponent(branch)}`,
  );
  return result.commit.sha;
}

export type TreeEntry = { path: string; type: "blob" | "tree" };

export async function getRepoTree(
  sha: string,
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const r = repo();
  const tree = await gh<{
    tree: Array<{ path: string; type: string }>;
    truncated: boolean;
  }>(`/repos/${r.path}/git/trees/${sha}?recursive=1`);
  return {
    entries: tree.tree
      .filter((entry) => entry.type === "blob" || entry.type === "tree")
      .map((entry) => ({ path: entry.path, type: entry.type as "blob" | "tree" })),
    truncated: Boolean(tree.truncated),
  };
}

export async function getFileContent(path: string, ref: string): Promise<string | null> {
  const r = repo();
  const res = await fetch(
    `${GH}/repos/${r.path}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`,
    { headers: headers({ Accept: "application/vnd.github.raw" }) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} contents ${path}`);
  return res.text();
}

export async function createBranch(name: string, fromSha: string): Promise<void> {
  const r = repo();
  try {
    await gh(`/repos/${r.path}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${name}`, sha: fromSha }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("already exists") || message.includes(" 422 ")) return;
    throw error;
  }
}

export type FileEdit = { path: string; content: string };

export async function commitFiles(
  branch: string,
  baseSha: string,
  files: FileEdit[],
  message: string,
): Promise<string> {
  if (files.length === 0) throw new Error("Cannot create an empty commit.");
  const branchHead = await getBranchHeadSha(branch);
  if (branchHead !== baseSha) {
    throw new Error(`Branch ${branch} moved from expected base ${baseSha}.`);
  }

  const r = repo();
  const baseCommit = await gh<{ tree: { sha: string } }>(`/repos/${r.path}/git/commits/${baseSha}`);
  const blobs = await Promise.all(
    files.map(async (file) => ({
      path: file.path,
      sha: (
        await gh<{ sha: string }>(`/repos/${r.path}/git/blobs`, {
          method: "POST",
          body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
        })
      ).sha,
    })),
  );
  const tree = await gh<{ sha: string }>(`/repos/${r.path}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: blobs.map((blob) => ({ ...blob, mode: "100644", type: "blob" })),
    }),
  });
  const commit = await gh<{ sha: string }>(`/repos/${r.path}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] }),
  });
  await gh(
    `/repos/${r.path}/git/refs/heads/${branch.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    },
  );
  return commit.sha;
}

export async function openPullRequest(input: {
  head: string;
  base: string;
  title: string;
  body: string;
}): Promise<{ number: number; html_url: string }> {
  const r = repo();
  return gh(`/repos/${r.path}/pulls`, {
    method: "POST",
    body: JSON.stringify({ ...input, draft: false }),
  });
}

