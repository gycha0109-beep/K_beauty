import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildRealPhotoStabilityAdequacyReview
} from "../lib/face-lab-real-photo-stability-adequacy-review.js";

const [reviewPacketPath, reviewPath, contractPath] = process.argv.slice(2);
if (!reviewPacketPath || !reviewPath || !contractPath) {
  throw new Error(
    "Usage: node scripts/verify-face-lab-real-photo-stability-adequacy-review.mjs <review-packet.json> <adequacy-review.json> <adequacy-contract.json>"
  );
}

const reviewPacket = JSON.parse(readFileSync(reviewPacketPath, "utf8"));
const review = JSON.parse(readFileSync(reviewPath, "utf8"));
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

const rebuilt = buildRealPhotoStabilityAdequacyReview(reviewPacket);
assert.deepEqual(review, rebuilt);

assert.equal(review.schemaVersion, "face-lab-real-photo-stability-adequacy-review-v1");
assert.equal(review.reviewVersion, "real-photo-stability-adequacy-review-v1");
assert.equal(review.status, "descriptive_review_complete_decision_separate");
assert.equal(review.boundEvidence.sourceReportCount, 488);
assert.equal(review.coverage.completeNuisanceCoverage, true);
assert.deepEqual(review.coverage.coveredNuisanceClasses, [
  "expression",
  "head_pitch",
  "head_roll",
  "head_yaw"
]);
assert.deepEqual(review.coverage.missingNuisanceClasses, []);
assert.deepEqual(review.coverage.reportCountByNuisance, {
  expression: 102,
  head_pitch: 180,
  head_roll: 2,
  head_yaw: 204
});

const roll = review.driftAnalysis.nuisanceClasses.find(
  (item) => item.nuisanceClass === "head_roll"
);
assert.ok(roll);
assert.equal(roll.reportCount, 2);
assert.equal(roll.subjectLinkageEvidenceRefCount, 1);
assert.equal(
  roll.distributionalInterpretation,
  "limited_single_subject_two_observations"
);

assert.equal(review.reviewSemantics.descriptiveOnly, true);
assert.equal(review.reviewSemantics.thresholdsApplied, false);
assert.equal(review.reviewSemantics.automaticPassFail, false);
assert.equal(review.reviewSemantics.automaticRanking, false);
assert.equal(review.reviewSemantics.adequacyDecisionIncluded, false);

assert.equal(review.authority.productionAuthority, false);
assert.equal(review.authority.normalizationAuthority, false);
assert.equal(review.authority.thresholdAuthority, false);
assert.equal(review.authority.populationAuthority, false);
assert.equal(review.authority.adequacyDecisionAuthority, false);

assert.equal(
  review.boundEvidence.collectionFingerprint,
  contract.currentEvidence.collectionFingerprint
);
assert.equal(
  review.boundEvidence.reviewPacketFingerprint,
  contract.currentEvidence.reviewPacketFingerprint
);
assert.equal(
  review.analysisFingerprint,
  contract.currentEvidence.descriptiveAdequacyReviewFingerprint
);
assert.equal(contract.currentEvidence.descriptiveAdequacyReviewPresent, true);

assert.ok(
  review.evidenceLimitations.some((item) =>
    item.includes("two same-session observations from one subject")
  )
);
assert.ok(
  review.evidenceLimitations.some((item) =>
    item.includes("no numeric adequacy threshold")
  )
);
assert.ok(
  review.evidenceLimitations.some((item) =>
    item.includes("chin_height_ratio") && item.includes("nose_width_ratio")
  )
);

console.log(JSON.stringify({
  ok: true,
  sourceReportCount: review.boundEvidence.sourceReportCount,
  analysisFingerprint: review.analysisFingerprint,
  completeNuisanceCoverage: true,
  headRollReportCount: roll.reportCount,
  headRollSubjectLinkageEvidenceRefCount: roll.subjectLinkageEvidenceRefCount,
  adequacyDecisionPresent: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
}, null, 2));
