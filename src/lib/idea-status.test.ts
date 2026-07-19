import { expect, test } from "bun:test";
import {
  IDEA_STATUS_REFERENCE_LINES,
  getIdeaDisplay,
  getIdeaNextStep,
  getIdeaStatusLabel,
  getIdeaTimeline,
} from "./idea-status";

test("idea status labels stay canonical and human-readable", () => {
  expect(getIdeaStatusLabel("requested")).toBe("Waiting on owner");
  expect(getIdeaStatusLabel("processing")).toBe("Checking");
  expect(getIdeaStatusLabel("sent")).toBe("Ready for owner");
  expect(getIdeaStatusLabel("approved")).toBe("Approved");
  expect(getIdeaStatusLabel("shipped")).toBe("Published");
  expect(getIdeaStatusLabel("live")).toBe("Live confirmed");
  expect(getIdeaStatusLabel("blocked")).toBe("Blocked");
});

test("idea next steps explain the current operator responsibility", () => {
  expect(getIdeaNextStep("requested")).toContain("Don");
  expect(getIdeaNextStep("shipped")).toContain("open it twice");
  expect(getIdeaNextStep("blocked")).toContain("inspect the blocker");
});

test("idea timeline marks current progress without inventing extra progress", () => {
  const requested = getIdeaTimeline("requested");
  expect(requested.map((step) => step.state)).toEqual([
    "complete",
    "current",
    "upcoming",
    "upcoming",
    "upcoming",
    "upcoming",
    "upcoming",
  ]);

  const live = getIdeaTimeline("live");
  expect(
    live.every((step, index) =>
      index < live.length - 1 ? step.state === "complete" : step.state === "current",
    ),
  ).toBe(true);
});

test("closed ideas distinguish completed Done history from closed history", () => {
  expect(getIdeaDisplay({ status: "closed", doneCategory: "home" })).toMatchObject({
    label: "Done",
    terminalOutcome: "completed",
  });
  expect(getIdeaDisplay({ status: "closed" })).toMatchObject({
    label: "Closed",
    terminalOutcome: "closed",
  });
  expect(getIdeaTimeline("closed", "home")[0]).toMatchObject({ title: "Done", state: "current" });
  expect(getIdeaTimeline("closed")[0]).toMatchObject({ title: "Closed", state: "current" });
});

test("status reference lines expose the same vocabulary to help surfaces", () => {
  expect(IDEA_STATUS_REFERENCE_LINES).toContain(
    "Ready for owner = a prepared change waits for Don to approve it or request changes.",
  );
  expect(IDEA_STATUS_REFERENCE_LINES).toContain(
    "Blocked = something stopped this idea and Don has to inspect it.",
  );
});
