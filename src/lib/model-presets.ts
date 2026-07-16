import modelsConfig from "@/config/models.json";
import presetsConfig from "@/config/presets.json";

export type CostClass = "free" | "cheap" | "medium" | "higher";

export type ModelConfig = {
  id: string;
  label: string;
  provider: string;
  strength: string;
  costClass: CostClass;
};

export type ModelParams = {
  temperature: number;
  maxTokens: number;
};

export type PresetConfig = {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  params: ModelParams;
};

export type ChatModelOptions = {
  model: string;
  systemPrompt: string;
  params: ModelParams;
};

const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const MIN_MAX_TOKENS = 64;
const MAX_MAX_TOKENS = 4096;
// Trusted engine tier calls are server-controlled (not client input) and may exceed the
// chat/preset cap — the code-editor step (engine.server.ts) runs at 8192.
export const MAX_MAX_TOKENS_ENGINE = 8192;
const MAX_SYSTEM_PROMPT_LENGTH = 4000;

export const curatedModels = modelsConfig as ModelConfig[];
export const shippedPresets = presetsConfig as PresetConfig[];

const modelIds = new Set(curatedModels.map((model) => model.id));

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a number.`);
}

export function isAllowedModelId(model: string): boolean {
  return modelIds.has(model);
}

export function validateModelId(model: string): string {
  const value = model.trim();
  if (!isAllowedModelId(value)) {
    throw new Error(`Unknown model id: ${value || "empty"}. Choose a model from the curated list.`);
  }
  return value;
}

export function validateModelParams(
  params: Partial<ModelParams> | undefined,
  maxTokensCeiling: number = MAX_MAX_TOKENS,
): ModelParams {
  const temperature = params?.temperature ?? 0.4;
  const maxTokens = params?.maxTokens ?? 300;
  assertFiniteNumber(temperature, "Temperature");
  assertFiniteNumber(maxTokens, "Max tokens");
  if (temperature < MIN_TEMPERATURE || temperature > MAX_TEMPERATURE) {
    throw new Error(`Temperature must be between ${MIN_TEMPERATURE} and ${MAX_TEMPERATURE}.`);
  }
  if (!Number.isInteger(maxTokens) || maxTokens < MIN_MAX_TOKENS || maxTokens > maxTokensCeiling) {
    throw new Error(`Max tokens must be an integer between ${MIN_MAX_TOKENS} and ${maxTokensCeiling}.`);
  }
  return { temperature, maxTokens };
}

export function validateSystemPrompt(systemPrompt: string): string {
  const value = systemPrompt.trim();
  if (value.length < 20) throw new Error("System prompt must be at least 20 characters.");
  if (value.length > MAX_SYSTEM_PROMPT_LENGTH) {
    throw new Error(`System prompt must be ${MAX_SYSTEM_PROMPT_LENGTH} characters or less.`);
  }
  return value;
}

export function validateChatModelOptions(options: ChatModelOptions): ChatModelOptions {
  return {
    model: validateModelId(options.model),
    systemPrompt: validateSystemPrompt(options.systemPrompt),
    params: validateModelParams(options.params),
  };
}

export function validatePresetConfig(preset: PresetConfig): PresetConfig {
  const name = preset.name.trim();
  if (name.length < 1 || name.length > 60) throw new Error("Preset name must be 1 to 60 characters.");
  return {
    id: preset.id.trim(),
    name,
    ...validateChatModelOptions({
      model: preset.model,
      systemPrompt: preset.systemPrompt,
      params: preset.params,
    }),
  };
}
