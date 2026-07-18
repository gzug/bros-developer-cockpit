import { expect, test } from "bun:test";
import {
  isTransientOpenRouterStatus,
  normalizeModelRequestTimeout,
  normalizeModelRetries,
} from "./openrouter.server";

test("model request timeouts stay inside the Vercel-safe bounded range", () => {
  expect(normalizeModelRequestTimeout()).toBe(12_000);
  expect(normalizeModelRequestTimeout(10)).toBe(1_000);
  expect(normalizeModelRequestTimeout(8_500.9)).toBe(8_500);
  expect(normalizeModelRequestTimeout(120_000)).toBe(20_000);
});

test("same-tier retries are finite", () => {
  expect(normalizeModelRetries()).toBe(1);
  expect(normalizeModelRetries(-10)).toBe(0);
  expect(normalizeModelRetries(1.9)).toBe(1);
  expect(normalizeModelRetries(99)).toBe(2);
});

test("only rate limits and server failures are transient HTTP responses", () => {
  expect(isTransientOpenRouterStatus(429)).toBe(true);
  expect(isTransientOpenRouterStatus(500)).toBe(true);
  expect(isTransientOpenRouterStatus(503)).toBe(true);
  expect(isTransientOpenRouterStatus(400)).toBe(false);
  expect(isTransientOpenRouterStatus(401)).toBe(false);
});
