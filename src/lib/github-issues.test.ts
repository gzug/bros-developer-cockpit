import { afterEach, expect, test } from "bun:test";
import {
  canBrotherShip,
  canConfirmIdeaLive,
  canTransitionIdeaStatus,
  claimIdeaForEngine,
  classifyDelivery,
  closeIdeaAsDeleted,
  completeIdea,
  requestBrotherShip,
  setIdeaContext,
  setIdeaDelivery,
  setIdeaPipelineState,
  setIdeaStatus,
  setIdeaWeight,
  createSubmittedIdea,
  deriveIdeaStatus,
  parseDelivery,
  describeIdeaStatus,
  getOwnerActionQueue,
  groupEngineRunStats,
  groupDoneIdeasForRetro,
  isParkedOlderThanDays,
  isBdcPipelineIssue,
  isPullRequestForIdea,
  markIdeaApproved,
  markIdeaGuardrailBlocked,
  markIdeaLive,
  selectPullRequestForIdea,
  parseBlockReason,
  readTextMeta,
  replaceTextMeta,
  requestIdeaChanges,
  toIdeaActivity,
  type DCIdea,
} from "./github-issues.server";
import type { PullState, RepoComment } from "./github.server";

const originalFetch = globalThis.fetch;
const originalGithubToken = process.env.GITHUB_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalGithubToken == null) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalGithubToken;
});

function pull(overrides: Partial<PullState> = {}): PullState {
  return {
    number: 42,
    html_url: "https://github.com/gzug/01-One-L1fe/pull/42",
    state: "open",
    merged: false,
    merged_at: null,
    labels: [],
    body: "Resolves: gzug/01-One-L1fe#7",
    title: "BDC change",
    headRef: "bdc-hold/dc-issue-7",
    headSha: "abc123",
    baseRef: "main",
    author: "gzug",
    ...overrides,
  };
}

test("pull binding requires exact branch, base, author, and source marker", () => {
  expect(isPullRequestForIdea(7, pull())).toBe(true);
  expect(isPullRequestForIdea(7, pull({ headRef: "feature/other" }))).toBe(false);
  expect(isPullRequestForIdea(7, pull({ baseRef: "release" }))).toBe(false);
  expect(isPullRequestForIdea(7, pull({ author: "attacker" }))).toBe(false);
  expect(isPullRequestForIdea(7, pull({ body: "Mentions #7 only" }))).toBe(false);
  expect(isPullRequestForIdea(7, pull({ body: "Resolves: gzug/01-One-L1fe#70" }))).toBe(false);
});

test("held PR selection is first exact match, including closed or duplicate matches", () => {
  const closed = pull({ number: 40, state: "closed", merged: false });
  const duplicateOpen = pull({ number: 41 });
  expect(selectPullRequestForIdea(7, [closed, duplicateOpen])?.number).toBe(40);
  expect(selectPullRequestForIdea(7, [pull({ headRef: "feature/not-held" })])).toBeUndefined();
});

test("open pull request derives sent status", () => {
  expect(
    deriveIdeaStatus({
      issueLabels: ["dc", "dc:status:submitted"],
      issueState: "open",
      pr: { labels: [], merged: false },
    }),
  ).toBe("sent");
});

test("merged pull request is not live without explicit live label", () => {
  expect(
    deriveIdeaStatus({
      issueLabels: ["dc", "dc:status:submitted"],
      issueState: "open",
      pr: { labels: [], merged: true },
    }),
  ).toBe("sent");
});

test("live confirmation requires an existing merged pull request", () => {
  expect(canConfirmIdeaLive()).toBe(false);
  expect(canConfirmIdeaLive({ merged: false })).toBe(false);
  expect(canConfirmIdeaLive({ merged: true })).toBe(true);
});

test("explicit live label derives live status", () => {
  expect(
    deriveIdeaStatus({
      issueLabels: ["dc", "dc:status:live"],
      issueState: "open",
      pr: { labels: [], merged: true },
    }),
  ).toBe("live");
});

test("explicit pull request live label derives live status", () => {
  expect(
    deriveIdeaStatus({
      issueLabels: ["dc", "dc:status:submitted"],
      issueState: "open",
      pr: { labels: ["dc:status:live"], merged: true },
    }),
  ).toBe("live");
});

