import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { runs, tasks } from "./schema";

// Best-effort persistence: Postgres is the observability layer, GitHub stays
// the source of truth. Every helper no-ops without DATABASE_URL and never
// throws, so a DB outage can not break the engine.

export type MemoryTask = {
  issueNumber: number;
  title: string;
  intent: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MemoryRun = {
  id: string;
  issueNumber: number;
  status: string;
  tier: string | null;
  model: string | null;
  tokensPrompt: number | null;
  tokensCompletion: number | null;
  costUsd: string | null;
  githubBranchRef: string | null;
  githubPrNumber: number | null;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

const memoryTasks = new Map<number, MemoryTask>();
const memoryRuns = new Map<string, MemoryRun>();

function memoryId(): string {
  return `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listMemoryTasks(): MemoryTask[] {
  return [...memoryTasks.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function listMemoryRuns(): MemoryRun[] {
  return [...memoryRuns.values()].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

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
  const existing = memoryTasks.get(input.issueNumber);
  memoryTasks.set(input.issueNumber, {
    ...input,
    createdAt: existing?.createdAt ?? new Date(),
    updatedAt: new Date(),
  });

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
  const id = memoryId();
  memoryRuns.set(id, {
    id,
    issueNumber: input.issueNumber,
    status: "started",
    tier: input.tier ?? null,
    model: null,
    tokensPrompt: null,
    tokensCompletion: null,
    costUsd: null,
    githubBranchRef: null,
    githubPrNumber: null,
    error: null,
    startedAt: new Date(),
    finishedAt: null,
  });

  const db = getDb();
  if (!db) return id;
  const rows = await safe("startRun", () =>
    db.insert(runs).values({ issueNumber: input.issueNumber, tier: input.tier, status: "started" }).returning({ id: runs.id }),
  );
  return rows?.[0]?.id ?? id;
}

export async function markRun(runId: string | null, status: string, patch?: { tier?: string }): Promise<void> {
  if (runId) {
    const current = memoryRuns.get(runId);
    if (current) {
      memoryRuns.set(runId, {
        ...current,
        status,
        tier: patch?.tier ?? current.tier,
      });
    }
  }

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
  if (runId) {
    const current = memoryRuns.get(runId);
    if (current) {
      memoryRuns.set(runId, {
        ...current,
        status: outcome.status,
        model: outcome.model ?? current.model,
        tokensPrompt: outcome.tokensPrompt ?? current.tokensPrompt,
        tokensCompletion: outcome.tokensCompletion ?? current.tokensCompletion,
        costUsd: outcome.costUsd != null ? outcome.costUsd.toFixed(6) : current.costUsd,
        githubBranchRef: outcome.githubBranchRef ?? current.githubBranchRef,
        githubPrNumber: outcome.githubPrNumber ?? current.githubPrNumber,
        error: outcome.error ?? current.error,
        finishedAt: new Date(),
      });
    }
  }

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
