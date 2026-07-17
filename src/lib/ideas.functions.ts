import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  canConfirmIdeaLive,
  createIdea,
  createSubmittedIdea,
  closeIdeaAsDeleted,
  completeIdea,
  describeIdeaStatus,
  getUndoLastChangeStatus,
  getEngineRunStatsBatch,
  getIdea,
  getIdeaWithPull,
  markIdeaLive,
  getOwnerActionQueue,
  listIdeaActivity,
  listDoneIdeas,
  listIdeas,
  listPipelineIdeas,
  recentIdeaCount,
  requestIdeaChanges,
  setIdeaContext,
  setIdeaPipelineState,
  setIdeaStatus,
  setIdeaWeight,
  toBrotherIdea,
  type BdcSubmissionType,
  type DoneCategorySlug,
  type DCIdeaStatus,
  type DCIdeaIntent,
  type IdeaPipelineState,
  type IdeaWeight,
} from "./github-issues.server";
import { addLabelsToIssue, getPullRequest, removeIssueLabel } from "./github.server";
import { upsertTask } from "./db/runs.server";

const CreateIdeaInput = z.object({
  intent: z.enum(["wording", "look", "wrong", "idea"]),
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(3).max(4000),
});

const SubmitIdeaInput = z.object({
  type: z.enum(["idea", "change"]),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(600),
  screen: z.string().trim().max(80).optional(),
});

const ParkedIdeaInput = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(600),
  weight: z.enum(["light", "heavy"]),
  context: z.string().trim().max(280).optional(),
});

const IdInput = z.object({
  id: z.number().int().positive(),
});

const PipelineStateInput = IdInput.extend({
  state: z.enum(["active", "parked", "archived"]),
});

const WeightInput = IdInput.extend({
  weight: z.enum(["light", "heavy"]),
});

const ContextInput = IdInput.extend({
  context: z.string().trim().max(280).optional(),
});

const DoneInput = IdInput.extend({
  category: z.enum(["home", "sleep", "nutrition", "activity", "statistics", "general"]),
});

const PrActionInput = z.object({
  issueNumber: z.number().int().positive(),
  prNumber: z.number().int().positive(),
});

async function enforceBrotherSubmissionQuota(role: "brother" | "owner"): Promise<void> {
  if (role !== "brother") return;
  const { getRequestIP } = await import("@tanstack/react-start/server");
  const { consumeDurableActionQuota } = await import("./login-rate-limit.server");
  await consumeDurableActionQuota(`submit:${getRequestIP()?.trim() || "unknown"}`);
  if ((await recentIdeaCount()) >= 5) {
    throw new Error(
      "Five wishes were already sent in the last five hours. Please try again later.",
    );
  }
}

export const createIdeaEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => CreateIdeaInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    const { checkGuardrails } = await import("./guardrails.server");
    const role = requireAuth();
    const guardrail = checkGuardrails({
      title: data.title,
      body: data.description,
    });
    if (!guardrail.ok) throw new Error(guardrail.message);
    await enforceBrotherSubmissionQuota(role);
    const idea = await createIdea(data.intent as DCIdeaIntent, data.title, data.description);
    await upsertTask({
      issueNumber: idea.id,
      title: idea.title,
      intent: idea.intent,
      status: idea.status,
    });
    return idea;
  });

export const submitIdeaFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    const role = requireAuth();

    const parsed = SubmitIdeaInput.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false as const,
        error: parsed.error.issues[0]?.message ?? "Please check the form.",
      };
    }

    const { checkGuardrails } = await import("./guardrails.server");
    const guardrail = checkGuardrails({
      title: parsed.data.title,
      screen: parsed.data.screen,
      body: parsed.data.description,
    });
    if (!guardrail.ok) return { ok: false as const, error: guardrail.message };
    await enforceBrotherSubmissionQuota(role);

    try {
      const idea = await createSubmittedIdea({
        type: parsed.data.type as BdcSubmissionType,
        title: parsed.data.title,
        description: parsed.data.description,
        screen: parsed.data.screen,
      });
      await upsertTask({
        issueNumber: idea.id,
        title: idea.title,
        intent: idea.intent,
        status: idea.status,
      });
      return { ok: true as const, issueNumber: idea.id, issueUrl: idea.issueUrl };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

export const listIdeaEntries = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("./auth-session.server");
  requireAuth();
  return (await listIdeas()).map(toBrotherIdea);
});

export const listPipelineEntries = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("./auth-session.server");
  requireAuth();
  return listPipelineIdeas();
});

export const listDoneIdeaEntries = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("./auth-session.server");
  requireAuth();
  return listDoneIdeas();
});

export const getUndoLastChangeEntry = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("./auth-session.server");
  requireAuth();
  return getUndoLastChangeStatus();
});

export const createParkedIdeaEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => ParkedIdeaInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    const { checkGuardrails } = await import("./guardrails.server");
    requireAuth();
    const guardrail = checkGuardrails({
      title: data.title,
      body: `${data.description}\n${data.context ?? ""}`,
    });
    if (!guardrail.ok) throw new Error(guardrail.message);
    return createSubmittedIdea({
      type: "idea",
      title: data.title,
      description: data.description,
      parked: true,
      weight: data.weight as IdeaWeight,
      context: data.context,
    });
  });

export const updateIdeaPipelineEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => PipelineStateInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    await setIdeaPipelineState(data.id, data.state as IdeaPipelineState);
    return { ok: true as const };
  });

