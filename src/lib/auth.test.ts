import { expect, test } from "bun:test";
import {
  checkLoginThrottle,
  clearLoginThrottle,
  recordLoginFailure,
  resetLoginThrottleForTest,
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
