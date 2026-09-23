export const REAL_PHOTO_STABILITY_ADEQUACY_DECISION_SCHEMA_VERSION =
  "face-lab-real-photo-stability-adequacy-decision-v1";

const ALLOWED_STATUSES = new Set([
  "adequate_for_provisional_research",
  "hold_for_more_evidence"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256Reference(value) {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function validateRealPhotoStabilityAdequacyDecision(
  decision = {},
  descriptiveReview
) {
  if (
    !isObject(descriptiveReview) ||
    descriptiveReview.schemaVersion !==
      "face-lab-real-photo-stability-adequacy-review-v1" ||
    descriptiveReview.status !==
      "descriptive_review_complete_decision_separate" ||
    !sha256Reference(descriptiveReview.analysisFingerprint) ||
    descriptiveReview.reviewSemantics?.adequacyDecisionIncluded !== false ||
    descriptiveReview.authority?.productionAuthority !== false ||
    descriptiveReview.authority?.normalizationAuthority !== false ||
    descriptiveReview.authority?.thresholdAuthority !== false ||
    descriptiveReview.authority?.adequacyDecisionAuthority !== false
  ) {
    throw new Error("real_photo_stability_adequacy_decision_review_invalid");
  }

  const expectedClasses = [
    "expression",
    "head_pitch",
    "head_roll",
    "head_yaw"
  ];

  if (
    !isObject(decision) ||
    decision.schemaVersion !==
      REAL_PHOTO_STABILITY_ADEQUACY_DECISION_SCHEMA_VERSION ||
    !ALLOWED_STATUSES.has(decision.status) ||
    !nonEmpty(decision.decisionVersion) ||
    !nonEmpty(decision.evidenceRef) ||
    decision.decisionMode !== "explicit_manual_research_review" ||
    decision.sourceDescriptiveReviewSchemaVersion !==
      descriptiveReview.schemaVersion ||
    decision.sourceDescriptiveReviewVersion !==
      descriptiveReview.reviewVersion ||
    decision.sourceDescriptiveReviewFingerprint !==
      descriptiveReview.analysisFingerprint ||
    decision.sourceCollectionFingerprint !==
      descriptiveReview.boundEvidence?.collectionFingerprint ||
    decision.sourceReviewPacketFingerprint !==
      descriptiveReview.boundEvidence?.reviewPacketFingerprint ||
    decision.sourceReportCount !==
      descriptiveReview.boundEvidence?.sourceReportCount ||
    !sameStringSet(decision.reviewedNuisanceClasses, expectedClasses) ||
    !nonEmpty(decision.decisionRationale) ||
    !Array.isArray(decision.coverageLimitations) ||
    decision.coverageLimitations.length === 0 ||
    decision.coverageLimitations.some((item) => !nonEmpty(item)) ||
    decision.automaticAdequacyInferred !== false ||
    decision.numericThresholdInvented !== false ||
    decision.productionAuthority !== false ||
    decision.normalizationAuthority !== false ||
    decision.thresholdAuthority !== false
  ) {
    throw new Error("real_photo_stability_adequacy_decision_invalid");
  }

  const holdReasons = Array.isArray(decision.holdReasons)
    ? decision.holdReasons
    : [];

  if (decision.status === "adequate_for_provisional_research") {
    if (
      decision.provisionalResearchGateGranted !== true ||
      holdReasons.length !== 0
    ) {
      throw new Error("real_photo_stability_adequacy_decision_invalid");
    }
  } else if (
    decision.provisionalResearchGateGranted !== false ||
    holdReasons.length === 0 ||
    holdReasons.some((item) => !nonEmpty(item))
  ) {
    throw new Error("real_photo_stability_adequacy_decision_invalid");
  }

  return {
    schemaVersion: REAL_PHOTO_STABILITY_ADEQUACY_DECISION_SCHEMA_VERSION,
    status: decision.status,
    decisionVersion: decision.decisionVersion,
    evidenceRef: decision.evidenceRef,
    decisionMode: "explicit_manual_research_review",
    sourceDescriptiveReviewFingerprint:
      decision.sourceDescriptiveReviewFingerprint,
    sourceCollectionFingerprint: decision.sourceCollectionFingerprint,
    sourceReviewPacketFingerprint: decision.sourceReviewPacketFingerprint,
    sourceReportCount: decision.sourceReportCount,
    reviewedNuisanceClasses: [...new Set(decision.reviewedNuisanceClasses)].sort(),
    decisionRationale: decision.decisionRationale,
    coverageLimitations: [...decision.coverageLimitations],
    holdReasons: [...holdReasons],
    provisionalResearchGateGranted:
      decision.status === "adequate_for_provisional_research",
    automaticAdequacyInferred: false,
    numericThresholdInvented: false,
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false,
      explicitResearchDecisionOnly: true
    }
  };
}
