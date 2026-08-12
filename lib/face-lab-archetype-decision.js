import {
  FACE_LAB_ARCHETYPE_REGISTRY,
  validateFaceLabArchetypeRegistry
} from "./face-lab-archetype-registry.js";
import { scoreFaceLabArchetypes } from "./face-lab-archetype-scoring.js";

export const FACE_LAB_ARCHETYPE_SHADOW_SCHEMA_VERSION = "face-lab-archetype-shadow-v1";

const HOLD_REASON_ORDER = Object.freeze([
  "ineligible",
  "insufficient_quality",
  "taxonomy_not_ready",
  "missing_required_axis",
  "low_evidence",
  "low_top_score",
  "low_top_margin",
  "contradiction",
  "calibration_not_ready"
]);

function orderHoldReasons(reasons) {
  const unique = new Set(reasons);
  return HOLD_REASON_ORDER.filter((reason) => unique.has(reason));
}

function emptyShadowResult(holdReasons, registryVersion = null) {
  return {
    schemaVersion: FACE_LAB_ARCHETYPE_SHADOW_SCHEMA_VERSION,
    mode: "shadow",
    productionEligible: false,
    status: "held",
    decision: null,
    registryVersion,
    topCandidate: null,
    ranking: [],
    holdReasons: orderHoldReasons(holdReasons),
    privacy: {
      sourceImagePersisted: false,
      evidenceTextCopied: false
    }
  };
}

function isPolicyReady(registry) {
  const policy = registry.decisionPolicy || {};
  const archetypesCalibrated = registry.archetypes.every((item) => item.calibrationStatus === "validated");
  return registry.calibrationStatus === "ready" && archetypesCalibrated && [
    policy.minimumEvidenceCoverage,
    policy.minimumTopScore,
    policy.minimumTopMargin,
    policy.maximumContradictions
  ].every((value) => Number.isFinite(value));
}

export function evaluateFaceLabArchetypeShadow(
  analysis,
  registry = FACE_LAB_ARCHETYPE_REGISTRY
) {
  const validation = validateFaceLabArchetypeRegistry(registry);
  if (!validation.ok) {
    return emptyShadowResult(["taxonomy_not_ready"], registry?.registryVersion || null);
  }

  const preflightReasons = [];
  if (analysis?.failureReason === "eligibility_failed") {
    preflightReasons.push("ineligible");
  }
  if (
    !analysis ||
    !["available", "partial"].includes(analysis.status) ||
    analysis.quality?.status !== "available" ||
    analysis.quality?.value?.structureSuitability === "unsuitable"
  ) {
    preflightReasons.push("insufficient_quality");
  }

  let scoring;
  try {
    scoring = scoreFaceLabArchetypes(analysis, registry);
  } catch {
    return emptyShadowResult(["taxonomy_not_ready"], registry.registryVersion);
  }

  const [rankedTop, rankedSecond] = scoring.candidates;
  const top = scoring.analysisUsable && rankedTop?.rawScore > 0 ? rankedTop : null;
  const second = top ? rankedSecond : null;
  const policy = registry.decisionPolicy;
  const holdReasons = [...preflightReasons];
  const taxonomyReady =
    (registry.lifecycle === "validated" || registry.lifecycle === "active") &&
    registry.archetypes.every((item) => item.lifecycle === "validated" || item.lifecycle === "active");
  if (!taxonomyReady) {
    holdReasons.push("taxonomy_not_ready");
  }
  if (top?.missingRequiredPaths?.length) {
    holdReasons.push("missing_required_axis");
  }
  if (Number.isFinite(policy.minimumEvidenceCoverage) && top?.evidenceCoverage < policy.minimumEvidenceCoverage) {
    holdReasons.push("low_evidence");
  }
  if (Number.isFinite(policy.minimumTopScore) && top?.rawScore < policy.minimumTopScore) {
    holdReasons.push("low_top_score");
  }
  const topMargin = top ? Number((top.rawScore - (second?.rawScore || 0)).toFixed(6)) : 0;
  if (Number.isFinite(policy.minimumTopMargin) && topMargin < policy.minimumTopMargin) {
    holdReasons.push("low_top_margin");
  }
  if (Number.isFinite(policy.maximumContradictions) && top?.contradictionCount > policy.maximumContradictions) {
    holdReasons.push("contradiction");
  }
  if (!isPolicyReady(registry)) {
    holdReasons.push("calibration_not_ready");
  }

  return {
    schemaVersion: FACE_LAB_ARCHETYPE_SHADOW_SCHEMA_VERSION,
    mode: "shadow",
    productionEligible: false,
    status: "held",
    decision: null,
    registryVersion: registry.registryVersion,
    topCandidate: top ? {
      key: top.key,
      rawScore: top.rawScore,
      evidenceCoverage: top.evidenceCoverage,
      topMargin
    } : null,
    ranking: scoring.candidates,
    holdReasons: orderHoldReasons(holdReasons),
    privacy: {
      sourceImagePersisted: false,
      evidenceTextCopied: false
    }
  };
}
