import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  addIdeaComment,
  canTransitionIdeaStatus,
  canConfirmIdeaLive,
  createIdea,
  createSubmittedIdea,
  describeIdeaStatus,
  getEngineRunStatsBatch,
  getIdea,
  getIdeaWithPull,
  markIdeaApproved,
  markIdeaLive,
  getOwnerActionQueue,
  listIdeaActivity,
  listIdeas,
  recentIdeaCount,
  requestIdeaChanges,
  setIdeaStatus,
  type BdcSubmissionType,
  type DCIdeaStatus,
  type DCIdeaIntent,
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

const IdInput = z.object({
  id: z.number().int().positive(),
});

const PrActionInput = z.object({
  issueNumber: z.number().int().positive(),
  prNumber: z.number().int().positive(),
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

export const submitIdeaFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();

    const parsed = SubmitIdeaInput.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false as const,
        error: parsed.error.issues[0]?.message ?? "Please check the form.",
      };
    }

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

export const pollNewBdcIssuesFn = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAuth } = await import("./auth-session.server");
  requireAuth();
  const { pollNewBdcIssues } = await import("./issue-poller.server");
  return pollNewBdcIssues();
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
    const { idea, pr } = await getIdeaWithPull(data.id);

    if (!canTransitionIdeaStatus(idea.status, data.status as DCIdeaStatus)) {
      throw new Error(`Cannot move ${idea.status} to ${data.status}.`);
    }

    if (data.status === "live" && !canConfirmIdeaLive(pr)) {
      throw new Error("Cannot confirm live until the linked PR is merged.");
    }

    await setIdeaStatus(data.id, data.status as DCIdeaStatus, idea.intent as DCIdeaIntent);
    await addIdeaComment(data.id, STATUS_COMMENT[data.status]);
    return { ok: true as const, statusSummary: describeIdeaStatus(data.status as DCIdeaStatus) };
  });

export const approvePrFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => PrActionInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();

    const pr = await getPullRequest(data.prNumber);
    const expectedHeldBranch = `bdc-hold/dc-issue-${data.issueNumber}`;
    if (pr.state !== "open") {
      throw new Error(`PR #${data.prNumber} is not open.`);
    }
    if (pr.headRef !== expectedHeldBranch) {
      throw new Error(`PR #${data.prNumber} is on ${pr.headRef}, expected ${expectedHeldBranch}.`);
    }

    await addLabelsToIssue(data.prNumber, ["bdc-approved"]);
    await markIdeaApproved(data.issueNumber);
    await removeIssueLabel(data.prNumber, "awaiting-owner-review");
    await removeIssueLabel(data.issueNumber, "awaiting-owner-review");
    await upsertTask({
      issueNumber: data.issueNumber,
      title: pr.title,
      intent: "change",
      status: "approved",
    });

    return {
      ok: true as const,
      shipLane: "one-l1fe-bdc-ship",
      message: "Approved. The One L1fe BDC ship workflow will validate, merge, and publish the production OTA.",
    };
  });

export const requestChangesFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => PrActionInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    await requestIdeaChanges(data.issueNumber);
    await addLabelsToIssue(data.prNumber, ["bdc-changes-requested"]);
    await removeIssueLabel(data.prNumber, "awaiting-owner-review");
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
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
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
  const { requireAuth } = await import("./auth-session.server");
  requireAuth();
  const ideas = await listIdeas();
  const statsMap = await getEngineRunStatsBatch(ideas.map((idea) => idea.id));
  const flatRuns = ideas.flatMap((idea) => statsMap.get(idea.id) ?? []);

  return {
    totalIdeas: ideas.length,
    liveCount: ideas.filter((idea) => idea.status === "live").length,
    approvedCount: ideas.filter((idea) => idea.status === "approved").length,
    blockedCount: ideas.filter((idea) => idea.status === "blocked").length,
    sentCount: ideas.filter((idea) => idea.status === "sent").length,
    submittedCount: ideas.filter((idea) => idea.status === "submitted").length,
    closedCount: ideas.filter((idea) => idea.status === "closed").length,
    totalCostUsd: flatRuns.reduce((sum, run) => sum + run.costUsd, 0),
    actionQueue: getOwnerActionQueue(ideas),
  };
});
