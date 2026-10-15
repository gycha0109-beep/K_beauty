// S1-B research-only one-request text smoke probe using the dedicated test key.
// No image, biometric data, survey, persisted response, retry, or production activation.
import { executeOpenAiChatJson } from "../../../lib/server/openai-chat-runtime.js";
import {
  OPENAI_RUNTIME_MODEL,
  OPENAI_RUNTIME_REASONING_EFFORT
} from "../../../lib/ai-model-policy.js";

export const KEY2_SMOKE_VERSION = "face-lab-skin-key2-smoke-v1";
export const KEY2_ENV_NAME = "OPENAI_API_KEY2";

function selectDedicatedTestKey(environment) {
  const key = environment?.[KEY2_ENV_NAME];
  if (typeof key !== "string" || !key.trim()) {
    throw new Error("dedicated_test_key2_unavailable");
  }
  // Never try OPENAI_API_KEY or another production credential.
  return key.trim();
}
function safeToken(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function safeFinish(value) {
  return ["stop", "length", "content_filter", "tool_calls"].includes(value) ? value : "unknown";
}
function smokeRequest() {
  return {
    model: OPENAI_RUNTIME_MODEL,
    reasoning_effort: OPENAI_RUNTIME_REASONING_EFFORT,
    max_completion_tokens: 256,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "This is a synthetic, text-only connectivity test. Reply only as JSON." },
      { role: "user", content: 'Return exactly this JSON object: {"probe":"synthetic_ok"}' }
    ]
  };
}

/**
 * A bounded one-shot smoke test. Never processes real or synthetic images.
 * fetchImpl is injected only for deterministic negative/success tests.
 */
export async function runKey2SyntheticSmoke({
  environment = process.env,
  fetchImpl = fetch
} = {}) {
  const apiKey = selectDedicatedTestKey(environment); // fail before any fetch
  const runtime = await executeOpenAiChatJson({
    apiKey,
    stage: "vision-observation",
    body: smokeRequest(),
    timeoutMs: 25_000,
    maxResponseBytes: 16 * 1024,
    fetchImpl,
    logEvent: () => {} // no process logs, even on provider failure
  });

  // Discard payload; emit only bounded summary values.
  const finishReason = safeFinish(runtime.providerPayload?.choices?.[0]?.finish_reason);
  const completionTokens = safeToken(runtime.providerPayload?.usage?.completion_tokens);
  const promptTokens = safeToken(runtime.providerPayload?.usage?.prompt_tokens);
  const responseMatched = runtime.parsed?.probe === "synthetic_ok" &&
    Object.keys(runtime.parsed || {}).length === 1;
  const passed = finishReason === "stop" && responseMatched && completionTokens !== null;

  return {
    version: KEY2_SMOKE_VERSION,
    keyEnvName: KEY2_ENV_NAME,
    result: passed ? "SYNTHETIC_TEXT_CONNECTIVITY_PASSED" : "SYNTHETIC_TEXT_CONNECTIVITY_INCOMPLETE",
    model: OPENAI_RUNTIME_MODEL,
    httpStatus: runtime.status === 200 ? 200 : null,
    requestCount: 1,
    elapsedMs: Number.isSafeInteger(runtime.durationMs) ? runtime.durationMs : null,
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    finishReason,
    outputContractMatched: responseMatched,
    inputType: "synthetic_text_only",
    actualSkinOrFacePhotoTested: false,
    realPhotoAccuracyCertified: false,
    externalFaceImageTransmitted: false,
    usedProductionApiKeyFallback: false,
    productionVisionAndRecommendationUnchanged: true,
    productReady: false,
    releaseReady: false
  };
}
