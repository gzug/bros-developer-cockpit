// Server-only OpenRouter client. The engine routes a task to a tier; this module
// turns a tier into a concrete model call, with same-tier retry on transient
// errors. Tier ESCALATION (on parse/validation failure) is the engine's job.
//
// Model IDs are env-driven for engine tiers and JSON-driven for chat presets.
// Defaults are sane starting points, verify against
// https://openrouter.ai/models and set BDC_MODEL_TIER{0,1,2} to pin them.
import { validateModelId, validateModelParams, MAX_MAX_TOKENS_ENGINE } from "./model-presets";

export type Tier = "tier0" | "tier1" | "tier2";

export const TIER_ORDER: Tier[] = ["tier0", "tier1", "tier2"];

export function nextTier(t: Tier): Tier | null {
  const i = TIER_ORDER.indexOf(t);
  return i >= 0 && i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1] : null;
}

const DEFAULT_MODELS: Record<Tier, string> = {
  tier0: "google/gemini-2.5-flash",
  tier1: "anthropic/claude-sonnet-4",
  tier2: "anthropic/claude-opus-4.1",
};

export function modelForTier(t: Tier): string {
  const env = process.env[`BDC_MODEL_${t.toUpperCase()}`];
  return (env && env.trim()) || DEFAULT_MODELS[t];
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ModelResult = {
  content: string;
  modelRequested: string;
  modelServed: string;
  provider: string | null;
  tokensPrompt: number | null;
  tokensCompletion: number | null;
  costUsd: number | null;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Call one tier's model. Retries the SAME tier on 429/5xx (transient) with
 * backoff. Throws on non-transient errors or after exhausting retries, the
 * engine catches and decides whether to escalate a tier.
 */
export async function callModel(opts: {
  tier?: Tier;
  model?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseJson?: boolean;
  signal?: AbortSignal;
  retries?: number;
}): Promise<ModelResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");

  if (!opts.tier && !opts.model) throw new Error("Either tier or model is required.");
  // Chat/preset calls (opts.model) are untrusted client input — cap at the chat limit.
  // Engine tier calls (opts.tier) are trusted server config and use the higher engine
  // ceiling, so the code-editor step's 8192 passes (behaviour parity with pre-preset).
  const params = validateModelParams(
    {
      temperature: opts.temperature ?? (opts.model ? undefined : 0.2),
      maxTokens: opts.maxTokens ?? (opts.model ? undefined : 4096),
    },
    opts.model ? undefined : MAX_MAX_TOKENS_ENGINE,
  );
  const model = opts.model ? validateModelId(opts.model) : modelForTier(opts.tier!);
  const retries = opts.retries ?? 2;

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    // Ask OpenRouter to include real cost (USD) in the usage block, same number
    // the Activity page shows.
    usage: { include: true },
  };
  if (opts.responseJson) body.response_format = { type: "json_object" };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: opts.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          // OpenRouter attribution headers (optional but recommended).
          "HTTP-Referer": "https://github.com/gzug/bros-developer-cockpit",
          "X-Title": "Bros Developer Cockpit",
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
        if (attempt < retries) {
          await sleep(500 * Math.pow(2, attempt));
          continue;
        }
        throw lastErr;
      }
      if (!res.ok) {
        throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }

      const json = (await res.json()) as {
        model?: string;
        provider?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      if (!content) throw new Error("OpenRouter returned empty content");

      return {
        content,
        modelRequested: model,
        modelServed: json.model ?? model,
        provider: json.provider ?? null,
        tokensPrompt: json.usage?.prompt_tokens ?? null,
        tokensCompletion: json.usage?.completion_tokens ?? null,
        costUsd: typeof json.usage?.cost === "number" ? json.usage.cost : null,
      };
    } catch (e) {
      lastErr = e;
      // AbortError or non-transient: don't retry.
      if (e instanceof Error && e.name === "AbortError") throw e;
      if (attempt >= retries) throw e;
      await sleep(500 * Math.pow(2, attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
