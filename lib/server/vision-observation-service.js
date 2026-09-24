import "server-only";
import "@/lib/server/recommendation-candidate-admission-runtime";

import {
  createVisionObservationPrompt,
  VISION_OBSERVATION_PROMPT_VERSION,
  VISION_OBSERVATION_SCHEMA_VERSION
} from "@/lib/vision-observation-contract";
import { normalizeVisionObservationBundle } from "@/lib/vision-observation-normalizer";
import { logProviderRuntimeEvent } from "@/lib/provider-runtime-log";
import { executeOpenAiChatJson } from "@/lib/server/openai-chat-runtime";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 2_200;

function buildImageDataUrl(imageBuffer, mimeType) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("image_buffer_invalid");
  }

  const resolvedMime = ["image/jpeg", "image/png", "image/webp"].includes(mimeType)
    ? mimeType
    : "image/jpeg";

  return `data:${resolvedMime};base64,${imageBuffer.toString("base64")}`;
}

function safeTokenCount(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function logUsage({ model, inputTokens, outputTokens }) {
  console.info("[vision-observation-usage]", {
    provider: "openai",
    model,
    inputTokens,
    outputTokens,
    imageProviderAttemptCount: 1,
    schemaVersion: VISION_OBSERVATION_SCHEMA_VERSION,
    promptVersion: VISION_OBSERVATION_PROMPT_VERSION
  });
}

export async function analyzeVisionObservation({
  apiKey,
  imageBuffer,
  mimeType,
  model = DEFAULT_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxTokens = DEFAULT_MAX_TOKENS
} = {}) {
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 256 || maxTokens > 4_000) {
    throw new Error("max_tokens_invalid");
  }

  const prompt = createVisionObservationPrompt();
  const imageDataUrl = buildImageDataUrl(imageBuffer, mimeType);
  const runtime = await executeOpenAiChatJson({
    apiKey,
    stage: "vision-observation",
    timeoutMs,
    body: {
      model,
      max_tokens: maxTokens,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the canonical locale-neutral observation bundle from this image."
            },
            {
              type: "image_url",
              image_url: { url: imageDataUrl }
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

  if (bundle.status !== "available") {
    logProviderRuntimeEvent({
      stage: "vision-observation",
      status: runtime.status,
      ok: false,
      provider: "openai",
      model,
      durationMs: runtime.durationMs,
      errorCategory: "contract_invalid"
    });
    throw new Error("vision_observation_contract_invalid");
  }

  const inputTokens = safeTokenCount(runtime.providerPayload?.usage?.prompt_tokens);
  const outputTokens = safeTokenCount(runtime.providerPayload?.usage?.completion_tokens);

  logProviderRuntimeEvent({
    stage: "vision-observation",
    status: runtime.status,
    ok: true,
    provider: "openai",
    model,
    durationMs: runtime.durationMs
  });
  logUsage({ model, inputTokens, outputTokens });

  return {
    bundle,
    telemetry: {
      provider: "openai",
      model,
      imageProviderAttemptCount: 1,
      inputTokens,
      outputTokens,
      schemaVersion: VISION_OBSERVATION_SCHEMA_VERSION,
      promptVersion: VISION_OBSERVATION_PROMPT_VERSION
    }
  };
}
