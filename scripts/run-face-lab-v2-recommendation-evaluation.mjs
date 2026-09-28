import {
  FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE,
  FACE_LAB_V2_COVERAGE_COHORT_SIZE,
  FACE_LAB_V2_LOCKED_COHORT_SEED,
  FACE_LAB_V2_LOCKED_COHORT_SIZE
} from "../lib/face-lab-v2/evaluation/contracts.js";
import {
  runFaceLabV2SpecificityDistributionEvaluation
} from "../lib/face-lab-v2/evaluation/specificity-distribution.js";
import {
  runFaceLabV2CandidatePersonalizationEvaluation
} from "../lib/face-lab-v2/evaluation/candidate-personalization.js";
import {
  runFaceLabV2FaceResponsivenessEvaluation
} from "../lib/face-lab-v2/evaluation/face-responsiveness.js";
import {
  runFaceLabV2PropertyFuzzEvaluation
} from "../lib/face-lab-v2/evaluation/property-fuzz.js";
import {
  runFaceLabV2ConstraintResponsivenessEvaluation
} from "../lib/face-lab-v2/evaluation/constraint-responsiveness.js";
import {
  runFaceLabV2ParameterTranslationEvaluation
} from "../lib/face-lab-v2/evaluation/parameter-translation.js";
import {
  runFaceLabV2RecommendationLineageEvaluation
} from "../lib/face-lab-v2/evaluation/lineage.js";
import {
  runFaceLabV2AxisConsumptionEvaluation
} from "../lib/face-lab-v2/evaluation/axis-consumption.js";
import {
  buildFaceLabV2TargetSweepCohort,
  runFaceLabV2TargetResponsivenessEvaluation
} from "../lib/face-lab-v2/evaluation/target-responsiveness.js";
import {
  buildFaceLabV2CoverageCohort,
  runFaceLabV2AdversarialEvaluation,
  runFaceLabV2CoverageEvaluation,
  runFaceLabV2EvaluationSuite,
  runFaceLabV2RecommendationEvaluation
} from "../lib/face-lab-v2/evaluation/harness.js";

const cohort = (process.env.FACE_LAB_EVAL_COHORT || "locked").toLowerCase();
const requestedCount = Number(process.env.FACE_LAB_EVAL_CASE_COUNT);
const seed = process.env.FACE_LAB_EVAL_SEED || FACE_LAB_V2_LOCKED_COHORT_SEED;

function boundedCount(fallback, maximum = 5000) {
  return Number.isInteger(requestedCount) && requestedCount > 0
    ? Math.min(requestedCount, maximum)
    : fallback;
}

let report;

