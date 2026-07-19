import { createServerFn } from "@tanstack/react-start";
import { desc } from "drizzle-orm";
import { getDb, dbSchema } from "./db/index";
import { listMemoryRuns, listMemoryTasks } from "./db/runs.server";

export type TaskRow = {
  issueNumber: number;
  title: string;
  intent: string;
  status: string;
  updatedAt: string;
};

export type RunRow = {
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
  startedAt: string;
  finishedAt: string | null;
};

export type RunsData = {
  tasks: TaskRow[];
  runs: RunRow[];
};

export const listRunsData = createServerFn({ method: "GET" }).handler(
  async (): Promise<RunsData> => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();

    const db = getDb();
    if (!db) {
      return {
        tasks: listMemoryTasks()
          .slice(0, 50)
          .map((t) => ({
            issueNumber: t.issueNumber,
            title: t.title,
            intent: t.intent,
            status: t.status,
            updatedAt: t.updatedAt.toISOString(),
          })),
        runs: listMemoryRuns()
          .slice(0, 100)
          .map((r) => ({
            id: r.id,
            issueNumber: r.issueNumber,
            status: r.status,
            tier: r.tier,
            model: r.model,
            tokensPrompt: r.tokensPrompt,
            tokensCompletion: r.tokensCompletion,
            costUsd: r.costUsd,
            githubBranchRef: r.githubBranchRef,
            githubPrNumber: r.githubPrNumber,
            error: r.error,
            startedAt: r.startedAt.toISOString(),
            finishedAt: r.finishedAt?.toISOString() ?? null,
          })),
      };
    }

    const [taskRows, runRows] = await Promise.all([
      db.select().from(dbSchema.tasks).orderBy(desc(dbSchema.tasks.updatedAt)).limit(50),
      db.select().from(dbSchema.runs).orderBy(desc(dbSchema.runs.startedAt)).limit(100),
    ]);

    return {
      tasks: taskRows.map((t) => ({
        issueNumber: t.issueNumber,
        title: t.title,
        intent: t.intent,
        status: t.status,
        updatedAt: t.updatedAt.toISOString(),
      })),
      runs: runRows.map((r) => ({
        id: r.id,
        issueNumber: r.issueNumber,
        status: r.status,
        tier: r.tier,
        model: r.model,
        tokensPrompt: r.tokensPrompt,
        tokensCompletion: r.tokensCompletion,
        costUsd: r.costUsd,
        githubBranchRef: r.githubBranchRef,
        githubPrNumber: r.githubPrNumber,
        error: r.error,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
      })),
    };
  },
);
