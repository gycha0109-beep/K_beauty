import {
  FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE,
  FACE_LAB_V2_COVERAGE_COHORT_SIZE,
  FACE_LAB_V2_LOCKED_COHORT_SEED,
  FACE_LAB_V2_LOCKED_COHORT_SIZE
} from "../lib/face-lab-v2/evaluation/contracts.js";
import {
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
} else if (cohort === "all") {
  report = runFaceLabV2EvaluationSuite();
} else {
  throw new Error(
    "FACE_LAB_EVAL_COHORT must be locked, coverage, adversarial, or all"
  );
}

console.log(JSON.stringify(report, null, 2));

if (report.summary?.hardFailureCount > 0) {
  process.exitCode = 1;
}
