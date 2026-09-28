import assert from "node:assert/strict";
import {
  FACE_LAB_V2_CANDIDATE_EVALUATION_CONTRACT_VERSION,
  FACE_LAB_V2_CANDIDATE_PERSONALIZATION_EVALUATOR_VERSION,
  runFaceLabV2CandidatePersonalizationEvaluation
} from "../lib/face-lab-v2/evaluation/candidate-personalization.js";

const report =
  runFaceLabV2CandidatePersonalizationEvaluation();

assert.equal(
  report.evaluatorVersion,
  FACE_LAB_V2_CANDIDATE_PERSONALIZATION_EVALUATOR_VERSION
);
assert.equal(
  report.contractVersion,
  FACE_LAB_V2_CANDIDATE_EVALUATION_CONTRACT_VERSION
);
assert.equal(report.cohort.faceCount, 8);
assert.equal(report.cohort.targetCount, 12);
assert.equal(report.cohort.caseCount, 96);
assert.equal(report.summary.caseCount, 96);
assert.equal(
  report.summary.hardFailureCount,
  0,
  JSON.stringify(report.failures.slice(0, 30), null, 2)
);

assert.ok(
  report.summary.candidateActivatedCaseCount > 0,
  "candidate foundation must activate on at least one Target Sweep case"
);
assert.equal(
  report.summary.styleDeltaChangedCaseCount,
  report.summary.candidateActivatedCaseCount,
  "every bounded candidate relation activation must produce a Style Delta semantic change"
);
assert.ok(
  report.summary.selectedRouteChangedCaseCount > 0,
  "candidate evaluation must exercise at least one selected-route semantic change"
);

assert.equal(
  report.summary.faceEvidenceUtilizationRate,
  1,
  "every candidate relation action reaching a selected route must retain face evidence"
);
assert.equal(
  report.summary.humanVisibleRationaleMutationRate,
  1,
  "every candidate relation action reaching a selected route must expose a changed explanation"
);

assert.deepEqual(
  Object.keys(
    report.distributions.relationActivationCounts
  ).sort(),
  ["FL-CAND-001", "FL-CAND-002"],
  "only the two frozen candidate relations may activate"
);
assert.ok(
  Object.values(
    report.distributions.relationActivationCounts
  ).every((count) => count > 0),
  "both frozen candidate relations must be exercised by the Target Sweep cohort"
);

assert.equal(
  report.distributions.current
    .uniqueParameterSignatureCount,
  report.distributions.candidate
    .uniqueParameterSignatureCount,
  "vCandidate-1 may not create new parameter signatures"
);
assert.equal(
  report.distributions.current
    .uniqueRouteStrategyCount,
  report.distributions.candidate
    .uniqueRouteStrategyCount,
  "vCandidate-1 strength caps must not create a new route strategy vocabulary"
);

assert.equal(
  report.summary.currentTargetFullyCollapsedCount,
  6,
  "current side must preserve the frozen 16L collapsed-target baseline"
);
assert.equal(
  report.summary
    .currentAverageTargetUniqueActionSignatureCount,
  1.667,
  "current side must preserve the frozen 16L target-specificity baseline"
);
assert.equal(
  report.summary
    .currentAverageFaceUniqueActionSignatureCount,
  10,
  "current side must preserve the frozen 16L face-specificity baseline"
);

for (let index = 0; index < report.rows.length; index += 1) {
  const row = report.rows[index];
  if (!row.candidateRelationIds.length) {
    assert.equal(
      row.currentStyleDeltaSignature,
      row.candidateStyleDeltaSignature,
      "non-activated candidate cases must preserve Style Delta semantics: " +
        row.caseId
    );
  }
}

console.log(JSON.stringify({
  ok: true,
  evaluatorVersion: report.evaluatorVersion,
  contractVersion: report.contractVersion,
  cohort: report.cohort,
  summary: report.summary,
  relationActivationCounts:
    report.distributions.relationActivationCounts,
  targetActivationCounts:
    report.distributions.targetActivationCounts,
  faceActivationCounts:
    report.distributions.faceActivationCounts,
  currentDistribution:
    report.distributions.current,
  candidateDistribution:
    report.distributions.candidate,
  targetDiagnostics: report.targetDiagnostics
}, null, 2));
