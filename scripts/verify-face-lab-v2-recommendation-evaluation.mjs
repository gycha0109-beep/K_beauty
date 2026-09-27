import assert from "node:assert/strict";
import {
  FACE_LAB_V2_LOCKED_COHORT_SEED,
  FACE_LAB_V2_LOCKED_COHORT_SIZE,
  FACE_LAB_V2_METAMORPHIC_RELATIONS
} from "../lib/face-lab-v2/evaluation/contracts.js";
import {
  FACE_LAB_V2_EVALUATION_HARNESS_VERSION,
  buildFaceLabV2EvaluationCohort,
  runFaceLabV2RecommendationEvaluation
} from "../lib/face-lab-v2/evaluation/harness.js";

const first = runFaceLabV2RecommendationEvaluation({
  seed: FACE_LAB_V2_LOCKED_COHORT_SEED,
  caseCount: FACE_LAB_V2_LOCKED_COHORT_SIZE
});
const replay = runFaceLabV2RecommendationEvaluation({
  seed: FACE_LAB_V2_LOCKED_COHORT_SEED,
  caseCount: FACE_LAB_V2_LOCKED_COHORT_SIZE
});

assert.equal(
  first.harnessVersion,
  FACE_LAB_V2_EVALUATION_HARNESS_VERSION
);
assert.equal(first.cohort.caseCount, FACE_LAB_V2_LOCKED_COHORT_SIZE);
assert.equal(
  first.cohort.hash,
  replay.cohort.hash,
  "locked evaluation cohort must replay to the exact same hash"
);
assert.deepEqual(
  first.summary,
  replay.summary,
  "locked evaluation summary must replay deterministically"
);
assert.deepEqual(
  first.failures,
  replay.failures,
  "locked evaluation failure fingerprints must replay deterministically"
);

const alternate = buildFaceLabV2EvaluationCohort({
  seed: "face-lab-v2-eval-v1-alternate",
  caseCount: 12
});
const alternateReplay = buildFaceLabV2EvaluationCohort({
  seed: "face-lab-v2-eval-v1-alternate",
  caseCount: 12
});
assert.equal(alternate.cohortHash, alternateReplay.cohortHash);
assert.notEqual(
  alternate.cohortHash,
  buildFaceLabV2EvaluationCohort({
    seed: "face-lab-v2-eval-v1-alternate-2",
    caseCount: 12
  }).cohortHash,
  "different seeds must produce different structured-face cohorts"
);

assert.equal(
  first.relationIds.length,
  FACE_LAB_V2_METAMORPHIC_RELATIONS.length
);
assert.deepEqual(
  first.relationIds,
  FACE_LAB_V2_METAMORPHIC_RELATIONS.map((item) => item.relationId)
);
assert.ok(
  first.summary.selectedRouteCaseCount > 0,
  "evaluation cohort must exercise actionable route generation"
);
assert.ok(
  Object.keys(first.summary.routeStrategyCounts).length >= 2,
  "evaluation cohort must exercise more than one selected route strategy"
);
assert.ok(
  first.summary.uniqueActionSignatureCount >= 4,
  "evaluation cohort must exercise multiple recommendation action signatures"
);
assert.equal(
  first.summary.hardFailureCount,
  0,
  JSON.stringify(first.failures.slice(0, 20), null, 2)
);
assert.equal(first.summary.contractFailureCount, 0);
assert.equal(first.summary.metamorphicFailureCount, 0);

console.log(JSON.stringify({
  ok: true,
  harnessVersion: first.harnessVersion,
  contractVersion: first.contractVersion,
  cohort: first.cohort,
  relationIds: first.relationIds,
  summary: first.summary
}, null, 2));
