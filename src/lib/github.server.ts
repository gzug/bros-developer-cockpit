// Server-only GitHub API helpers for the Contribution Mask.
// Creates branches/PRs + polls PR state. The engine never merges: the target
// repo's bdc-ship workflow validates, merges, and ships.

const GH = "https://api.github.com";

function headers() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not set");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "oppdater-contribution-mask",
    "Content-Type": "application/json",
  };
}

function repo() {
  const owner = process.env.GITHUB_REPO_OWNER;
  const name = process.env.GITHUB_REPO_NAME;
  if (!owner || !name) throw new Error("GITHUB_REPO_OWNER/NAME not set");
  return { owner, name, path: `${owner}/${name}` };
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GH}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} ${path}: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

export async function createIssue(input: {
  title: string;
  body: string;
}): Promise<{ number: number; html_url: string }> {
  const r = repo();
  return gh(`/repos/${r.path}/issues`, {
    method: "POST",
    body: JSON.stringify({ title: input.title, body: input.body }),
  });
}

export type PullState = {
  number: number;
  html_url: string;
  state: "open" | "closed";
  merged: boolean;
  merged_at: string | null;
  labels: string[];
};

// ---------- repo read helpers (for the engine to gather context) ----------

export async function getDefaultBranch(): Promise<string> {
  const r = repo();
  const meta = await gh<{ default_branch: string }>(`/repos/${r.path}`);
  return meta.default_branch;
}

export async function getBranchHeadSha(branch: string): Promise<string> {
  const r = repo();
  const b = await gh<{ commit: { sha: string } }>(
    `/repos/${r.path}/branches/${encodeURIComponent(branch)}`,
  );
  return b.commit.sha;
}

export type TreeEntry = { path: string; type: "blob" | "tree" };

// Full recursive path list at a commit/tree sha. `truncated` flags huge repos.
export async function getRepoTree(
  sha: string,
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const r = repo();
  const t = await gh<{
    tree: Array<{ path: string; type: string }>;
    truncated: boolean;
  }>(`/repos/${r.path}/git/trees/${sha}?recursive=1`);
  return {
    entries: t.tree
      .filter((e) => e.type === "blob" || e.type === "tree")
      .map((e) => ({ path: e.path, type: e.type as "blob" | "tree" })),
    truncated: !!t.truncated,
  };
}

// Raw text content of a file at a ref. Returns null if not found.
export async function getFileContent(
  path: string,
  ref: string,
): Promise<string | null> {
  const r = repo();
  const res = await fetch(
    `${GH}/repos/${r.path}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`,
    { headers: { ...headers(), Accept: "application/vnd.github.raw" } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} contents ${path}`);
  return res.text();
}

// ---------- write helpers (branch + commit + PR) ----------

export async function createBranch(name: string, fromSha: string): Promise<void> {
  const r = repo();
  try {
    await gh(`/repos/${r.path}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${name}`, sha: fromSha }),
    });
  } catch (e) {
    // Idempotent: if the engine-owned branch already exists (e.g. a retry after
    // a transient failure), that's fine — commitFiles force-updates it.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists") || msg.includes(" 422 ")) return;
    throw e;
  }
}

export type FileEdit = { path: string; content: string };

// Commit a set of file edits onto `branch` (already created at baseSha), using
// the Git Data API: blobs -> tree -> commit -> move ref. Returns the new sha.
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
    files.map(async (f) => {
      const blob = await gh<{ sha: string }>(`/repos/${r.path}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
      });
      return { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
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

  // force: the bdc/* branch is engine-owned + single-purpose, so a retry that
  // rebuilds the commit off baseSha may overwrite a prior partial attempt.
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

// Merge a PR using the squash strategy. NOT called by the engine anymore (the
// bdc-ship workflow merges after its validate passed); kept for the planned
// Maindev release button (roles feature, post go-live).
export async function mergePullRequest(prNumber: number): Promise<boolean> {
  const r = repo();
  const res = await fetch(`${GH}/repos/${r.path}/pulls/${prNumber}/merge`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ merge_method: "squash" }),
  });
  if (res.status === 200 || res.status === 204) return true;
  if (res.status === 405 || res.status === 422) return false; // protected or not mergeable
  const body = await res.text();
  throw new Error(`GitHub merge ${res.status}: ${body.slice(0, 200)}`);
}

// Search for a PR that references our REQ-<id> in title or body.
export async function findPullRequestByReqId(
  reqId: string,
): Promise<PullState | null> {
  const r = repo();
  const q = encodeURIComponent(
    `repo:${r.path} is:pr in:title,body "${reqId}"`,
  );
  const res = await fetch(`${GH}/search/issues?q=${q}&per_page=3`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: Array<{ number: number; pull_request?: unknown }>;
  };
  const hit = data.items?.find((i) => i.pull_request);
  if (!hit) return null;
  try {
    const pr = await gh<{
      number: number;
      html_url: string;
      state: "open" | "closed";
      merged: boolean;
      merged_at: string | null;
      labels?: Array<{ name: string }>;
    }>(`/repos/${r.path}/pulls/${hit.number}`);
    return {
      number: pr.number,
      html_url: pr.html_url,
      state: pr.state,
      merged: pr.merged,
      merged_at: pr.merged_at,
      labels: (pr.labels ?? []).map((l) => l.name),
    };
  } catch {
    return null;
  }
}
