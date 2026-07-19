import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { upsertTask, listMemoryTasks } from "./db/runs.server";
import { isBdcPipelineIssue } from "./github-issues.server";
import { gh, type RepoIssue } from "./github.server";
import { filterAssistantHonestyReply, validateEditorOutput } from "./eval/bdc-honesty";
import { resolveLoginRole, validateLoginConfiguration } from "./auth.server";
import { parseSessionRole, validateAppSecret } from "./auth-session.server";
import { safeNext } from "./safe-next";

const originalFetch = globalThis.fetch;
const originalGithubToken = process.env.GITHUB_TOKEN;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalGithubToken == null) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalGithubToken;
  if (originalDatabaseUrl == null) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

const issue = (
  labels: string[],
  pull_request?: unknown,
): Pick<RepoIssue, "labels" | "pull_request"> => ({
  labels: labels.map((name) => ({ name })),
  pull_request,
});

test("role/session boundary matrix fails closed and preserves safe local redirects", () => {
  expect(resolveLoginRole("1234", { ownerPin: "4321", brotherPin: "1234" })).toBe("brother");
  expect(resolveLoginRole("4321", { ownerPin: "4321", brotherPin: "1234" })).toBe("owner");
  expect(resolveLoginRole("1234", { ownerPin: "4321" })).toBeNull();
  expect(validateLoginConfiguration({ ownerPin: "4321" })).toBeNull();
  expect(validateLoginConfiguration({ brotherPin: "1234" })).toBeNull();
  expect(validateLoginConfiguration({ ownerPin: "1234", brotherPin: "1234" })).toContain(
    "different",
  );

  const now = Date.parse("2026-07-19T12:00:00Z");
  expect(parseSessionRole(`owner:${now}`, now)).toBe("owner");
  expect(parseSessionRole(`brother:${now - 31 * 24 * 60 * 60 * 1000}`, now)).toBeNull();
  expect(validateAppSecret("not-a-secret")).toContain("64 hexadecimal");
  expect(safeNext("/submit?context=Home")).toBe("/submit?context=Home");
  expect(safeNext("https://evil.example/")).toBe("");
});

test("caller-level BDC ownership rejects non-BDC, pull-request, and incomplete fixtures", () => {
  expect(isBdcPipelineIssue(issue(["bdc-submitted", "from-brother"]))).toBe(true);
  expect(isBdcPipelineIssue(issue(["bdc-submitted"]))).toBe(false);
  expect(isBdcPipelineIssue(issue(["from-brother"]))).toBe(false);
  expect(isBdcPipelineIssue(issue(["bdc-submitted", "from-brother"], {}))).toBe(false);
});

test("honesty boundary keeps Q&A/status claims separate from rewrite metadata", () => {
  expect(
    filterAssistantHonestyReply("Refined version: The Plan label is clearer.", {
      hasRealStatusData: false,
      allowRefinedVersionLabel: false,
    }),
  ).toBe("The Plan label is clearer.");
  expect(
    filterAssistantHonestyReply("Refined version: This is already live.", {
      hasRealStatusData: false,
      allowRefinedVersionLabel: true,
    }),
  ).toContain("I cannot verify");
  expect(
    validateEditorOutput(
      '{"summary":"copy change","edits":[{"path":"src/routes/index.tsx","content":"export default null"}]}',
    ).ok,
  ).toBe(true);
});

test("GitHub and DB boundaries expose errors without losing the local fallback", async () => {
  process.env.GITHUB_TOKEN = "test-token";
  globalThis.fetch = (async () => new Response("rate limited", { status: 429 })) as typeof fetch;
  await expect(gh("/repos/gzug/bros-developer-cockpit/issues")).rejects.toThrow("GitHub 429");

  delete process.env.DATABASE_URL;
  const issueNumber = 900_000 + Math.floor(Math.random() * 10_000);
  await upsertTask({ issueNumber, title: "boundary test", intent: "idea", status: "submitted" });
  expect(listMemoryTasks().some((task) => task.issueNumber === issueNumber)).toBe(true);
});

// Source-shape contract tests: createServerFn handlers can't be invoked directly outside a
// request context in bun's test runner, so we assert on the source text of the gated files
// instead of calling the server fns. This still catches an accidental widening/narrowing of
// the auth gate on /runs, and a regression on the still-owner-only screens around it.
test("runs read gate relaxed to requireAuth while mutating/owner screens stay requireOwner-gated", () => {
  const read = (relativePath: string) => readFileSync(join(import.meta.dir, relativePath), "utf8");

  const runsFunctions = read("runs.functions.ts");
  expect(runsFunctions).toContain("requireAuth(");
  expect(runsFunctions).not.toContain("requireOwner(");

  // ideas.functions.ts triggers/mutates preparation runs (processContribution et al.) and
  // must stay owner-gated even though the read-only /runs page was relaxed. (Deviation from
  // the brief: engine.server.ts itself holds no auth check — it's an internal helper invoked
  // from ideas.functions.ts, which is the actual server-fn boundary that gates mutation.)
  const ideasFunctions = read("ideas.functions.ts");
  expect(ideasFunctions).toContain("requireOwner");

  const runsRoute = read(join("..", "routes", "_authenticated", "runs.tsx"));
  expect(runsRoute).not.toContain('redirect({ to: "/dashboard" })');

  // Regression guard: other owner-only screens are unaffected by this relaxation.
  const dcRoute = read(join("..", "routes", "_authenticated", "dc.tsx"));
  expect(dcRoute).toContain('redirect({ to: "/dashboard" })');
});
