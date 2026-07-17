import { expect, test } from "bun:test";
import {
  bridgeBranchName,
  classifyBridgeBranch,
  isBdcPaused,
  taskDeadlineMs,
} from "./engine.server";

test("bridge branches stay out of the OL1 auto-ship lane", () => {
  expect(bridgeBranchName(42)).toBe("bdc-hold/dc-issue-42");
  expect(bridgeBranchName(42).startsWith("bdc/")).toBe(false);
});

test("the engine is paused unless an owner explicitly arms it", () => {
  expect(isBdcPaused()).toBe(true);
  expect(isBdcPaused("true")).toBe(true);
  expect(isBdcPaused("false")).toBe(false);
  expect(isBdcPaused(" FALSE ")).toBe(false);
});

test("the durable branch distinguishes a claim from a prepared commit", () => {
  expect(classifyBridgeBranch(null, "base")).toBe("missing");
  expect(classifyBridgeBranch("base", "base")).toBe("claimable");
  expect(classifyBridgeBranch("patch", "base", 1)).toBe("committed");
  expect(classifyBridgeBranch("stale", "base", 0)).toBe("conflict");
});

test("the task deadline cannot be configured beyond the request-safe ceiling", () => {
  expect(taskDeadlineMs()).toBe(45_000);
  expect(taskDeadlineMs("100")).toBe(5_000);
  expect(taskDeadlineMs("32000.9")).toBe(32_000);
  expect(taskDeadlineMs("999999")).toBe(55_000);
  expect(taskDeadlineMs(" ")).toBe(45_000);
  expect(taskDeadlineMs("not-a-number")).toBe(45_000);
});
