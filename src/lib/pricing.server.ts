// Server-only OpenRouter pricing lookup (USD per token), used by the owner KPI
// what-if routing comparison. The public /models endpoint needs no API key.
// Cached in memory for 1h; on fetch failure we serve the stale cache or null.

import { TIER_ORDER, modelForTier, type Tier } from "./openrouter.server";

export type ModelPricing = { prompt: number; completion: number };

export type TierPricing = Record<Tier, { model: string; pricing: ModelPricing } | null>;

const CACHE_TTL_MS = 60 * 60 * 1000;

let cache: { at: number; byModel: Record<string, ModelPricing> } | null = null;

async function loadPricing(): Promise<Record<string, ModelPricing> | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.byModel;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) return cache?.byModel ?? null;
    const json = (await res.json()) as {
      data?: Array<{ id?: string; pricing?: { prompt?: string; completion?: string } }>;
    };
    const byModel: Record<string, ModelPricing> = {};
    for (const m of json.data ?? []) {
      if (!m.id) continue;
      const prompt = Number(m.pricing?.prompt);
      const completion = Number(m.pricing?.completion);
      if (Number.isFinite(prompt) && Number.isFinite(completion)) {
        byModel[m.id] = { prompt, completion };
      }
    }
    cache = { at: Date.now(), byModel };
    return byModel;
  } catch {
    return cache?.byModel ?? null;
  }
}

/** Pricing for the three tier models as currently configured. */
export async function getTierPricing(): Promise<TierPricing | null> {
  const byModel = await loadPricing();
  if (!byModel) return null;
  const out = {} as TierPricing;
  for (const t of TIER_ORDER) {
    const model = modelForTier(t);
    out[t] = byModel[model] ? { model, pricing: byModel[model] } : null;
  }
  return out;
}