test("explicit approved label derives approved status", () => {
  expect(
    deriveIdeaStatus({
      issueLabels: ["dc", "dc:status:approved"],
      issueState: "open",
      pr: { labels: [], merged: false },
    }),
  ).toBe("approved");
});

test("bdc lifecycle labels derive requested, processing, blocked, approved, and live", () => {
  expect(
    deriveIdeaStatus({
      issueLabels: ["from-brother", "bdc-submitted", "bdc-shipped"],
      issueState: "open",
      pr: { labels: [], merged: true },
    }),
  ).toBe("shipped");
  expect(
    deriveIdeaStatus({
      issueLabels: ["from-brother", "bdc-submitted", "bdc-approved", "bdc-publish-failed"],
      issueState: "open",
      pr: { labels: [], merged: true },
    }),
  ).toBe("blocked");
  expect(
    deriveIdeaStatus({
      issueLabels: ["from-brother", "bdc-submitted", "bdc-ship-requested"],
      issueState: "open",
    }),
  ).toBe("requested");
  expect(
    deriveIdeaStatus({
      issueLabels: ["from-brother", "bdc-submitted", "bdc-engine-started"],
      issueState: "open",
    }),
  ).toBe("processing");
  expect(
    deriveIdeaStatus({
      issueLabels: ["from-brother", "bdc-submitted", "bdc-blocked-guardrails"],
      issueState: "open",
    }),
  ).toBe("blocked");
  expect(
    deriveIdeaStatus({
      issueLabels: ["from-brother", "bdc-submitted", "bdc-approved"],
      issueState: "open",
    }),
  ).toBe("approved");
  expect(
    deriveIdeaStatus({
      issueLabels: ["from-brother", "bdc-submitted", "bdc-live"],
      issueState: "open",
    }),
  ).toBe("live");
});

test("sent ideas can move to approved or blocked", () => {
  expect(canTransitionIdeaStatus("sent", "approved")).toBe(true);
  expect(canTransitionIdeaStatus("sent", "blocked")).toBe(true);
  expect(canTransitionIdeaStatus("sent", "live")).toBe(false);
});

test("only shipped ideas can move to live", () => {
  expect(canTransitionIdeaStatus("approved", "live")).toBe(false);
  expect(canTransitionIdeaStatus("approved", "blocked")).toBe(true);
  expect(canTransitionIdeaStatus("approved", "sent")).toBe(false);
  expect(canTransitionIdeaStatus("shipped", "live")).toBe(true);
});

test("other statuses cannot enter the owner lane directly", () => {
  expect(canTransitionIdeaStatus("submitted", "approved")).toBe(false);
  expect(canTransitionIdeaStatus("requested", "processing")).toBe(true);
  expect(canTransitionIdeaStatus("requested", "approved")).toBe(false);
  expect(canTransitionIdeaStatus("blocked", "approved")).toBe(false);
  expect(canTransitionIdeaStatus("live", "blocked")).toBe(false);
});

test("status descriptions explain the next operator step", () => {
  expect(describeIdeaStatus("requested")).toContain("waiting for Don");
  expect(describeIdeaStatus("sent")).toContain("Don to review");
  expect(describeIdeaStatus("approved")).toContain("owner-controlled path");
  expect(describeIdeaStatus("blocked")).toContain("Don's help");
});

test("idea activity removes blank comments and returns newest first", () => {
  expect(
    toIdeaActivity([
      {
        id: 1,
        body: "  ",
        created_at: "2026-07-13T10:00:00Z",
        updated_at: "2026-07-13T10:00:00Z",
        html_url: "https://example.com/1",
      },
      {
        id: 2,
        body: "First note",
        created_at: "2026-07-13T09:00:00Z",
        updated_at: "2026-07-13T09:00:00Z",
        html_url: "https://example.com/2",
      },
      {
        id: 3,
        body: "Latest note",
        created_at: "2026-07-13T11:00:00Z",
        updated_at: "2026-07-13T11:00:00Z",
        html_url: "https://example.com/3",
      },
    ]),
  ).toEqual([
    {
      id: 3,
      body: "Latest note",
      createdAt: "2026-07-13T11:00:00Z",
      url: "https://example.com/3",
    },
    {
      id: 2,
      body: "First note",
      createdAt: "2026-07-13T09:00:00Z",
      url: "https://example.com/2",
    },
  ]);
});

