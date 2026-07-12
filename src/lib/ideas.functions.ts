import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertAllowedEmail, getAllowedEmail } from "./allowlist.server";
import { findPullRequestByReqId } from "./github.server";
import { INTENT_LABEL, runSubmitContribution } from "./contribution.server";
import type { Database } from "@/integrations/supabase/types";

// ---------- login: request magic link (allowlist enforced server-side) ----------
// Always returns { ok: true } so the endpoint never reveals which email is
// allowed. The OTP is only actually dispatched when the submitted email
// matches ALLOWED_EMAIL.

const RequestLoginInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  redirectTo: z.string().url(),
});

export const requestLoginLink = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RequestLoginInput.parse(input))
  .handler(async ({ data }) => {
    try {
      if (data.email === getAllowedEmail()) {
        const supa = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        await supa.auth.signInWithOtp({
          email: data.email,
          options: { emailRedirectTo: data.redirectTo, shouldCreateUser: true },
        });
      }
    } catch {
      // swallow — response stays generic
    }
    return { ok: true as const };
  });

// ---------- schema ----------

const SubmitInput = z.object({
  intent: z.enum(["wording", "look", "wrong", "idea"]),
  screen: z.string().trim().min(1, "Bitte sag, wo in der App.").max(120),
  wrong: z.string().trim().min(3, "Ein Satz reicht.").max(1000),
  should: z.string().trim().min(3, "Ein Satz reicht.").max(1000),
  body: z.string().trim().max(2000).optional().default(""),
  force: z.boolean().optional().default(false),
});
export type SubmitInputT = z.infer<typeof SubmitInput>;

// ---------- submit ----------

export const submitContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAllowedEmail(context.claims as { email?: string | null });
    return runSubmitContribution(context.supabase, context.userId, data);
  });

// ---------- process: run the engine (OpenRouter -> PR) for one idea ----------
// Guarded: only the allow-listed user, only an idea still in 'generating'.
// Idempotent-ish: once it succeeds the status leaves 'generating', so a repeat
// call is a no-op.

export const processContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAllowedEmail(context.claims as { email?: string | null });
    const { data: idea, error } = await context.supabase
      .from("ideas")
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!idea) throw new Error("Nicht gefunden.");
    if (idea.status !== "generating") {
      return { started: false as const, status: idea.status };
    }
    const { processTask } = await import("./engine.server");
    const result = await processTask(data.id);
    return { started: true as const, result };
  });


// ---------- list ----------

export const listContributions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAllowedEmail(context.claims as { email?: string | null });
    const { data, error } = await context.supabase
      .from("ideas")
      .select(
        "id, title, intent, status, req_id, github_issue_url, github_pr_url, block_reason, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- usage (last 5h) ----------

export const usageLast5h = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAllowedEmail(context.claims as { email?: string | null });
    const since = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    const { count, error } = await context.supabase
      .from("ideas")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "reviewing", "live", "reverted"])
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    return { count: count ?? 0, windowHours: 5 };
  });

// ---------- get one (+ refresh status from GitHub) ----------

const IdInput = z.object({ id: z.string().uuid() });

export const getContribution = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAllowedEmail(context.claims as { email?: string | null });
    const { data: idea, error } = await context.supabase
      .from("ideas")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!idea) throw new Error("Nicht gefunden.");
    return idea;
  });

export const refreshContributionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAllowedEmail(context.claims as { email?: string | null });
    const { supabase } = context;
    const { data: idea, error } = await supabase
      .from("ideas")
      .select("id, status, req_id, github_pr_url, github_pr_number")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!idea || !idea.req_id) return { changed: false };

    const pr = await findPullRequestByReqId(idea.req_id);
    if (!pr) {
      await supabase.from("ideas").update({ last_polled_at: new Date().toISOString() }).eq("id", idea.id);
      return { changed: false };
    }

    let nextStatus: Database["public"]["Enums"]["idea_status"] = "reviewing";
    if (pr.merged) nextStatus = "live";
    else if (pr.state === "closed") nextStatus = "reverted";

    const changed =
      idea.status !== nextStatus ||
      idea.github_pr_number !== pr.number ||
      idea.github_pr_url !== pr.html_url;

    if (changed) {
      await supabase
        .from("ideas")
        .update({
          status: nextStatus,
          github_pr_number: pr.number,
          github_pr_url: pr.html_url,
          last_polled_at: new Date().toISOString(),
        })
        .eq("id", idea.id);
    } else {
      await supabase.from("ideas").update({ last_polled_at: new Date().toISOString() }).eq("id", idea.id);
    }
    return { changed, status: nextStatus, prUrl: pr.html_url };
  });

// Convenience re-export for UI labels.
export const INTENT_LABELS = INTENT_LABEL;
