import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  addIdeaComment,
  canTransitionIdeaStatus,
  createIdea,
  describeIdeaStatus,
  getEngineRunStats,
  getIdea,
  listIdeaActivity,
  listIdeas,
  recentIdeaCount,
  setIdeaStatus,
  type DCIdeaStatus,
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

const UpdateIdeaStatusInput = z.object({
  id: z.number().int().positive(),
  status: z.enum(["approved", "live", "blocked"]),
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

export const getIdeaActivityEntry = createServerFn({ method: "GET" })
  .validator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    return listIdeaActivity(data.id);
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

const STATUS_COMMENT: Record<"approved" | "live" | "blocked", string> = {
  approved: "Owner marked this PR approved to ship.",
  live: "Owner confirmed this change live in OL1.",
  blocked: "Owner returned this idea to manual review.",
};

export const updateIdeaStatusEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => UpdateIdeaStatusInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    const idea = await getIdea(data.id);

    if (!canTransitionIdeaStatus(idea.status, data.status as DCIdeaStatus)) {
      throw new Error(`Cannot move ${idea.status} to ${data.status}.`);
    }

    await setIdeaStatus(data.id, data.status as DCIdeaStatus, idea.intent as DCIdeaIntent);
    await addIdeaComment(data.id, STATUS_COMMENT[data.status]);
    return { ok: true as const, statusSummary: describeIdeaStatus(data.status as DCIdeaStatus) };
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
