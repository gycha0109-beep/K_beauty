import { normalizeImageAnalysisEligibility } from "@/lib/image-analysis-eligibility";
import { buildFaceLabObservationAnalysis } from "@/lib/face-lab-observation-contract";
import {
  VISION_CONFIDENCE_LEVELS,
  VISION_OBSERVATION_PROMPT_VERSION,
  VISION_OBSERVATION_SCHEMA_VERSION,
  VISION_SKIN_AREAS,
  VISION_SKIN_CUES,
  VISION_SKIN_LEVELS,
  VISION_SKIN_OBSERVATION_KEYS,
  VISION_SKIN_SIGNAL_AXES
} from "@/lib/vision-observation-contract";

const SKIN_KEYS = new Set(VISION_SKIN_OBSERVATION_KEYS);
const SKIN_AREAS = new Set(VISION_SKIN_AREAS);
const SKIN_CUES = new Set(VISION_SKIN_CUES);
const SKIN_LEVELS = new Set(VISION_SKIN_LEVELS);
const CONFIDENCE_LEVELS = new Set(VISION_CONFIDENCE_LEVELS);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(5, Math.round(parsed))) : 0;
}

function normalizeEnum(value, allowed, fallback) {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

function createEmptySkinSignals() {
  return Object.fromEntries(VISION_SKIN_SIGNAL_AXES.map((axis) => [axis, 0]));
}

export function createFallbackVisionObservationBundle(options = {}) {
  const eligibility = normalizeImageAnalysisEligibility(null);
  const faceAnalysis = buildFaceLabObservationAnalysis(null, {
    eligibility,
    provider: options.provider || "openai",
    model: options.model || null,
    promptVersion: VISION_OBSERVATION_PROMPT_VERSION
  });

  return {
    schemaVersion: VISION_OBSERVATION_SCHEMA_VERSION,
    promptVersion: VISION_OBSERVATION_PROMPT_VERSION,
    status: "provider_failure",
    eligibility,
    skin: {
      status: "unavailable",
      signals: createEmptySkinSignals(),
      observations: []
    },
    face: {
      status: faceAnalysis.status,
      analysis: faceAnalysis
    },
    privacy: {
      sourceImagePersisted: false,
      rawProviderResponsePersisted: false
    }
  };
}

function normalizeSkinSection(rawSkin, eligibility) {
  if (!eligibility.skinAnalysisEligible || !isObject(rawSkin)) {
    return {
      status: eligibility.skinAnalysisEligible ? "insufficient_evidence" : "unavailable",
      signals: createEmptySkinSignals(),
      observations: []
    };
  }

  const signals = Object.fromEntries(
    VISION_SKIN_SIGNAL_AXES.map((axis) => [axis, normalizeScore(rawSkin?.signals?.[axis])])
  );
  const observations = Array.isArray(rawSkin.observations)
    ? rawSkin.observations
        .map((item) => {
          if (!isObject(item)) return null;
          const key = normalizeEnum(item.key, SKIN_KEYS, null);
          if (!key) return null;
          return {
            key,
            area: normalizeEnum(item.area, SKIN_AREAS, "unknown"),
            cue: normalizeEnum(item.cue, SKIN_CUES, "uncertain"),
            level: normalizeEnum(item.level, SKIN_LEVELS, "low"),
            confidence: normalizeEnum(item.confidence, CONFIDENCE_LEVELS, "low")
          };
        })
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return {
    status: observations.length || Object.values(signals).some((value) => value > 0)
      ? "available"
      : "insufficient_evidence",
    signals,
    observations
  };
}

export function normalizeVisionObservationBundle(parsed, options = {}) {
  if (!isObject(parsed) || parsed.schemaVersion !== VISION_OBSERVATION_SCHEMA_VERSION) {
    return createFallbackVisionObservationBundle(options);
  }

  const eligibility = normalizeImageAnalysisEligibility(parsed.eligibility);
  const skin = normalizeSkinSection(parsed.skin, eligibility);
  const faceAnalysis = buildFaceLabObservationAnalysis(parsed.face, {
    eligibility,
    provider: options.provider || "openai",
    model: options.model || null,
    promptVersion: VISION_OBSERVATION_PROMPT_VERSION
  });
  const hasVisionEligibility = eligibility.source === "vision";

  return {
    schemaVersion: VISION_OBSERVATION_SCHEMA_VERSION,
    promptVersion: VISION_OBSERVATION_PROMPT_VERSION,
    status: hasVisionEligibility ? "available" : "invalid_response",
    eligibility,
    skin,
    face: {
      status: faceAnalysis.status,
      analysis: faceAnalysis
    },
    privacy: {
      sourceImagePersisted: false,
      rawProviderResponsePersisted: false
    }
  };
}
