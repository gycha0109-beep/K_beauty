import assert from "node:assert/strict";
import { inspectSkinDecisionProvenance, SKIN_PROVENANCE_AUDIT_VERSION } from "./skin-decision-provenance-audit-core.mjs";

const safe = {
  photoEvidenceState: { status: "available" },
  photoObservations: {
    signals: [{ key: "redness", confidence: "high" }],
    surveyAlignment: { status: "mixed" }
  },
  freeResult: {
    scoring: { concernScores: {
      redness: { total: 27, photo: 12 },
      pores: { total: 8, photo: 0 }
    } }
  },
  decisionBundle: {
    context: {
      photo: { status: "available", evidenceAvailable: true },
      concernState: { surveyPhotoAlignment: "partial" },
      productExposureState: { rows: [] }
    },
    consistency: { violations: [] },
    effectivePolicySource: "raw",
    routineProductActions: []
  }
};
const before = JSON.stringify(safe);
const cleared = inspectSkinDecisionProvenance(safe);
assert.equal(cleared.version, SKIN_PROVENANCE_AUDIT_VERSION);
assert.equal(cleared.status, "NO_FLAGGED_INVARIANT");
assert.equal(cleared.findingCount, 0);
assert.equal(cleared.disclosure.noFindingDoesNotProveSkinAccuracy, true);
assert.equal(JSON.stringify(safe), before, "audit must not mutate source report");
assert.deepEqual(inspectSkinDecisionProvenance(safe), cleared);

const unsafe = structuredClone(safe);
unsafe.photoEvidenceState = { status: "unavailable", failureClass: "provider_failure" };
unsafe.photoObservations = {
  signals: [{ key: "redness", confidence: "low" }],
  surveyAlignment: { status: "mixed" }
};
unsafe.freeResult.scoring.concernScores.dehydration = { total: 15, photo: 12 };
unsafe.decisionBundle.context.photo = { status: "available", evidenceAvailable: true };
unsafe.decisionBundle.context.concernState.surveyPhotoAlignment = "unknown";
unsafe.decisionBundle.context.productExposureState.rows = [
  { sourceState: "not_in_db", productId: "unknown_product" }
];
unsafe.decisionBundle.consistency.violations = [{ severity: "critical", ruleId: "test_critical" }];
unsafe.decisionBundle.routineProductActions = [{ action: "stop", productId: "unknown_product" }];
const problematic = inspectSkinDecisionProvenance(unsafe);
assert.equal(problematic.status, "REVIEW_REQUIRED");
const codes = problematic.findings.map(x => x.code);
for (const code of [
  "PHOTO_FAILURE_PROMOTED_AVAILABLE",
  "FALLBACK_COUNTS_AS_PHOTO_EVIDENCE",
  "MIXED_ALIGNMENT_LOST",
  "PHOTO_SCORE_LOW_AXIS_CONFIDENCE:redness",
  "PHOTO_SCORE_WITHOUT_AXIS_CUE:dehydration",
  "PHOTO_SCORE_WHEN_UNAVAILABLE:redness",
  "PHOTO_SCORE_WHEN_UNAVAILABLE:dehydration",
  "CRITICAL_CONSISTENCY_RAW_POLICY",
  "UNKNOWN_PRODUCT_FORCED_STOP"
]) assert(codes.includes(code), "missing diagnostic " + code);
assert.equal(problematic.findingCount, 9);
assert.deepEqual([...codes].sort(), codes, "deterministic codes");

const repaired = structuredClone(unsafe);
repaired.photoEvidenceState.status = "available";
repaired.decisionBundle.context.concernState.surveyPhotoAlignment = "partial";
repaired.decisionBundle.consistency.violations = [];
repaired.decisionBundle.routineProductActions = [{ action: "check_needed", productId: "unknown_product" }];
repaired.photoObservations.signals[0].confidence = "high";
delete repaired.freeResult.scoring.concernScores.dehydration;
const cleaned = inspectSkinDecisionProvenance(repaired);
assert.equal(cleaned.status, "NO_FLAGGED_INVARIANT");
assert.equal(cleaned.findingCount, 0);

const conflictLost = inspectSkinDecisionProvenance({
  photoEvidenceState: { status: "available" },
  photoObservations: { signals: [], surveyAlignment: { status: "conflict" } },
  decisionBundle: { context: { photo: { status: "available" }, concernState: { surveyPhotoAlignment: "unknown" } } }
});
assert(conflictLost.findings.some(f => f.code === "PHOTO_SURVEY_CONFLICT_LOST"));
assert.throws(() => inspectSkinDecisionProvenance(null), /report_invalid/);
console.log("verify-face-lab-skin-s2-provenance: PASS (synthetic, diagnostic-only)");
