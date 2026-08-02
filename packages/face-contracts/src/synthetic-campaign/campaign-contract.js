import {
  GENERATION_HANDOFF_OUTCOMES,
  GENERATION_HANDOFF_SCHEMA_VERSION,
  GENERATION_WORK_PACKET_SCHEMA_VERSION,
  PILOT_ALLOWED_PROVIDER_PROFILES,
  PILOT_CAMPAIGN_CLOSEOUT_SCHEMA_VERSION,
  PILOT_CAMPAIGN_EVENT_SCHEMA_VERSION,
  PILOT_CAMPAIGN_PLAN_SCHEMA_VERSION,
  PILOT_CAMPAIGN_PROJECTION_SCHEMA_VERSION,
  PILOT_CAMPAIGN_RUN_SCHEMA_VERSION,
  PILOT_CHECKPOINT_APPROVAL_SCHEMA_VERSION,
  PILOT_CONDITIONS,
  PILOT_EVENT_TYPES,
  PILOT_REASON_CODES,
  PILOT_SLOT_SCHEMA_VERSION,
  PILOT_SOURCE_FREEZE_SCHEMA_VERSION,
  PILOT_TERMINAL_OUTCOMES,
  PILOT_TRACKS
} from "./constants.js";

const HEX64 = /^[a-f0-9]{64}$/;
const SAFE_TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const RUN_ID = /^crun_[a-f0-9]{24}$/;
const SLOT_ID = /^slot_[a-f0-9]{24}$/;
const ATTEMPT_ID = /^att_[a-f0-9]{24}$/;
const PACKET_ID = /^pkt_[a-f0-9]{24}$/;
const HANDOFF_ID = /^hnd_[a-f0-9]{24}$/;
const SAFE_RELATIVE_PATH = /^(?![A-Za-z]:)(?!\\\\)(?!\/)(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))(?!.*\0).+$/;
const SENSITIVE_PATTERN = /(bearer\s+[a-z0-9._-]+|api[_ -]?key|session[_ -]?token|cookie\s*=|authorization|sk-[a-z0-9_-]{8,}|https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function uniqueArray(value, allowed = null) {
  return Array.isArray(value) && new Set(value).size === value.length && (!allowed || value.every((item) => allowed.includes(item)));
}

function error(code, path, detail = null) {
  return Object.freeze({ code, path, detail });
}

function result(errors) {
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function validateSourceFreeze(value, errors) {
  const keys = [
    "schemaVersion",
    "generationSpecSchemaVersion",
    "compiledPromptSchemaVersion",
    "promptCompilerVersion",
    "fixtureSetId",
    "fixtureObjectDigests",
    "finalizedSpecDigests",
    "providerProfileId",
    "providerProfileVersion",
    "providerProfileDigest",
    "providerTemplateVersion",
    "t3ImportPolicyVersion",
    "t4ObservationContractVersion",
    "t4AdapterProfileId",
    "t4AdapterProfileVersion",
    "t5JudgmentPolicyVersion",
    "t6PromotionPolicyId",
    "t6PromotionPolicyVersion",
    "sourceFreezeDigest"
  ];
  if (!exactKeys(value, keys)) {
    errors.push(error("campaign_source_freeze_invalid", "sourceFreeze"));
    return;
  }
  if (
    value.schemaVersion !== PILOT_SOURCE_FREEZE_SCHEMA_VERSION ||
    value.generationSpecSchemaVersion !== "generation-spec-v1" ||
    value.compiledPromptSchemaVersion !== "compiled-prompt-v1" ||
    value.promptCompilerVersion !== "prompt-compiler-v1" ||
    value.fixtureSetId !== "skin-control-abcd-v1" ||
    !PILOT_ALLOWED_PROVIDER_PROFILES.includes(value.providerProfileId) ||
    value.providerProfileVersion !== "1.0.0" ||
    !HEX64.test(value.providerProfileDigest || "") ||
    typeof value.providerTemplateVersion !== "string" ||
    value.providerTemplateVersion.length === 0 ||
    typeof value.t3ImportPolicyVersion !== "string" ||
    typeof value.t4ObservationContractVersion !== "string" ||
    typeof value.t4AdapterProfileId !== "string" ||
    typeof value.t4AdapterProfileVersion !== "string" ||
    typeof value.t5JudgmentPolicyVersion !== "string" ||
    value.t6PromotionPolicyId !== "bejewely-promotion-policy-v1" ||
    value.t6PromotionPolicyVersion !== "1.0.0" ||
    !HEX64.test(value.sourceFreezeDigest || "")
  ) {
    errors.push(error("campaign_source_freeze_invalid", "sourceFreeze"));
  }
  for (const field of ["fixtureObjectDigests", "finalizedSpecDigests"]) {
    if (!exactKeys(value[field], ["A", "B", "C", "D"]) || !Object.values(value[field]).every((digest) => HEX64.test(digest || ""))) {
      errors.push(error("campaign_source_freeze_invalid", `sourceFreeze.${field}`));
    }
  }
}

export function validatePilotCampaignPlan(value) {
  const errors = [];
  const keys = ["schemaVersion", "campaignId", "campaignVersion", "comparisonGroupId", "objective", "sourceFreeze", "matrix", "budgets", "retryPolicy", "checkpointPolicy", "stopPolicy", "outputPolicy", "authoredBy", "authoredAt", "planDigest"];
  if (!exactKeys(value, keys)) return result([error("campaign_plan_invalid", "$")]);
  if (
    value.schemaVersion !== PILOT_CAMPAIGN_PLAN_SCHEMA_VERSION ||
    !SAFE_TOKEN.test(value.campaignId || "") ||
    !SAFE_TOKEN.test(value.campaignVersion || "") ||
    !(value.comparisonGroupId === null || SAFE_TOKEN.test(value.comparisonGroupId || "")) ||
    !SAFE_TOKEN.test(value.authoredBy || "") ||
    !isIso(value.authoredAt) ||
    !HEX64.test(value.planDigest || "")
  ) errors.push(error("campaign_plan_invalid", "$"));
  if (!exactKeys(value.objective, ["questionId", "purpose", "primarySlotCount", "interpretationOwner"]) || value.objective.questionId !== "skin-control-abcd-e2e-v1" || value.objective.purpose !== "skin_cue_control" || value.objective.primarySlotCount !== 20 || value.objective.interpretationOwner !== "t8") errors.push(error("campaign_plan_invalid", "objective"));
  validateSourceFreeze(value.sourceFreeze, errors);
  if (!Array.isArray(value.matrix) || value.matrix.length !== 4) errors.push(error("campaign_matrix_invalid", "matrix"));
  else {
    const ordered = ["A", "B", "C", "D"];
    value.matrix.forEach((row, index) => {
      const conditionId = ordered[index];
      const expected = PILOT_CONDITIONS[conditionId];
      if (!exactKeys(row, ["conditionId", "fixtureId", "primarySlots", "waveAllocation"]) || row.conditionId !== conditionId || row.fixtureId !== expected.fixtureId || row.primarySlots !== 5 || JSON.stringify(row.waveAllocation) !== "[1,2,2]") errors.push(error("campaign_matrix_invalid", `matrix.${index}`));
    });
  }
  if (!exactKeys(value.budgets, ["primaryGenerationSlots", "technicalGenerationRetryReserve", "maxGenerationAttemptsTotal", "maxGenerationAttemptsPerSlot", "maxAuthoritativeObservationRuns", "maxObservationRecoveryRuns", "maxObservationRunsTotal", "requiredPrimaryReviewersPerCandidate", "maxAdjudicationsPerCandidate", "maxPromotionReviewsPerEligibleCandidate"]) || JSON.stringify(Object.values(value.budgets)) !== JSON.stringify([20,10,30,2,20,10,30,2,1,1])) errors.push(error("campaign_budget_invalid", "budgets"));
  if (!exactKeys(value.retryPolicy, ["generationRetryAllowedReasons", "generationRetryForbiddenReasons", "registeredCandidateReplacement", "observationRecoveryAllowedReasons", "observationRecoveryForbiddenOutcomes"]) || value.retryPolicy.registeredCandidateReplacement !== "forbidden") errors.push(error("campaign_retry_policy_invalid", "retryPolicy"));
  if (!exactKeys(value.checkpointPolicy, ["waveCount", "wavePrimarySlotCounts", "manualApprovalRequired", "readinessBoundary"]) || value.checkpointPolicy.waveCount !== 3 || JSON.stringify(value.checkpointPolicy.wavePrimarySlotCounts) !== "[4,8,8]" || value.checkpointPolicy.manualApprovalRequired !== true || value.checkpointPolicy.readinessBoundary !== "authoritative_t4_or_technical_terminal") errors.push(error("campaign_checkpoint_policy_invalid", "checkpointPolicy"));
  if (!exactKeys(value.stopPolicy, ["immediateStopReasons", "pauseReasons", "lowYieldAutomaticStop"]) || value.stopPolicy.lowYieldAutomaticStop !== false || !uniqueArray(value.stopPolicy.immediateStopReasons) || !uniqueArray(value.stopPolicy.pauseReasons)) errors.push(error("campaign_stop_policy_invalid", "stopPolicy"));
  if (!exactKeys(value.outputPolicy, ["retainAllRegisteredCandidates", "retainAllTerminalOutcomes", "reportAuthority", "splitAuthority"]) || value.outputPolicy.retainAllRegisteredCandidates !== true || value.outputPolicy.retainAllTerminalOutcomes !== true || value.outputPolicy.reportAuthority !== "t8" || value.outputPolicy.splitAuthority !== "t9") errors.push(error("campaign_output_policy_invalid", "outputPolicy"));
  return result(errors);
}

export function validatePilotCampaignRun(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "campaignRunId", "campaignPlanDigest", "providerProfileId", "sourceFreezeDigest", "runNonce", "startedBy", "startedAt", "runIdentityDigest"])) return result([error("campaign_run_invalid", "$")]);
  if (value.schemaVersion !== PILOT_CAMPAIGN_RUN_SCHEMA_VERSION || !RUN_ID.test(value.campaignRunId || "") || !HEX64.test(value.campaignPlanDigest || "") || !PILOT_ALLOWED_PROVIDER_PROFILES.includes(value.providerProfileId) || !HEX64.test(value.sourceFreezeDigest || "") || !SAFE_TOKEN.test(value.runNonce || "") || !SAFE_TOKEN.test(value.startedBy || "") || !isIso(value.startedAt) || !HEX64.test(value.runIdentityDigest || "")) errors.push(error("campaign_run_invalid", "$"));
  return result(errors);
}

