import { cleanEvidence, exactKeys, normalizeEnum, set } from "./helpers.js";

function invalidEligibility() {
  return {
    status: "insufficient_evidence", source: null, imageType: "unknown", humanFaceCount: null,
    faceLabEligible: false, skinAnalysisEligible: false,
    faceLabFailureReason: "eligibility_response_invalid",
    skinFailureReason: "eligibility_response_invalid", confidence: null, evidence: []
  };
}

export function normalizeEligibility(value, S) {
  const invalid = invalidEligibility();
  const faceCount = value.humanFaceCount === null
    ? null
    : Number.isInteger(value.humanFaceCount) && value.humanFaceCount >= 0 && value.humanFaceCount <= 20
      ? value.humanFaceCount
      : undefined;
  const confidence = value.confidence === null
    ? null
    : typeof value.confidence === "number" && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 1
      ? value.confidence
      : undefined;
  const faceReasons = set(S.eligibility.faceFailureReasons);
  const skinReasons = set(S.eligibility.skinFailureReasons);
  const faceReason = value.faceLabFailureReason === null ? null : faceReasons.has(value.faceLabFailureReason) ? value.faceLabFailureReason : undefined;
  const skinReason = value.skinFailureReason === null ? null : skinReasons.has(value.skinFailureReason) ? value.skinFailureReason : undefined;
  const evidence = cleanEvidence(value.evidence, 6);
  if (
    !set(S.eligibility.statuses).has(value.status) || value.source !== "vision" ||
    !set(S.eligibility.imageTypes).has(value.imageType) || faceCount === undefined ||
    typeof value.faceLabEligible !== "boolean" || typeof value.skinAnalysisEligible !== "boolean" ||
    faceReason === undefined || skinReason === undefined || confidence === undefined || !evidence.length
  ) return invalid;
  const singlePhotoFace = value.imageType === "photorealistic_human" && faceCount === 1;
  if ((value.faceLabEligible || value.skinAnalysisEligible) && !singlePhotoFace) return invalid;
  if ((value.faceLabEligible ? faceReason !== null : faceReason === null) || (value.skinAnalysisEligible ? skinReason !== null : skinReason === null)) return invalid;
  const expectedStatus = value.faceLabEligible || value.skinAnalysisEligible ? "eligible" : singlePhotoFace ? "insufficient_evidence" : "ineligible";
  if (value.status !== expectedStatus) return invalid;
  return { ...value, humanFaceCount: faceCount, faceLabFailureReason: faceReason, skinFailureReason: skinReason, confidence, evidence };
}

function emptySignals(S) {
  return Object.fromEntries(S.skin.signalAxes.map((axis) => [axis, 0]));
}

function score(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(5, Math.round(parsed))) : 0;
}

export function normalizeSkin(rawSkin, eligibility, S) {
  if (!eligibility.skinAnalysisEligible) return { status: "unavailable", signals: emptySignals(S), observations: [] };
  const signals = Object.fromEntries(S.skin.signalAxes.map((axis) => [axis, score(rawSkin.signals[axis])]));
  const keys = set(S.skin.observationKeys);
  const areas = set(S.skin.areas);
  const cues = set(S.skin.cues);
  const levels = set(S.skin.levels);
  const confidence = set(S.skin.confidenceLevels);
  const observations = rawSkin.observations.map((item) => {
    const key = normalizeEnum(item.key, keys);
    if (!key) return null;
    return {
      key,
      area: normalizeEnum(item.area, areas) || "unknown",
      cue: normalizeEnum(item.cue, cues) || "uncertain",
      level: normalizeEnum(item.level, levels) || "low",
      confidence: normalizeEnum(item.confidence, confidence) || "low"
    };
  }).filter(Boolean);
  return {
    status: observations.length || Object.values(signals).some((value) => value > 0) ? "available" : "insufficient_evidence",
    signals,
    observations
  };
}
