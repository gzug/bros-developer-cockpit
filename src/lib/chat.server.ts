import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { validateChatModelOptions } from "./model-presets";
import { callModel } from "./openrouter.server";

type Intent = "wording" | "look" | "wrong" | "idea";

const InputSchema = z.object({
  intent: z.enum(["wording", "look", "wrong", "idea"]),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(2000),
    }),
  ),
  model: z.string().min(1),
  systemPrompt: z.string().min(1),
  params: z.object({
    temperature: z.number(),
    maxTokens: z.number(),
  }),
});

export type RefineIdeaInput = z.infer<typeof InputSchema>;

export function defaultSystemPrompt(intent: Intent): string {
  return `You are a friendly assistant inside Developer Cockpit. The user is not a developer and wants help turning a rough app feedback note into a clear, useful message. Keep every reply short, warm, and practical: 2 to 3 sentences max.

Category: ${intent}.
Adapt lightly by focus:

wording: focus on unclear text, tone, labels, or wording.
look: focus on layout, design, visibility, or what feels confusing on screen.
wrong: focus on what does not work, what happened, and what should have happened.
idea: focus on the suggested improvement and why it would help.
Rules:

Use simple English.
Ask at most one question only if something important is unclear.
Then give a clear improved version the user can approve.
Mark the improved version with this label exactly: Refined version:
The refined version should preserve the user's meaning, but make it clearer, more structured, and easier for an engineering workflow.
Do not use technical jargon unless truly helpful.
Do not lecture or correct.
If the user's wording is already clear, say so briefly and keep it close to their original.
If the user wants to keep their original text, respect that.`;
}

export async function refineIdeaChat(input: RefineIdeaInput): Promise<{ message: string }> {
  const options = validateChatModelOptions({
    model: input.model,
    systemPrompt: input.systemPrompt || defaultSystemPrompt(input.intent),
    params: input.params,
  });

  const result = await callModel({
    model: options.model,
    messages: [
      { role: "system", content: options.systemPrompt },
      ...input.messages,
    ],
    temperature: options.params.temperature,
    maxTokens: options.params.maxTokens,
  });

  const content = result.content.trim();
  if (!content) throw new Error("No response received.");
  return { message: content };
}

export const refineIdea = createServerFn({ method: "POST" })
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    return refineIdeaChat(data);
  });
