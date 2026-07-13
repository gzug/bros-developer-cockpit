const GH = "https://api.github.com";

export type PullState = {
  number: number;
  html_url: string;
  state: "open" | "closed";
  merged: boolean;
  merged_at: string | null;
  labels: string[];
  body: string;
  title: string;
};

export type RepoIssue = {
  number: number;
  title: string;
  body: string;
  html_url: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
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
  const owner = process.env.GITHUB_REPO_OWNER;
  const name = process.env.GITHUB_REPO_NAME;
  if (!owner || !name) throw new Error("GITHUB_REPO_OWNER or GITHUB_REPO_NAME is missing.");
  return { owner, name, path: `${owner}/${name}` };
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

export async function createIssue(input: {
  title: string;
  body: string;
  labels?: string[];
}): Promise<{ number: number; html_url: string; body: string; title: string; created_at: string }> {
  const r = repo();
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

export async function addIssueComment(number: number, body: string): Promise<RepoComment> {
  const r = repo();
  return gh(`/repos/${r.path}/issues/${number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function updateIssueLabels(number: number, labels: string[]): Promise<void> {
  const r = repo();
  await gh(`/repos/${r.path}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ labels }),
  });
}

export async function listPullRequests(state: "open" | "closed" | "all" = "all"): Promise<PullState[]> {
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
  const r = repo();
  const baseCommit = await gh<{ tree: { sha: string } }>(
    `/repos/${r.path}/git/commits/${baseSha}`,
  );

  const tree = await Promise.all(
    files.map(async (file) => {
      const blob = await gh<{ sha: string }>(`/repos/${r.path}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
      });
      return { path: file.path, mode: "100644", type: "blob", sha: blob.sha };
    }),
  );

  const newTree = await gh<{ sha: string }>(`/repos/${r.path}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
  });

  const commit = await gh<{ sha: string }>(`/repos/${r.path}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseSha] }),
  });

  await gh(`/repos/${r.path}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: true }),
  });

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
    body: JSON.stringify(input),
  });
}