test("owner action queue prioritizes shipped, sent, requested, blocked, then approved", () => {
  const idea = (overrides: Partial<DCIdea>): DCIdea => ({
    id: 0,
    title: "",
    description: "",
    intent: "idea",
    status: "submitted",
    statusSummary: "",
    createdAt: "2026-07-13T09:00:00Z",
    issueUrl: "https://example.com/issues/0",
    labels: [],
    weight: "light",
    delivery: "ota",
    pipelineState: "active",
    ...overrides,
  });

  expect(
    getOwnerActionQueue([
      idea({
        id: 1,
        title: "Blocked",
        status: "blocked",
        statusSummary: "Stopped for manual review.",
        createdAt: "2026-07-13T09:00:00Z",
        issueUrl: "https://example.com/issues/1",
      }),
      idea({
        id: 2,
        title: "Approved",
        status: "approved",
        statusSummary: "Approved in Cockpit. Ship it in OL1, then confirm it live here.",
        createdAt: "2026-07-13T08:00:00Z",
        issueUrl: "https://example.com/issues/2",
        prNumber: 20,
        prUrl: "https://example.com/pulls/20",
      }),
      idea({
        id: 3,
        title: "Waiting",
        status: "sent",
        statusSummary:
          "A held PR exists. Review it and either approve shipping or return it to manual review.",
        createdAt: "2026-07-13T10:00:00Z",
        issueUrl: "https://example.com/issues/3",
        prNumber: 30,
        prUrl: "https://example.com/pulls/30",
      }),
      idea({
        id: 6,
        title: "Requested",
        status: "requested",
        statusSummary: "Shipping was requested. It is waiting for Don to start the checks.",
        createdAt: "2026-07-13T10:30:00Z",
        issueUrl: "https://example.com/issues/6",
      }),
      idea({
        id: 5,
        title: "Published",
        status: "shipped",
        statusSummary: "Update published. Check the phone.",
        createdAt: "2026-07-13T12:00:00Z",
        issueUrl: "https://example.com/issues/5",
        prNumber: 50,
        prUrl: "https://example.com/pulls/50",
      }),
      idea({
        id: 4,
        title: "Submitted",
        status: "submitted",
        statusSummary: "Ready to start the bridge pipeline.",
        createdAt: "2026-07-13T11:00:00Z",
        issueUrl: "https://example.com/issues/4",
      }),
    ]).map((idea) => ({ id: idea.id, status: idea.status })),
  ).toEqual([
    { id: 5, status: "shipped" },
    { id: 3, status: "sent" },
    { id: 6, status: "requested" },
    { id: 1, status: "blocked" },
    { id: 2, status: "approved" },
  ]);
});

test("groupEngineRunStats groups engine comments by issue number", () => {
  const comments = [
    {
      issue_url: "https://api.github.com/repos/o/r/issues/1",
      body: "🤖 Model: gpt-x | Tokens: 100+50 | $0.0123 | PR #10",
    },
    {
      issue_url: "https://api.github.com/repos/o/r/issues/1",
      body: "just a normal comment",
    },
    {
      issue_url: "https://api.github.com/repos/o/r/issues/2",
      body: "🤖 Model: claude-y | Tokens: 200+80 | $0.0456",
    },
    {
      issue_url: "https://api.github.com/repos/o/r/issues/99",
      body: "🤖 Model: gpt-x | Tokens: 1+1 | $0.0001",
    },
  ];

  const stats = groupEngineRunStats([1, 2, 3], comments);

  expect(stats.get(1)).toEqual([
    { model: "gpt-x", promptTokens: 100, completionTokens: 50, costUsd: 0.0123, prNumber: 10 },
  ]);
  expect(stats.get(2)).toEqual([
    {
      model: "claude-y",
      promptTokens: 200,
      completionTokens: 80,
      costUsd: 0.0456,
      prNumber: undefined,
    },
  ]);
  expect(stats.get(3)).toEqual([]);
  expect(stats.has(99)).toBe(false);
});