export function validatePilotSlot(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "campaignRunId", "slotId", "conditionId", "conditionOrdinal", "waveOrdinal", "fixtureDigest", "slotIdentityDigest"])) return result([error("campaign_slot_invalid", "$")]);
  if (value.schemaVersion !== PILOT_SLOT_SCHEMA_VERSION || !RUN_ID.test(value.campaignRunId || "") || !SLOT_ID.test(value.slotId || "") || !["A","B","C","D"].includes(value.conditionId) || !Number.isInteger(value.conditionOrdinal) || value.conditionOrdinal < 1 || value.conditionOrdinal > 5 || ![1,2,3].includes(value.waveOrdinal) || !HEX64.test(value.fixtureDigest || "") || !HEX64.test(value.slotIdentityDigest || "")) errors.push(error("campaign_slot_invalid", "$"));
  return result(errors);
}

export function validateGenerationWorkPacket(value) {
  const errors = [];
  const keys = ["schemaVersion", "packetId", "campaignRunId", "slotId", "attemptId", "attemptOrdinal", "providerProfileId", "providerProfileVersion", "finalizedSpecDigest", "compiledPromptDigest", "promptArtifactRef", "expectedOutput", "blindBoundary", "issuedAt", "packetDigest"];
  if (!exactKeys(value, keys)) return result([error("generation_packet_invalid", "$")]);
  if (value.schemaVersion !== GENERATION_WORK_PACKET_SCHEMA_VERSION || !PACKET_ID.test(value.packetId || "") || !RUN_ID.test(value.campaignRunId || "") || !SLOT_ID.test(value.slotId || "") || !ATTEMPT_ID.test(value.attemptId || "") || ![1,2].includes(value.attemptOrdinal) || !PILOT_ALLOWED_PROVIDER_PROFILES.includes(value.providerProfileId) || value.providerProfileVersion !== "1.0.0" || !HEX64.test(value.finalizedSpecDigest || "") || !HEX64.test(value.compiledPromptDigest || "") || typeof value.promptArtifactRef !== "string" || !SAFE_RELATIVE_PATH.test(value.promptArtifactRef) || !isIso(value.issuedAt) || !HEX64.test(value.packetDigest || "")) errors.push(error("generation_packet_invalid", "$"));
  if (!exactKeys(value.expectedOutput, ["oneImageOnly", "allowedFormats", "requiredWidth", "requiredHeight"]) || value.expectedOutput.oneImageOnly !== true || JSON.stringify(value.expectedOutput.allowedFormats) !== '["png","jpeg","webp_static"]' || value.expectedOutput.requiredWidth !== 1024 || value.expectedOutput.requiredHeight !== 1024) errors.push(error("generation_packet_invalid", "expectedOutput"));
  if (!exactKeys(value.blindBoundary, ["judgmentIntentDisclosure", "rawAccountMetadataRetention"]) || value.blindBoundary.judgmentIntentDisclosure !== "forbidden" || value.blindBoundary.rawAccountMetadataRetention !== "forbidden") errors.push(error("generation_packet_invalid", "blindBoundary"));
  return result(errors);
}

