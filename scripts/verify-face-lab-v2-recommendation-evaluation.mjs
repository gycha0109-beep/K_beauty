import assert from "node:assert/strict";
import {
  FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE,
  FACE_LAB_V2_COVERAGE_COHORT_SIZE,
  FACE_LAB_V2_LOCKED_COHORT_HASH,
  FACE_LAB_V2_LOCKED_COHORT_SEED,
  FACE_LAB_V2_LOCKED_COHORT_SIZE,
  FACE_LAB_V2_METAMORPHIC_RELATIONS
} from "../lib/face-lab-v2/evaluation/contracts.js";
import {
  FACE_LAB_V2_EVALUATION_HARNESS_VERSION,
  buildFaceLabV2AdversarialCohort,
  buildFaceLabV2CoverageCohort,
  buildFaceLabV2EvaluationCohort,
  runFaceLabV2AdversarialEvaluation,
  runFaceLabV2CoverageEvaluation,
  runFaceLabV2EvaluationSuite,
  runFaceLabV2RecommendationEvaluation
} from "../lib/face-lab-v2/evaluation/harness.js";

function assertNoHardFailures(report, label) {
  assert.equal(
    report.summary.hardFailureCount,
    0,
    `${label}: ${JSON.stringify(report.failures.slice(0, 20), null, 2)}`
  );
  assert.equal(
    report.summary.unexpectedNoRouteCount,
    0,
    `${label}: actionable style priorities must not disappear before route generation`
  );
  assert.equal(report.summary.contractFailureCount, 0);
  assert.equal(report.summary.metamorphicFailureCount, 0);
}

function assertNoRouteAccounting(report, label) {
  const classified = Object.values(
    report.summary.noRouteClassificationCounts || {}
  ).reduce((sum, value) => sum + value, 0);
  assert.equal(
    classified,
    report.summary.noRouteCount,
    `${label}: every no-route case must have an explicit diagnostic classification`
  );
  assert.equal(
    report.noRouteCases.length,
    report.summary.noRouteCount,
    `${label}: no-route diagnostic rows must preserve every bounded case`
  );
}

const locked = runFaceLabV2RecommendationEvaluation({
  seed: FACE_LAB_V2_LOCKED_COHORT_SEED,
  caseCount: FACE_LAB_V2_LOCKED_COHORT_SIZE
});
const lockedReplay = runFaceLabV2RecommendationEvaluation({
  seed: FACE_LAB_V2_LOCKED_COHORT_SEED,
  caseCount: FACE_LAB_V2_LOCKED_COHORT_SIZE
});

assert.equal(locked.harnessVersion, FACE_LAB_V2_EVALUATION_HARNESS_VERSION);
assert.equal(locked.cohort.caseCount, FACE_LAB_V2_LOCKED_COHORT_SIZE);
assert.equal(
  locked.cohort.hash,
  FACE_LAB_V2_LOCKED_COHORT_HASH,
  "locked cohort hash changed; create a new cohort version instead of mutating v1 in place"
);
assert.equal(locked.cohort.hash, lockedReplay.cohort.hash);
assert.deepEqual(locked.summary, lockedReplay.summary);
assert.deepEqual(locked.failures, lockedReplay.failures);

const alternate = buildFaceLabV2EvaluationCohort({
  seed: "face-lab-v2-eval-v1-alternate",
  caseCount: 12
});
assert.equal(
  alternate.cohortHash,
  buildFaceLabV2EvaluationCohort({
    seed: "face-lab-v2-eval-v1-alternate",
    caseCount: 12
  }).cohortHash
);
assert.notEqual(
  alternate.cohortHash,
  buildFaceLabV2EvaluationCohort({
    seed: "face-lab-v2-eval-v1-alternate-2",
    caseCount: 12
  }).cohortHash
);

const coverageCohort = buildFaceLabV2CoverageCohort();
const adversarialCohort = buildFaceLabV2AdversarialCohort();
assert.equal(coverageCohort.caseCount, FACE_LAB_V2_COVERAGE_COHORT_SIZE);
assert.equal(adversarialCohort.caseCount, FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE);
assert.equal(
  coverageCohort.cohortHash,
  buildFaceLabV2CoverageCohort().cohortHash,
  "coverage cohort must replay deterministically"
);
assert.equal(
  adversarialCohort.cohortHash,
  buildFaceLabV2AdversarialCohort().cohortHash,
  "adversarial cohort must replay deterministically"
);

const coverage = runFaceLabV2CoverageEvaluation();
const adversarial = runFaceLabV2AdversarialEvaluation();

for (const [label, report] of [
  ["locked", locked],
  ["coverage", coverage],
  ["adversarial", adversarial]
]) {
  assertNoHardFailures(report, label);
  assertNoRouteAccounting(report, label);
  assert.deepEqual(
    report.relationIds,
    FACE_LAB_V2_METAMORPHIC_RELATIONS.map((item) => item.relationId)
  );
}

assert.ok(
  locked.summary.selectedRouteCaseCount > 0,
  "locked cohort must exercise actionable route generation"
);
assert.ok(
  Object.keys(locked.summary.routeStrategyCounts).length >= 2,
  "locked cohort must exercise more than one selected route strategy"
);
assert.ok(
  locked.summary.uniqueActionSignatureCount >= 4,
  "locked cohort must exercise multiple recommendation action signatures"
);
assert.ok(
  coverage.summary.selectedRouteCaseCount > 0,
  "coverage cohort must include actionable recommendations"
);
assert.ok(
  Object.keys(coverage.summary.actionDomainCounts).length >= 5,
  "coverage cohort must exercise most executable styling domains"
);
assert.ok(
  adversarial.summary.noRouteCount > 0,
  "adversarial cohort must include intentionally bounded no-route states"
);
assert.ok(
  (adversarial.summary.noRouteClassificationCounts
    .EXPECTED_CONSTRAINT_BOUNDED_NO_ROUTE || 0) > 0,
  "adversarial cohort must prove expected constraint-bounded abstention"
);

const suite = runFaceLabV2EvaluationSuite();
assert.equal(
  suite.summary.caseCount,
  FACE_LAB_V2_LOCKED_COHORT_SIZE +
    FACE_LAB_V2_COVERAGE_COHORT_SIZE +
    FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE
);
assert.equal(suite.summary.hardFailureCount, 0);
assert.equal(suite.summary.unexpectedNoRouteCount, 0);

console.log(JSON.stringify({
  ok: true,
  harnessVersion: suite.harnessVersion,
  contractVersion: suite.contractVersion,
  relationIds: locked.relationIds,
  suite: suite.summary,
  cohorts: {
    locked: locked.summary,
    coverage: coverage.summary,
    adversarial: adversarial.summary
  }
}, null, 2));
