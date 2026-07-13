import { expect, test } from "bun:test";
import { canTransitionIdeaStatus, deriveIdeaStatus, describeIdeaStatus, toIdeaActivity } from "./github-issues.server";

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
