import assert from "node:assert/strict";
import {
  FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE,
  FACE_LAB_V2_COVERAGE_COHORT_SIZE,
  FACE_LAB_V2_LOCKED_COHORT_HASH,
  FACE_LAB_V2_LOCKED_COHORT_SEED,
  FACE_LAB_V2_LOCKED_COHORT_SIZE,
  FACE_LAB_V2_METAMORPHIC_RELATIONS,
  FACE_LAB_V2_TARGET_SWEEP_COHORT_HASH
} from "../lib/face-lab-v2/evaluation/contracts.js";
import {
  FACE_LAB_V2_SPECIFICITY_DISTRIBUTION_VERSION,
  runFaceLabV2SpecificityDistributionEvaluation
} from "../lib/face-lab-v2/evaluation/specificity-distribution.js";
import {
  FACE_LAB_V2_FACE_RESPONSIVENESS_VERSION,
  runFaceLabV2FaceResponsivenessEvaluation
} from "../lib/face-lab-v2/evaluation/face-responsiveness.js";
import {
  FACE_LAB_V2_PROPERTY_FUZZ_CASES_PER_SEED,
  FACE_LAB_V2_PROPERTY_FUZZ_SEEDS,
  FACE_LAB_V2_PROPERTY_FUZZ_VERSION,
  minimizeFaceLabV2FuzzFailure,
  runFaceLabV2PropertyFuzzEvaluation
} from "../lib/face-lab-v2/evaluation/property-fuzz.js";
import {
  FACE_LAB_V2_CONSTRAINT_RESPONSIVENESS_VERSION,
  runFaceLabV2ConstraintResponsivenessEvaluation
} from "../lib/face-lab-v2/evaluation/constraint-responsiveness.js";
import {
  FACE_LAB_V2_PARAMETER_TRANSLATION_EVALUATOR_VERSION,
  runFaceLabV2ParameterTranslationEvaluation
} from "../lib/face-lab-v2/evaluation/parameter-translation.js";
import {
  FACE_LAB_V2_LINEAGE_EVALUATOR_VERSION,
  runFaceLabV2RecommendationLineageEvaluation
} from "../lib/face-lab-v2/evaluation/lineage.js";
import {
  FACE_LAB_V2_AXIS_CONSUMPTION_EVALUATOR_VERSION,
  runFaceLabV2AxisConsumptionEvaluation
} from "../lib/face-lab-v2/evaluation/axis-consumption.js";
import {
  FACE_LAB_V2_TARGET_RESPONSIVENESS_VERSION,
  buildFaceLabV2TargetSweepCohort,
  runFaceLabV2TargetResponsivenessEvaluation
} from "../lib/face-lab-v2/evaluation/target-responsiveness.js";
import {
  FACE_LAB_V2_EVALUATION_HARNESS_VERSION,
  buildFaceLabV2AdversarialCohort,
  buildFaceLabV2CoverageCohort,
  buildFaceLabV2EvaluationCohort,
  evaluateFaceLabV2RecommendationCase,
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

const targetSweepCohort = buildFaceLabV2TargetSweepCohort();
const targetSweepReplay = buildFaceLabV2TargetSweepCohort();
assert.equal(
  targetSweepCohort.cohortHash,
  targetSweepReplay.cohortHash,
  "target-sweep cohort must replay deterministically"
);
assert.equal(
  targetSweepCohort.cohortHash,
  FACE_LAB_V2_TARGET_SWEEP_COHORT_HASH,
  "target-sweep v1 cohort changed; create a new cohort version instead of mutating it in place"
);
assert.equal(targetSweepCohort.faceCount, 8);
assert.equal(targetSweepCohort.targetCount, 12);
assert.equal(targetSweepCohort.caseCount, 96);

const faceResponsiveness = runFaceLabV2FaceResponsivenessEvaluation();
assert.equal(
  faceResponsiveness.evaluatorVersion,
  FACE_LAB_V2_FACE_RESPONSIVENESS_VERSION
);
assert.equal(faceResponsiveness.summary.pairedComparisonCount, 22);
assert.equal(faceResponsiveness.summary.recommendationModifierPairCount, 4);
assert.equal(faceResponsiveness.summary.nonAuthorityPairCount, 18);
assert.equal(faceResponsiveness.summary.profileOnlyPairCount, 15);
assert.equal(faceResponsiveness.summary.observedNotProfilePairCount, 3);
assert.equal(
  faceResponsiveness.summary.styleDeltaChangedPairCount,
  faceResponsiveness.summary.recommendationModifierPairCount,
  "only current modifier-backed observations may change Style Delta action semantics"
);
assert.equal(
  faceResponsiveness.summary.selectedRouteChangedPairCount,
  faceResponsiveness.summary.recommendationModifierPairCount,
  "all current modifier-backed observations must propagate to selected route actions"
);
assert.equal(
  faceResponsiveness.summary.hardFailureCount,
  0,
  JSON.stringify(faceResponsiveness.failures.slice(0, 30), null, 2)
);

const specificityDistribution =
  runFaceLabV2SpecificityDistributionEvaluation();
assert.equal(
  specificityDistribution.evaluatorVersion,
  FACE_LAB_V2_SPECIFICITY_DISTRIBUTION_VERSION
);
assert.equal(specificityDistribution.summary.caseCount, 96);
assert.equal(specificityDistribution.cohort.faceCount, 8);
assert.equal(specificityDistribution.cohort.targetCount, 12);
assert.equal(
  specificityDistribution.summary.hardFailureCount,
  0,
  JSON.stringify(specificityDistribution.failures, null, 2)
);
assert.equal(
  specificityDistribution.targetDiagnostics.length,
  specificityDistribution.cohort.targetCount
);
assert.equal(
  specificityDistribution.faceDiagnostics.length,
  specificityDistribution.cohort.faceCount
);

const propertyFuzz = runFaceLabV2PropertyFuzzEvaluation();
assert.equal(
  propertyFuzz.evaluatorVersion,
  FACE_LAB_V2_PROPERTY_FUZZ_VERSION
);
assert.equal(
  propertyFuzz.summary.seedCount,
  FACE_LAB_V2_PROPERTY_FUZZ_SEEDS.length
);
assert.equal(
  propertyFuzz.summary.totalCaseCount,
  FACE_LAB_V2_PROPERTY_FUZZ_SEEDS.length *
    FACE_LAB_V2_PROPERTY_FUZZ_CASES_PER_SEED
);
assert.equal(
  propertyFuzz.summary.hardFailureCount,
  0,
  JSON.stringify(propertyFuzz.counterexamples.slice(0, 12), null, 2)
);
assert.equal(propertyFuzz.summary.minimizedCounterexampleCount, 0);

for (const seedReport of propertyFuzz.seedReports) {
  const replay = buildFaceLabV2EvaluationCohort({
    seed: seedReport.seed,
    caseCount: FACE_LAB_V2_PROPERTY_FUZZ_CASES_PER_SEED
  });
  assert.equal(
    seedReport.cohortHash,
    replay.cohortHash,
    `property fuzz seed must replay exactly: ${seedReport.seed}`
  );
}

const shrinkProbe = structuredClone(coverageCohort.cases[0]);
shrinkProbe.caseId = "FL-FUZZ-SHRINK-PROBE";
shrinkProbe.surveyAnswers.targetSelections = [];
const shrinkProbeEvaluated =
  evaluateFaceLabV2RecommendationCase(shrinkProbe);
const shrinkProbeFailure = shrinkProbeEvaluated.failures.find(
  (item) => item.evaluatorId === "E1-target-authority"
);
assert.ok(
  shrinkProbeFailure,
  "shrink probe must create a deterministic target-authority failure"
);
const shrinkProbeMinimized = minimizeFaceLabV2FuzzFailure(
  shrinkProbe,
  shrinkProbeFailure
);
assert.equal(
  shrinkProbeMinimized.failureIdentity,
  "E1-target-authority|"
);
assert.equal(
  shrinkProbeMinimized.minimizedFailure.evaluatorId,
  "E1-target-authority"
);
assert.ok(
  shrinkProbeMinimized.steps.length > 0,
  "fuzz failure reducer must simplify at least one survey dimension while preserving failure identity"
);

const constraintResponsiveness =
  runFaceLabV2ConstraintResponsivenessEvaluation(targetSweepCohort.cases);
assert.equal(
  constraintResponsiveness.evaluatorVersion,
  FACE_LAB_V2_CONSTRAINT_RESPONSIVENESS_VERSION
);
assert.equal(
  constraintResponsiveness.summary.pairedComparisonCount,
  targetSweepCohort.caseCount * 4
);
assert.equal(
  constraintResponsiveness.summary.hardFailureCount,
  0,
  JSON.stringify(constraintResponsiveness.failures.slice(0, 30), null, 2)
);

const targetResponsiveness = runFaceLabV2TargetResponsivenessEvaluation();
assert.equal(
  targetResponsiveness.evaluatorVersion,
  FACE_LAB_V2_TARGET_RESPONSIVENESS_VERSION
);
assert.equal(
  targetResponsiveness.summary.hardFailureCount,
  0,
  JSON.stringify(targetResponsiveness.failures.slice(0, 20), null, 2)
);
assert.equal(
  targetResponsiveness.summary.collapsedFaceCount,
  0,
  "no structured face may collapse all confirmed targets into one style-delta signature"
);
assert.equal(
  targetResponsiveness.summary.contrastPairComparisonCount,
  targetSweepCohort.faceCount * 6
);
assert.ok(
  targetResponsiveness.summary.averageUniqueStyleDeltaSignatures > 1,
  "target sweep must demonstrate recommendation sensitivity beyond one signature"
);

const parameterTranslation = runFaceLabV2ParameterTranslationEvaluation();
assert.equal(
  parameterTranslation.evaluatorVersion,
  FACE_LAB_V2_PARAMETER_TRANSLATION_EVALUATOR_VERSION
);
assert.ok(
  parameterTranslation.summary.uniqueParameterCount >= 20,
  "parameter translation evaluator must exercise the current Style Delta parameter surface"
);
assert.equal(
  parameterTranslation.summary.hardFailureCount,
  0,
  JSON.stringify(parameterTranslation.failures, null, 2)
);

const lineage = runFaceLabV2RecommendationLineageEvaluation(
  coverageCohort.cases
);
assert.equal(
  lineage.evaluatorVersion,
  FACE_LAB_V2_LINEAGE_EVALUATOR_VERSION
);
assert.ok(
  lineage.summary.actionableCaseCount > 0,
  "lineage evaluation must exercise actionable recommendations"
);
assert.ok(
  Object.keys(lineage.summary.executionDomainCounts).length >= 5,
  "lineage evaluation must exercise most execution domains"
);
assert.equal(
  lineage.summary.hardFailureCount,
  0,
  JSON.stringify(lineage.failures.slice(0, 30), null, 2)
);

const axisConsumption = runFaceLabV2AxisConsumptionEvaluation();
assert.equal(
  axisConsumption.evaluatorVersion,
  FACE_LAB_V2_AXIS_CONSUMPTION_EVALUATOR_VERSION
);
assert.equal(
  axisConsumption.summary.hardFailureCount,
  0,
  JSON.stringify(axisConsumption.failures, null, 2)
);
assert.equal(
  axisConsumption.summary.fullyConsumedAxisCount,
  axisConsumption.summary.axisCount,
  "every advertised style axis must produce executable low/high priorities when isolated"
);

const suite = runFaceLabV2EvaluationSuite();
assert.equal(
  suite.summary.caseCount,
  FACE_LAB_V2_LOCKED_COHORT_SIZE +
    FACE_LAB_V2_COVERAGE_COHORT_SIZE +
    FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE +
    targetResponsiveness.cohort.caseCount
);
assert.equal(suite.summary.hardFailureCount, 0);
assert.equal(suite.summary.unexpectedNoRouteCount, 0);
assert.equal(suite.summary.targetCollapsedFaceCount, 0);

console.log(JSON.stringify({
  ok: true,
  harnessVersion: suite.harnessVersion,
  contractVersion: suite.contractVersion,
  relationIds: locked.relationIds,
  suite: suite.summary,
  cohorts: {
    locked: locked.summary,
    coverage: coverage.summary,
    adversarial: adversarial.summary,
    targetResponsiveness: targetResponsiveness.summary,
    axisConsumption: axisConsumption.summary,
    lineage: lineage.summary,
    parameterTranslation: parameterTranslation.summary,
    constraintResponsiveness: constraintResponsiveness.summary,
    propertyFuzz: propertyFuzz.summary,
    faceResponsiveness: faceResponsiveness.summary,
    specificityDistribution: specificityDistribution.summary
  },
  targetSweep: {
    cohort: targetResponsiveness.cohort,
    faceDiagnostics: targetResponsiveness.faceDiagnostics
  }
}, null, 2));
