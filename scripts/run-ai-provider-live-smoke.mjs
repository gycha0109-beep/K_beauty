import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  executeOpenAiChatJson
} from "../lib/server/openai-chat-runtime.js";
import {
  createVisionObservationPrompt,
  VISION_OBSERVATION_PROMPT_VERSION,
  VISION_OBSERVATION_SCHEMA_VERSION
} from "../lib/vision-observation-contract.js";
import { normalizeVisionObservationBundle } from "../lib/vision-observation-normalizer.js";
import { logProviderRuntimeEvent } from "../lib/provider-runtime-log.js";

const apiKey = process.env.OPENAI_API_KEY || "";
assert.ok(apiKey, "OPENAI_API_KEY is required for the explicit live-provider smoke");

const model = process.env.AI_PROVIDER_SMOKE_MODEL || "gpt-4o-mini";
const fixturePath = new URL(
  "../apps/mobile/assets/store/bejewely-google-play-feature-graphic-1024x500.png",
  import.meta.url
);
const imageBuffer = await readFile(fixturePath);
assert.ok(imageBuffer.length > 0 && imageBuffer.length < 256 * 1024, "live smoke fixture must remain small and bounded");

const prompt = createVisionObservationPrompt();
const runtime = await executeOpenAiChatJson({
  apiKey,
  stage: "vision-observation",
  timeoutMs: 60_000,
  body: {
    model,
    max_tokens: 2_200,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: prompt
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract the canonical locale-neutral observation bundle from this fixed non-user CI fixture."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageBuffer.toString("base64")}`
            }
          }
        ]
      }
    ]
  }
});

const bundle = normalizeVisionObservationBundle(runtime.parsed, {
  provider: "openai",
  model
});

assert.equal(bundle.schemaVersion, VISION_OBSERVATION_SCHEMA_VERSION);
assert.equal(bundle.promptVersion, VISION_OBSERVATION_PROMPT_VERSION);
assert.equal(bundle.status, "available");
assert.equal(bundle.eligibility.source, "vision");
assert.equal(bundle.privacy.sourceImagePersisted, false);
assert.equal(bundle.privacy.rawProviderResponsePersisted, false);
assert.equal(bundle.eligibility.faceLabEligible, false, "non-user store graphic must not become Face Lab eligible");
assert.equal(bundle.eligibility.skinAnalysisEligible, false, "non-user store graphic must not become skin-analysis eligible");

logProviderRuntimeEvent({
  stage: "vision-observation",
  status: runtime.status,
  ok: true,
  provider: "openai",
  model,
  durationMs: runtime.durationMs
});

console.log(JSON.stringify({
  status: "PASS",
  contract: "ai-provider-runtime-live-vision-smoke-v1",
  schemaVersion: bundle.schemaVersion,
  promptVersion: bundle.promptVersion,
  imageType: bundle.eligibility.imageType,
  faceLabEligible: bundle.eligibility.faceLabEligible,
  skinAnalysisEligible: bundle.eligibility.skinAnalysisEligible,
  persisted: false
}));
