import {
  DATASET_ACTIVATION_MANIFEST_SCHEMA_VERSION,
  DATASET_COUPLING_KINDS,
  DATASET_EXPOSURE_CLAIM_SCHEMA_VERSION,
  DATASET_EXPOSURE_CLASS,
  DATASET_LOCK_BASIS_SCHEMA_VERSION,
  DATASET_LOCK_DECISIONS,
  DATASET_LOCK_REVIEW_SCHEMA_VERSION,
  DATASET_MEMBER_SCHEMA_VERSION,
  DATASET_SOURCE_REQUEST_SCHEMA_VERSION,
  DATASET_SOURCE_SNAPSHOT_SCHEMA_VERSION,
  DATASET_SPLIT_ASSIGNMENT_SCHEMA_VERSION,
  DATASET_SPLIT_ORDER,
  DATASET_SPLIT_PLAN_SCHEMA_VERSION,
  DATASET_SPLITS,
  DATASET_USE_SCOPE,
  DATASET_VERSION_MANIFEST_SCHEMA_VERSION,
  DATASET_VERSION_STATUS_EVENT_SCHEMA_VERSION,
  DATASET_VERSION_STATUS_EVENTS,
  G5_HOLDOUT_RECORD_SCHEMA_VERSION,
  G5_STATUS_EVENT_SCHEMA_VERSION,
  G5_STATUS_EVENTS,
  HOLDOUT_MATERIALIZATION_REQUEST_SCHEMA_VERSION,
  LEAKAGE_GRAPH_SCHEMA_VERSION,
  REGRESSION_BASELINE_REQUEST_SCHEMA_VERSION,
  REGRESSION_BASELINE_REVIEW_SCHEMA_VERSION,
  REGRESSION_BASELINE_SCHEMA_VERSION
} from "./constants.js";

const HEX64 = /^[a-f0-9]{64}$/;
const CANDIDATE_ID = /^cand_[a-f0-9]{24}$/;
const RUN_ID = /^crun_[a-f0-9]{24}$/;
const DATASET_VERSION_ID = /^dsv_[a-f0-9]{24}$/;
const GRADE_RECORD_ID = /^grd_[a-f0-9]{24}$/;
const TOKEN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const ACTOR = /^(?:operator|reviewer)_[a-z0-9][a-z0-9._-]{2,63}$/;

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, keys) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function isIso(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
function uniqueStrings(value, pattern = null) { return Array.isArray(value) && value.every((item) => typeof item === "string" && (!pattern || pattern.test(item))) && new Set(value).size === value.length; }
function error(code, path, detail = null) { return Object.freeze({ code, path, detail }); }
function result(errors) { return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) }); }
function digest(value) { return HEX64.test(value || ""); }
function split(value) { return DATASET_SPLITS.includes(value); }

export function validateDatasetSourceRequestShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "datasetId", "datasetLineageId", "purpose", "useScope", "sourceSelection", "requestedAt"])) return result([error("dataset_source_request_invalid", "$")]);
  if (value.schemaVersion !== DATASET_SOURCE_REQUEST_SCHEMA_VERSION || !TOKEN.test(value.datasetId || "") || !TOKEN.test(value.datasetLineageId || "") || !TOKEN.test(value.purpose || "") || value.useScope !== DATASET_USE_SCOPE || !isIso(value.requestedAt)) errors.push(error("dataset_source_request_invalid", "$"));
  const selection = value.sourceSelection;
  const single = exactKeys(selection, ["mode", "campaignRunId", "includeAllCurrentActiveG4"]) && selection.mode === "single_run" && RUN_ID.test(selection.campaignRunId || "") && selection.includeAllCurrentActiveG4 === true;
  const group = exactKeys(selection, ["mode", "comparisonGroupId", "cutoffAt", "includeAllCurrentActiveG4"]) && selection.mode === "comparison_group" && TOKEN.test(selection.comparisonGroupId || "") && isIso(selection.cutoffAt) && selection.includeAllCurrentActiveG4 === true;
  if (!single && !group) errors.push(error("dataset_source_request_invalid", "sourceSelection"));
  return result(errors);
}

export function validateDatasetSourceSnapshotShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "datasetId", "datasetLineageId", "purpose", "useScope", "sourceUniverseDigest", "members", "exclusions", "labelSchema", "priorExposureRegistryDigest", "sourcePolicy", "capturedAt", "sourceSnapshotDigest"])) return result([error("dataset_source_snapshot_invalid", "$")]);
  if (value.schemaVersion !== DATASET_SOURCE_SNAPSHOT_SCHEMA_VERSION || !TOKEN.test(value.datasetId || "") || !TOKEN.test(value.datasetLineageId || "") || !TOKEN.test(value.purpose || "") || value.useScope !== DATASET_USE_SCOPE || !digest(value.sourceUniverseDigest) || !digest(value.priorExposureRegistryDigest) || !isIso(value.capturedAt) || !digest(value.sourceSnapshotDigest)) errors.push(error("dataset_source_snapshot_invalid", "$"));
  if (!Array.isArray(value.members) || value.members.length === 0 || !value.members.every((member) => exactKeys(member, ["campaignRunId", "candidateId", "candidateDigest", "canonicalSha256", "canonicalObjectRelativePath", "g4GradeRecordDigest", "g4StatusHeadDigest", "promotionKey", "promotionSourceSnapshotDigest", "promotionEvidenceBundleDigest", "leakageReviewDigest", "claimValuesDigest", "splitCouplingKeys", "splitCouplingKeysDigest"]) && RUN_ID.test(member.campaignRunId || "") && CANDIDATE_ID.test(member.candidateId || "") && [member.candidateDigest, member.canonicalSha256, member.g4GradeRecordDigest, member.g4StatusHeadDigest, member.promotionSourceSnapshotDigest, member.promotionEvidenceBundleDigest, member.leakageReviewDigest, member.claimValuesDigest, member.splitCouplingKeysDigest].every(digest) && TOKEN.test(member.promotionKey || "") && typeof member.canonicalObjectRelativePath === "string" && Array.isArray(member.splitCouplingKeys))) errors.push(error("dataset_source_snapshot_invalid", "members"));
  if (!Array.isArray(value.exclusions) || !value.exclusions.every((item) => exactKeys(item, ["campaignRunId", "candidateId", "sourceArtifactDigest", "disposition", "reasonCode"]) && RUN_ID.test(item.campaignRunId || "") && CANDIDATE_ID.test(item.candidateId || "") && digest(item.sourceArtifactDigest) && ["excluded", "quarantined"].includes(item.disposition) && TOKEN.test(item.reasonCode || ""))) errors.push(error("dataset_source_snapshot_invalid", "exclusions"));
  if (!exactKeys(value.labelSchema, ["purpose", "claimAxes", "excludedClaims", "labelSchemaDigest"]) || value.labelSchema.purpose !== value.purpose || !uniqueStrings(value.labelSchema.claimAxes) || !uniqueStrings(value.labelSchema.excludedClaims) || !digest(value.labelSchema.labelSchemaDigest)) errors.push(error("dataset_source_snapshot_invalid", "labelSchema"));
  if (!exactKeys(value.sourcePolicy, ["id", "version", "digest"]) || !TOKEN.test(value.sourcePolicy.id || "") || !TOKEN.test(value.sourcePolicy.version || "") || !digest(value.sourcePolicy.digest)) errors.push(error("dataset_source_snapshot_invalid", "sourcePolicy"));
  return result(errors);
}