if (cohort === "locked") {
  report = runFaceLabV2RecommendationEvaluation({
    seed,
    caseCount: boundedCount(FACE_LAB_V2_LOCKED_COHORT_SIZE)
  });
} else if (cohort === "coverage") {
  report = runFaceLabV2CoverageEvaluation({
    seed: process.env.FACE_LAB_EVAL_SEED,
    caseCount: boundedCount(FACE_LAB_V2_COVERAGE_COHORT_SIZE, FACE_LAB_V2_COVERAGE_COHORT_SIZE)
  });
} else if (cohort === "adversarial") {
  report = runFaceLabV2AdversarialEvaluation({
    seed: process.env.FACE_LAB_EVAL_SEED,
    caseCount: boundedCount(
      FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE,
      FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE
    )
  });
} else if (cohort === "target-sweep") {
  report = runFaceLabV2TargetResponsivenessEvaluation();
} else if (cohort === "axis-consumption") {
  report = runFaceLabV2AxisConsumptionEvaluation();
} else if (cohort === "lineage") {
  report = runFaceLabV2RecommendationLineageEvaluation(
    buildFaceLabV2CoverageCohort().cases
  );
} else if (cohort === "parameter-translation") {
  report = runFaceLabV2ParameterTranslationEvaluation();
} else if (cohort === "constraint-responsiveness") {
  report = runFaceLabV2ConstraintResponsivenessEvaluation(
    buildFaceLabV2TargetSweepCohort().cases
  );
} else if (cohort === "property-fuzz") {
  report = runFaceLabV2PropertyFuzzEvaluation();
} else if (cohort === "face-responsiveness") {
  report = runFaceLabV2FaceResponsivenessEvaluation();
} else if (cohort === "specificity-distribution") {
  report = runFaceLabV2SpecificityDistributionEvaluation();
} else if (cohort === "candidate-personalization") {
  report = runFaceLabV2CandidatePersonalizationEvaluation();
} else if (cohort === "all") {
  const core = runFaceLabV2EvaluationSuite();
  const lineage = runFaceLabV2RecommendationLineageEvaluation(
    buildFaceLabV2CoverageCohort().cases
  );
  const parameterTranslation = runFaceLabV2ParameterTranslationEvaluation();
  const constraintResponsiveness =
    runFaceLabV2ConstraintResponsivenessEvaluation(
      buildFaceLabV2TargetSweepCohort().cases
    );
  const propertyFuzz = runFaceLabV2PropertyFuzzEvaluation();
  const faceResponsiveness = runFaceLabV2FaceResponsivenessEvaluation();
  const specificityDistribution = runFaceLabV2SpecificityDistributionEvaluation();
  const candidatePersonalization =
    runFaceLabV2CandidatePersonalizationEvaluation();
  report = {
    suiteVersion: "face-lab-v2-recommendation-evaluation-cli-suite-v7",
    harnessVersion: core.harnessVersion,
    contractVersion: core.contractVersion,
    reports: {
      ...core.reports,
      lineage,
      parameterTranslation,
      constraintResponsiveness,
      propertyFuzz,
      faceResponsiveness,
      specificityDistribution,
      candidatePersonalization
    },
    summary: {
      ...core.summary,
      hardFailureCount:
        core.summary.hardFailureCount +
        lineage.summary.hardFailureCount +
        parameterTranslation.summary.hardFailureCount +
        constraintResponsiveness.summary.hardFailureCount +
        propertyFuzz.summary.hardFailureCount +
        faceResponsiveness.summary.hardFailureCount +
        specificityDistribution.summary.hardFailureCount +
        candidatePersonalization.summary.hardFailureCount,
      lineageFailureCount: lineage.summary.hardFailureCount,
      lineageActionableCaseCount: lineage.summary.actionableCaseCount,
      lineageSelectedRouteActionCount: lineage.summary.selectedRouteActionCount,
      parameterTranslationFailureCount:
        parameterTranslation.summary.hardFailureCount,
      parameterTranslationUniqueParameterCount:
        parameterTranslation.summary.uniqueParameterCount,
      parameterTranslationActionVariantCount:
        parameterTranslation.summary.actionVariantCount,
      constraintResponsivenessFailureCount:
        constraintResponsiveness.summary.hardFailureCount,
      constraintResponsivenessPairCount:
        constraintResponsiveness.summary.pairedComparisonCount,
      propertyFuzzFailureCount: propertyFuzz.summary.hardFailureCount,
      propertyFuzzCaseCount: propertyFuzz.summary.totalCaseCount,
      faceResponsivenessFailureCount: faceResponsiveness.summary.hardFailureCount,
      faceResponsivenessPairCount: faceResponsiveness.summary.pairedComparisonCount,
      specificityDistributionFailureCount: specificityDistribution.summary.hardFailureCount,
      specificityDistributionCaseCount: specificityDistribution.summary.caseCount,
      candidatePersonalizationFailureCount:
        candidatePersonalization.summary.hardFailureCount,
      candidatePersonalizationCaseCount:
        candidatePersonalization.summary.caseCount,
      candidatePersonalizationActivatedCaseCount:
        candidatePersonalization.summary.candidateActivatedCaseCount
    }
  };
} else {
  throw new Error(
    "FACE_LAB_EVAL_COHORT must be locked, coverage, adversarial, target-sweep, axis-consumption, lineage, parameter-translation, constraint-responsiveness, property-fuzz, face-responsiveness, specificity-distribution, candidate-personalization, or all"
  );
}

console.log(JSON.stringify(report, null, 2));

if (report.summary?.hardFailureCount > 0) {
  process.exitCode = 1;
}
