import { createHash, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

const LoginInput = z.object({
  pin: z.string().regex(/^\d{4}$/, "Please enter exactly four digits."),
});

type LoginThrottleBucket = {
  attempts: number;
  lockedUntil: number;
};

const loginThrottle = new Map<string, LoginThrottleBucket>();

export function throttleKey(ip?: string | null): string {
  const value = ip?.trim();
  return value ? `ip:${value}` : "global";
}

export function resetLoginThrottleForTest(): void {
  loginThrottle.clear();
}

export function checkLoginThrottle(key: string, now = Date.now()): void {
  const bucket = loginThrottle.get(key);
  if (bucket && bucket.lockedUntil > now) {
    throw new Error("Too many attempts. Try again later.");
  }
  if (bucket && bucket.lockedUntil <= now && bucket.lockedUntil !== 0) {
    loginThrottle.delete(key);
  }
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const bucket = loginThrottle.get(key) ?? { attempts: 0, lockedUntil: 0 };
  const attempts = bucket.attempts + 1;
  loginThrottle.set(key, {
    attempts,
    lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? now + LOCK_MS : 0,
  });
}

export function clearLoginThrottle(key: string): void {
  loginThrottle.delete(key);
}

export const loginWithPin = createServerFn({ method: "POST" })
  .validator((input: unknown) => LoginInput.parse(input))
  .handler(async ({ data }) => {
    const expectedPin = process.env.APP_PIN;
    if (!expectedPin) throw new Error("APP_PIN is missing.");
    const key = throttleKey(getRequestIP());
    checkLoginThrottle(key);
    const inputHash = createHash("sha256").update(data.pin).digest();
    const expectedHash = createHash("sha256").update(expectedPin).digest();
    const pinMatch = timingSafeEqual(inputHash, expectedHash);
    if (!pinMatch) {
      recordLoginFailure(key);
      throw new Error("Wrong code");
    }
    clearLoginThrottle(key);
    const { loginCookie } = await import("./auth-session.server");
    loginCookie();
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { logoutCookie } = await import("./auth-session.server");
  logoutCookie();
  return { ok: true as const };
});

export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { isAuthenticated } = await import("./auth-session.server");
  return { authenticated: isAuthenticated() };
});