export function validateLeakageGraphShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "sourceSnapshotDigest", "nodes", "edges", "components", "graphPolicy", "graphDigest"])) return result([error("leakage_graph_invalid", "$")]);
  if (value.schemaVersion !== LEAKAGE_GRAPH_SCHEMA_VERSION || !digest(value.sourceSnapshotDigest) || !digest(value.graphDigest) || !exactKeys(value.graphPolicy, ["id", "version", "digest"]) || !digest(value.graphPolicy.digest)) errors.push(error("leakage_graph_invalid", "$"));
  if (!Array.isArray(value.nodes) || !value.nodes.every((node) => exactKeys(node, ["nodeId", "candidateId", "g4GradeRecordDigest", "canonicalSha256", "claimValuesDigest"]) && TOKEN.test(node.nodeId || "") && CANDIDATE_ID.test(node.candidateId || "") && [node.g4GradeRecordDigest, node.canonicalSha256, node.claimValuesDigest].every(digest))) errors.push(error("leakage_graph_invalid", "nodes"));
  if (!Array.isArray(value.edges) || !value.edges.every((edge) => exactKeys(edge, ["edgeId", "leftNodeId", "rightNodeId", "couplingKind", "couplingKeyDigest", "sourceArtifactDigest"]) && TOKEN.test(edge.edgeId || "") && TOKEN.test(edge.leftNodeId || "") && TOKEN.test(edge.rightNodeId || "") && edge.leftNodeId !== edge.rightNodeId && DATASET_COUPLING_KINDS.includes(edge.couplingKind) && digest(edge.couplingKeyDigest) && digest(edge.sourceArtifactDigest))) errors.push(error("leakage_graph_invalid", "edges"));
  if (!Array.isArray(value.components) || !value.components.every((component) => exactKeys(component, ["componentId", "nodeIds", "candidateIds", "claimValuesDigests", "couplingKinds", "componentFingerprint", "componentDigest"]) && TOKEN.test(component.componentId || "") && uniqueStrings(component.nodeIds) && uniqueStrings(component.candidateIds, CANDIDATE_ID) && uniqueStrings(component.claimValuesDigests, HEX64) && uniqueStrings(component.couplingKinds) && digest(component.componentFingerprint) && digest(component.componentDigest))) errors.push(error("leakage_graph_invalid", "components"));
  return result(errors);
}

export function validateDatasetSplitPlanShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "datasetId", "datasetLineageId", "sourceSnapshotDigest", "leakageGraphDigest", "splits", "targets", "minimumComponents", "balancePolicy", "assignmentPolicy", "authoredBy", "authoredAt", "planDigest"])) return result([error("dataset_split_plan_invalid", "$")]);
  if (value.schemaVersion !== DATASET_SPLIT_PLAN_SCHEMA_VERSION || !TOKEN.test(value.datasetId || "") || !TOKEN.test(value.datasetLineageId || "") || !digest(value.sourceSnapshotDigest) || !digest(value.leakageGraphDigest) || JSON.stringify(value.splits) !== JSON.stringify(DATASET_SPLITS) || !ACTOR.test(value.authoredBy || "") || !isIso(value.authoredAt) || !digest(value.planDigest)) errors.push(error("dataset_split_plan_invalid", "$"));
  if (!exactKeys(value.targets, DATASET_SPLITS) || !DATASET_SPLITS.every((key) => Number.isInteger(value.targets[key]) && value.targets[key] >= 0)) errors.push(error("dataset_split_plan_invalid", "targets"));
  if (!exactKeys(value.minimumComponents, ["validation", "test", "holdout"]) || !["validation", "test", "holdout"].every((key) => Number.isInteger(value.minimumComponents[key]) && value.minimumComponents[key] >= 0)) errors.push(error("dataset_split_plan_invalid", "minimumComponents"));
  if (!exactKeys(value.balancePolicy, ["axis", "hardMinimumPerLabel", "allowedAbsoluteDeviation"]) || value.balancePolicy.axis !== "claim_values_digest" || !Number.isInteger(value.balancePolicy.hardMinimumPerLabel) || value.balancePolicy.hardMinimumPerLabel < 0 || !Number.isInteger(value.balancePolicy.allowedAbsoluteDeviation) || value.balancePolicy.allowedAbsoluteDeviation < 0) errors.push(error("dataset_split_plan_invalid", "balancePolicy"));
  if (!exactKeys(value.assignmentPolicy, ["id", "version", "callerSeedAllowed", "splitOrder", "digest"]) || value.assignmentPolicy.callerSeedAllowed !== false || JSON.stringify(value.assignmentPolicy.splitOrder) !== JSON.stringify(DATASET_SPLIT_ORDER) || !digest(value.assignmentPolicy.digest)) errors.push(error("dataset_split_plan_invalid", "assignmentPolicy"));
  return result(errors);
}

export function validateDatasetSplitAssignmentShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "sourceSnapshotDigest", "leakageGraphDigest", "splitPlanDigest", "assignmentEntropyDigest", "componentAssignments", "achievedCounts", "deviations", "assignmentPolicyDigest", "assignedAt", "assignmentDigest"])) return result([error("dataset_split_assignment_invalid", "$")]);
  if (value.schemaVersion !== DATASET_SPLIT_ASSIGNMENT_SCHEMA_VERSION || ![value.sourceSnapshotDigest, value.leakageGraphDigest, value.splitPlanDigest, value.assignmentEntropyDigest, value.assignmentPolicyDigest, value.assignmentDigest].every(digest) || !isIso(value.assignedAt)) errors.push(error("dataset_split_assignment_invalid", "$"));
  if (!Array.isArray(value.componentAssignments) || !value.componentAssignments.every((item) => exactKeys(item, ["componentId", "componentDigest", "componentFingerprint", "assignedSplit", "inheritedFromExposureClaimDigest"]) && TOKEN.test(item.componentId || "") && digest(item.componentDigest) && digest(item.componentFingerprint) && split(item.assignedSplit) && (item.inheritedFromExposureClaimDigest === null || digest(item.inheritedFromExposureClaimDigest)))) errors.push(error("dataset_split_assignment_invalid", "componentAssignments"));
  if (!exactKeys(value.achievedCounts, DATASET_SPLITS) || !DATASET_SPLITS.every((key) => Number.isInteger(value.achievedCounts[key]) && value.achievedCounts[key] >= 0)) errors.push(error("dataset_split_assignment_invalid", "achievedCounts"));
  if (!exactKeys(value.deviations, ["totalAbsoluteDeviation", "perSplit", "perLabel"]) || !Number.isInteger(value.deviations.totalAbsoluteDeviation) || !isObject(value.deviations.perSplit) || !isObject(value.deviations.perLabel)) errors.push(error("dataset_split_assignment_invalid", "deviations"));
  return result(errors);
}

export function validateDatasetLockReviewShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "sourceSnapshotDigest", "leakageGraphDigest", "splitPlanDigest", "assignmentDigest", "reviewer", "confirmations", "decision", "reasonCodes", "reviewDecisionDigest", "completedAt", "submissionDigest"])) return result([error("dataset_lock_review_invalid", "$")]);
  if (value.schemaVersion !== DATASET_LOCK_REVIEW_SCHEMA_VERSION || ![value.sourceSnapshotDigest, value.leakageGraphDigest, value.splitPlanDigest, value.assignmentDigest, value.reviewDecisionDigest, value.submissionDigest].every(digest) || !isIso(value.completedAt) || !DATASET_LOCK_DECISIONS.includes(value.decision) || !uniqueStrings(value.reasonCodes)) errors.push(error("dataset_lock_review_invalid", "$"));
  if (!exactKeys(value.reviewer, ["reviewerId", "role", "roleSeparationAttested"]) || !ACTOR.test(value.reviewer.reviewerId || "") || value.reviewer.role !== "dataset_lock_reviewer" || value.reviewer.roleSeparationAttested !== true) errors.push(error("dataset_lock_review_invalid", "reviewer"));
  const confirmationKeys = ["currentG4StatusReviewed", "leakageComponentsReviewed", "priorExposureReviewed", "splitFeasibilityReviewed", "holdoutIsolationReviewed", "labelSchemaReviewed"];
  if (!exactKeys(value.confirmations, confirmationKeys) || !confirmationKeys.every((key) => value.confirmations[key] === true)) errors.push(error("dataset_lock_review_invalid", "confirmations"));
  return result(errors);
}

