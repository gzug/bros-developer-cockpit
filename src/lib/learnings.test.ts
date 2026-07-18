import { expect, test } from "bun:test";
import { parseLearningsJsonl } from "./learnings";

test("the session archive is valid JSONL with one record per learning", async () => {
  const text = await Bun.file("data/learnings/learnings.jsonl").text();
  const records = parseLearningsJsonl(text);

  expect(records).toHaveLength(15);
  expect(records.every((record) => record.date === "2026-07-18")).toBe(true);
  expect(records.slice(0, 10).every((record) => record.area !== "prompt-pattern")).toBe(true);
  expect(records.slice(10).every((record) => record.area === "prompt-pattern")).toBe(true);
  expect(records.every((record) => Object.values(record).every((value) => value.length > 0))).toBe(true);
});

test("the learning parser rejects malformed records", () => {
  expect(() => parseLearningsJsonl('{"date":"2026-07-18"}')).toThrow(
    "Learning on line 1 must contain non-empty string fields.",
  );
  expect(() => parseLearningsJsonl("not json")).toThrow("Invalid learning JSON on line 1.");
});
