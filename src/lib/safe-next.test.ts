import { expect, test } from "bun:test";
import { safeNext } from "./safe-next";

test("safeNext keeps local paths and query strings", () => {
  expect(safeNext("/submit?context=Home&type=change")).toBe("/submit?context=Home&type=change");
});

test("safeNext rejects cross-origin and backslash redirects", () => {
  expect(safeNext("https://evil.example/")).toBe("");
  expect(safeNext("//evil.example/")).toBe("");
  expect(safeNext("/\\evil.example/")).toBe("");
});
