import { describe, expect, it } from "bun:test";
import { formatDcCost, getCockpitRoleLabel, getDcQueueCardState } from "./dc-display";

describe("formatDcCost", () => {
  it("formats missing, string, and numeric run costs with four decimals", () => {
    expect(formatDcCost(null)).toBe("$0.0000");
    expect(formatDcCost("0.012345")).toBe("$0.0123");
    expect(formatDcCost(1.2)).toBe("$1.2000");
  });
});

describe("getCockpitRoleLabel", () => {
  it("keeps visible cockpit role labels canonical", () => {
    expect(getCockpitRoleLabel("owner")).toBe("Owner");
    expect(getCockpitRoleLabel("brother")).toBe("Co-dev");
  });
});

describe("getDcQueueCardState", () => {
  it("keeps a failed queue load distinct from a real empty result", () => {
    // Load FAILED (GitHub outage / missing token): no rows came back, but this
    // must NOT read as the plain "No ideas collected yet" empty state.
    expect(getDcQueueCardState({ queueUnavailable: true, queueCount: 0 })).toBe("unavailable");
    // Load SUCCEEDED with zero rows: the genuine empty state, not unavailable.
    expect(getDcQueueCardState({ queueUnavailable: false, queueCount: 0 })).toBe("empty");
    // Load SUCCEEDED with rows: the queue renders normally.
    expect(getDcQueueCardState({ queueUnavailable: false, queueCount: 3 })).toBe("populated");
  });

  it("treats the unavailable flag as authoritative even if rows are present", () => {
    expect(getDcQueueCardState({ queueUnavailable: true, queueCount: 5 })).toBe("unavailable");
  });
});
