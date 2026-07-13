import { expect, test } from "bun:test";
import {
  checkLoginThrottle,
  clearLoginThrottle,
  recordLoginFailure,
  resetLoginThrottleForTest,
  throttleKey,
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