test("parseBlockReason prefers tagged block comments over engine cost comments", () => {
  const comment = (id: number, body: string): RepoComment => ({
    id,
    body,
    created_at: `2026-07-13T10:0${id}:00Z`,
    updated_at: `2026-07-13T10:0${id}:00Z`,
    html_url: `https://example.com/comments/${id}`,
  });

  expect(
    parseBlockReason([
      comment(1, "Started preparation."),
      comment(
        2,
        "<!-- bdc:block-reason -->\nBlocked by BDC guardrails.\n\nAuth changes are out of scope.",
      ),
      comment(3, "🤖 Model: gpt-x | Tokens: 100+50 | $0.0123 | PR #10"),
    ]),
  ).toBe("Blocked by BDC guardrails.\n\nAuth changes are out of scope.");

  expect(
    parseBlockReason([
      comment(1, "Blocked by BDC guardrails.\n\nLegacy guardrail reason."),
      comment(2, "🤖 Model: gpt-x | Tokens: 100+50 | $0.0123"),
    ]),
  ).toBe("Blocked by BDC guardrails.\n\nLegacy guardrail reason.");
});

test("parked ideas older than 14 days are archive eligible", () => {
  const now = new Date("2026-07-16T12:00:00Z");

  expect(isParkedOlderThanDays("2026-07-01", now, 14)).toBe(true);
  expect(isParkedOlderThanDays("2026-07-02", now, 14)).toBe(false);
  expect(isParkedOlderThanDays("not a date", now, 14)).toBe(false);
  expect(isParkedOlderThanDays(undefined, now, 14)).toBe(false);
});

test("done retro groups ideas by category with counts and newest closed first", () => {
  const base: DCIdea = {
    id: 1,
    title: "Base",
    description: "",
    intent: "idea",
    status: "live",
    statusSummary: "Confirmed live in OL1.",
    createdAt: "2026-07-01T00:00:00Z",
    issueUrl: "https://example.com/issues/1",
    labels: [],
    weight: "light",
    delivery: "ota",
    pipelineState: "active",
  };

  const groups = groupDoneIdeasForRetro([
    { ...base, id: 1, title: "Old Home", doneCategory: "home", closedAt: "2026-07-10T09:00:00Z" },
    { ...base, id: 2, title: "Sleep", doneCategory: "sleep", closedAt: "2026-07-11T09:00:00Z" },
    { ...base, id: 3, title: "New Home", doneCategory: "home", closedAt: "2026-07-12T09:00:00Z" },
    { ...base, id: 4, title: "Fallback", closedAt: "2026-07-13T09:00:00Z" },
  ]);

  expect(groups.map((group) => ({ category: group.category, count: group.count }))).toEqual([
    { category: "home", count: 2 },
    { category: "sleep", count: 1 },
    { category: "general", count: 1 },
  ]);
  expect(groups[0].ideas.map((idea) => idea.title)).toEqual(["New Home", "Old Home"]);
});

test("destructive mutations only accept real BDC wish issues, never pull requests", () => {
  expect(
    isBdcPipelineIssue({ labels: [{ name: "from-brother" }, { name: "bdc-submitted" }] }),
  ).toBe(true);
  expect(isBdcPipelineIssue({ labels: [{ name: "from-brother" }], pull_request: undefined })).toBe(
    false,
  );
  expect(
    isBdcPipelineIssue({
      labels: [{ name: "from-brother" }, { name: "bdc-submitted" }],
      pull_request: {},
    }),
  ).toBe(false);
  expect(
    isBdcPipelineIssue({ labels: [{ name: "skill-evidence" }], pull_request: undefined }),
  ).toBe(false);
  expect(isBdcPipelineIssue({ labels: [{ name: "bdc-submitted" }], pull_request: undefined })).toBe(
    false,
  );
});

