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
  const env = process.env[`BDC_MODEL_${t.toUpperCase()}`]?.trim();
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
const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const MIN_REQUEST_TIMEOUT_MS = 1_000;
const MAX_REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_RETRIES = 1;
const MAX_RETRIES = 2;

class OpenRouterHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OpenRouterHttpError";
  }
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("OpenRouter request aborted.");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortReason(signal));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal ? abortReason(signal) : new Error("OpenRouter backoff aborted."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function normalizeModelRequestTimeout(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_REQUEST_TIMEOUT_MS;
  return Math.min(
    MAX_REQUEST_TIMEOUT_MS,
    Math.max(MIN_REQUEST_TIMEOUT_MS, Math.trunc(value as number)),
  );
}

export function normalizeModelRetries(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RETRIES;
  return Math.min(MAX_RETRIES, Math.max(0, Math.trunc(value as number)));
}

export function isTransientOpenRouterStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function openRouterErrorMessage(status: number, detail: string): string {
  if (status === 401) {
    return "OpenRouter rejected the API key. Check OPENROUTER_API_KEY.";
  }
  if (status === 402) {
    return "OpenRouter credits or model access are unavailable for this account.";
  }
  if (status === 403) {
    return "OpenRouter blocked this model or request for the current account.";
  }
  const normalized = detail.replace(/\s+/g, " ").trim();
  return `OpenRouter ${status}: ${normalized.slice(0, isTransientOpenRouterStatus(status) ? 200 : 300)}`;
}

function isRetryableTransportError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
  );
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
  requestTimeoutMs?: number;
}): Promise<ModelResult> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
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
  const retries = normalizeModelRetries(opts.retries);
  const requestTimeoutMs = normalizeModelRequestTimeout(opts.requestTimeoutMs);

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
  // Chat/preset calls run with small token budgets (a few hundred). Reasoning models
  // (e.g. GPT-5 Mini) otherwise spend the whole budget on hidden reasoning and return
  // empty content. Engine tier calls keep the provider default.
  if (opts.model) body.reasoning = { enabled: false };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (opts.signal?.aborted) throw abortReason(opts.signal);
      const requestSignal = AbortSignal.timeout(requestTimeoutMs);
      const signal = opts.signal ? AbortSignal.any([opts.signal, requestSignal]) : requestSignal;
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          // OpenRouter attribution headers (optional but recommended).
          "HTTP-Referer": "https://github.com/gzug/bros-developer-cockpit",
          "X-Title": "Bros Developer Cockpit",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new OpenRouterHttpError(
          res.status,
          openRouterErrorMessage(res.status, detail),
        );
      }

      const json = (await res.json()) as {
        model?: string;
        provider?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      if (!content) {
        throw new Error(
          "The model returned no text. It may have spent all tokens on internal reasoning. Raise Max tokens or pick another model.",
        );
      }

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
      if (opts.signal?.aborted) throw abortReason(opts.signal);
      const retryable =
        (e instanceof OpenRouterHttpError && isTransientOpenRouterStatus(e.status)) ||
        isRetryableTransportError(e);
      if (!retryable || attempt >= retries) throw e;
      await sleep(500 * Math.pow(2, attempt), opts.signal);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
