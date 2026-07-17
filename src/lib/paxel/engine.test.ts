import { expect, test } from "bun:test";
import {
  ACTIVE_GAP_LIMIT_SECONDS,
  activeSecondsFromTimestamps,
  buildSessionReport,
  buildSnapshot,
  calculateScores,
  scrubText,
  snapshotContainsRawText,
} from "./engine";
import type { NormalizedSession, PaxelSnapshot } from "./types";

const session = (overrides: Partial<NormalizedSession> = {}): NormalizedSession => ({
  id: "session-1",
  source: "codex-cli",
  startedAt: "2026-07-17T10:00:00.000Z",
  endedAt: "2026-07-17T10:20:00.000Z",
  prompts: [
    { text: "Plan the user-facing Builder Profile route and verify the acceptance checks.", timestamp: "2026-07-17T10:00:00.000Z" },
    { text: "Actually, add a focused regression test before shipping.", timestamp: "2026-07-17T10:10:00.000Z" },
  ],
  tools: [
    { name: "read_file", status: "success", timestamp: "2026-07-17T10:01:00.000Z" },
    { name: "apply_patch", status: "success", timestamp: "2026-07-17T10:12:00.000Z" },
    { name: "bun test", status: "success", timestamp: "2026-07-17T10:13:00.000Z" },
  ],
  commitCount: 1,
  malformedLines: 0,
  eventTimestamps: ["2026-07-17T10:00:00.000Z", "2026-07-17T10:10:00.000Z", "2026-07-17T10:13:00.000Z"],
  wallSeconds: 780,
  activeSeconds: 780,
  ...overrides,
});

test("active time excludes gaps longer than the configured idle window", () => {
  const start = Date.parse("2026-07-17T10:00:00.000Z");
  const timestamps = [0, 10 * 60, 10 * 60 + ACTIVE_GAP_LIMIT_SECONDS + 60].map((seconds) => new Date(start + seconds * 1000).toISOString());
  expect(activeSecondsFromTimestamps(timestamps)).toBe(10 * 60);
});

test("scrubText removes paths, IPs, and secret-like values", () => {
  const scrubbed = scrubText("Edit /Users/don/private/project/src/App.tsx at 192.168.1.20 with token=abc123456789.");
  expect(scrubbed).toContain("[PATH]");
  expect(scrubbed).toContain("[IP_ADDRESS]");
  expect(scrubbed).toContain("[REDACTED_SECRET]");
  expect(scrubbed).not.toContain("abc123456789");
});

test("scores stay in the five-axis 0-100 contract", () => {
  const scores = calculateScores(session());
  expect(Object.keys(scores).sort()).toEqual(["execution", "planning", "product", "quality", "steering"]);
  Object.values(scores).forEach((value) => {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  });
});

test("snapshot carries previous values and no raw prompt text", () => {
  const previous = buildSnapshot([buildSessionReport(session({ id: "old", prompts: [{ text: "old private phrase" }] }))]);
  const current = buildSnapshot([buildSessionReport(session({ id: "new", prompts: [{ text: "new private phrase" }] }))], previous as PaxelSnapshot);
  expect(current.metrics.every((metric) => metric.previousValue !== undefined)).toBe(true);
  expect(snapshotContainsRawText(current, ["new private phrase", "/Users/don"])).toBe(false);
});
