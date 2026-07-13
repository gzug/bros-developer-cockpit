import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { runs, tasks } from "./schema";

// Best-effort persistence: Postgres is the observability layer, GitHub stays
// the source of truth. Every helper no-ops without DATABASE_URL and never
// throws, so a DB outage can not break the engine.

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[db] ${label} failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function upsertTask(input: {
  issueNumber: number;
  title: string;
  intent: string;
  status: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  await safe("upsertTask", () =>
    db
      .insert(tasks)
      .values(input)
      .onConflictDoUpdate({
        target: tasks.issueNumber,
        set: { title: input.title, intent: input.intent, status: input.status, updatedAt: new Date() },
      }),
  );
}

export async function startRun(input: { issueNumber: number; tier?: string }): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await safe("startRun", () =>
    db.insert(runs).values({ issueNumber: input.issueNumber, tier: input.tier, status: "started" }).returning({ id: runs.id }),
  );
  return rows?.[0]?.id ?? null;
}

export async function markRun(runId: string | null, status: string, patch?: { tier?: string }): Promise<void> {
  const db = getDb();
  if (!db || !runId) return;
  await safe("markRun", () => db.update(runs).set({ status, ...patch }).where(eq(runs.id, runId)));
}

export async function finishRun(
  runId: string | null,
  outcome: {
    status: "completed" | "failed" | "blocked";
    model?: string;
    tokensPrompt?: number;
    tokensCompletion?: number;
    costUsd?: number;
    githubBranchRef?: string;
    githubPrNumber?: number;
    error?: string;
  },
): Promise<void> {
  const db = getDb();
  if (!db || !runId) return;
  const { costUsd, ...rest } = outcome;
  await safe("finishRun", () =>
    db
      .update(runs)
      .set({ ...rest, costUsd: costUsd != null ? costUsd.toFixed(6) : undefined, finishedAt: new Date() })
      .where(eq(runs.id, runId)),
  );
}