export function validateGenerationHandoff(value) {
  const errors = [];
  const keys = ["schemaVersion", "handoffId", "campaignRunId", "slotId", "attemptId", "providerProfileId", "compiledPromptDigest", "localAssetRelativePath", "outcome", "operator", "generatedAt", "handoffDigest"];
  if (!exactKeys(value, keys)) return result([error("generation_handoff_invalid", "$")]);
  if (value.schemaVersion !== GENERATION_HANDOFF_SCHEMA_VERSION || !HANDOFF_ID.test(value.handoffId || "") || !RUN_ID.test(value.campaignRunId || "") || !SLOT_ID.test(value.slotId || "") || !ATTEMPT_ID.test(value.attemptId || "") || !PILOT_ALLOWED_PROVIDER_PROFILES.includes(value.providerProfileId) || !HEX64.test(value.compiledPromptDigest || "") || !GENERATION_HANDOFF_OUTCOMES.includes(value.outcome) || !isIso(value.generatedAt) || !HEX64.test(value.handoffDigest || "")) errors.push(error("generation_handoff_invalid", "$"));
  const pathOk = value.localAssetRelativePath === null || (typeof value.localAssetRelativePath === "string" && SAFE_RELATIVE_PATH.test(value.localAssetRelativePath) && !SENSITIVE_PATTERN.test(value.localAssetRelativePath));
  if (!pathOk || (value.outcome === "asset_ready") !== (value.localAssetRelativePath !== null)) errors.push(error("generation_handoff_invalid", "localAssetRelativePath"));
  if (!exactKeys(value.operator, ["operatorId", "syntheticOnlyConfirmed", "realPersonReferenceUsed", "termsAndRightsReviewedForImport"]) || !SAFE_TOKEN.test(value.operator?.operatorId || "") || value.operator.syntheticOnlyConfirmed !== true || value.operator.realPersonReferenceUsed !== false || value.operator.termsAndRightsReviewedForImport !== true) errors.push(error("generation_handoff_invalid", "operator"));
  if (SENSITIVE_PATTERN.test(JSON.stringify(value))) errors.push(error("generation_handoff_sensitive_data_forbidden", "$"));
  return result(errors);
}

