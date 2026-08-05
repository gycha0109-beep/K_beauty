import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { normalizeImageAnalysisEligibility } from "../image-analysis-eligibility.js";
import { resolveSafeProductImage } from "./image-source-policy.js";
import { stableSerialize } from "./analysis-request-guard-core.js";

export const ANONYMOUS_WRITE_GRANT_VERSION = 2;
export const ANONYMOUS_WRITE_GRANT_PURPOSE = "anonymous-analysis-write";
export const ANONYMOUS_WRITE_GRANT_RESOURCE_TYPE = "analysis-run";
export const ANONYMOUS_RESULT_WRITE_OPERATION = "result:create";
export const ANONYMOUS_TRACK_WRITE_OPERATION = "track:create";
export const ANONYMOUS_WRITE_GRANT_TTL_MS = 24 * 60 * 60 * 1000;
export const ANONYMOUS_TRACK_WRITE_MAX_USES = 24;

export const ANONYMOUS_RESULT_PERSISTENCE_FIELDS = Object.freeze([
  "summary",
  "priority",
  "topPick",
  "alternative",
  "amFocus",
  "pmFocus",
  "routineStructure",
  "morning",
  "night",
  "warnings",
  "photoEvidence",
  "photoObservations",
  "photoEvidenceState",
  "imageEligibility",
  "surveyEvidence",
  "scoring",
  "altPicks",
  "categoryPicks"
]);

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;
const ANONYMOUS_RESULT_PERSISTENCE_FIELD_SET = new Set(ANONYMOUS_RESULT_PERSISTENCE_FIELDS);

function createHash(secret, purpose, value) {
  return createHmac("sha256", secret)
    .update(`${purpose}\n${value}`)
    .digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || "", "utf8");
  const rightBuffer = Buffer.from(right || "", "utf8");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value, limit = 8) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

const PHOTO_EVIDENCE_STATUSES = new Set([
  "available",
  "not_provided",
  "unavailable",
  "insufficient_evidence",
  "ineligible",
  "unknown"
]);
const PHOTO_FAILURE_CLASSES = new Set([
  "provider_unavailable",
  "provider_failure",
  "technical_failure",
  "input_ineligible",
  "input_insufficient",
  "not_provided"
]);

function normalizePhotoEvidenceState(value) {
  const source = normalizeObject(value);

  if (!source) {
    return null;
  }

  const status = normalizeString(source.status).toLowerCase();
  const failureClass = normalizeString(source.failureClass).toLowerCase();

  return {
    status: PHOTO_EVIDENCE_STATUSES.has(status) ? status : "unknown",
    source: normalizeString(source.source).slice(0, 64) || null,
    failureReason: normalizeString(source.failureReason).slice(0, 96) || null,
    failureClass: PHOTO_FAILURE_CLASSES.has(failureClass) ? failureClass : null,
    analysisEligible: source.analysisEligible === true
      ? true
      : source.analysisEligible === false
        ? false
        : null
  };
}

function normalizeProduct(product) {
  const value = normalizeObject(product);

  if (!value) {
    return null;
  }

  return {
    id: normalizeString(value.id),
    name: normalizeString(value.name),
    brand: normalizeString(value.brand),
    step: normalizeString(value.step),
    reason: normalizeString(value.reason),
    comparison_reason: normalizeString(value.comparison_reason),
    buy_link: normalizeString(value.buy_link),
    image_url: resolveSafeProductImage(value.image_url),
    price_range: normalizeString(value.price_range),
    use_time: normalizeString(value.use_time)
  };
}

function normalizeProductArray(value, limit = 6) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeProduct)
    .filter(Boolean)
    .slice(0, limit);
}

