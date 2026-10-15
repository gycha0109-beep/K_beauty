// S1-B nonproduction research: paired v1/v2 on ONE generated geometric NON-human PNG.
// No face photo, user data, filesystem, Provider response retention, database or production imports.
import { deflateSync } from "node:zlib";
import { executeOpenAiChatJson } from "../../../lib/server/openai-chat-runtime.js";
import { createVisionObservationPrompt } from "../../../lib/vision-observation-contract.js";
import {
  OPENAI_RUNTIME_MODEL,
  OPENAI_RUNTIME_REASONING_EFFORT,
  OPENAI_RUNTIME_IMAGE_DETAIL
} from "../../../lib/ai-model-policy.js";
import { createSkinVisionV2CandidatePrompt } from "./skin-vision-v2-candidate-core.mjs";
import { inspectSkinVisionTrial, summarizeSkinVisionTrials } from "./skin-vision-v2-provider-evidence-gate.mjs";
import { summarizeSkinVisionOperationalPairs } from "./skin-vision-v2-operational-metrics.mjs";

export const NONFACE_PAIR_VERSION = "face-lab-skin-key2-nonface-pair-v1";
const KEY_ENV = "OPENAI_API_KEY2";
const CASE_ID = "SYN_GEO_01";
const CAP = 2200;
const SIZE = 96;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const octet of buffer) {
    crc ^= octet;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, payload) {
  const label = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([label, payload])));
  return Buffer.concat([length, label, payload, checksum]);
}

