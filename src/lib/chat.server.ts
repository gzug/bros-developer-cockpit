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
  return `Du hilfst dem Benutzer seine Idee fuer eine App-Verbesserung klar zu formulieren.
Kategorie: ${intent}.
Regeln:
- Antworte auf Deutsch, kurz und freundlich (2-3 Saetze)
- Frag hoechstens EINE Rueckfrage
- Formuliere dann einen klaren Vorschlag, markiert mit [VORSCHLAG]
- Keine technischen Begriffe (Component, State, API sind verboten)
- Nicht belehren, nur helfen zu praezisieren`;
}

export const refineIdea = createServerFn({ method: "POST" })
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-session.server");
    requireAuth();
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY fehlt.");

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
    if (!content) throw new Error("Keine Antwort erhalten.");
    return { message: content };
  });
