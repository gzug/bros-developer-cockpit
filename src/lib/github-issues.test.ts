import { expect, test } from "bun:test";
import { canTransitionIdeaStatus, deriveIdeaStatus } from "./github-issues.server";

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
