import { expect, test } from "bun:test";
import {
  checkLoginThrottle,
  clearLoginThrottle,
  recordLoginFailure,
  resolveLoginRole,
  resetLoginThrottleForTest,
  throttleKey,
  validateLoginConfiguration,
} from "./auth.server";

test("login throttle locks after repeated failures and then expires", () => {
  resetLoginThrottleForTest();
  const key = "test";
  const now = 1_000;

  for (let i = 0; i < 4; i++) {
    recordLoginFailure(key, now);
    expect(() => checkLoginThrottle(key, now)).not.toThrow();
  }

  recordLoginFailure(key, now);
  expect(() => checkLoginThrottle(key, now)).toThrow("Too many attempts");
  expect(() => checkLoginThrottle(key, now + 5 * 60 * 1000 + 1)).not.toThrow();
});

test("successful login clears throttle bucket", () => {
  resetLoginThrottleForTest();
  const key = "test";
  const now = 1_000;

  recordLoginFailure(key, now);
  clearLoginThrottle(key);

  expect(() => checkLoginThrottle(key, now)).not.toThrow();
});

test("throttle key uses request IP when present", () => {
  expect(throttleKey("203.0.113.9")).toBe("ip:203.0.113.9");
  expect(throttleKey(" 203.0.113.9 ")).toBe("ip:203.0.113.9");
  expect(throttleKey("")).toBe("global");
  expect(throttleKey()).toBe("global");
});

test("login codes resolve to separate brother and owner roles", () => {
  const pins = { ownerPin: "4321", brotherPin: "1234" };
  expect(resolveLoginRole("1234", pins)).toBe("brother");
  expect(resolveLoginRole("4321", pins)).toBe("owner");
  expect(resolveLoginRole("0000", pins)).toBeNull();
});

test("malformed or colliding four-digit credentials fail closed", () => {
  // owner pin must be exactly four digits
  expect(validateLoginConfiguration({ ownerPin: "98", brotherPin: "1234" })).toContain(
    "four digits",
  );
  // brother pin must be exactly four digits
  expect(
    validateLoginConfiguration({ ownerPin: "4321", brotherPin: "12ab" }),
  ).toContain("four digits");
  // the two codes must differ
  expect(
    validateLoginConfiguration({ ownerPin: "1234", brotherPin: "1234" }),
  ).toContain("different");
  expect(resolveLoginRole("98", { ownerPin: "98", brotherPin: "1234" })).toBeNull();
});
