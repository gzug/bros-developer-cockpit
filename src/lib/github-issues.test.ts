import { expect, test } from "bun:test";
import {
  canConfirmIdeaLive,
  canTransitionIdeaStatus,
  deriveIdeaStatus,
  describeIdeaStatus,
  getOwnerActionQueue,
  groupEngineRunStats,
  groupDoneIdeasForRetro,
  isParkedOlderThanDays,
  isBdcPipelineIssue,
  readTextMeta,
  replaceTextMeta,
  toIdeaActivity,
  type DCIdea,
} from "./github-issues.server";

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

test("bdc lifecycle labels derive processing, blocked, approved, and live", () => {
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

test("approved ideas can move to live or blocked", () => {
  expect(canTransitionIdeaStatus("approved", "live")).toBe(true);
  expect(canTransitionIdeaStatus("approved", "blocked")).toBe(true);
  expect(canTransitionIdeaStatus("approved", "sent")).toBe(false);
});

test("other statuses cannot enter the owner lane directly", () => {
  expect(canTransitionIdeaStatus("submitted", "approved")).toBe(false);
  expect(canTransitionIdeaStatus("blocked", "approved")).toBe(false);
  expect(canTransitionIdeaStatus("live", "blocked")).toBe(false);
});

test("status descriptions explain the next operator step", () => {
  expect(describeIdeaStatus("sent")).toContain("approve shipping");
  expect(describeIdeaStatus("approved")).toContain("ship lane");
  expect(describeIdeaStatus("blocked")).toBe("Stopped for manual review.");
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

test("owner action queue prioritizes approved then sent then blocked", () => {
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
        statusSummary: "A held PR exists. Review it and either approve shipping or return it to manual review.",
        createdAt: "2026-07-13T10:00:00Z",
        issueUrl: "https://example.com/issues/3",
        prNumber: 30,
        prUrl: "https://example.com/pulls/30",
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
    { id: 2, status: "approved" },
    { id: 3, status: "sent" },
    { id: 1, status: "blocked" },
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
    { model: "claude-y", promptTokens: 200, completionTokens: 80, costUsd: 0.0456, prNumber: undefined },
  ]);
  expect(stats.get(3)).toEqual([]);
  expect(stats.has(99)).toBe(false);
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
  expect(isBdcPipelineIssue({ labels: [{ name: "from-brother" }, { name: "bdc-submitted" }] })).toBe(true);
  expect(isBdcPipelineIssue({ labels: [{ name: "from-brother" }], pull_request: undefined })).toBe(false);
  expect(isBdcPipelineIssue({ labels: [{ name: "from-brother" }, { name: "bdc-submitted" }], pull_request: {} })).toBe(false);
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
