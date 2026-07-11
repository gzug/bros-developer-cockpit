// Server-only helpers shared by the TanStack server functions and the
// MCP tool handlers. Never import from client-reachable modules at module scope.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { checkGuardrails, sanitizeForFence } from "./guardrails.server";
import { createIssue } from "./github.server";

type Intent = Database["public"]["Enums"]["contribution_intent"];

export const INTENT_LABEL: Record<Intent, string> = {
  wording: "Wording ändern",
  look: "Aussehen ändern",
  wrong: "Etwas ist kaputt",
  idea: "Neue Idee",
};

export function shortReqId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  for (const b of buf) s += alphabet[b % alphabet.length];
  return `REQ-${s}`;
}

function randomBoundary(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return (
    "USER-NOTE-" +
    Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

export function buildBrief(input: {
  reqId: string;
  intent: Intent;
  screen: string;
  wrong: string;
  should: string;
  body: string;
}): { title: string; body: string } {
  const boundary = randomBoundary();
  const safeNote = sanitizeForFence(input.body ?? "", boundary).trim();

  const title =
    `${input.reqId}: ${INTENT_LABEL[input.intent]} — ${input.screen}`.slice(
      0,
      200,
    );

  const md = [
    `### ${input.reqId}`,
    `**Intent:** ${INTENT_LABEL[input.intent]}`,
    ``,
    `**Wo in der App**`,
    input.screen,
    ``,
    `**Was aktuell nicht passt**`,
    input.wrong,
    ``,
    `**Was stattdessen passieren soll**`,
    input.should,
    ``,
    ...(safeNote
      ? [
          `**Zusatz (rohtext des Users, sanitized)**`,
          "```text " + boundary,
          safeNote,
          boundary + " ```",
          ``,
        ]
      : []),
    `---`,
    `**Rules for the implementing agent**`,
    `- Do NOT touch health data, storage layer, or auth.`,
    `- Do NOT target \`main\` directly — open a Pull Request against the default branch.`,
    `- Include the token \`${input.reqId}\` in the PR title or body so status tracking finds it.`,
    ``,
    `@codex please implement this in a fresh branch and open a PR referencing ${input.reqId}.`,
  ].join("\n");

  return { title, body: md };
}

export type SubmitInputData = {
  intent: Intent;
  screen: string;
  wrong: string;
  should: string;
  body?: string;
  force?: boolean;
};

export type SubmitResult =
  | {
      id: string;
      blocked: true;
      kind: "destructive" | "scope" | "reask";
      message: string;
    }
  | {
      id: string;
      blocked: false;
      issueUrl: string | null;
      reqId: string;
      sendError?: string;
    };

export async function runSubmitContribution(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: SubmitInputData,
): Promise<SubmitResult> {
  const guard = checkGuardrails({
    title: input.screen,
    screen: input.screen,
    wrong: input.wrong,
    should: input.should,
    body: input.body ?? "",
  });

  const reqId = shortReqId();
  const displayTitle =
    `${INTENT_LABEL[input.intent]} — ${input.screen}`.slice(0, 120);

  if (!guard.ok && !input.force) {
    const { data: saved, error } = await supabase
      .from("ideas")
      .insert({
        user_id: userId,
        intent: input.intent,
        screen: input.screen,
        wrong: input.wrong,
        should: input.should,
        body: input.body ?? "",
        title: displayTitle,
        status: "saved",
        req_id: reqId,
        block_reason: guard.message,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: saved.id,
      blocked: true,
      kind: guard.kind,
      message: guard.message,
    };
  }

  const { data: created, error: insErr } = await supabase
    .from("ideas")
    .insert({
      user_id: userId,
      intent: input.intent,
      screen: input.screen,
      wrong: input.wrong,
      should: input.should,
      body: input.body ?? "",
      title: displayTitle,
      status: "draft",
      req_id: reqId,
      block_reason: !guard.ok ? guard.message : null,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  const brief = buildBrief({
    reqId,
    intent: input.intent,
    screen: input.screen,
    wrong: input.wrong,
    should: input.should,
    body: input.body ?? "",
  });

  try {
    const issue = await createIssue(brief);
    await supabase
      .from("ideas")
      .update({
        status: "sent",
        github_issue_number: issue.number,
        github_issue_url: issue.html_url,
      })
      .eq("id", created.id);
    return {
      id: created.id,
      blocked: false,
      issueUrl: issue.html_url,
      reqId,
    };
  } catch (e) {
    await supabase
      .from("ideas")
      .update({
        status: "saved",
        error_message: e instanceof Error ? e.message : String(e),
      })
      .eq("id", created.id);
    return {
      id: created.id,
      blocked: false,
      issueUrl: null,
      reqId,
      sendError: e instanceof Error ? e.message : String(e),
    };
  }
}
