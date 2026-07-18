import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import type { AuthRole } from "./auth-session.server";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

const LoginInput = z.object({
  secret: z.string().trim().min(4, "Please enter your access code.").max(128),
});

type LoginThrottleBucket = {
  attempts: number;
  lockedUntil: number;
};

const loginThrottle = new Map<string, LoginThrottleBucket>();

function normalizeCredential(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePins(pins: { ownerPin?: string; brotherPin?: string }): {
  ownerPin?: string;
  brotherPin?: string;
} {
  return {
    ownerPin: normalizeCredential(pins.ownerPin),
    brotherPin: normalizeCredential(pins.brotherPin),
  };
}

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

function secretMatches(input: string, expected?: string): boolean {
  if (!expected) return false;
  let mismatch = input.length ^ expected.length;
  for (let index = 0; index < 128; index += 1) {
    const actual = index < input.length ? input.charCodeAt(index) : 0;
    const wanted = index < expected.length ? expected.charCodeAt(index) : 0;
    mismatch |= actual ^ wanted;
  }
  return mismatch === 0;
}

function validOwnerSecret(value?: string): value is string {
  return Boolean(value && /^\d{4}$/.test(value));
}

function validBrotherPin(value?: string): value is string {
  return Boolean(value && /^\d{4}$/.test(value));
}

export function validateLoginConfiguration(pins: {
  ownerPin?: string;
  brotherPin?: string;
}): string | null {
  const normalized = normalizePins(pins);
  const ownerPin = normalized.ownerPin;
  const brotherPin = normalized.brotherPin;
  const ownerValid = validOwnerSecret(ownerPin);
  const brotherValid = validBrotherPin(brotherPin);

  if (!ownerPin && !brotherPin) {
    return "Login codes are missing.";
  }
  if (ownerPin && !ownerValid && !brotherValid) {
    return "APP_PIN must contain exactly four digits.";
  }
  if (brotherPin && !brotherValid && !ownerValid) {
    return "BROTHER_PIN must contain exactly four digits.";
  }
  if (ownerValid && brotherValid && ownerPin === brotherPin) {
    return "Owner and brother credentials must be different.";
  }
  return null;
}

export function resolveLoginRole(
  input: string,
  pins: { ownerPin?: string; brotherPin?: string },
): AuthRole | null {
  const normalized = normalizePins(pins);
  if (validateLoginConfiguration(normalized)) return null;
  if (validOwnerSecret(normalized.ownerPin) && secretMatches(input, normalized.ownerPin)) {
    return "owner";
  }
  if (validBrotherPin(normalized.brotherPin) && secretMatches(input, normalized.brotherPin)) {
    return "brother";
  }
  return null;
}

export const loginWithPin = createServerFn({ method: "POST" })
  .validator((input: unknown) => LoginInput.parse(input))
  .handler(async ({ data }) => {
    const ownerPin = normalizeCredential(process.env.APP_PIN);
    const brotherPin = normalizeCredential(process.env.BROTHER_PIN);
    const configurationError = validateLoginConfiguration({ ownerPin, brotherPin });
    if (configurationError) throw new Error(configurationError);
    const key = throttleKey(getRequestIP());
    checkLoginThrottle(key);
    const { checkDurableLoginThrottle, clearDurableLoginThrottle, recordDurableLoginFailure } =
      await import("./login-rate-limit.server");
    await checkDurableLoginThrottle(key);
    const role = resolveLoginRole(data.secret, { ownerPin, brotherPin });
    if (!role) {
      recordLoginFailure(key);
      const locked = await recordDurableLoginFailure(key);
      throw new Error(locked ? "Too many attempts. Try again later." : "Wrong code");
    }
    clearLoginThrottle(key);
    await clearDurableLoginThrottle(key);
    const { loginCookie } = await import("./auth-session.server");
    loginCookie(role);
    return { ok: true as const, role };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { logoutCookie } = await import("./auth-session.server");
  logoutCookie();
  return { ok: true as const };
});

export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { getAuthRole } = await import("./auth-session.server");
  const role = getAuthRole();
  return { authenticated: role !== null, role };
});
