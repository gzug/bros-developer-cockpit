import { createHmac, timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "vinxi/http";

const COOKIE_NAME = "dc_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function getAppSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET fehlt.");
  return secret;
}

function sign(value: string): string {
  const sig = createHmac("sha256", getAppSecret()).update(value).digest("hex");
  return `${value}.${sig}`;
}

function verify(signed: string): boolean {
  const [value, sig] = signed.split(".");
  if (!value || !sig) return false;
  const expected = createHmac("sha256", getAppSecret()).update(value).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function isAuthenticated(): boolean {
  const cookie = getCookie(COOKIE_NAME);
  return typeof cookie === "string" && verify(cookie);
}

export function requireAuth(): void {
  if (!isAuthenticated()) {
    throw new Error("Nicht eingeloggt.");
  }
}

export function loginCookie(): void {
  const token = sign(Date.now().toString());
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
