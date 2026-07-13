import { expect, test } from "bun:test";
import { bridgeBranchName } from "./engine.server";

test("bridge branches stay out of the OL1 auto-ship lane", () => {
  expect(bridgeBranchName(42)).toBe("bdc-hold/dc-issue-42");
  expect(bridgeBranchName(42).startsWith("bdc/")).toBe(false);
});
