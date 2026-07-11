import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { runSubmitContribution } from "@/lib/contribution.server";

function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "submit_contribution",
  title: "Submit contribution",
  description:
    "File a new change request for the One-L1fe app. Runs the same guardrails as the web form; on pass, opens a GitHub issue that mentions @codex. On block, saves as a private note.",
  inputSchema: {
    intent: z
      .enum(["wording", "look", "wrong", "idea"])
      .describe("wording=text change, look=visual, wrong=bug, idea=new."),
    screen: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .describe("Where in the app (route/screen name or short description)."),
    wrong: z
      .string()
      .trim()
      .min(3)
      .max(1000)
      .describe("What currently does not fit."),
    should: z
      .string()
      .trim()
      .min(3)
      .max(1000)
      .describe("What should happen instead."),
    body: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .describe("Optional extra context; sanitized before it hits GitHub."),
    force: z
      .boolean()
      .optional()
      .describe(
        "If true, bypass a soft guardrail block (still refuses destructive input).",
      ),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    }
    const userId = ctx.getUserId();
    if (!userId) {
      return {
        content: [{ type: "text", text: "Missing user id in token" }],
        isError: true,
      };
    }
    try {
      const result = await runSubmitContribution(
        supabaseForUser(ctx),
        userId,
        {
          intent: input.intent,
          screen: input.screen,
          wrong: input.wrong,
          should: input.should,
          body: input.body,
          force: input.force,
        },
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      };
    } catch (e) {
      return {
        content: [
          { type: "text", text: e instanceof Error ? e.message : String(e) },
        ],
        isError: true,
      };
    }
  },
});
