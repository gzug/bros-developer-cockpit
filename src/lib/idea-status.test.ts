import { expect, test } from "bun:test";
import { getIdeaNextStep, getIdeaStatusLabel, getIdeaTimeline } from "./idea-status";

test("idea status labels stay human-readable", () => {
  expect(getIdeaStatusLabel("requested")).toBe("Wartet auf Owner");
  expect(getIdeaStatusLabel("live")).toBe("Live bestätigt");
});

test("idea next steps explain the current operator responsibility", () => {
  expect(getIdeaNextStep("requested")).toContain("Don");
  expect(getIdeaNextStep("shipped")).toContain("zweimal öffnen");
  expect(getIdeaNextStep("blocked")).toContain("Blocker ansehen");
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
  ]);

  const live = getIdeaTimeline("live");
  expect(
    live.every((step, index) =>
      index < live.length - 1 ? step.state === "complete" : step.state === "current",
    ),
  ).toBe(true);
});
