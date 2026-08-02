import {
  PILOT_CHECKPOINT_APPROVAL_SCHEMA_VERSION,
  validatePilotCheckpointApproval
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function semantic(approval) {
  const { approvalDigest, approvedAt, ...rest } = approval;
  return rest;
}

export function createPilotCheckpointApproval({
  projection,
  completedWaveOrdinal,
  checklist,
  decision,
  reasonCodes = [],
  approvedBy,
  approvedAt = new Date().toISOString()
}) {
  if (![1,2].includes(completedWaveOrdinal) || !["continue","pause","stop"].includes(decision) || !TOKEN.test(approvedBy || "") || !Number.isFinite(Date.parse(approvedAt)) || new Date(approvedAt).toISOString() !== approvedAt) return failure("campaign_checkpoint_invalid", "$", null);
  const wave = projection?.waveStatus?.find((item) => item.waveOrdinal === completedWaveOrdinal);
  if (!wave || !["awaiting_checkpoint", "complete"].includes(wave.status)) return failure("campaign_checkpoint_not_ready", "completedWaveOrdinal", wave?.status || null);
  const expectedSlotCount = completedWaveOrdinal === 1 ? 4 : 8;
  const slots = projection.slotProjections?.filter((slot) => slot.waveOrdinal === completedWaveOrdinal) || [];
  if (slots.length !== expectedSlotCount || !slots.every((slot) => slot.checkpointReady)) return failure("campaign_checkpoint_not_ready", "slotProjections", null);
  const normalizedChecklist = {
    sourceFreezeStillValid: checklist?.sourceFreezeStillValid === true,
    providerProfileStillAllowed: checklist?.providerProfileStillAllowed === true,
    noRealPersonReferenceEvidence: checklist?.noRealPersonReferenceEvidence === true,
    noSystemicExternalMarkIssue: checklist?.noSystemicExternalMarkIssue === true,
    noCandidateReplacementOccurred: checklist?.noCandidateReplacementOccurred === true,
    allRegisteredOutcomesRetained: checklist?.allRegisteredOutcomesRetained === true,
    unresolvedCriticalIntegrityFailureCount: Number.isInteger(checklist?.unresolvedCriticalIntegrityFailureCount) && checklist.unresolvedCriticalIntegrityFailureCount >= 0 ? checklist.unresolvedCriticalIntegrityFailureCount : -1
  };
  if (normalizedChecklist.unresolvedCriticalIntegrityFailureCount < 0) return failure("campaign_checkpoint_invalid", "checklist", null);
  const allClear = Object.entries(normalizedChecklist).every(([key, value]) => key === "unresolvedCriticalIntegrityFailureCount" ? value === 0 : value === true);
  if (decision === "continue" && !allClear) return failure("campaign_checkpoint_invalid", "decision", "continue_requires_clear_checklist");
  const semanticValue = {
    schemaVersion: PILOT_CHECKPOINT_APPROVAL_SCHEMA_VERSION,
    campaignRunId: projection.campaignRunId,
    completedWaveOrdinal,
    runProjectionDigest: projection.projectionDigest,
    budgetSnapshotDigest: sha256Hex(stableStringify(projection.budget)),
    checklist: normalizedChecklist,
    decision,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    approvedBy
  };
  const approvalDigest = sha256Hex(stableStringify(semanticValue));
  const approval = deepFreeze({ ...semanticValue, approvedAt, approvalDigest });
  return validatePilotCheckpointApproval(approval).ok ? Object.freeze({ ok: true, approval }) : failure("campaign_checkpoint_invalid", "$", null);
}

export function verifyPilotCheckpointApprovalIntegrity(approval, projection = null) {
  if (!validatePilotCheckpointApproval(approval).ok) return false;
  const digest = sha256Hex(stableStringify(semantic(approval)));
  if (digest !== approval.approvalDigest) return false;
  if (approval.decision === "continue") {
    const clear = Object.entries(approval.checklist).every(([key, value]) => key === "unresolvedCriticalIntegrityFailureCount" ? value === 0 : value === true);
    if (!clear) return false;
  }
  if (projection) {
    if (approval.campaignRunId !== projection.campaignRunId || approval.runProjectionDigest !== projection.projectionDigest || approval.budgetSnapshotDigest !== sha256Hex(stableStringify(projection.budget))) return false;
  }
  return true;
}

export function authorizeWaveIssue(waveOrdinal, checkpointApprovals) {
  if (waveOrdinal === 1) return Object.freeze({ ok: true });
  if (![2,3].includes(waveOrdinal)) return failure("campaign_wave_invalid", "waveOrdinal", null);
  const requiredWave = waveOrdinal - 1;
  const matches = checkpointApprovals.filter((approval) => approval.completedWaveOrdinal === requiredWave && verifyPilotCheckpointApprovalIntegrity(approval));
  if (matches.length !== 1 || matches[0].decision !== "continue") return failure("campaign_checkpoint_required", "checkpoint", requiredWave);
  return Object.freeze({ ok: true, approval: matches[0] });
}