export function validateDatasetMemberShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "sourceSnapshotDigest", "assignmentDigest", "candidateId", "g4GradeRecordDigest", "g4StatusHeadDigest", "componentDigest", "componentFingerprint", "split", "claimValuesDigest", "canonicalSha256", "memberDigest"])) return result([error("dataset_member_invalid", "$")]);
  if (value.schemaVersion !== DATASET_MEMBER_SCHEMA_VERSION || ![value.sourceSnapshotDigest, value.assignmentDigest, value.g4GradeRecordDigest, value.g4StatusHeadDigest, value.componentDigest, value.componentFingerprint, value.claimValuesDigest, value.canonicalSha256, value.memberDigest].every(digest) || !CANDIDATE_ID.test(value.candidateId || "") || !split(value.split)) errors.push(error("dataset_member_invalid", "$"));
  return result(errors);
}

export function validateDatasetLockBasisShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "datasetId", "datasetLineageId", "predecessorDatasetVersionDigest", "sourceSnapshotDigest", "leakageGraphDigest", "splitPlanDigest", "assignmentDigest", "lockReviewDecisionDigest", "lockReviewSubmissionDigest", "labelSchemaDigest", "memberIndexDigest", "lockPolicy", "lockBasisDigest"])) return result([error("dataset_lock_basis_invalid", "$")]);
  if (value.schemaVersion !== DATASET_LOCK_BASIS_SCHEMA_VERSION || !TOKEN.test(value.datasetId || "") || !TOKEN.test(value.datasetLineageId || "") || !(value.predecessorDatasetVersionDigest === null || digest(value.predecessorDatasetVersionDigest)) || ![value.sourceSnapshotDigest, value.leakageGraphDigest, value.splitPlanDigest, value.assignmentDigest, value.lockReviewDecisionDigest, value.lockReviewSubmissionDigest, value.labelSchemaDigest, value.memberIndexDigest, value.lockBasisDigest].every(digest) || !exactKeys(value.lockPolicy, ["id", "version", "digest"]) || !digest(value.lockPolicy.digest)) errors.push(error("dataset_lock_basis_invalid", "$"));
  return result(errors);
}

export function validateDatasetVersionManifestShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "datasetId", "datasetLineageId", "datasetVersionId", "predecessorDatasetVersionDigest", "lockBasisDigest", "sourceSnapshotDigest", "leakageGraphDigest", "splitPlanDigest", "assignmentDigest", "lockReviewDecisionDigest", "lockReviewSubmissionDigest", "labelSchemaDigest", "memberIndexDigest", "lockedAt", "datasetVersionDigest"])) return result([error("dataset_version_manifest_invalid", "$")]);
  if (value.schemaVersion !== DATASET_VERSION_MANIFEST_SCHEMA_VERSION || !TOKEN.test(value.datasetId || "") || !TOKEN.test(value.datasetLineageId || "") || !DATASET_VERSION_ID.test(value.datasetVersionId || "") || !(value.predecessorDatasetVersionDigest === null || digest(value.predecessorDatasetVersionDigest)) || ![value.lockBasisDigest, value.sourceSnapshotDigest, value.leakageGraphDigest, value.splitPlanDigest, value.assignmentDigest, value.lockReviewDecisionDigest, value.lockReviewSubmissionDigest, value.labelSchemaDigest, value.memberIndexDigest, value.datasetVersionDigest].every(digest) || !isIso(value.lockedAt)) errors.push(error("dataset_version_manifest_invalid", "$"));
  return result(errors);
}

export function validateDatasetExposureClaimShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "datasetLineageId", "componentFingerprint", "datasetVersionDigest", "assignedSplit", "exposureClass", "predecessorClaimDigest", "firstExposedAt", "claimDigest"])) return result([error("dataset_exposure_claim_invalid", "$")]);
  if (value.schemaVersion !== DATASET_EXPOSURE_CLAIM_SCHEMA_VERSION || !TOKEN.test(value.datasetLineageId || "") || !digest(value.componentFingerprint) || !digest(value.datasetVersionDigest) || !split(value.assignedSplit) || value.exposureClass !== DATASET_EXPOSURE_CLASS[value.assignedSplit] || !(value.predecessorClaimDigest === null || digest(value.predecessorClaimDigest)) || !isIso(value.firstExposedAt) || !digest(value.claimDigest)) errors.push(error("dataset_exposure_claim_invalid", "$"));
  return result(errors);
}

export function validateG5HoldoutRecordShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "gradeRecordId", "candidateId", "grade", "sourceG4GradeRecordDigest", "sourceG4StatusHeadDigest", "datasetVersionDigest", "datasetMemberDigest", "leakageComponentDigest", "split", "labelSchemaDigest", "exposureClaimDigest", "policy", "recordedAt", "gradeRecordDigest"])) return result([error("g5_holdout_record_invalid", "$")]);
  if (value.schemaVersion !== G5_HOLDOUT_RECORD_SCHEMA_VERSION || !GRADE_RECORD_ID.test(value.gradeRecordId || "") || !CANDIDATE_ID.test(value.candidateId || "") || value.grade !== "G5_LEAKAGE_LOCKED_HOLDOUT" || ![value.sourceG4GradeRecordDigest, value.sourceG4StatusHeadDigest, value.datasetVersionDigest, value.datasetMemberDigest, value.leakageComponentDigest, value.labelSchemaDigest, value.exposureClaimDigest, value.gradeRecordDigest].every(digest) || value.split !== "holdout" || !exactKeys(value.policy, ["id", "version", "digest"]) || !digest(value.policy.digest) || !isIso(value.recordedAt)) errors.push(error("g5_holdout_record_invalid", "$"));
  return result(errors);
}

export function validateDatasetVersionStatusEventShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "datasetVersionDigest", "event", "reasonCodes", "predecessorEventDigest", "recordedAt", "eventDigest"])) return result([error("dataset_status_event_invalid", "$")]);
  if (value.schemaVersion !== DATASET_VERSION_STATUS_EVENT_SCHEMA_VERSION || !digest(value.datasetVersionDigest) || !DATASET_VERSION_STATUS_EVENTS.includes(value.event) || !uniqueStrings(value.reasonCodes) || !(value.predecessorEventDigest === null || digest(value.predecessorEventDigest)) || !isIso(value.recordedAt) || !digest(value.eventDigest)) errors.push(error("dataset_status_event_invalid", "$"));
  return result(errors);
}

export function validateG5StatusEventShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "g5GradeRecordDigest", "event", "reasonCodes", "predecessorEventDigest", "recordedAt", "eventDigest"])) return result([error("g5_status_event_invalid", "$")]);
  if (value.schemaVersion !== G5_STATUS_EVENT_SCHEMA_VERSION || !digest(value.g5GradeRecordDigest) || !G5_STATUS_EVENTS.includes(value.event) || !uniqueStrings(value.reasonCodes) || !(value.predecessorEventDigest === null || digest(value.predecessorEventDigest)) || !isIso(value.recordedAt) || !digest(value.eventDigest)) errors.push(error("g5_status_event_invalid", "$"));
  return result(errors);
}

export function validateDatasetActivationManifestShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "datasetVersionDigest", "datasetStatusHeadDigest", "exposureClaimIndexDigest", "g5IndexDigest", "g5StatusHeadIndexDigest", "activationPolicyDigest", "activatedAt", "activationDigest"])) return result([error("dataset_activation_manifest_invalid", "$")]);
  if (value.schemaVersion !== DATASET_ACTIVATION_MANIFEST_SCHEMA_VERSION || ![value.datasetVersionDigest, value.datasetStatusHeadDigest, value.exposureClaimIndexDigest, value.g5IndexDigest, value.g5StatusHeadIndexDigest, value.activationPolicyDigest, value.activationDigest].every(digest) || !isIso(value.activatedAt)) errors.push(error("dataset_activation_manifest_invalid", "$"));
  return result(errors);
}

export function validateHoldoutMaterializationRequestShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "datasetVersionDigest", "requestedBy", "purpose", "authorizationDigest", "requestedAt"])) return result([error("holdout_materialization_request_invalid", "$")]);
  if (value.schemaVersion !== HOLDOUT_MATERIALIZATION_REQUEST_SCHEMA_VERSION || !digest(value.datasetVersionDigest) || !ACTOR.test(value.requestedBy || "") || !["regression_evaluation", "integrity_review"].includes(value.purpose) || !digest(value.authorizationDigest) || !isIso(value.requestedAt)) errors.push(error("holdout_materialization_request_invalid", "$"));
  return result(errors);
}

export function validateRegressionBaselineRequestShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "datasetVersionDigest", "holdoutG5IndexDigest", "modelArtifactDigest", "evaluationHarnessDigest", "metricContractDigest", "resultPackageDigest", "requestedAt"])) return result([error("regression_baseline_request_invalid", "$")]);
  if (value.schemaVersion !== REGRESSION_BASELINE_REQUEST_SCHEMA_VERSION || ![value.datasetVersionDigest, value.holdoutG5IndexDigest, value.modelArtifactDigest, value.evaluationHarnessDigest, value.metricContractDigest, value.resultPackageDigest].every(digest) || !isIso(value.requestedAt)) errors.push(error("regression_baseline_request_invalid", "$"));
  return result(errors);
}

export function validateRegressionBaselineReviewShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "requestDigest", "reviewerId", "datasetAndG5CurrentReviewed", "resultPackageIntegrityReviewed", "metricContractReviewed", "decision", "completedAt", "reviewDigest"])) return result([error("regression_baseline_review_invalid", "$")]);
  if (value.schemaVersion !== REGRESSION_BASELINE_REVIEW_SCHEMA_VERSION || !digest(value.requestDigest) || !ACTOR.test(value.reviewerId || "") || value.datasetAndG5CurrentReviewed !== true || value.resultPackageIntegrityReviewed !== true || value.metricContractReviewed !== true || !["approve", "reject"].includes(value.decision) || !isIso(value.completedAt) || !digest(value.reviewDigest)) errors.push(error("regression_baseline_review_invalid", "$"));
  return result(errors);
}

export function validateRegressionBaselineShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "datasetVersionDigest", "holdoutG5IndexDigest", "modelArtifactDigest", "evaluationHarnessDigest", "metricContractDigest", "resultPackageDigest", "activatedByReviewDigest", "policyDigest", "activatedAt", "baselineDigest"])) return result([error("regression_baseline_invalid", "$")]);
  if (value.schemaVersion !== REGRESSION_BASELINE_SCHEMA_VERSION || ![value.datasetVersionDigest, value.holdoutG5IndexDigest, value.modelArtifactDigest, value.evaluationHarnessDigest, value.metricContractDigest, value.resultPackageDigest, value.activatedByReviewDigest, value.policyDigest, value.baselineDigest].every(digest) || !isIso(value.activatedAt)) errors.push(error("regression_baseline_invalid", "$"));
  return result(errors);
}
