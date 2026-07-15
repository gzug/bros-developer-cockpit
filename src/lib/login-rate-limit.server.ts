import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { validateAppSecret } from "./auth-session.server";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const LOCK_MINUTES = 15;

type NeonClient = ReturnType<typeof neon>;
let ready: Promise<void> | null = null;

function client(): NeonClient | null {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.VERCEL === "1") {
      throw new Error("Login is temporarily unavailable because durable rate limiting is not configured.");
    }
    return null;
  }
  return neon(url);
}

function keyHash(key: string): string {
  const secret = process.env.APP_SECRET;
  const error = validateAppSecret(secret);
  if (error) throw new Error(error);
  return createHmac("sha256", secret!).update(`login-rate:${key}`).digest("hex");
}

async function ensureTable(sql: NeonClient): Promise<void> {
  ready ??= sql`
    CREATE TABLE IF NOT EXISTS login_rate_limits (
      key_hash text PRIMARY KEY,
      attempts integer NOT NULL DEFAULT 0,
      window_started_at timestamptz NOT NULL DEFAULT now(),
      locked_until timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.then(() => undefined);
  await ready;
}

export async function checkDurableLoginThrottle(key: string): Promise<void> {
  const sql = client();
  if (!sql) return;
  await ensureTable(sql);
  const rows = (await sql`
    SELECT locked_until
    FROM login_rate_limits
    WHERE key_hash = ${keyHash(key)}
  `) as Array<Record<string, unknown>>;
  const lockedUntil = rows[0]?.locked_until ? new Date(String(rows[0].locked_until)) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    throw new Error("Too many attempts. Try again later.");
  }
}

export async function recordDurableLoginFailure(key: string): Promise<boolean> {
  const sql = client();
  if (!sql) return false;
  await ensureTable(sql);
  const rows = (await sql`
    INSERT INTO login_rate_limits (key_hash, attempts, window_started_at, locked_until, updated_at)
    VALUES (${keyHash(key)}, 1, now(), null, now())
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE
        WHEN login_rate_limits.window_started_at < now() - (${WINDOW_MINUTES} * interval '1 minute') THEN 1
        ELSE login_rate_limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN login_rate_limits.window_started_at < now() - (${WINDOW_MINUTES} * interval '1 minute') THEN now()
        ELSE login_rate_limits.window_started_at
      END,
      locked_until = CASE
        WHEN (
          CASE
            WHEN login_rate_limits.window_started_at < now() - (${WINDOW_MINUTES} * interval '1 minute') THEN 1
            ELSE login_rate_limits.attempts + 1
          END
        ) >= ${MAX_ATTEMPTS} THEN now() + (${LOCK_MINUTES} * interval '1 minute')
        ELSE null
      END,
      updated_at = now()
    RETURNING locked_until
  `) as Array<Record<string, unknown>>;
  return Boolean(rows[0]?.locked_until);
}

export async function clearDurableLoginThrottle(key: string): Promise<void> {
  const sql = client();
  if (!sql) return;
  await ensureTable(sql);
  await sql`DELETE FROM login_rate_limits WHERE key_hash = ${keyHash(key)}`;
}

export async function consumeDurableActionQuota(key: string): Promise<void> {
  await checkDurableLoginThrottle(key);
  if (await recordDurableLoginFailure(key)) {
    throw new Error("Too many requests. Try again later.");
  }
}