export function canonicalizeAnonymousSurveyForPersistence(form = {}) {
  const value = normalizeObject(form) || {};
  const mainConcerns = normalizeStringArray(value.mainConcerns, 5);
  const environmentExposure = normalizeStringArray(value.environmentExposure, 8);

  return {
    skinType: normalizeString(value.skinType),
    sensitivity: normalizeString(value.sensitivityLevel || value.sensitivity),
    mainConcern: normalizeString(value.mainConcern || mainConcerns[0]),
    mainConcerns,
    primaryConcern: normalizeString(value.primaryConcern),
    recentSkinChange: normalizeString(value.recentSkinChange),
    recentlyChangedProduct: normalizeString(value.recentlyChangedProduct),
    cleansingFrequency: normalizeString(value.cleansingFrequency),
    preferredTexture: normalizeString(value.preferredTexture || value.texturePreference),
    postWashFeeling: normalizeString(value.postWashFeeling || value.postCleanseFeel),
    afternoonSkinChange: normalizeString(value.afternoonSkinChange || value.afternoonState),
    environmentExposure,
    mostDislikedFeel: normalizeString(value.mostDislikedFeel || value.dislikedFeel),
    genderPreference: normalizeString(value.genderPreference),
    whiteCastHate: Boolean(value.whiteCastHate),
    toneUpWanted: Boolean(value.toneUpWanted),
    makeupUse: Boolean(value.makeupUse),
    eyeSensitive: Boolean(value.eyeSensitive),
    sunscreenPreferenceState: normalizeString(value.sunscreenPreferenceState),
    outdoorExposure: typeof value.outdoorExposure === "boolean"
      ? value.outdoorExposure
      : environmentExposure.includes("outdoor"),
    verySensitivePeriod: Boolean(value.verySensitivePeriod)
  };
}

export function canonicalizeAnonymousResultForPersistence(result) {
  const value = normalizeObject(result);

  if (!value || Object.keys(value).some((key) => !ANONYMOUS_RESULT_PERSISTENCE_FIELD_SET.has(key))) {
    return null;
  }

  return {
    summary: normalizeString(value.summary),
    priority: value.priority || null,
    topPick: normalizeProduct(value.topPick),
    alternative: normalizeProduct(value.alternative),
    amFocus: normalizeString(value.amFocus),
    pmFocus: normalizeString(value.pmFocus),
    routineStructure: value.routineStructure || null,
    morning: normalizeStringArray(value.morning, 3),
    night: normalizeStringArray(value.night, 3),
    warnings: Array.isArray(value.warnings) ? value.warnings.slice(0, 1) : [],
    photoEvidence: Array.isArray(value.photoEvidence) ? value.photoEvidence.slice(0, 3) : [],
    photoObservations: value.photoObservations || null,
    photoEvidenceState: normalizePhotoEvidenceState(value.photoEvidenceState),
    imageEligibility: normalizeImageAnalysisEligibility(value.imageEligibility),
    surveyEvidence: Array.isArray(value.surveyEvidence) ? value.surveyEvidence.slice(0, 4) : [],
    scoring: value.scoring || null,
    altPicks: normalizeProductArray(value.altPicks, 3),
    categoryPicks: normalizeProductArray(value.categoryPicks, 6)
  };
}

export function isAnonymousWriteGrantHash(value) {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

export function createAnonymousWriteGrantHash(secret, purpose, value) {
  return createHash(secret, `anonymous-write-grant:${purpose}`, value);
}

export function createAnonymousWritePrincipalHash({ secret, anonymousPayload }) {
  return createAnonymousWriteGrantHash(secret, "principal", anonymousPayload);
}

export function createAnonymousWriteJtiHash({ secret, jti }) {
  return createAnonymousWriteGrantHash(secret, "jti", jti);
}

export function createAnalysisRunId() {
  return randomBytes(24).toString("base64url");
}

export function createAnonymousWriteJti() {
  return randomBytes(24).toString("base64url");
}

export function createAnonymousResultFingerprintHash({ secret, result, form, locale }) {
  const canonicalResult = canonicalizeAnonymousResultForPersistence(result);

  if (!canonicalResult) {
    return null;
  }

  return createAnonymousWriteGrantHash(
    secret,
    "result-fingerprint",
    stableSerialize({
      locale: locale === "en" ? "en" : "ko",
      form: canonicalizeAnonymousSurveyForPersistence(form),
      result: canonicalResult
    })
  );
}

export function createAnonymousTrackEventFingerprintHash({ secret, analysisRunId, payload }) {
  const value = normalizeObject(payload) || {};

  return createAnonymousWriteGrantHash(
    secret,
    "track-event-fingerprint",
    stableSerialize({
      analysisRunId,
      eventName: normalizeString(value.event_name),
      productId: normalizeString(value.product_id),
      featureName: normalizeString(value.feature_name),
      resultType: normalizeString(value.result_type),
      questionId: normalizeString(value.question_id),
      answer: normalizeString(value.answer),
      isTopPick: Boolean(value.is_top_pick),
      meta: value.meta_json ?? null
    })
  );
}

export function createAnonymousWriteGrantTokenSignature({ secret, encodedPayload }) {
  return createHash(secret, "token-signature", encodedPayload);
}

function encodeAndSign(payload, secret) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createAnonymousWriteGrantTokenSignature({ secret, encodedPayload });

  return `${encodedPayload}.${signature}`;
}

function isValidTokenPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.version === ANONYMOUS_WRITE_GRANT_VERSION &&
      payload.purpose === ANONYMOUS_WRITE_GRANT_PURPOSE &&
      payload.resourceType === ANONYMOUS_WRITE_GRANT_RESOURCE_TYPE &&
      OPAQUE_ID_PATTERN.test(payload.resourceId || "") &&
      [ANONYMOUS_RESULT_WRITE_OPERATION, ANONYMOUS_TRACK_WRITE_OPERATION].includes(payload.operation) &&
      isAnonymousWriteGrantHash(payload.principalHash) &&
      OPAQUE_ID_PATTERN.test(payload.jti || "") &&
      Number.isSafeInteger(payload.issuedAt) &&
      Number.isSafeInteger(payload.expiresAt) &&
      payload.expiresAt > payload.issuedAt &&
      payload.expiresAt - payload.issuedAt <= ANONYMOUS_WRITE_GRANT_TTL_MS
  );
}

export function createAnonymousWriteGrantTokens({ secret, anonymousPayload, result, form, locale, nowMs = Date.now() }) {
  const analysisRunId = createAnalysisRunId();
  const principalHash = createAnonymousWritePrincipalHash({ secret, anonymousPayload });
  const expiresAt = nowMs + ANONYMOUS_WRITE_GRANT_TTL_MS;
  const resultJti = createAnonymousWriteJti();
  const trackJti = createAnonymousWriteJti();
  const expectedFingerprintHash = createAnonymousResultFingerprintHash({
    secret,
    result,
    form,
    locale
  });

  if (!expectedFingerprintHash) {
    throw new Error("Invalid anonymous result persistence payload.");
  }
  const shared = {
    version: ANONYMOUS_WRITE_GRANT_VERSION,
    purpose: ANONYMOUS_WRITE_GRANT_PURPOSE,
    resourceType: ANONYMOUS_WRITE_GRANT_RESOURCE_TYPE,
    resourceId: analysisRunId,
    principalHash,
    issuedAt: nowMs,
    expiresAt
  };
  const resultPayload = {
    ...shared,
    operation: ANONYMOUS_RESULT_WRITE_OPERATION,
    jti: resultJti
  };
  const trackPayload = {
    ...shared,
    operation: ANONYMOUS_TRACK_WRITE_OPERATION,
    jti: trackJti
  };

  return {
    analysisRunId,
    expiresAt,
    principalHash,
    resultToken: encodeAndSign(resultPayload, secret),
    trackToken: encodeAndSign(trackPayload, secret),
    grants: [
      {
        jtiHash: createAnonymousWriteJtiHash({ secret, jti: resultJti }),
        version: shared.version,
        purpose: shared.purpose,
        resourceType: shared.resourceType,
        resourceId: shared.resourceId,
        operation: resultPayload.operation,
        principalHash,
        expectedFingerprintHash,
        maxUses: 1,
        issuedAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(expiresAt).toISOString()
      },
      {
        jtiHash: createAnonymousWriteJtiHash({ secret, jti: trackJti }),
        version: shared.version,
        purpose: shared.purpose,
        resourceType: shared.resourceType,
        resourceId: shared.resourceId,
        operation: trackPayload.operation,
        principalHash,
        expectedFingerprintHash: null,
        maxUses: ANONYMOUS_TRACK_WRITE_MAX_USES,
        issuedAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(expiresAt).toISOString()
      }
    ]
  };
}

export function verifyAnonymousWriteGrantToken({ token, secret, expectedOperation, nowMs = Date.now() }) {
  if (!secret) {
    return { ok: false, code: "misconfigured" };
  }

  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, code: "missing" };
  }

  const parts = token.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, code: "malformed" };
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = createAnonymousWriteGrantTokenSignature({ secret, encodedPayload });

  if (!safeEqual(signature, expectedSignature)) {
    return { ok: false, code: "invalid_signature" };
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

    if (!isValidTokenPayload(payload)) {
      return { ok: false, code: "invalid_claims" };
    }

    if (payload.expiresAt <= nowMs) {
      return { ok: false, code: "expired" };
    }

    if (payload.operation !== expectedOperation) {
      return { ok: false, code: "operation_mismatch" };
    }

    return { ok: true, payload };
  } catch {
    return { ok: false, code: "invalid_payload" };
  }
}

export function getAnonymousWriteGrantResultFingerprintInput({ result, submission, locale }) {
  return {
    result,
    form: submission?.form,
    locale: locale === "en" ? "en" : "ko"
  };
}
