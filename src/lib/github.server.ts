// Server-only GitHub API helpers for the Contribution Mask.
// Creates Issues + polls for a matching Pull Request. Never pushes code.

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
};

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
    }>(`/repos/${r.path}/pulls/${hit.number}`);
    return {
      number: pr.number,
      html_url: pr.html_url,
      state: pr.state,
      merged: pr.merged,
      merged_at: pr.merged_at,
    };
  } catch {
    return null;
  }
}
