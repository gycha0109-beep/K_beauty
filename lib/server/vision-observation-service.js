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
import {
  OPENAI_RUNTIME_IMAGE_DETAIL,
  OPENAI_RUNTIME_MODEL,
  OPENAI_RUNTIME_REASONING_EFFORT
} from "@/lib/ai-model-policy";
import { createOpenAiUsageTelemetry } from "@/lib/ai-usage-cost";
import { executeVisionProviderWithRetry } from "@/lib/vision-observation-retry-core";

const DEFAULT_MODEL = OPENAI_RUNTIME_MODEL;
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

function logUsage({ model, inputTokens, outputTokens, imageDetail, attemptCount }) {
  const usage = createOpenAiUsageTelemetry({
    model,
    inputTokens,
    outputTokens,
    imageDetail
  });

  console.info("[vision-observation-usage]", {
    event: "vision_observation_usage",
    provider: "openai",
    model,
    usageDayUtc: usage.usageDayUtc,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    imageDetail: usage.imageDetail,
    pricingVersion: usage.pricingVersion,
    estimatedCostNanoUsd: usage.estimatedCostNanoUsd,
    estimatedCostUsd: usage.estimatedCostUsd,
    imageProviderAttemptCount: attemptCount,
    schemaVersion: VISION_OBSERVATION_SCHEMA_VERSION,
    promptVersion: VISION_OBSERVATION_PROMPT_VERSION
  });

  return usage;
}

export async function analyzeVisionObservation({
  apiKey,
  imageBuffer,
  mimeType,
  model = DEFAULT_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxTokens = DEFAULT_MAX_TOKENS,
  imageDetail = OPENAI_RUNTIME_IMAGE_DETAIL
} = {}) {
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 256 || maxTokens > 4_000) {
    throw new Error("max_tokens_invalid");
  }
  if (!["low", "high", "original", "auto"].includes(imageDetail)) {
    throw new Error("image_detail_invalid");
  }

  const prompt = createVisionObservationPrompt();
  const imageDataUrl = buildImageDataUrl(imageBuffer, mimeType);
  const {
    runtime,
    attemptCount
  } =
    await executeVisionProviderWithRetry({
      run: () =>
        executeOpenAiChatJson({
          apiKey,
          stage: "vision-observation",
          timeoutMs,
          body: {
            model,
            max_completion_tokens: maxTokens,
            reasoning_effort: OPENAI_RUNTIME_REASONING_EFFORT,
            temperature: 0,
            response_format: {
              type: "json_object"
            },
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
                    text:
                      "Extract the canonical locale-neutral observation bundle from this image."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: imageDataUrl,
                      detail:
                        imageDetail
                    }
                  }
                ]
              }
            ]
          }
        })
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
  const usage = logUsage({
    model,
    inputTokens,
    outputTokens,
    imageDetail,
    attemptCount
  });

  return {
    bundle,
    telemetry: {
      provider: "openai",
      model,
      imageProviderAttemptCount:
        attemptCount,
      inputTokens,
      outputTokens,
      imageDetail: usage.imageDetail,
      usageDayUtc: usage.usageDayUtc,
      pricingVersion: usage.pricingVersion,
      estimatedCostNanoUsd: usage.estimatedCostNanoUsd,
      estimatedCostUsd: usage.estimatedCostUsd,
      schemaVersion: VISION_OBSERVATION_SCHEMA_VERSION,
      promptVersion: VISION_OBSERVATION_PROMPT_VERSION
    }
  };
}