export const updateIdeaWeightEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => WeightInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    await setIdeaWeight(data.id, data.weight as IdeaWeight);
    return { ok: true as const };
  });

export const updateIdeaContextEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => ContextInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    await setIdeaContext(data.id, data.context);
    return { ok: true as const };
  });

export const deleteIdeaEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    await closeIdeaAsDeleted(data.id);
    return { ok: true as const };
  });

export const completeIdeaEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) => DoneInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    await completeIdea(data.id, data.category as DoneCategorySlug);
    return { ok: true as const };
  });

export const getIdeaEntry = createServerFn({ method: "GET" })
  .validator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    return toBrotherIdea(await getIdea(data.id));
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
    const { requireOwner } = await import("./auth-session.server");
    requireOwner();
    const { processTask } = await import("./engine.server");
    return processTask(data.id);
  });

export const pollNewBdcIssuesFn = createServerFn({ method: "POST" }).handler(async () => {
  const { requireOwner } = await import("./auth-session.server");
  requireOwner();
  const { pollNewBdcIssues } = await import("./issue-poller.server");
  return pollNewBdcIssues();
});

async function approveHeldPullRequest(issueNumber: number, prNumber: number) {
  const { isBdcPaused } = await import("./engine.server");
  if (isBdcPaused()) {
    throw new Error(
      "BDC shipping is paused. Arm it only after the production baseline is device-verified.",
    );
  }
  const pr = await getPullRequest(prNumber);
  if (pr.state !== "open") {
    throw new Error(`PR #${prNumber} is not open.`);
  }
  const { isPullRequestForIdea } = await import("./github-issues.server");
  if (!isPullRequestForIdea(issueNumber, pr)) {
    throw new Error(`PR #${prNumber} is not the trusted held change for issue #${issueNumber}.`);
  }

  await removeIssueLabel(prNumber, "bdc-changes-requested");
  await removeIssueLabel(prNumber, "bdc-failed");
  await removeIssueLabel(prNumber, "bdc-approved");
  await removeIssueLabel(issueNumber, "bdc-changes-requested");
  await removeIssueLabel(issueNumber, "bdc-failed");
  await removeIssueLabel(issueNumber, "bdc-approved");
  await removeIssueLabel(prNumber, "awaiting-owner-review");
  await removeIssueLabel(issueNumber, "awaiting-owner-review");
  await upsertTask({
    issueNumber,
    title: pr.title,
    intent: "change",
    status: "approved",
  });
  // This label starts the privileged ship workflow. Keep it as the final mutation so
  // a failed bookkeeping call can never look like a failed approval while shipment runs.
  await addLabelsToIssue(prNumber, ["bdc-approved"]);

  return {
    ok: true as const,
    shipLane: "one-l1fe-bdc-ship",
    message: "Approved. The One L1fe checks will run before the update is published.",
  };
}

export const approvePrFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => PrActionInput.parse(input))
  .handler(async ({ data }) => {
    const { requireOwner } = await import("./auth-session.server");
    requireOwner();
    return approveHeldPullRequest(data.issueNumber, data.prNumber);
  });

export const requestChangesFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => PrActionInput.parse(input))
  .handler(async ({ data }) => {
    const { requireOwner } = await import("./auth-session.server");
    requireOwner();
    const { pr } = await getIdeaWithPull(data.issueNumber);
    if (!pr || pr.number !== data.prNumber || pr.state !== "open") {
      throw new Error(
        `PR #${data.prNumber} is not the open held change for issue #${data.issueNumber}.`,
      );
    }
    await requestIdeaChanges(data.issueNumber);
    await addLabelsToIssue(pr.number, ["bdc-changes-requested"]);
    await removeIssueLabel(pr.number, "awaiting-owner-review");
    await upsertTask({
      issueNumber: data.issueNumber,
      title: `Issue #${data.issueNumber}`,
      intent: "change",
      status: "blocked",
    });
    return { ok: true as const };
  });

export const markLiveFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }) => {
    const { requireOwner } = await import("./auth-session.server");
    requireOwner();
    const { idea, pr } = await getIdeaWithPull(data.id);
    if (idea.status !== "shipped" || !canConfirmIdeaLive(pr)) {
      throw new Error(
        "Cannot confirm live until the update was published and the linked PR was merged.",
      );
    }
    await markIdeaLive(data.id);
    await upsertTask({
      issueNumber: data.id,
      title: `Issue #${data.id}`,
      intent: "change",
      status: "live",
    });
    return { ok: true as const };
  });

export const getOwnerKpis = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOwner } = await import("./auth-session.server");
  requireOwner();
  const ideas = await listIdeas();
  const statsMap = await getEngineRunStatsBatch(ideas.map((idea) => idea.id));
  const flatRuns = ideas.flatMap((idea) => statsMap.get(idea.id) ?? []);

  return {
    totalIdeas: ideas.length,
    liveCount: ideas.filter((idea) => idea.status === "live").length,
    approvedCount: ideas.filter((idea) => idea.status === "approved").length,
    shippedCount: ideas.filter((idea) => idea.status === "shipped").length,
    blockedCount: ideas.filter((idea) => idea.status === "blocked").length,
    sentCount: ideas.filter((idea) => idea.status === "sent").length,
    submittedCount: ideas.filter((idea) => idea.status === "submitted").length,
    closedCount: ideas.filter((idea) => idea.status === "closed").length,
    totalCostUsd: flatRuns.reduce((sum, run) => sum + run.costUsd, 0),
    actionQueue: getOwnerActionQueue(ideas),
  };
});
