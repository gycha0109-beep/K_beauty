import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { normalizeVisionObservationBundle } from "../../../lib/vision-observation-normalizer.js";
import { buildSharedSkinDecisionContext } from "../../../lib/shared-skin-decision-context-v4.js";

// S0 diagnostic only: reproduce current behavior; these assertions are NOT desired semantics.
// Not wired into product runtime/CI. Remove or rewrite after approved contract repairs.
const eligibility = {
  status: "eligible",
  source: "vision",
  imageType: "photorealistic_human",
  humanFaceCount: 1,
  faceLabEligible: true,
  skinAnalysisEligible: true,
  faceLabFailureReason: null,
  skinFailureReason: null,
  confidence: 0.91,
  evidence: ["One clearly visible face is present."]
};

function bundle(signals, confidence = "low") {
  return normalizeVisionObservationBundle({
    schemaVersion: "vision-observation-v1",
    eligibility,
    skin: {
      signals,
      observations: [{
        key: "redness",
        area: "cheeks",
        cue: "red_appearance",
        level: "high",
        confidence
      }]
    },
    face: null
  });
}

const missing = bundle({ redness: 5 }, "low");
const explicitZero = bundle({ redness: 5, pores: 0 }, "low");
assert.equal(missing.skin.status, "available");
assert.equal(missing.skin.signals.pores, 0);
assert.equal(explicitZero.skin.signals.pores, 0);
assert.equal(missing.skin.observations[0].confidence, "low");

const scorerSource = readFileSync("lib/skin-match-decision-engine-core.js", "utf8");
const marker = "function applyPhotoWeights(";
const start = scorerSource.indexOf(marker);
assert.ok(start >= 0, "S0 photo-weight function must be inspected explicitly");
const end = scorerSource.indexOf("\n}\n", start);
assert.ok(end > start, "function boundary must be found (diagnostic is deliberately narrow)");
const scorerFunction = scorerSource.slice(start, end + 2);
const applyPhotoWeights = runInNewContext("(" + scorerFunction + ")", {
  CONCERN_AXES: ["redness"],
  clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
  addScore: (card, axis, bucket, value) => {
    if (!card[axis] || !value) return;
    card[axis].total += value;
    card[axis][bucket] += value;
  }
});
function photoPoints(confidence, eligible = true) {
  const card = { redness: { total: 0, photo: 0 } };
  const normalized = bundle({ redness: 5 }, confidence);
  applyPhotoWeights(card, {
    imageEligibility: { skinAnalysisEligible: eligible },
    signals: normalized.skin.signals,
    photoObservations: { signals: normalized.skin.observations }
  });
  return card.redness.photo;
}
assert.equal(photoPoints("low"), 20);
assert.equal(photoPoints("high"), 20);
assert.equal(photoPoints("high", false), 0);

const basicReport = {
  freeResult: {
    priority: { axis: "redness", score: 20 },
    scoring: { concernScores: { redness: { total: 20 } } },
    answers: { skinType: "combination", sensitivity: "medium" }
  },
  photoEvidenceState: {
    status: "unavailable",
    failureReason: "vision_request_failed",
    failureClass: "provider_failure",
    source: "vision"
  },
  photoObservations: {
    summary: "Photo unavailable: survey-only fallback",
    signals: [],
    surveyAlignment: { status: "unknown", note: "Photo unavailable" }
  }
};
const failure = buildSharedSkinDecisionContext(basicReport);
assert.equal(failure.context.photo.status, "available", "reproduces fallback presence overriding explicit failure");
assert.equal(failure.context.photo.evidenceAvailable, true, "reproduces evidenceAvailable from fallback object");
assert.equal(failure.context.photo.failureClass, "provider_failure", "declared failure class survives despite contradictory status");
const mixed = buildSharedSkinDecisionContext({
  ...basicReport,
  photoEvidenceState: { status: "available", source: "vision" },
  photoObservations: {
    summary: "Some cues",
    signals: [{ key: "redness", confidence: "medium" }],
    surveyAlignment: { status: "mixed" }
  }
});
assert.equal(mixed.context.concernState.surveyPhotoAlignment, "unknown", "mixed is not a recognized v4 token");

console.log(JSON.stringify({
  diagnostic: "face-lab-skin-s0-photo-evidence",
  classification: "RISKS_REPRODUCED_NOT_CORRECTNESS_PASS",
  checks: {
    unsupportedAndExplicitZeroCollapse: true,
    lowAndHighConfidencePhotoPointsIdentical: true,
    ineligiblePhotoPointsZero: true,
    fallbackAvailabilityContradictsExplicitFailure: true,
    mixedAlignmentDowngradedToUnknown: true
  },
  providerCalls: 0,
  productionMutations: 0,
  realPhotoAccuracyValidated: false
}, null, 2));
