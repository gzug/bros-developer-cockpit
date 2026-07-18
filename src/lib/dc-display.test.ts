import { describe, expect, it } from "bun:test";
import { formatDcCost } from "./dc-display";

describe("formatDcCost", () => {
  it("formats missing, string, and numeric run costs with four decimals", () => {
    expect(formatDcCost(null)).toBe("$0.0000");
    expect(formatDcCost("0.012345")).toBe("$0.0123");
    expect(formatDcCost(1.2)).toBe("$1.2000");
  });
});
