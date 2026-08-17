export const EXFOLIATION_NORMATIVE_POLICY_TELEMETRY_VERSION = "exfoliation-normative-production-policy-runtime-telemetry-v1";
export const EXFOLIATION_NORMATIVE_POLICY_STOP_REASONS = Object.freeze([
  "activation_gate_rejected", "evaluator_error", "fallback_legacy_not_preserved", "invalid_policy_output", "invalid_telemetry", "kill_switch_execution_violation", "response_schema_changed", "shadow_canonical_eligibility_delta", "shadow_persistence_delta", "shadow_public_response_delta", "shadow_ranking_delta", "shadow_score_delta", "shadow_top1_top3_delta", "unexpected_db_mutation", "unexpected_storage_mutation", "unsupported_activation_scope", "version_mismatch"
]);
const ACTIONS = Object.freeze(["ALLOW", "CAUTION", "RESTRICT", "DEFER", "NOT_APPLICABLE"]);
const FORBIDDEN_KEYS = new Set(["productid","productids","productname","productnames","name","brand","userid","userinput","survey","surveypayload","skinanalysis","image","imagedata","photo","request","requestbody","response","responsebody","token","accesstoken","apikey","secret","authorization"]);
const TOP_LEVEL_KEYS = new Set(["evidenceType","schemaVersion","effectiveMode","runtimeExecutionCount","runtimeErrorCount","runtimeLatencyMsTotal","runtimeLatencyMsMax","actionCounts","restrictEvaluationCount","hypotheticalExclusionCount","actualNormativeExclusionCount","fallbackCount","killSwitchRequested","killSwitchSuppressedExecution","versionMismatchCount","activationGateRejectionCount","candidateCountBefore","candidateCountAfter","topKChangedCount","rollbackEventCount","reasonCodeDistribution","policyContractVersion","runtimeVersion","activationVersion","stopRequired","stopReasons"]);
function int(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; }
function uniqueSorted(values) { return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "en")); }
function hasForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  return Object.entries(value).some(([key, nested]) => FORBIDDEN_KEYS.has(key.replace(/[^a-z0-9]/gi, "").toLowerCase()) || hasForbiddenKey(nested));
}
function emptyActionCounts() { return Object.fromEntries(ACTIONS.map((action) => [action, 0])); }
function countReasons(events) {
  const counts = {};
  for (const event of events) for (const reason of Array.isArray(event?.reasonCodes) ? event.reasonCodes : []) counts[String(reason)] = (counts[String(reason)] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, "en")));
}
export function deriveNormativePolicyStopReasons({ control, runtimeEvents = [], comparison = {}, telemetryValid = true } = {}) {
  const reasons = [];
  if (!telemetryValid) reasons.push("invalid_telemetry");
  if (control?.killSwitchRequested && runtimeEvents.some((event) => event?.runtimeExecuted === true)) reasons.push("kill_switch_execution_violation");
  if (control?.enabledRequested && control?.effectiveMode === "OFF" && control?.reasonCodes?.some((reason) => !["requested_off","activation_disabled_default_off","kill_switch_override"].includes(reason))) reasons.push("activation_gate_rejected");
  if (control?.reasonCodes?.includes("version_mismatch")) reasons.push("version_mismatch");
  if (control?.reasonCodes?.includes("unsupported_activation_scope")) reasons.push("unsupported_activation_scope");
  if (runtimeEvents.some((event) => event?.runtimeError === true)) reasons.push("evaluator_error");
  if (runtimeEvents.some((event) => event?.invalidPolicyOutput === true)) reasons.push("invalid_policy_output");
  if (runtimeEvents.some((event) => event?.fallback === true && event?.legacyPathPreserved !== true)) reasons.push("fallback_legacy_not_preserved");
  if (comparison.canonicalEligibilityDelta === true) reasons.push("shadow_canonical_eligibility_delta");
  if (comparison.scoreDelta === true) reasons.push("shadow_score_delta");
  if (comparison.rankingDelta === true) reasons.push("shadow_ranking_delta");
  if (comparison.top1Delta === true || comparison.top3Delta === true) reasons.push("shadow_top1_top3_delta");
  if (comparison.persistenceDelta === true) reasons.push("shadow_persistence_delta");
  if (comparison.publicResponseDelta === true) reasons.push("shadow_public_response_delta");
  if (comparison.responseSchemaChanged === true) reasons.push("response_schema_changed");
  if (comparison.dbMutationDelta === true) reasons.push("unexpected_db_mutation");
  if (comparison.storageMutationDelta === true) reasons.push("unexpected_storage_mutation");
  return uniqueSorted(reasons);
}
export function buildExfoliationNormativePolicyRuntimeTelemetry({ control = {}, runtimeEvents = [], comparison = {}, versions = {}, rollbackEventCount = 0 } = {}) {
  const events = Array.isArray(runtimeEvents) ? runtimeEvents : [];
  const actionCounts = emptyActionCounts();
  for (const event of events) if (ACTIONS.includes(event?.policyAction)) actionCounts[event.policyAction] += 1;
  const runtimeExecutionCount = events.filter((event) => event?.runtimeExecuted === true).length;
  const runtimeErrorCount = events.filter((event) => event?.runtimeError === true).length;
  const fallbackCount = events.filter((event) => event?.fallback === true).length;
  const candidateCountBefore = events.reduce((sum, event) => sum + int(event?.candidateCountBefore), 0);
  const latencyValues = events.map((event) => int(event?.latencyMs));
  const telemetry = {
    evidenceType: "normative_policy_runtime_aggregate",
    schemaVersion: EXFOLIATION_NORMATIVE_POLICY_TELEMETRY_VERSION,
    effectiveMode: control?.effectiveMode || "OFF",
    runtimeExecutionCount,
    runtimeErrorCount,
    runtimeLatencyMsTotal: latencyValues.reduce((a, b) => a + b, 0),
    runtimeLatencyMsMax: latencyValues.length ? Math.max(...latencyValues) : 0,
    actionCounts,
    restrictEvaluationCount: actionCounts.RESTRICT,
    hypotheticalExclusionCount: events.filter((event) => event?.policyAction === "RESTRICT" && event?.existingEligibility === true).length,
    actualNormativeExclusionCount: control?.effectiveMode === "ENFORCE" ? events.filter((event) => event?.actualNormativeExclusion === true).length : 0,
    fallbackCount,
    killSwitchRequested: control?.killSwitchRequested === true,
    killSwitchSuppressedExecution: control?.killSwitchRequested === true && runtimeExecutionCount === 0,
    versionMismatchCount: control?.reasonCodes?.includes("version_mismatch") ? 1 : 0,
    activationGateRejectionCount: control?.enabledRequested && control?.effectiveMode === "OFF" ? 1 : 0,
    candidateCountBefore,
    candidateCountAfter: control?.effectiveMode === "ENFORCE" ? events.reduce((sum, event) => sum + int(event?.candidateCountAfter), 0) : candidateCountBefore,
    topKChangedCount: control?.effectiveMode === "ENFORCE" ? events.filter((event) => event?.topKChanged === true).length : 0,
    rollbackEventCount: int(rollbackEventCount),
    reasonCodeDistribution: countReasons(events),
    policyContractVersion: String(versions.policyContractVersion || ""),
    runtimeVersion: String(versions.runtimeVersion || ""),
    activationVersion: String(versions.activationVersion || ""),
    stopRequired: false,
    stopReasons: []
  };
  const initialValidation = validateExfoliationNormativePolicyRuntimeTelemetry({ ...telemetry, stopRequired: false, stopReasons: [] }, { skipStopConsistency: true });
  telemetry.stopReasons = deriveNormativePolicyStopReasons({ control, runtimeEvents: events, comparison, telemetryValid: initialValidation.valid });
  telemetry.stopRequired = telemetry.stopReasons.length > 0;
  return telemetry;
}
export function validateExfoliationNormativePolicyRuntimeTelemetry(telemetry, { skipStopConsistency = false } = {}) {
  const errors = [];
  if (!telemetry || typeof telemetry !== "object" || Array.isArray(telemetry)) return { valid: false, errors: ["telemetry_not_object"] };
  if (hasForbiddenKey(telemetry)) errors.push("forbidden_telemetry_field");
  if (Object.keys(telemetry).some((key) => !TOP_LEVEL_KEYS.has(key))) errors.push("unknown_telemetry_field");
  if (telemetry.evidenceType !== "normative_policy_runtime_aggregate") errors.push("invalid_evidence_type");
  if (telemetry.schemaVersion !== EXFOLIATION_NORMATIVE_POLICY_TELEMETRY_VERSION) errors.push("invalid_schema_version");
  if (!["OFF","SHADOW","ENFORCE"].includes(telemetry.effectiveMode)) errors.push("invalid_effective_mode");
  for (const key of ["runtimeExecutionCount","runtimeErrorCount","runtimeLatencyMsTotal","runtimeLatencyMsMax","restrictEvaluationCount","hypotheticalExclusionCount","actualNormativeExclusionCount","fallbackCount","versionMismatchCount","activationGateRejectionCount","candidateCountBefore","candidateCountAfter","topKChangedCount","rollbackEventCount"]) if (!Number.isInteger(telemetry[key]) || telemetry[key] < 0) errors.push(`invalid_${key}`);
  for (const key of ["killSwitchRequested","killSwitchSuppressedExecution","stopRequired"]) if (typeof telemetry[key] !== "boolean") errors.push(`invalid_${key}`);
  if (!telemetry.actionCounts || ACTIONS.some((action) => !Number.isInteger(telemetry.actionCounts[action]) || telemetry.actionCounts[action] < 0) || Object.keys(telemetry.actionCounts).length !== ACTIONS.length) errors.push("invalid_action_counts");
  if (!telemetry.reasonCodeDistribution || typeof telemetry.reasonCodeDistribution !== "object" || Array.isArray(telemetry.reasonCodeDistribution) || Object.values(telemetry.reasonCodeDistribution).some((value) => !Number.isInteger(value) || value < 0)) errors.push("invalid_reason_code_distribution");
  if (!Array.isArray(telemetry.stopReasons) || telemetry.stopReasons.some((reason) => !EXFOLIATION_NORMATIVE_POLICY_STOP_REASONS.includes(reason))) errors.push("invalid_stop_reasons");
  if (!skipStopConsistency && telemetry.stopRequired !== (telemetry.stopReasons.length > 0)) errors.push("stop_state_mismatch");
  if (telemetry.killSwitchRequested && telemetry.runtimeExecutionCount > 0) errors.push("kill_switch_execution_violation");
  if (telemetry.effectiveMode !== "ENFORCE" && telemetry.actualNormativeExclusionCount !== 0) errors.push("non_enforce_actual_exclusion");
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}
export function emitExfoliationNormativePolicyRuntimeTelemetry(telemetry, sink = console.info) {
  const validation = validateExfoliationNormativePolicyRuntimeTelemetry(telemetry);
  if (!validation.valid) return { emitted: false, reasonCode: "telemetry_validation_failed", errors: validation.errors };
  try { sink("[exfoliation-normative-policy-runtime]", telemetry); return { emitted: true, reasonCode: "aggregate_telemetry_emitted" }; }
  catch { return { emitted: false, reasonCode: "telemetry_sink_failed", errors: [] }; }
}
