import assert from "node:assert/strict";
import {
  FACE_LAB_V2_END_TO_END_COMPLETION_AUDIT_VERSION,
  runFaceLabV2EndToEndCompletionAudit
} from "../lib/face-lab-v2/evaluation/end-to-end-completion.js";

const report = runFaceLabV2EndToEndCompletionAudit();

assert.equal(
  report.evaluatorVersion,
  "face-lab-v2-end-to-end-completion-audit-v1"
);
assert.equal(report.cohort.faceCount, 8);
assert.equal(report.cohort.targetCount, 12);
assert.equal(report.cohort.baseCaseCount, 96);
assert.deepEqual(
  report.cohort.recommendationPriorityModes,
  ["face_harmony", "target_forward"]
);
assert.equal(report.summary.previewCaseCount, 192);
assert.ok(
  report.summary.explicitRouteChoiceCaseCount > report.summary.previewCaseCount,
  "the completion audit must exercise every emitted Route, not only one route per case"
);
assert.equal(
  report.summary.routeChoiceEvidenceCount,
  report.summary.explicitRouteChoiceCaseCount
);
assert.equal(
  report.summary.roundTripCaseCount,
  report.summary.explicitRouteChoiceCaseCount
);
assert.equal(report.summary.previewExecutionLeakCount, 0);
assert.equal(report.summary.previewLookLeakCount, 0);
assert.equal(report.summary.previewProductLeakCount, 0);
assert.equal(report.summary.selectionMismatchCount, 0);
assert.equal(report.summary.executionMismatchCount, 0);
assert.equal(report.summary.evidenceMismatchCount, 0);
assert.equal(report.summary.roundTripMismatchCount, 0);
assert.equal(
  report.summary.hardFailureCount,
  0,
  JSON.stringify(report.failures.slice(0, 30), null, 2)
);
assert.equal(report.rows.length, 192);
assert.ok(
  report.rows.every((row) =>
    row.routeCount >= 1 &&
    row.choices.length === row.routeCount
  )
);
assert.ok(
  report.rows
    .filter((row) => row.routeCount >= 2)
    .every((row) =>
      row.previewSelectionState === "default_preview" &&
      row.comparisonAvailable === true
    )
);

console.log(JSON.stringify({
  ok: true,
  version: FACE_LAB_V2_END_TO_END_COMPLETION_AUDIT_VERSION,
  cohort: report.cohort,
  summary: report.summary,
  sample: report.rows.slice(0, 4)
}, null, 2));