export function validatePilotCampaignEvent(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "campaignRunId", "slotId", "eventType", "sourceRefs", "reasonCodes", "predecessorEventDigest", "recordedAt", "eventDigest"])) return result([error("campaign_event_invalid", "$")]);
  if (value.schemaVersion !== PILOT_CAMPAIGN_EVENT_SCHEMA_VERSION || !RUN_ID.test(value.campaignRunId || "") || !(value.slotId === null || SLOT_ID.test(value.slotId || "")) || !PILOT_EVENT_TYPES.includes(value.eventType) || !(value.predecessorEventDigest === null || HEX64.test(value.predecessorEventDigest || "")) || !isIso(value.recordedAt) || !HEX64.test(value.eventDigest || "")) errors.push(error("campaign_event_invalid", "$"));
  if (!Array.isArray(value.sourceRefs) || value.sourceRefs.some((ref) => !exactKeys(ref, ["track", "artifactType", "artifactDigest"]) || !PILOT_TRACKS.includes(ref.track) || !SAFE_TOKEN.test(ref.artifactType || "") || !HEX64.test(ref.artifactDigest || ""))) errors.push(error("campaign_event_invalid", "sourceRefs"));
  if (!uniqueArray(value.reasonCodes) || value.reasonCodes.some((code) => !PILOT_REASON_CODES.includes(code) && !PILOT_TERMINAL_OUTCOMES.includes(code))) errors.push(error("campaign_event_invalid", "reasonCodes"));
  return result(errors);
}

