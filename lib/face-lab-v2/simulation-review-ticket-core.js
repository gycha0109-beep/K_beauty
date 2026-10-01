import {
  createHmac,
  randomUUID
} from "node:crypto";
import {
  hashFaceLabAuthorityImage,
  hashFaceLabAuthorityValue
} from "./simulation-authority-core.js";
import {
  FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION
} from "./simulation-provider-config.js";
export const FACE_LAB_SIMULATION_REVIEW_TICKET_VERSION =
  "face-lab-simulation-review-ticket-v1";
export const FACE_LAB_SIMULATION_REVIEW_TICKET_TTL_MS =
  30 * 60 * 1000;

const MAX_TOKEN_LENGTH = 4096;
const MAX_CLOCK_SKEW_MS = 60 * 1000;
const HEX_64 = /^[a-f0-9]{64}$/i;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeId(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return ID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeHash(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return HEX_64.test(normalized) ? normalized.toLowerCase() : null;
}

function localeValue(locale) {
  return locale === "en" ? "en" : "ko";
}

function hmac(secret, purpose, value) {
  return createHmac("sha256", secret)
    .update(
      purpose + "\n" + value
    )
    .digest("hex");
}

function opaqueRef(secret, purpose, value) {
  return hmac(
    secret,
    purpose,
    value
  );
}

function ticketSignature(secret, encodedPayload) {
  return hmac(
    secret,
    "face-lab-simulation-review-ticket",
    encodedPayload
  );
}

function invalid(code) {
  return { ok: false, code };
}

export function issueFaceLabSimulationReviewTicket({
  secret,
  sourceImageBuffer,
  outputImageBuffer,
  analysis,
  faceLabV2State,
  locale = "ko",
  renderSpecSha256,
  routeId,
  lookId,
  simulationVersion,
  instructionVersion,
  providerConfigVersion,
  providerConfigFingerprint,
  caseId = null,
  nowMs = Date.now(),
  ttlMs = FACE_LAB_SIMULATION_REVIEW_TICKET_TTL_MS
} = {}) {
  const resolvedCaseId =
    normalizeId(caseId || "face-lab-review:" + randomUUID());
  const renderDigest = normalizeHash(renderSpecSha256);
  const normalizedRouteId = normalizeId(routeId);
  const normalizedLookId = normalizeId(lookId);
  const normalizedSimulationVersion = normalizeId(simulationVersion);
  const normalizedInstructionVersion = normalizeId(instructionVersion);
  const normalizedProviderConfigVersion =
    normalizeId(providerConfigVersion);
  const normalizedProviderConfigFingerprint =
    normalizeHash(providerConfigFingerprint);

  if (
    typeof secret !== "string" ||
    !secret.trim() ||
    !Buffer.isBuffer(sourceImageBuffer) ||
    !sourceImageBuffer.length ||
    !Buffer.isBuffer(outputImageBuffer) ||
    !outputImageBuffer.length ||
    !isObject(analysis) ||
    !isObject(faceLabV2State) ||
    !resolvedCaseId ||
    !renderDigest ||
    !normalizedRouteId ||
    !normalizedLookId ||
    !normalizedSimulationVersion ||
    !normalizedInstructionVersion ||
    normalizedProviderConfigVersion !==
      FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION ||
    !normalizedProviderConfigFingerprint ||
    !Number.isSafeInteger(nowMs) ||
    !Number.isSafeInteger(ttlMs) ||
    ttlMs <= 0 ||
    ttlMs > 2 * 60 * 60 * 1000
  ) {
    return null;
  }

  const sourceHash = hashFaceLabAuthorityImage(sourceImageBuffer);
  const outputHash = hashFaceLabAuthorityImage(outputImageBuffer);
  const analysisHash = hashFaceLabAuthorityValue(analysis);
  const stateHash = hashFaceLabAuthorityValue(faceLabV2State);

  if (!sourceHash || !outputHash || !analysisHash || !stateHash) {
    return null;
  }

  const payload = {
    version: FACE_LAB_SIMULATION_REVIEW_TICKET_VERSION,
    caseId: resolvedCaseId,
    locale: localeValue(locale),
    sourceRef: opaqueRef(secret.trim(), "face-lab-review-source", sourceHash),
    outputRef: opaqueRef(secret.trim(), "face-lab-review-output", outputHash),
    analysisRef: opaqueRef(secret.trim(), "face-lab-review-analysis", analysisHash),
    stateRef: opaqueRef(secret.trim(), "face-lab-review-state", stateHash),
    renderSpecSha256: renderDigest,
    routeId: normalizedRouteId,
    lookId: normalizedLookId,
    simulationVersion: normalizedSimulationVersion,
    instructionVersion: normalizedInstructionVersion,
    providerConfigVersion:
      normalizedProviderConfigVersion,
    providerConfigFingerprint:
      normalizedProviderConfigFingerprint,
    issuedAt: nowMs,
    expiresAt: nowMs + ttlMs
  };

  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8"
  ).toString("base64url");

  const signature = ticketSignature(secret.trim(), encodedPayload);

  return {
    version: payload.version,
    caseId: payload.caseId,
    token: encodedPayload + "." + signature,
    expiresAt: new Date(payload.expiresAt).toISOString()
  };
}

