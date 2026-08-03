import test from "node:test";
import assert from "node:assert/strict";
import { createPilotCheckpointApproval, verifyPilotCheckpointApprovalIntegrity } from "../../src/campaign/checkpoint.js";

function checklist() {
  return {
    sourceFreezeStillValid: true,
    providerProfileStillAllowed: true,
    noRealPersonReferenceEvidence: true,
    noSystemicExternalMarkIssue: true,
    noCandidateReplacementOccurred: true,
    allRegisteredOutcomesRetained: true,
    unresolvedCriticalIntegrityFailureCount: 0
  };
}

test("an exhausted observation failure no longer deadlocks a ready T7 wave", () => {
  const projection = {
    campaignRunId: `crun_${"1".repeat(24)}`,
    projectionDigest: "a".repeat(64),
    budget: { generationAttemptsUsed: 4, observationRunsUsed: 4 },
    waveStatus: [{ waveOrdinal: 1, status: "active" }],
    slotProjections: [
      { waveOrdinal: 1, checkpointReady: true, terminalOutcome: null },
      { waveOrdinal: 1, checkpointReady: true, terminalOutcome: null },
      { waveOrdinal: 1, checkpointReady: true, terminalOutcome: null },
      { waveOrdinal: 1, checkpointReady: false, terminalOutcome: "observation_failed" }
    ]
  };
  const result = createPilotCheckpointApproval({
    projection,
    completedWaveOrdinal: 1,
    checklist: checklist(),
    decision: "continue",
    reasonCodes: ["checkpoint_continue"],
    approvedBy: "campaign_operator",
    approvedAt: "2026-08-03T00:00:00.000Z"
  });
  assert.equal(result.ok, true);
  assert.equal(verifyPilotCheckpointApprovalIntegrity(result.approval), true);
});