export function validatePilotCheckpointApproval(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "campaignRunId", "completedWaveOrdinal", "runProjectionDigest", "budgetSnapshotDigest", "checklist", "decision", "reasonCodes", "approvedBy", "approvedAt", "approvalDigest"])) return result([error("campaign_checkpoint_invalid", "$")]);
  if (value.schemaVersion !== PILOT_CHECKPOINT_APPROVAL_SCHEMA_VERSION || !RUN_ID.test(value.campaignRunId || "") || ![1,2].includes(value.completedWaveOrdinal) || !HEX64.test(value.runProjectionDigest || "") || !HEX64.test(value.budgetSnapshotDigest || "") || !["continue","pause","stop"].includes(value.decision) || !uniqueArray(value.reasonCodes) || !SAFE_TOKEN.test(value.approvedBy || "") || !isIso(value.approvedAt) || !HEX64.test(value.approvalDigest || "")) errors.push(error("campaign_checkpoint_invalid", "$"));
  if (!exactKeys(value.checklist, ["sourceFreezeStillValid", "providerProfileStillAllowed", "noRealPersonReferenceEvidence", "noSystemicExternalMarkIssue", "noCandidateReplacementOccurred", "allRegisteredOutcomesRetained", "unresolvedCriticalIntegrityFailureCount"]) || Object.entries(value.checklist).some(([key, item]) => key === "unresolvedCriticalIntegrityFailureCount" ? !Number.isInteger(item) || item < 0 : typeof item !== "boolean")) errors.push(error("campaign_checkpoint_invalid", "checklist"));
  return result(errors);
}

export function validatePilotProjection(value) {
  const errors = [];
  if (!isObject(value) || value.schemaVersion !== PILOT_CAMPAIGN_PROJECTION_SCHEMA_VERSION || !RUN_ID.test(value.campaignRunId || "") || !HEX64.test(value.planDigest || "") || !HEX64.test(value.latestEventDigest || "") || !["active","paused","stopped","closed"].includes(value.runStatus) || !HEX64.test(value.projectionDigest || "")) errors.push(error("campaign_projection_invalid", "$"));
  return result(errors);
}

export function validatePilotCloseout(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "campaignRunId", "planDigest", "finalProjectionDigest", "slotEventHeadDigests", "checkpointDigests", "activeG4Refs", "nonGoldDecisionRefs", "unresolvedHoldRefs", "splitCouplingKeyDigests", "closedBy", "closedAt", "closeoutDigest"])) return result([error("campaign_closeout_invalid", "$")]);
  if (value.schemaVersion !== PILOT_CAMPAIGN_CLOSEOUT_SCHEMA_VERSION || !RUN_ID.test(value.campaignRunId || "") || !HEX64.test(value.planDigest || "") || !HEX64.test(value.finalProjectionDigest || "") || !SAFE_TOKEN.test(value.closedBy || "") || !isIso(value.closedAt) || !HEX64.test(value.closeoutDigest || "")) errors.push(error("campaign_closeout_invalid", "$"));
  for (const field of ["slotEventHeadDigests","checkpointDigests","activeG4Refs","nonGoldDecisionRefs","unresolvedHoldRefs","splitCouplingKeyDigests"]) if (!uniqueArray(value[field]) || value[field].some((item) => !HEX64.test(item || ""))) errors.push(error("campaign_closeout_invalid", field));
  return result(errors);
}

export const PILOT_ID_PATTERNS = Object.freeze({ HEX64, RUN_ID, SLOT_ID, ATTEMPT_ID, PACKET_ID, HANDOFF_ID });
