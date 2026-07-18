import { createHmac, timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

const COOKIE_NAME = "dc_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export type AuthRole = "brother" | "owner";

export function parseSessionRole(value: string, now = Date.now()): AuthRole | null {
  const [role, issuedAtText, ...rest] = value.split(":");
  const issuedAt = Number(issuedAtText);
  if (rest.length > 0 || (role !== "brother" && role !== "owner")) return null;
  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) return null;
  if (issuedAt > now + 60_000 || now - issuedAt > MAX_AGE * 1000) return null;
  return role;
}

export function validateAppSecret(secret?: string): string | null {
  if (!secret) return "APP_SECRET is missing.";
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    return "APP_SECRET must be exactly 32 random bytes encoded as 64 hexadecimal characters.";
  }
  return null;
}

function getAppSecret(): string {
  const secret = process.env.APP_SECRET;
  const error = validateAppSecret(secret);
  if (error) throw new Error(error);
  return secret!;
}

function sign(value: string): string {
  const sig = createHmac("sha256", getAppSecret()).update(value).digest("hex");
  return `${value}.${sig}`;
}

function verify(signed: string): string | null {
  const separator = signed.lastIndexOf(".");
  const value = separator > 0 ? signed.slice(0, separator) : "";
  const sig = separator > 0 ? signed.slice(separator + 1) : "";
  if (!value || !sig) return null;
  const expected = createHmac("sha256", getAppSecret()).update(value).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? value : null;
  } catch {
    return null;
  }
}

export function getAuthRole(): AuthRole | null {
  const cookie = getCookie(COOKIE_NAME);
  if (typeof cookie !== "string") return null;
  const value = verify(cookie);
  if (!value) return null;
  return parseSessionRole(value);
}

export function isAuthenticated(): boolean {
  return getAuthRole() !== null;
}

export function requireAuth(): AuthRole {
  const role = getAuthRole();
  if (!role) {
    throw new Error("Not logged in.");
  }
  return role;
}

export function requireOwner(): void {
  if (requireAuth() !== "owner") {
    throw new Error("Owner access required.");
  }
}

export function loginCookie(role: AuthRole): void {
  const token = sign(`${role}:${Date.now()}`);
  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function logoutCookie(): void {
  deleteCookie(COOKIE_NAME, { path: "/" });
}
