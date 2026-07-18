import { expect, test } from "bun:test";
import { parseSessionRole, validateAppSecret } from "./auth-session.server";

test("session signing secret requires 32 random bytes in hex", () => {
  expect(validateAppSecret()).toContain("missing");
  expect(validateAppSecret("too-short")).toContain("64 hexadecimal");
  expect(validateAppSecret("a".repeat(64))).toBeNull();
});

test("session roles expire after thirty days", () => {
  const now = Date.parse("2026-07-15T12:00:00Z");
  expect(parseSessionRole(`brother:${now}`, now)).toBe("brother");
  expect(parseSessionRole(`owner:${now}`, now)).toBe("owner");
  expect(parseSessionRole(`owner:${now - 31 * 24 * 60 * 60 * 1000}`, now)).toBeNull();
});

test("session roles reject malformed and future values", () => {
  const now = Date.parse("2026-07-15T12:00:00Z");
  expect(parseSessionRole(`admin:${now}`, now)).toBeNull();
  expect(parseSessionRole("owner:not-a-time", now)).toBeNull();
  expect(parseSessionRole(`owner:${now + 60_001}`, now)).toBeNull();
});
