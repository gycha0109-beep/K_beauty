import {
  PROMOTION_POLICY_ID,
  PROMOTION_POLICY_VERSION,
  PROMOTION_SUPPORTED_G4_PURPOSES,
  PROMOTION_USE_SCOPE
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

export const PROMOTION_POLICY = deepFreeze({
  id: PROMOTION_POLICY_ID,
  version: PROMOTION_POLICY_VERSION,
  useScope: PROMOTION_USE_SCOPE,
  g4Purposes: [...PROMOTION_SUPPORTED_G4_PURPOSES],
  nonGoldPurposes: ["paired_skin_edit", "mixed_control_pilot"],
  claimSource: "sealed_blind_consensus",
  aggregateScoreAllowed: false,
  featureStrengthClaimAllowed: false,
  g5Authority: false,
  batchPromotionAllowed: false
});

export const PROMOTION_POLICY_DIGEST = sha256Hex(stableStringify(PROMOTION_POLICY));

export function buildPromotionKey(candidateId, purpose, requiredAxesDigest) {
  const digest = sha256Hex(stableStringify({ candidateId, purpose, requiredAxesDigest }));
  return `prom_${digest.slice(0, 24)}`;
}

export function excludedClaimsForPurpose(purpose) {
  if (purpose === "capture_control") {
    return Object.freeze(["archetype", "face_feature", "health_diagnosis", "skin_condition", "training_license"]);
  }
  if (purpose === "skin_cue_control") {
    return Object.freeze(["archetype", "health_diagnosis", "severity_beyond_registry", "training_license"]);
  }
  if (purpose === "face_feature_control") {
    return Object.freeze(["archetype", "feature_strength", "style_advice", "training_license"]);
  }
  if (purpose === "paired_skin_edit") {
    return Object.freeze(["same_person_preservation", "synthetic_gold", "training_license"]);
  }
  return Object.freeze(["combined_gold_claim", "synthetic_gold", "training_license"]);
}

export function buildConsensusClaimProjection({ consensus, alignment }) {
  const requiredAxes = [...alignment.policy.requiredAxes].sort();
  const claimValues = [];
  for (const axis of requiredAxes) {
    const result = consensus.axes?.[axis];
    if (!result || result.status !== "agreed") {
      return Object.freeze({ ok: false, errors: Object.freeze([{ code: "required_axis_not_agreed", path: `consensus.axes.${axis}`, detail: result?.status || null }]) });
    }
    claimValues.push(deepFreeze({ axis, value: result.value }));
  }
  const claimValuesDigest = sha256Hex(stableStringify(claimValues));
  return Object.freeze({
    ok: true,
    claims: deepFreeze({
      requiredAxes,
      claimValues,
      claimValuesDigest,
      excludedClaims: [...excludedClaimsForPurpose(alignment.generation.purpose)].sort()
    })
  });
}

export function splitCouplingKeysDigest(keys) {
  const normalized = [...keys]
    .map((item) => ({ kind: item.kind, key: item.key }))
    .sort((left, right) => `${left.kind}:${left.key}`.localeCompare(`${right.kind}:${right.key}`));
  return sha256Hex(stableStringify(normalized));
}
