import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

let db: Db | null | undefined;

// Single export point for the Neon client. Returns null when DATABASE_URL is
// not configured so callers can degrade gracefully (GitHub stays the source
// of truth; Postgres is the observability layer).
export function getDb(): Db | null {
  if (db !== undefined) return db;
  const url = process.env.DATABASE_URL;
  db = url ? drizzle(neon(url), { schema }) : null;
  return db;
}

export * as dbSchema from "./schema";
