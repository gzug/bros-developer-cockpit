// Server-only submit helper. Runs Layer-1 guardrails, then records the idea.
// The heavy engine work (OpenRouter -> PR) runs separately in engine.server.ts
// via processContribution, so the submit request stays fast.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { checkGuardrails } from "./guardrails.server";

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
      reqId: string;
      status: "generating";
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
  const displayTitle = `${INTENT_LABEL[input.intent]} — ${input.screen}`.slice(0, 120);

  // Blocked by a Layer-1 brake and not overridden -> save it, never lose it.
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
    return { id: saved.id, blocked: true, kind: guard.kind, message: guard.message };
  }

  // Accepted -> record as 'generating'. The engine picks it up next.
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
      status: "generating",
      req_id: reqId,
      block_reason: !guard.ok ? guard.message : null,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  return { id: created.id, blocked: false, reqId, status: "generating" };
}