test("every exported lifecycle mutator rejects non-BDC issues before any write", async () => {
  process.env.GITHUB_TOKEN = "test-token";
  const calls: Array<{ method: string; url: string }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ method: init?.method ?? "GET", url: String(input) });
    return new Response(
      JSON.stringify({
        number: 89,
        title: "Not a BDC issue",
        body: "",
        html_url: "https://github.com/gzug/01-One-L1fe/issues/89",
        state: "open",
        created_at: "2026-07-23T00:00:00Z",
        updated_at: "2026-07-23T00:00:00Z",
        labels: [{ name: "not-bdc-submitted" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  // Ownership matrix: EVERY exported mutator that writes issue state (labels / body / close) by
  // number must run requireBdcPipelineIssue FIRST (a single GET) and reject a non-BDC issue before
  // any write. This list is maintained BY HAND — when you add a lifecycle mutator, add it here; a
  // mutator that skips the guard is only caught once it is listed (there is no reflection-based
  // discovery). Comment-only telemetry helpers (addIdeaComment / addEngineRunComment) are excluded
  // by design: they change no lifecycle state and every caller validates the issue first (see the
  // note at their definition in github-issues.server.ts).
  const lifecycleMutators: Array<{ name: string; run: (issueNumber: number) => Promise<unknown> }> = [
    { name: "setIdeaStatus", run: (n) => setIdeaStatus(n, "processing") },
    { name: "setIdeaPipelineState", run: (n) => setIdeaPipelineState(n, "parked") },
    { name: "setIdeaWeight", run: (n) => setIdeaWeight(n, "light") },
    { name: "setIdeaDelivery", run: (n) => setIdeaDelivery(n, "ota") },
    { name: "setIdeaContext", run: (n) => setIdeaContext(n, "context") },
    { name: "requestBrotherShip", run: (n) => requestBrotherShip(n) },
    { name: "closeIdeaAsDeleted", run: (n) => closeIdeaAsDeleted(n) },
    { name: "completeIdea", run: (n) => completeIdea(n, "general") },
    { name: "claimIdeaForEngine", run: (n) => claimIdeaForEngine(n) },
    { name: "markIdeaGuardrailBlocked", run: (n) => markIdeaGuardrailBlocked(n, "guardrail reason") },
    { name: "markIdeaApproved", run: (n) => markIdeaApproved(n) },
    { name: "markIdeaLive", run: (n) => markIdeaLive(n) },
    { name: "requestIdeaChanges", run: (n) => requestIdeaChanges(n) },
  ];

  for (const mutator of lifecycleMutators) {
    calls.length = 0;
    await expect(mutator.run(89)).rejects.toThrow("Idea not found.");
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("GET");
  }
});

test("valid BDC mutations pass the exact label allowlist and issue writes", async () => {
  process.env.GITHUB_TOKEN = "test-token";
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ method: init?.method ?? "GET", url: String(input), body: init?.body?.toString() });
    const url = String(input);
    if (url.endsWith("/issues/89")) {
      return new Response(
        JSON.stringify({
          number: 89,
          title: "Valid BDC issue",
          body: "",
          html_url: "https://github.com/gzug/bros-developer-cockpit/issues/89",
          state: "open",
          created_at: "2026-07-23T00:00:00Z",
          updated_at: "2026-07-23T00:00:00Z",
          labels: [{ name: "from-brother" }, { name: "bdc-submitted" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  for (const [mutation, expectedLabel] of [
    [markIdeaApproved, "bdc-approved"],
    [markIdeaLive, "bdc-live"],
    [requestIdeaChanges, "bdc-changes-requested"],
  ] as const) {
    calls.length = 0;
    await mutation(89);
    const issueCalls = calls.filter((call) => call.url.includes("/issues/89"));
    expect(issueCalls).toHaveLength(3);
    expect(issueCalls[0]).toMatchObject({
      method: "GET",
      url: expect.stringContaining("/issues/89"),
    });
    expect(issueCalls[1]).toMatchObject({
      method: "POST",
      url: expect.stringContaining("/issues/89/labels"),
      body: expect.stringContaining(expectedLabel),
    });
    expect(issueCalls[2]).toMatchObject({
      method: "POST",
      url: expect.stringContaining("/issues/89/comments"),
    });
  }
});

test("claim and guardrail-block mutations pass the BDC allowlist before writing", async () => {
  process.env.GITHUB_TOKEN = "test-token";
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ method: init?.method ?? "GET", url: String(input), body: init?.body?.toString() });
    const url = String(input);
    if (url.endsWith("/issues/89")) {
      return new Response(
        JSON.stringify({
          number: 89,
          title: "Valid BDC issue",
          body: "",
          html_url: "https://github.com/gzug/bros-developer-cockpit/issues/89",
          state: "open",
          created_at: "2026-07-23T00:00:00Z",
          updated_at: "2026-07-23T00:00:00Z",
          labels: [{ name: "from-brother" }, { name: "bdc-submitted" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  // claimIdeaForEngine: guard GET first, then a single engine-started label write (no comment).
  calls.length = 0;
  await claimIdeaForEngine(89);
  const claimCalls = calls.filter((call) => call.url.includes("/issues/89"));
  expect(claimCalls).toHaveLength(2);
  expect(claimCalls[0]).toMatchObject({
    method: "GET",
    url: expect.stringContaining("/issues/89"),
  });
  expect(claimCalls[1]).toMatchObject({
    method: "POST",
    url: expect.stringContaining("/issues/89/labels"),
    body: expect.stringContaining("bdc-engine-started"),
  });

  // markIdeaGuardrailBlocked: guard GET first, then the block label write, then the reason comment.
  calls.length = 0;
  await markIdeaGuardrailBlocked(89, "Auth changes are out of scope.");
  const blockCalls = calls.filter((call) => call.url.includes("/issues/89"));
  expect(blockCalls).toHaveLength(3);
  expect(blockCalls[0]).toMatchObject({
    method: "GET",
    url: expect.stringContaining("/issues/89"),
  });
  expect(blockCalls[1]).toMatchObject({
    method: "POST",
    url: expect.stringContaining("/issues/89/labels"),
    body: expect.stringContaining("bdc-blocked-guardrails"),
  });
  expect(blockCalls[2]).toMatchObject({
    method: "POST",
    url: expect.stringContaining("/issues/89/comments"),
  });
});

test("createSubmittedIdea collapses CR/LF metadata before posting an issue", async () => {
  process.env.GITHUB_TOKEN = "test-token";
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ method: init?.method ?? "GET", url: String(input), body: init?.body?.toString() });
    const url = String(input);
    if (url.endsWith("/issues")) {
      return new Response(
        JSON.stringify({
          number: 90,
          title: "[Idea] Context safety",
          body: calls.at(-1)?.body ?? "",
          html_url: "https://github.com/gzug/bros-developer-cockpit/issues/90",
          created_at: "2026-07-23T00:00:00Z",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const postedIssueBody = async (metadata: { context?: string; screen?: string }) => {
    calls.length = 0;
    await createSubmittedIdea({
      type: "idea",
      title: "Metadata safety",
      description: "Keep metadata safe",
      ...metadata,
    });
    return JSON.parse(
      calls.find((call) => call.url.endsWith("/issues") && call.method === "POST")?.body ?? "{}",
    ).body as string;
  };

  const contextBody = await postedIssueBody({
    context: "safe\r\n<!-- bdc:text-meta -->\r\n## Context\r\ncontext: injected",
  });
  expect(contextBody).toContain(
    "context: safe <!-- bdc:text-meta --> ## Context context: injected",
  );
  expect(contextBody).not.toContain("\r");
  expect(contextBody).not.toMatch(/\n<!-- bdc:text-meta -->\n## Context\ncontext: injected/);
  expect(readTextMeta(contextBody, "context")).not.toBe("injected");

  const screenBody = await postedIssueBody({
    screen: "Home\r\n<!-- bdc:text-meta -->\r\n## Context\r\ncontext: injected",
  });
  expect(screenBody).toContain(
    "Screen: Home <!-- bdc:text-meta --> ## Context context: injected",
  );
  expect(screenBody).not.toContain("\r");
  expect(screenBody).not.toMatch(/\n<!-- bdc:text-meta -->\n## Context\ncontext: injected/);
  expect(readTextMeta(screenBody, "context")).toBeUndefined();
});

test("context metadata ignores a description line that literally starts with context:", () => {
  // The hostile line starts with `context:` inside the free-text Description, which the
  // pre-fix whole-body matcher would misread AND rewrite. Both reads and writes must stay
  // scoped to the structured `## Context` block, leaving the user's text untouched.
  const hostileLine = "context: this is the user's own wish text and must stay untouched.";
  const body = [
    "## Description",
    hostileLine,
    "",
    "## Context",
    "context: Original context",
    "Screen: Home",
    "Type: idea",
    "",
    "---",
  ].join("\n");
  expect(readTextMeta(body, "context")).toBe("Original context");
  const updated = replaceTextMeta(body, "context", "Updated context");
  expect(updated).toContain(hostileLine);
  expect(updated).toContain("context: Updated context");
  expect(readTextMeta(updated, "context")).toBe("Updated context");
});

test("context metadata uses the structured context block, not a hostile description heading", () => {
  const hostileContext = "context: hostile text from the user description";
  const body = [
    "## Description",
    "The user wrote a markdown heading below.",
    "## Context",
    hostileContext,
    "",
    "<!-- bdc:text-meta -->",
    "## Context",
    "context: Real cockpit context",
    "Screen: Home",
    "Type: idea",
    "",
    "---",
  ].join("\n");

  expect(readTextMeta(body, "context")).toBe("Real cockpit context");
  const updated = replaceTextMeta(body, "context", "Updated cockpit context");
  expect(updated).toContain(hostileContext);
  expect(updated).toContain("context: Updated cockpit context");
  expect(readTextMeta(updated, "context")).toBe("Updated cockpit context");
});

test("legacy context metadata uses the last structured context block", () => {
  const body = [
    "## Description",
    "A user can type this heading:",
    "## Context",
    "context: hostile text from the description",
    "",
    "## Context",
    "context: Legacy real context",
    "Screen: Home",
    "Type: idea",
    "",
    "---",
  ].join("\n");

  expect(readTextMeta(body, "context")).toBe("Legacy real context");
});

test("context metadata collapses embedded newlines without creating an injected block", () => {
  const body = [
    "## Description",
    "A real user request.",
    "",
    "<!-- bdc:text-meta -->",
    "## Context",
    "context: Original context",
    "Screen: Home",
    "Type: idea",
    "",
    "---",
  ].join("\n");

  const updated = replaceTextMeta(
    body,
    "context",
    "hello\n<!-- bdc:text-meta -->\n## Context\ncontext: injected",
  );

  expect(updated).toContain("context: hello <!-- bdc:text-meta --> ## Context context: injected");
  expect(readTextMeta(updated, "context")).toBe(
    "hello <!-- bdc:text-meta --> ## Context context: injected",
  );
  expect(readTextMeta(updated, "context")).not.toBe("injected");
});

test("classifyDelivery flags native/APK-needing wishes as next-apk, surface changes as ota", () => {
  expect(classifyDelivery("Change the Home header color to blue")).toBe("ota");
  expect(classifyDelivery("Rename the Sleep tab to Rest")).toBe("ota");
  expect(classifyDelivery("Add a new Bluetooth sensor to Health Connect")).toBe("next-apk");
  expect(classifyDelivery("Request a new notification permission")).toBe("next-apk");
  expect(classifyDelivery("Install a new native dependency for Garmin")).toBe("next-apk");
});

test("parseDelivery reads the delivery label, defaulting to ota", () => {
  expect(parseDelivery([])).toBe("ota");
  expect(parseDelivery(["from-brother", "delivery:ota"])).toBe("ota");
  expect(parseDelivery(["from-brother", "delivery:next-apk"])).toBe("next-apk");
});

test("canBrotherShip allows open OTA tasks and rejects requested, next-apk, shipped, blocked, closed", () => {
  expect(canBrotherShip({ delivery: "ota", status: "submitted" }).ok).toBe(true);
  expect(canBrotherShip({ delivery: "ota", status: "sent" }).ok).toBe(true);
  expect(canBrotherShip({ delivery: "ota", status: "requested" }).ok).toBe(false);
  expect(canBrotherShip({ delivery: "next-apk", status: "submitted" }).ok).toBe(false);
  expect(canBrotherShip({ delivery: "next-apk", status: "submitted" }).reason).toContain("APK");
  expect(canBrotherShip({ delivery: "ota", status: "shipped" }).ok).toBe(false);
  expect(canBrotherShip({ delivery: "ota", status: "live" }).ok).toBe(false);
  expect(canBrotherShip({ delivery: "ota", status: "blocked" }).ok).toBe(false);
  expect(canBrotherShip({ delivery: "ota", status: "closed" }).ok).toBe(false);
});
