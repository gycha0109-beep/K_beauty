import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  validateRealPhotoStabilityAdequacyDecision
} from "../lib/face-lab-real-photo-stability-adequacy-decision.js";

const descriptiveReview = {
  schemaVersion: "face-lab-real-photo-stability-adequacy-review-v1",
  reviewVersion: "synthetic-descriptive-review-v1",
  status: "descriptive_review_complete_decision_separate",
  analysisFingerprint: "sha256:" + "a".repeat(64),
  boundEvidence: {
    collectionFingerprint: "sha256:" + "b".repeat(64),
    reviewPacketFingerprint: "sha256:" + "c".repeat(64),
    sourceReportCount: 488
  },
  reviewSemantics: {
    adequacyDecisionIncluded: false
  },
  authority: {
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false,
    adequacyDecisionAuthority: false
  }
};

const baseDecision = {
  schemaVersion: "face-lab-real-photo-stability-adequacy-decision-v1",
  decisionCode: "ADDITIONAL_EVIDENCE_REQUIRED",
  decisionVersion: "synthetic-decision-v1",
  evidenceRef: "synthetic-verifier-only:decision",
  decisionMode: "explicit_manual_research_review",
  sourceDescriptiveReviewSchemaVersion: descriptiveReview.schemaVersion,
  sourceDescriptiveReviewVersion: descriptiveReview.reviewVersion,
  sourceDescriptiveReviewFingerprint: descriptiveReview.analysisFingerprint,
  sourceCollectionFingerprint:
    descriptiveReview.boundEvidence.collectionFingerprint,
  sourceReviewPacketFingerprint:
    descriptiveReview.boundEvidence.reviewPacketFingerprint,
  sourceReportCount: 488,
  reviewedNuisanceClasses: [
    "expression",
    "head_pitch",
    "head_roll",
    "head_yaw"
  ],
  decisionRationale:
    "Synthetic verifier only; decision semantics are being tested.",
  coverageLimitations: [
    "Synthetic verifier only; no empirical adequacy conclusion is established."
  ],
  automaticAdequacyInferred: false,
  numericThresholdInvented: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
};

const hold = validateRealPhotoStabilityAdequacyDecision(
  {
    ...baseDecision,
    status: "hold_for_more_evidence",
    provisionalResearchGateGranted: false,
    holdReasons: ["synthetic_verifier_requires_more_evidence"],
    evidenceIntegrityBlockers: []
  },
  descriptiveReview
);
assert.equal(hold.status, "hold_for_more_evidence");
assert.equal(hold.provisionalResearchGateGranted, false);

const adequate = validateRealPhotoStabilityAdequacyDecision(
  {
    ...baseDecision,
    status: "adequate_for_provisional_research",
    decisionCode: "PROVISIONAL_RESEARCH_ADEQUATE",
    provisionalResearchGateGranted: true,
    holdReasons: [],
    evidenceIntegrityBlockers: []
  },
  descriptiveReview
);
assert.equal(adequate.status, "adequate_for_provisional_research");
assert.equal(adequate.provisionalResearchGateGranted, true);

const blocked = validateRealPhotoStabilityAdequacyDecision(
  {
    ...baseDecision,
    status: "blocked_by_evidence_integrity",
    decisionCode: "BLOCKED_BY_EVIDENCE_INTEGRITY",
    provisionalResearchGateGranted: false,
    holdReasons: [],
    evidenceIntegrityBlockers: [
      "synthetic_verifier_integrity_block"
    ]
  },
  descriptiveReview
);
assert.equal(blocked.status, "blocked_by_evidence_integrity");
assert.equal(blocked.provisionalResearchGateGranted, false);

assert.throws(
  () =>
    validateRealPhotoStabilityAdequacyDecision(
      {
        ...baseDecision,
        status: "hold_for_more_evidence",
        provisionalResearchGateGranted: false,
        holdReasons: [],
        evidenceIntegrityBlockers: []
      },
      descriptiveReview
    ),
  /decision_invalid/
);

assert.throws(
  () =>
    validateRealPhotoStabilityAdequacyDecision(
      {
        ...baseDecision,
        status: "adequate_for_provisional_research",
        decisionCode: "PROVISIONAL_RESEARCH_ADEQUATE",
        provisionalResearchGateGranted: false,
        holdReasons: []
      },
      descriptiveReview
    ),
  /decision_invalid/
);

assert.throws(
  () =>
    validateRealPhotoStabilityAdequacyDecision(
      {
        ...baseDecision,
        status: "hold_for_more_evidence",
        provisionalResearchGateGranted: false,
        holdReasons: ["synthetic"],
        evidenceIntegrityBlockers: [],
        automaticAdequacyInferred: true
      },
      descriptiveReview
    ),
  /decision_invalid/
);

assert.throws(
  () =>
    validateRealPhotoStabilityAdequacyDecision(
      {
        ...baseDecision,
        status: "hold_for_more_evidence",
        provisionalResearchGateGranted: false,
        holdReasons: ["synthetic"],
        evidenceIntegrityBlockers: [],
        sourceDescriptiveReviewFingerprint: "sha256:" + "d".repeat(64)
      },
      descriptiveReview
    ),
  /decision_invalid/
);

console.log(JSON.stringify({
  ok: true,
  allowedStatuses: [
    "adequate_for_provisional_research",
    "hold_for_more_evidence",
    "blocked_by_evidence_integrity"
  ],
  explicitManualDecisionRequired: true,
  automaticAdequacyInferenceForbidden: true,
  numericThresholdInventionForbidden: true,
  holdDoesNotGrantProvisionalResearchGate: true,
  actualDecisionPresent: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
}, null, 2));

const [actualReviewPath, actualDecisionPath] = process.argv.slice(2);
if ((actualReviewPath && !actualDecisionPath) || (!actualReviewPath && actualDecisionPath)) {
  throw new Error(
    "Usage: node scripts/verify-face-lab-real-photo-stability-adequacy-decision.mjs [<descriptive-review.json> <decision.json>]"
  );
}
if (actualReviewPath && actualDecisionPath) {
  const actualReview = JSON.parse(readFileSync(actualReviewPath, "utf8"));
  const actualDecision = JSON.parse(readFileSync(actualDecisionPath, "utf8"));
  const validatedActual = validateRealPhotoStabilityAdequacyDecision(
    actualDecision,
    actualReview
  );
  assert.equal(validatedActual.status, "hold_for_more_evidence");
  assert.equal(
    validatedActual.decisionCode,
    "ADDITIONAL_EVIDENCE_REQUIRED"
  );
  assert.equal(validatedActual.provisionalResearchGateGranted, false);
  assert.deepEqual(validatedActual.evidenceIntegrityBlockers, []);
  assert.ok(
    validatedActual.holdReasons.includes(
      "head_roll_subject_diversity_limited"
    )
  );
  assert.ok(
    validatedActual.holdReasons.includes(
      "head_roll_distributional_evidence_limited"
    )
  );
  console.log(JSON.stringify({
    actualDecisionValidated: true,
    status: validatedActual.status,
    decisionCode: validatedActual.decisionCode,
    provisionalResearchGateGranted:
      validatedActual.provisionalResearchGateGranted,
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false
  }, null, 2));
}
