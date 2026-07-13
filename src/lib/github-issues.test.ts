import { expect, test } from "bun:test";
import {
  canConfirmIdeaLive,
  canTransitionIdeaStatus,
  deriveIdeaStatus,
  describeIdeaStatus,
  getOwnerActionQueue,
  groupEngineRunStats,
  toIdeaActivity,
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
  expect(describeIdeaStatus("approved")).toContain("confirm it live");
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
  expect(
    getOwnerActionQueue([
      {
        id: 1,
        title: "Blocked",
        description: "",
        intent: "idea",
        status: "blocked",
        statusSummary: "Stopped for manual review.",
        createdAt: "2026-07-13T09:00:00Z",
        issueUrl: "https://example.com/issues/1",
        labels: [],
      },
      {
        id: 2,
        title: "Approved",
        description: "",
        intent: "idea",
        status: "approved",
        statusSummary: "Approved in Cockpit. Ship it in OL1, then confirm it live here.",
        createdAt: "2026-07-13T08:00:00Z",
        issueUrl: "https://example.com/issues/2",
        prNumber: 20,
        prUrl: "https://example.com/pulls/20",
        labels: [],
      },
      {
        id: 3,
        title: "Waiting",
        description: "",
        intent: "idea",
        status: "sent",
        statusSummary: "A held PR exists. Review it and either approve shipping or return it to manual review.",
        createdAt: "2026-07-13T10:00:00Z",
        issueUrl: "https://example.com/issues/3",
        prNumber: 30,
        prUrl: "https://example.com/pulls/30",
        labels: [],
      },
      {
        id: 4,
        title: "Submitted",
        description: "",
        intent: "idea",
        status: "submitted",
        statusSummary: "Ready to start the bridge pipeline.",
        createdAt: "2026-07-13T11:00:00Z",
        issueUrl: "https://example.com/issues/4",
        labels: [],
      },
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
