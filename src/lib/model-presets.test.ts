import { expect, test } from "bun:test";
import {
  shippedPresets,
  validateChatModelOptions,
  validateModelId,
  validateModelParams,
  validatePresetConfig,
} from "./model-presets";

test("unknown curated model ids are rejected", () => {
  expect(() => validateModelId("not-a-real/model")).toThrow("Unknown model id");
});

test("all shipped presets validate against curated models and parameter bounds", () => {
  for (const preset of shippedPresets) {
    expect(validatePresetConfig(preset)).toMatchObject({
      id: preset.id,
      model: preset.model,
      params: preset.params,
    });
  }
});

test("chat model options round-trip model, system prompt, and params", () => {
  const options = validateChatModelOptions({
    model: "google/gemini-2.5-flash",
    systemPrompt: "This is a valid custom system prompt for a user preset.",
    params: { temperature: 0.7, maxTokens: 512 },
  });

  expect(options).toEqual({
    model: "google/gemini-2.5-flash",
    systemPrompt: "This is a valid custom system prompt for a user preset.",
    params: { temperature: 0.7, maxTokens: 512 },
  });
});

test("model params are bounded server-side", () => {
  expect(() => validateModelParams({ temperature: 2.1, maxTokens: 512 })).toThrow("Temperature");
  expect(() => validateModelParams({ temperature: 0.4, maxTokens: 32 })).toThrow("Max tokens");
});
