import { afterEach, expect, test } from "bun:test";
import { callModel } from "./openrouter.server";

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

test("callModel rejects a model id outside models.json before fetch", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("fetch should not run");
  }) as typeof fetch;

  await expect(
    callModel({
      model: "not-a-real/model",
      messages: [{ role: "user", content: "Hello" }],
      retries: 0,
    }),
  ).rejects.toThrow("Unknown model id");
  expect(called).toBe(false);
});

test("callModel sends validated preset model and params to OpenRouter", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  let body: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        model: "google/gemini-2.5-flash",
        provider: "Google",
        choices: [{ message: { content: "Refined version: Clear text" } }],
        usage: { prompt_tokens: 10, completion_tokens: 4, cost: 0.0001 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const result = await callModel({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: "This is a valid custom system prompt for a user preset." },
      { role: "user", content: "Make this clearer" },
    ],
    temperature: 0.7,
    maxTokens: 512,
    retries: 0,
  });

  expect(body?.model).toBe("google/gemini-2.5-flash");
  expect(body?.temperature).toBe(0.7);
  expect(body?.max_tokens).toBe(512);
  expect(result.content).toBe("Refined version: Clear text");
});

test("callModel keeps legacy tier defaults for engine calls", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  let body: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        model: "google/gemini-2.5-flash",
        choices: [{ message: { content: "ok" } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  await callModel({
    tier: "tier0",
    messages: [{ role: "user", content: "Run engine task" }],
    retries: 0,
  });

  expect(body?.temperature).toBe(0.2);
  expect(body?.max_tokens).toBe(4096);
});

test("callModel allows the engine editor's 8192 maxTokens on the tier path", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  let body: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({ model: "google/gemini-2.5-flash", choices: [{ message: { content: "ok" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  await callModel({
    tier: "tier0",
    messages: [{ role: "user", content: "Run editor" }],
    maxTokens: 8192,
    retries: 0,
  });

  expect(body?.max_tokens).toBe(8192);
});

test("callModel still caps chat/preset maxTokens at the chat limit", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("fetch should not run");
  }) as typeof fetch;

  await expect(
    callModel({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 8192,
      retries: 0,
    }),
  ).rejects.toThrow("Max tokens");
  expect(called).toBe(false);
});
