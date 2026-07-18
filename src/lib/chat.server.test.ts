import { afterEach, expect, test } from "bun:test";
import { refineIdeaChat } from "./chat.server";

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENROUTER_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey == null) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalKey;
  }
});

test("refineIdeaChat round-trips preset model, system prompt, and params into the server call", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  let body: { model?: string; messages?: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number } | null = null;
  globalThis.fetch = (async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        model: "openai/gpt-5-mini",
        choices: [{ message: { content: "Refined version: Better text" } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const systemPrompt = "This is a valid custom system prompt for a user preset.";
  const result = await refineIdeaChat({
    intent: "idea",
    messages: [{ role: "user", content: "better button please" }],
    model: "openai/gpt-5-mini",
    systemPrompt,
    params: { temperature: 0.6, maxTokens: 700 },
  });

  expect(result.message).toBe("Refined version: Better text");
  expect(body?.model).toBe("openai/gpt-5-mini");
  expect(body?.temperature).toBe(0.6);
  expect(body?.max_tokens).toBe(700);
  expect(body?.messages?.[0]?.role).toBe("system");
  expect(String(body?.messages?.[0]?.content ?? "")).toContain(systemPrompt);
  expect(String(body?.messages?.[0]?.content ?? "")).toContain("Don is the main developer");
});
