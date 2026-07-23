import { expect, test } from "bun:test";
import { IDEA_STATUS_VALUES } from "./eval/bdc-honesty";
import {
  IDEA_PHASE_TRACK,
  IDEA_STATUS_PHASE,
  IDEA_STATUS_REFERENCE_LINES,
  canCelebrateLive,
  getIdeaDisplay,
  getIdeaNextStep,
  getIdeaPhase,
  getIdeaStatusLabel,
  getIdeaTimeline,
  type IdeaPhase,
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

  const blocked = getIdeaTimeline("blocked");
  expect(blocked.map((step) => step.state)).toEqual([
    "complete",
    "complete",
    "complete",
    "current",
  ]);
  expect(blocked[blocked.length - 1]).toMatchObject({
    key: "blocked",
    title: "Blocked",
  });
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

test("IDEA_STATUS_PHASE maps every one of the 9 statuses to a valid coarse phase", () => {
  const validPhases = new Set<IdeaPhase>([
    "queued",
    "understanding",
    "building",
    "checking",
    "live",
    "needsAnotherLook",
  ]);
  // Iterate the closed status union — a new status must be added to IDEA_STATUS_PHASE (a
  // Record<IdeaStatus, IdeaPhase>) or the build fails, and this test proves it maps to a real phase.
  for (const status of IDEA_STATUS_VALUES) {
    const phase = getIdeaPhase(status);
    expect(validPhases.has(phase)).toBe(true);
    expect(IDEA_STATUS_PHASE[status]).toBe(phase);
  }
  expect(Object.keys(IDEA_STATUS_PHASE)).toHaveLength(IDEA_STATUS_VALUES.length);
});

test("only the live status reaches the live phase, and needsAnotherLook stays off the rail", () => {
  for (const status of IDEA_STATUS_VALUES) {
    if (getIdeaPhase(status) === "live") {
      expect(status).toBe("live");
    }
  }
  expect(getIdeaPhase("blocked")).toBe("needsAnotherLook");
  expect(getIdeaPhase("closed")).toBe("needsAnotherLook");
  expect(IDEA_PHASE_TRACK).not.toContain("needsAnotherLook");
});

test("while paused the tracker can never celebrate any status as live or shipped", () => {
  // Honesty gate: with the engine paused, nothing reached the phone, so no status (not even a real
  // live/shipped one) may render celebratory copy.
  for (const status of IDEA_STATUS_VALUES) {
    expect(canCelebrateLive(status, true)).toBe(false);
  }
  // Unpaused, only genuinely shipped/live ideas celebrate; a non-live idea never does.
  expect(canCelebrateLive("submitted", false)).toBe(false);
  expect(canCelebrateLive("processing", false)).toBe(false);
  expect(canCelebrateLive("shipped", false)).toBe(true);
  expect(canCelebrateLive("live", false)).toBe(true);
});

test("status reference lines expose the same vocabulary to help surfaces", () => {
  expect(IDEA_STATUS_REFERENCE_LINES).toContain(
    "Ready for owner = a prepared change waits for Don to approve it or request changes.",
  );
  expect(IDEA_STATUS_REFERENCE_LINES).toContain(
    "Blocked = something stopped this idea and Don has to inspect it.",
  );
});
