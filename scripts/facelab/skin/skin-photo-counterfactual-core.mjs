// Skin S2-C research-only counterfactual adapter.
// This module NEVER calls a provider, changes stored reports, or writes to
// production recommendation scoring. It changes an *in-memory copy* supplied
// to the existing unchanged recommendation engine for offline comparison.
import {
  SKIN_VISIBLE_AXES,
  assessSkinAxisEvidence,
  hasUsablePositiveSkinAxisEvidence
} from "./skin-axis-evidence-contract-core.mjs";

export const SKIN_PHOTO_COUNTERFACTUAL_VERSION = "skin-photo-counterfactual-v1";
const SCORE_AXES = Object.freeze([
  "barrier", "dehydration", "oiliness", "redness", "acne", "pores", "uneven_tone", "uv"
]);

function record(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function finiteScore(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5
    ? value : null;
}

/**
 * @param {object} legacyPhotoAnalysis A sanitized, synthetic test object with
 *   numeric v1 signal scores. Never interpret v1 zeros as verified not_seen.
 * @param {object} explicitManifest Future-state independently supplied *synthetic*
 *   axis evidence. It is NOT reconstructible from v1 signals.
 */
export function buildSkinPhotoCounterfactual(legacyPhotoAnalysis, explicitManifest) {
  if (!record(legacyPhotoAnalysis)) throw new Error("legacy_photo_invalid");
  const gate = {
    photoStatus: legacyPhotoAnalysis.photoEvidenceState?.status || "unknown",
    skinAnalysisEligible: legacyPhotoAnalysis.imageEligibility?.skinAnalysisEligible === true
  };
  const evidence = assessSkinAxisEvidence(explicitManifest, gate);
  const signals = Object.fromEntries(SCORE_AXES.map(axis => [axis, 0]));
  const findings = [];
  for (const axis of SKIN_VISIBLE_AXES) {
    const legacyScore = finiteScore(legacyPhotoAnalysis.signals?.[axis]);
    const supported = hasUsablePositiveSkinAxisEvidence(evidence, axis);
    const observed = evidence.axes[axis];
    if (legacyScore === null) {
      findings.push({ axis, code: "legacy_score_missing_or_invalid" });
      continue;
    }
    if (supported) {
      // Never silently overwrite a contradictory model numeric score; this
      // proposal records that conflict and holds the photo contribution.
      if (observed.value !== legacyScore) {
        findings.push({ axis, code: "axis_value_conflict_hold" });
      } else {
        signals[axis] = observed.value;
      }
    } else if (legacyScore > 0) {
      findings.push({ axis, code: evidence.photoGate === "blocked"
        ? "photo_unavailable_score_held"
        : "axis_evidence_unreliable_score_held" });
    }
  }

  // No evidence-backed visual cue exists for UV in the current Skin contract.
  // Only the hypothetical shadow input is zeroed; legacy score is unchanged.
  const oldUv = finiteScore(legacyPhotoAnalysis.signals?.uv);
  if (oldUv === null) findings.push({ axis: "uv", code: "legacy_score_missing_or_invalid" });
  else if (oldUv > 0) findings.push({ axis: "uv", code: "uv_direct_cue_missing" });

  return {
    version: SKIN_PHOTO_COUNTERFACTUAL_VERSION,
    evaluationOnly: true,
    candidatePhotoAnalysis: {
      ...legacyPhotoAnalysis,
      signals // in-memory projection only; never pass into an actual response
    },
    evidenceStatus: evidence.status,
    photoGate: evidence.photoGate,
    findings,
    authority: {
      scorerModified: false,
      providerCalls: 0,
      scoreActivationAuthorized: false,
      realPhotoTruthEstablished: false
    }
  };
}

export function compareSkinPhotoDecisions(original, hypothetical) {
  if (!record(original) || !record(hypothetical)) throw new Error("decision_invalid");
  const rows = {};
  let deltaCount = 0;
  let legacyPhotoPoints = 0;
  let candidatePhotoPoints = 0;
  for (const axis of SCORE_AXES) {
    const a = original.scoring?.concernScores?.[axis];
    const b = hypothetical.scoring?.concernScores?.[axis];
    if (!record(a) || !record(b)) throw new Error("decision_axis_missing_" + axis);
    for (const key of ["photo", "survey", "environment", "total"]) {
      if (typeof a[key] !== "number" || typeof b[key] !== "number" ||
          !Number.isFinite(a[key]) || !Number.isFinite(b[key])) {
        throw new Error("decision_score_invalid_" + axis);
      }
    }
    if (a.survey !== b.survey || a.environment !== b.environment) {
      throw new Error("shadow_must_not_change_survey_or_environment");
    }
    if (b.photo > a.photo) throw new Error("shadow_must_not_increase_photo_points");
    if (b.total !== a.total - (a.photo - b.photo)) {
      throw new Error("shadow_score_conservation_failed");
    }
    const delta = a.photo - b.photo;
    if (delta > 0) {
      rows[axis] = { legacyPhotoPoints: a.photo, shadowPhotoPoints: b.photo, removedPoints: delta };
      deltaCount++;
    }
    legacyPhotoPoints += a.photo;
    candidatePhotoPoints += b.photo;
  }

  const ranked = (bundle) => {
    const products = bundle.diagnostics?.candidateSource?.products;
    if (!Array.isArray(products)) throw new Error("candidate_source_missing");
    return products.map(item => String(item.id));
  };
  const aRanked = ranked(original);
  const bRanked = ranked(hypothetical);
  if (aRanked.length !== bRanked.length ||
      new Set(aRanked).size !== aRanked.length ||
      aRanked.some(id => !bRanked.includes(id))) {
    throw new Error("candidate_eligibility_or_identity_changed");
  }
  const aTop = original.topPick?.id || null;
  const bTop = hypothetical.topPick?.id || null;
  return {
    priorityBefore: original.priority?.axis || null,
    priorityAfter: hypothetical.priority?.axis || null,
    priorityChanged: original.priority?.axis !== hypothetical.priority?.axis,
    topPickChanged: String(aTop) !== String(bTop),
    topThreeRankedChanged: aRanked.slice(0, 3).join("|") !== bRanked.slice(0, 3).join("|"),
    rankingChanged: aRanked.join("|") !== bRanked.join("|"),
    candidateCount: aRanked.length,
    photoPointReduction: legacyPhotoPoints - candidatePhotoPoints,
    legacyPhotoPoints,
    candidatePhotoPoints,
    changedAxisCount: deltaCount,
    changedAxes: rows
  };
}
