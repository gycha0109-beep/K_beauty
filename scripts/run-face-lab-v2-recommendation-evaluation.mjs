import {
  FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE,
  FACE_LAB_V2_COVERAGE_COHORT_SIZE,
  FACE_LAB_V2_LOCKED_COHORT_SEED,
  FACE_LAB_V2_LOCKED_COHORT_SIZE
} from "../lib/face-lab-v2/evaluation/contracts.js";
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
} else if (cohort === "all") {
  const core = runFaceLabV2EvaluationSuite();
  const lineage = runFaceLabV2RecommendationLineageEvaluation(
    buildFaceLabV2CoverageCohort().cases
  );
  const parameterTranslation = runFaceLabV2ParameterTranslationEvaluation();
  report = {
    suiteVersion: "face-lab-v2-recommendation-evaluation-cli-suite-v2",
    harnessVersion: core.harnessVersion,
    contractVersion: core.contractVersion,
    reports: {
      ...core.reports,
      lineage,
      parameterTranslation
    },
    summary: {
      ...core.summary,
      hardFailureCount:
        core.summary.hardFailureCount +
        lineage.summary.hardFailureCount +
        parameterTranslation.summary.hardFailureCount,
      lineageFailureCount: lineage.summary.hardFailureCount,
      lineageActionableCaseCount: lineage.summary.actionableCaseCount,
      lineageSelectedRouteActionCount: lineage.summary.selectedRouteActionCount,
      parameterTranslationFailureCount:
        parameterTranslation.summary.hardFailureCount,
      parameterTranslationUniqueParameterCount:
        parameterTranslation.summary.uniqueParameterCount,
      parameterTranslationActionVariantCount:
        parameterTranslation.summary.actionVariantCount
    }
  };
} else {
  throw new Error(
    "FACE_LAB_EVAL_COHORT must be locked, coverage, adversarial, target-sweep, axis-consumption, lineage, parameter-translation, or all"
  );
}

console.log(JSON.stringify(report, null, 2));

if (report.summary?.hardFailureCount > 0) {
  process.exitCode = 1;
}