export function verifyFaceLabSimulationReviewTicket({
  token,
  secret,
  analysis,
  faceLabV2State,
  locale = "ko",
  renderSpecSha256,
  routeId,
  lookId,
  simulationVersion,
  instructionVersion,
  nowMs = Date.now()
} = {}) {
  if (
    typeof token !== "string" ||
    !token ||
    token.length > MAX_TOKEN_LENGTH ||
    typeof secret !== "string" ||
    !secret.trim() ||
    !isObject(analysis) ||
    !isObject(faceLabV2State) ||
    !Number.isSafeInteger(nowMs)
  ) {
    return invalid("simulation_review_ticket_invalid");
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return invalid("simulation_review_ticket_invalid");
  }

  const [encodedPayload, signature] = parts;

  if (signature !== ticketSignature(secret.trim(), encodedPayload)) {
    return invalid("simulation_review_ticket_invalid");
  }

  let payload = null;

  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );
  } catch {
    return invalid("simulation_review_ticket_invalid");
  }

  if (
    !isObject(payload) ||
    payload.version !== FACE_LAB_SIMULATION_REVIEW_TICKET_VERSION ||
    !normalizeId(payload.caseId) ||
    payload.locale !== localeValue(locale) ||
    !normalizeHash(payload.sourceRef) ||
    !normalizeHash(payload.outputRef) ||
    !normalizeHash(payload.analysisRef) ||
    !normalizeHash(payload.stateRef) ||
    !normalizeHash(payload.renderSpecSha256) ||
    !normalizeId(payload.routeId) ||
    !normalizeId(payload.lookId) ||
    !normalizeId(payload.simulationVersion) ||
    !normalizeId(payload.instructionVersion) ||
    payload.providerConfigVersion !==
      FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION ||
    !normalizeHash(
      payload.providerConfigFingerprint
    ) ||
    !Number.isSafeInteger(payload.issuedAt) ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.expiresAt <= payload.issuedAt ||
    payload.issuedAt > nowMs + MAX_CLOCK_SKEW_MS
  ) {
    return invalid("simulation_review_ticket_invalid");
  }

  if (payload.expiresAt < nowMs) {
    return invalid("simulation_review_ticket_expired");
  }

  const expectedAnalysisRef = opaqueRef(
    secret.trim(),
    "face-lab-review-analysis",
    hashFaceLabAuthorityValue(analysis)
  );
  const expectedStateRef = opaqueRef(
    secret.trim(),
    "face-lab-review-state",
    hashFaceLabAuthorityValue(faceLabV2State)
  );

  if (
    payload.analysisRef !== expectedAnalysisRef ||
    payload.stateRef !== expectedStateRef ||
    payload.renderSpecSha256 !== normalizeHash(renderSpecSha256) ||
    payload.routeId !== normalizeId(routeId) ||
    payload.lookId !== normalizeId(lookId) ||
    payload.simulationVersion !== normalizeId(simulationVersion) ||
    payload.instructionVersion !== normalizeId(instructionVersion)
  ) {
    return invalid("simulation_review_ticket_mismatch");
  }

  return {
    ok: true,
    version: payload.version,
    caseId: payload.caseId,
    expiresAt: new Date(payload.expiresAt).toISOString(),
    sourceRef: payload.sourceRef,
    outputRef: payload.outputRef,
    renderSpecSha256: payload.renderSpecSha256,
    routeId: payload.routeId,
    lookId: payload.lookId,
    simulationVersion: payload.simulationVersion,
    instructionVersion: payload.instructionVersion,
    providerConfigVersion:
      payload.providerConfigVersion,
    providerConfigFingerprint:
      payload.providerConfigFingerprint
  };
}
