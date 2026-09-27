import {
  FACE_LAB_V2_LOCKED_COHORT_SEED,
  FACE_LAB_V2_LOCKED_COHORT_SIZE
} from "../lib/face-lab-v2/evaluation/contracts.js";
import {
  runFaceLabV2RecommendationEvaluation
} from "../lib/face-lab-v2/evaluation/harness.js";

const requestedCount = Number(process.env.FACE_LAB_EVAL_CASE_COUNT);
const caseCount = Number.isInteger(requestedCount) && requestedCount > 0
  ? Math.min(requestedCount, 5000)
  : FACE_LAB_V2_LOCKED_COHORT_SIZE;
const seed = process.env.FACE_LAB_EVAL_SEED || FACE_LAB_V2_LOCKED_COHORT_SEED;

const report = runFaceLabV2RecommendationEvaluation({ seed, caseCount });
console.log(JSON.stringify(report, null, 2));

if (report.summary.hardFailureCount > 0) {
  process.exitCode = 1;
}