/** Small, deterministic RGB grid, unambiguously NOT a human face. In-memory only. */
export function createNonfaceGeometricPng() {
  const width = SIZE;
  const height = SIZE;
  const scanlines = Buffer.alloc(height * (1 + 3 * width), 0);
  for (let y = 0; y < height; y++) {
    const row = y * (1 + 3 * width);
    scanlines[row] = 0; // PNG filter NONE
    for (let x = 0; x < width; x++) {
      const base = row + 1 + 3 * x;
      const cell = (Math.floor(x / 16) + Math.floor(y / 16)) % 3;
      const rgb = cell === 0 ? [218, 75, 60] : cell === 1 ? [48, 155, 108] : [42, 97, 205];
      scanlines[base] = rgb[0];
      scanlines[base + 1] = rgb[1];
      scanlines[base + 2] = rgb[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8bit
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
function selectedKey(env) {
  const value = env?.[KEY_ENV];
  if (typeof value !== "string" || !value.trim()) throw new Error("key2_not_injected");
  return value.trim(); // NEVER use OPENAI_API_KEY or alternate secrets.
}
function safeFailure(error) {
  const msg = error?.message;
  if (typeof msg === "string" && /^provider_http_(?:400|401|403|404|408|409|422|429|500|502|503|504)$/.test(msg)) {
    return msg;
  }
  if (["provider_response_invalid", "provider_response_empty", "provider_redirect_rejected", "response_too_large"].includes(msg)) {
    return msg;
  }
  return "provider_request_unavailable";
}
function requestBody(variant, imageUrl) {
  return {
    model: OPENAI_RUNTIME_MODEL,
    max_completion_tokens: CAP,
    reasoning_effort: OPENAI_RUNTIME_REASONING_EFFORT,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: variant === "v1" ? createVisionObservationPrompt() : createSkinVisionV2CandidatePrompt() },
      { role: "user", content: [
        { type: "text", text: "Extract the canonical locale-neutral observation bundle from this image." },
        { type: "image_url", image_url: { url: imageUrl, detail: OPENAI_RUNTIME_IMAGE_DETAIL } }
      ]}
    ]
  };
}
function operationalRow(variant, structuralResult, elapsedMs) {
  return {
    caseId: CASE_ID,
    variant,
    structuralResult,
    elapsedMs,
    estimatedCostMicroUsd: null,
    costSource: "unavailable"
  };
}

/** Two isolated research calls on the same generated non-face; no retries, persistence or recommendations. */
export async function runKey2NonfaceVisionPair({
  environment = process.env,
  invoke = executeOpenAiChatJson
} = {}) {
  const apiKey = selectedKey(environment); // Fail closed before image generation or network.
  const png = createNonfaceGeometricPng();
  const imageUrl = "data:image/png;base64," + png.toString("base64");
  const diagnostic = [];
  const inspected = [];
  const operational = [];
  let liveAttempts = 0;
  for (const variant of ["v1", "v2"]) {
    liveAttempts++;
    try {
      const response = await invoke({
        apiKey,
        body: requestBody(variant, imageUrl),
        stage: "vision-observation",
        timeoutMs: 120000,
        maxResponseBytes: 256 * 1024,
        logEvent: () => {} // Never log source, secret, raw responses or tokens content.
      });
      // Raw Provider envelope remains ephemeral; inspector returns bounded numeric / categorical metrics only.
      const metrics = inspectSkinVisionTrial({
        caseId: CASE_ID,
        variant,
        providerEnvelope: response.providerPayload
      });
      inspected.push(metrics);
      operational.push(operationalRow(variant, metrics.result,
        Number.isSafeInteger(response.durationMs) && response.durationMs >= 0
          ? response.durationMs : null));
      diagnostic.push({
        variant,
        outcome: "provider_json_parsed",
        responseComplete: metrics.responseComplete,
        finishReason: metrics.finishReason,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        nearTokenCap: metrics.nearTokenCap,
        structuralResult: metrics.result,
        faceStatus: metrics.faceStatus,
        faceAvailableFieldCount: metrics.faceAvailableFieldCount,
        skinStatus: metrics.skinStatus,
        skinAxisStates: metrics.skinAxisStates,
        problems: metrics.problems
      });
    } catch (error) {
      operational.push(operationalRow(variant, "INVALID_OR_INCOMPLETE", null));
      diagnostic.push({
        variant,
        outcome: "provider_request_or_json_failed",
        errorClass: safeFailure(error),
        structuralResult: "INVALID_OR_INCOMPLETE"
      });
      if (["provider_http_401", "provider_http_403"].includes(safeFailure(error))) {
        break; // Never spend another call after a credential rejection.
      }
    }
  }
  const paired = inspected.length === 2
    ? summarizeSkinVisionTrials(inspected, { evidenceOrigin: "operator_review_pending" })
    : null;
  const operationalSummary = summarizeSkinVisionOperationalPairs(operational, {
    evidenceOrigin: "operator_unverified"
  });
  return {
    version: NONFACE_PAIR_VERSION,
    model: OPENAI_RUNTIME_MODEL,
    credentialEnv: KEY_ENV,
    imageClass: "GENERATED_NONHUMAN_COLOR_GRID",
    imageDimensions: [SIZE, SIZE],
    completionTokenCapPerRequest: CAP,
    providerCallsAttempted: liveAttempts,
    variants: diagnostic,
    structuralPair: paired,
    timingsAndCostAvailability: operationalSummary,
    verdict: diagnostic.length === 2 &&
      diagnostic.every(d => d.outcome === "provider_json_parsed") &&
      diagnostic.every(d => d.finishReason === "stop")
        ? "NONFACE_PROVIDER_RESPONSE_CAPTURED_REVIEW_ONLY"
        : "NONFACE_PROVIDER_RESPONSE_INCOMPLETE",
    trustBoundary: {
      realHumanPhotoTransmitted: false,
      realFaceOrSkinAccuracyVerified: false,
      faceParityOnActualHumansVerified: false,
      sourceOrRawProviderResponsePersisted: false,
      billingCostsVerified: false,
      noProductionKeyFallback: true,
      productionProviderRequestsChanged: false,
      productionScoreRankingTopPickChanged: false,
      productReady: false,
      releaseReady: false
    }
  };
}
