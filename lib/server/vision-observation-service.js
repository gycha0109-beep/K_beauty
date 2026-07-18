import "server-only";

import {
  createVisionObservationPrompt,
  VISION_OBSERVATION_PROMPT_VERSION,
  VISION_OBSERVATION_SCHEMA_VERSION
} from "@/lib/vision-observation-contract";
import { normalizeVisionObservationBundle } from "@/lib/vision-observation-normalizer";
import { logProviderRuntimeEvent } from "@/lib/provider-runtime-log";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 2_200;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function extractTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => (item?.type === "text" ? item.text || "" : typeof item === "string" ? item : ""))
    .join("\n")
    .trim();
}

function parseJsonStrict(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("empty_response");
  }
  return JSON.parse(value);
}

function buildImageDataUrl(imageBuffer, mimeType) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("image_buffer_invalid");
  }
  const resolvedMime = ["image/jpeg", "image/png", "image/webp"].includes(mimeType)
    ? mimeType
    : "image/jpeg";
  return `data:${resolvedMime};base64,${imageBuffer.toString("base64")}`;
}

async function readBoundedResponse(response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("response_too_large");
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("response_too_large");
  }
  return text;
}

function logFailure({ response, model, startedAt, errorCategory }) {
  logProviderRuntimeEvent({
    stage: "vision-observation",
    status: response?.status ?? null,
    ok: false,
    provider: "openai",
    model,
    durationMs: Date.now() - startedAt,
    errorCategory
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
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("api_key_missing");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 10 * 60_000) {
    throw new Error("timeout_invalid");
  }
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 256 || maxTokens > 4_000) {
    throw new Error("max_tokens_invalid");
  }

  const prompt = createVisionObservationPrompt();
  const imageDataUrl = buildImageDataUrl(imageBuffer, mimeType);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  let response;
  let rawText;

  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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
      })
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      logFailure({ response, model, startedAt, errorCategory: "redirect_rejected" });
      throw new Error("provider_redirect_rejected");
    }

    rawText = await readBoundedResponse(response);
  } catch (error) {
    if (!["provider_redirect_rejected", "response_too_large"].includes(error?.message)) {
      logFailure({
        response,
        model,
        startedAt,
        errorCategory: error?.name === "AbortError" ? "timeout" : "request_failed"
      });
    } else if (error?.message === "response_too_large") {
      logFailure({ response, model, startedAt, errorCategory: "response_too_large" });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    logFailure({ response, model, startedAt, errorCategory: "http_error" });
    throw new Error(`provider_http_${response.status}`);
  }

  let providerPayload;
  let parsed;
  try {
    providerPayload = JSON.parse(rawText);
    parsed = parseJsonStrict(extractTextContent(providerPayload?.choices?.[0]?.message?.content));
  } catch {
    logFailure({ response, model, startedAt, errorCategory: "invalid_response" });
    throw new Error("provider_response_invalid");
  }

  const bundle = normalizeVisionObservationBundle(parsed, { provider: "openai", model });
  if (bundle.status !== "available") {
    logFailure({ response, model, startedAt, errorCategory: "contract_invalid" });
    throw new Error("vision_observation_contract_invalid");
  }

  logProviderRuntimeEvent({
    stage: "vision-observation",
    status: response.status,
    ok: true,
    provider: "openai",
    model,
    durationMs: Date.now() - startedAt
  });

  return {
    bundle,
    telemetry: {
      provider: "openai",
      model,
      imageProviderAttemptCount: 1,
      inputTokens: Number.isFinite(Number(providerPayload?.usage?.prompt_tokens))
        ? Number(providerPayload.usage.prompt_tokens)
        : null,
      outputTokens: Number.isFinite(Number(providerPayload?.usage?.completion_tokens))
        ? Number(providerPayload.usage.completion_tokens)
        : null,
      schemaVersion: VISION_OBSERVATION_SCHEMA_VERSION,
      promptVersion: VISION_OBSERVATION_PROMPT_VERSION
    }
  };
}
