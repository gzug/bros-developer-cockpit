import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Intent = "wording" | "look" | "wrong" | "idea";

const InputSchema = z.object({
  intent: z.enum(["wording", "look", "wrong", "idea"]),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(2000),
    }),
  ),
});

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function systemPrompt(intent: Intent): string {
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

export const refineIdea = createServerFn({ method: "POST" })
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY is missing.");

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/gzug/bros-developer-cockpit",
        "X-Title": "Bros Developer Cockpit",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt(data.intent) },
          ...data.messages,
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter ${res.status}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("No response received.");
    return { message: content };
  });
