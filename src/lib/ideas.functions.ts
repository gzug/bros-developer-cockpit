import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createIdea,
  getEngineRunStats,
  getIdea,
  listIdeas,
  recentIdeaCount,
  type DCIdeaIntent,
} from "./github-issues.server";

const CreateIdeaInput = z.object({
  intent: z.enum(["wording", "look", "wrong", "idea"]),
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(3).max(4000),
});

const IdInput = z.object({
  id: z.number().int().positive(),
});

export const createIdeaEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => CreateIdeaInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    const { checkGuardrails } = await import("./guardrails.server");
    requireAuth();
    const guardrail = checkGuardrails({
      title: data.title,
      body: data.description,
    });
    if (!guardrail.ok) throw new Error(guardrail.message);
    return createIdea(data.intent as DCIdeaIntent, data.title, data.description);
  });

export const listIdeaEntries = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("./auth-session.server");
  requireAuth();
  return listIdeas();
});

export const getIdeaEntry = createServerFn({ method: "GET" })
  .validator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    return getIdea(data.id);
  });

export const recentIdeaUsage = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("./auth-session.server");
  requireAuth();
  const count = await recentIdeaCount();
  return { count, windowHours: 5 };
});

export const processContribution = createServerFn({ method: "POST" })
  .validator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    const { processTask } = await import("./engine.server");
    return processTask(data.id);
  });

export const getOwnerKpis = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("./auth-session.server");
  requireAuth();
  const ideas = await listIdeas();
  const runs = await Promise.all(ideas.map((idea) => getEngineRunStats(idea.id)));
  const flatRuns = runs.flat();

  return {
    totalIdeas: ideas.length,
    liveCount: ideas.filter((idea) => idea.status === "live").length,
    approvedCount: ideas.filter((idea) => idea.status === "approved").length,
    blockedCount: ideas.filter((idea) => idea.status === "blocked").length,
    sentCount: ideas.filter((idea) => idea.status === "sent").length,
    submittedCount: ideas.filter((idea) => idea.status === "submitted").length,
    closedCount: ideas.filter((idea) => idea.status === "closed").length,
    totalCostUsd: flatRuns.reduce((sum, run) => sum + run.costUsd, 0),
  };
});
