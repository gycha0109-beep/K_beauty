import assert from "node:assert/strict";
import {
  createVisionObservationPrompt,
  VISION_OBSERVATION_PROMPT_VERSION,
  VISION_OBSERVATION_SCHEMA_VERSION
} from "../lib/vision-observation-contract.js";
import {
  createFallbackVisionObservationBundle
} from "../lib/vision-observation-normalizer.js";
import {
  executeOpenAiChatJson
} from "../lib/server/openai-chat-runtime.js";
import {
  buildProviderRuntimeLogEvent
} from "../lib/provider-runtime-log.js";
import {
  OPENAI_RUNTIME_MODEL,
  OPENAI_RUNTIME_REASONING_EFFORT
} from "../lib/ai-model-policy.js";

const prompt = createVisionObservationPrompt();
assert.equal(typeof prompt, "string");
assert.ok(prompt.includes(VISION_OBSERVATION_SCHEMA_VERSION));
assert.ok(prompt.includes("Required JSON shape:"));
assert.ok(prompt.includes("Face rules:"));
assert.ok(prompt.includes("Eligibility rules:"));

const fallback = createFallbackVisionObservationBundle({
  provider: "openai",
  model: OPENAI_RUNTIME_MODEL
});

assert.equal(fallback.schemaVersion, VISION_OBSERVATION_SCHEMA_VERSION);
assert.equal(fallback.promptVersion, VISION_OBSERVATION_PROMPT_VERSION);
assert.equal(fallback.privacy.sourceImagePersisted, false);
assert.equal(fallback.privacy.rawProviderResponsePersisted, false);

const logEvent = buildProviderRuntimeLogEvent({
  stage: "vision-observation",
  status: 200,
  ok: true,
  provider: "openai",
  model: OPENAI_RUNTIME_MODEL,
  durationMs: 1
});

assert.equal(logEvent.model, OPENAI_RUNTIME_MODEL);
assert.equal(OPENAI_RUNTIME_REASONING_EFFORT, "none");
assert.equal(typeof executeOpenAiChatJson, "function");

console.log(JSON.stringify({
  ok: true,
  contract: "ai-provider-live-smoke-importability-v1",
  model: OPENAI_RUNTIME_MODEL,
  reasoningEffort: OPENAI_RUNTIME_REASONING_EFFORT,
  schemaVersion: VISION_OBSERVATION_SCHEMA_VERSION,
  promptVersion: VISION_OBSERVATION_PROMPT_VERSION
}, null, 2));
