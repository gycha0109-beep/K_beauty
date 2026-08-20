import {
  EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES,
  normalizeExfoliationNormativePolicyProductionSource
} from "./exfoliation-normative-policy-production-provenance.js";

export const EXFOLIATION_NORMATIVE_POLICY_TELEMETRY_VERSION = "exfoliation-normative-production-policy-runtime-telemetry-v1";
export const EXFOLIATION_NORMATIVE_POLICY_STOP_REASONS = Object.freeze([
  "activation_gate_rejected", "evaluator_error", "fallback_legacy_not_preserved", "invalid_policy_output", "invalid_telemetry", "kill_switch_execution_violation", "response_schema_changed", "shadow_canonical_eligibility_delta", "shadow_persistence_delta", "shadow_public_response_delta", "shadow_ranking_delta", "shadow_score_delta", "shadow_top1_top3_delta", "unexpected_db_mutation", "unexpected_storage_mutation", "unsupported_activation_scope", "version_mismatch"
]);
const ACTIONS = Object.freeze(["ALLOW", "CAUTION", "RESTRICT", "DEFER", "NOT_APPLICABLE"]);
const FORBIDDEN_KEYS = new Set([
  "productid", "productids", "productname", "productnames", "brand",
  "user", "userid", "useridentifier", "username", "fullname", "name",
  "session", "sessionid", "sessionidentifier", "sessionkey",
  "ip", "rawip", "ipaddress", "rawipaddress", "email",
  "userinput", "questionnaire", "rawquestionnaire", "questionnairepayload",
  "survey", "rawsurvey", "surveypayload", "skinanalysis",
  "image", "rawimage", "imagedata", "photo", "rawphoto", "photodata",
  "request", "requestbody", "response", "responsebody",
  "token", "authtoken", "sessiontoken", "accesstoken", "refreshtoken", "bearertoken",
  "apikey", "secret", "authorization", "password", "credential", "credentials",
  "freetext", "freeformtext", "identifyingtext", "identifyingfreetext"
]);
const TOP_LEVEL_KEYS = new Set([
  "evidenceType","schemaVersion","effectiveMode","productionSource",
  "runtimeExecutionCount","runtimeErrorCount","runtimeLatencyMsTotal","runtimeLatencyMsMax","actionCounts","restrictEvaluationCount","hypotheticalExclusionCount","actualNormativeExclusionCount","fallbackCount","killSwitchRequested","killSwitchSuppressedExecution","versionMismatchCount","activationGateRejectionCount","candidateCountBefore","candidateCountAfter","topKChangedCount","rollbackEventCount","reasonCodeDistribution","policyContractVersion","runtimeVersion","activationVersion","stopRequired","stopReasons",
  "organicRecommendationExecutionCount","controlledProductionProbeExecutionCount","unknownProductionSourceExecutionCount",
  "organicActionCounts","controlledActionCounts","unknownActionCounts",
  "organicFallbackCount","controlledFallbackCount","unknownFallbackCount",
  "organicRuntimeErrorCount","controlledRuntimeErrorCount","unknownRuntimeErrorCount",
  "organicHypotheticalExclusionCount","controlledHypotheticalExclusionCount","unknownHypotheticalExclusionCount",
  "organicActualNormativeExclusionCount","controlledActualNormativeExclusionCount","unknownActualNormativeExclusionCount",
  "organicStopReasons","controlledStopReasons","unknownStopReasons"
]);
function int(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; }
function uniqueSorted(values) { return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "en")); }
function normalizeKey(value) { return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase(); }
function isForbiddenNormalizedKey(key) {
  if (FORBIDDEN_KEYS.has(key)) return true;
  if (/^(product).*(id|ids|name|names)$/.test(key)) return true;
  if (/^(user|session).*(id|identifier|key)$/.test(key)) return true;
  if (/^(auth|session|access|refresh|bearer).*token$/.test(key)) return true;
  if (/^(raw)?ip(address)?$/.test(key)) return true;
  if (/^(raw)?(image|photo|questionnaire|survey)(data|payload|text)?$/.test(key)) return true;
  if (/^(freeform|identifying).*text$/.test(key)) return true;
  return false;
}
function hasForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  return Object.entries(value).some(([key, nested]) => isForbiddenNormalizedKey(normalizeKey(key)) || hasForbiddenKey(nested));
}
function emptyActionCounts() { return Object.fromEntries(ACTIONS.map((action) => [action, 0])); }
function countReasons(events) {
  const counts = {};
  for (const event of events) for (const reason of Array.isArray(event?.reasonCodes) ? event.reasonCodes : []) counts[String(reason)] = (counts[String(reason)] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, "en")));
}
function partitionValue(source, expectedSource, value) { return source === expectedSource ? value : 0; }
function partitionActionCounts(source, expectedSource, actionCounts) { return source === expectedSource ? { ...actionCounts } : emptyActionCounts(); }
function partitionStopReasons(source, expectedSource, stopReasons) { return source === expectedSource ? [...stopReasons] : []; }
function validActionCounts(value) {
  return value && typeof value === "object" && !Array.isArray(value) && ACTIONS.every((action) => Number.isInteger(value[action]) && value[action] >= 0) && Object.keys(value).length === ACTIONS.length;
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
export function buildExfoliationNormativePolicyRuntimeTelemetry({ control = {}, runtimeEvents = [], comparison = {}, versions = {}, rollbackEventCount = 0, productionSource } = {}) {
  const events = Array.isArray(runtimeEvents) ? runtimeEvents : [];
  const source = normalizeExfoliationNormativePolicyProductionSource(productionSource);
  const actionCounts = emptyActionCounts();
  for (const event of events) if (ACTIONS.includes(event?.policyAction)) actionCounts[event.policyAction] += 1;
  const runtimeExecutionCount = events.filter((event) => event?.runtimeExecuted === true).length;
  const runtimeErrorCount = events.filter((event) => event?.runtimeError === true).length;
  const fallbackCount = events.filter((event) => event?.fallback === true).length;
  const candidateCountBefore = events.reduce((sum, event) => sum + int(event?.candidateCountBefore), 0);
  const latencyValues = events.map((event) => int(event?.latencyMs));
  const hypotheticalExclusionCount = events.filter((event) => event?.policyAction === "RESTRICT" && event?.existingEligibility === true).length;
  const actualNormativeExclusionCount = control?.effectiveMode === "ENFORCE" ? events.filter((event) => event?.actualNormativeExclusion === true).length : 0;
  const telemetry = {
    evidenceType: "normative_policy_runtime_aggregate",
    schemaVersion: EXFOLIATION_NORMATIVE_POLICY_TELEMETRY_VERSION,
    effectiveMode: control?.effectiveMode || "OFF",
    productionSource: source,
    runtimeExecutionCount,
    runtimeErrorCount,
    runtimeLatencyMsTotal: latencyValues.reduce((a, b) => a + b, 0),
    runtimeLatencyMsMax: latencyValues.length ? Math.max(...latencyValues) : 0,
    actionCounts,
    restrictEvaluationCount: actionCounts.RESTRICT,
    hypotheticalExclusionCount,
    actualNormativeExclusionCount,
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
    stopReasons: [],
    organicRecommendationExecutionCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.ORGANIC_PRODUCTION, 1),
    controlledProductionProbeExecutionCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.CONTROLLED_PRODUCTION_PROBE, 1),
    unknownProductionSourceExecutionCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.UNKNOWN_PRODUCTION_SOURCE, 1),
    organicActionCounts: partitionActionCounts(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.ORGANIC_PRODUCTION, actionCounts),
    controlledActionCounts: partitionActionCounts(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.CONTROLLED_PRODUCTION_PROBE, actionCounts),
    unknownActionCounts: partitionActionCounts(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.UNKNOWN_PRODUCTION_SOURCE, actionCounts),
    organicFallbackCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.ORGANIC_PRODUCTION, fallbackCount),
    controlledFallbackCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.CONTROLLED_PRODUCTION_PROBE, fallbackCount),
    unknownFallbackCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.UNKNOWN_PRODUCTION_SOURCE, fallbackCount),
    organicRuntimeErrorCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.ORGANIC_PRODUCTION, runtimeErrorCount),
    controlledRuntimeErrorCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.CONTROLLED_PRODUCTION_PROBE, runtimeErrorCount),
    unknownRuntimeErrorCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.UNKNOWN_PRODUCTION_SOURCE, runtimeErrorCount),
    organicHypotheticalExclusionCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.ORGANIC_PRODUCTION, hypotheticalExclusionCount),
    controlledHypotheticalExclusionCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.CONTROLLED_PRODUCTION_PROBE, hypotheticalExclusionCount),
    unknownHypotheticalExclusionCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.UNKNOWN_PRODUCTION_SOURCE, hypotheticalExclusionCount),
    organicActualNormativeExclusionCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.ORGANIC_PRODUCTION, actualNormativeExclusionCount),
    controlledActualNormativeExclusionCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.CONTROLLED_PRODUCTION_PROBE, actualNormativeExclusionCount),
    unknownActualNormativeExclusionCount: partitionValue(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.UNKNOWN_PRODUCTION_SOURCE, actualNormativeExclusionCount),
    organicStopReasons: [],
    controlledStopReasons: [],
    unknownStopReasons: []
  };
  const initialValidation = validateExfoliationNormativePolicyRuntimeTelemetry({ ...telemetry, stopRequired: false, stopReasons: [] }, { skipStopConsistency: true });
  telemetry.stopReasons = deriveNormativePolicyStopReasons({ control, runtimeEvents: events, comparison, telemetryValid: initialValidation.valid });
  telemetry.stopRequired = telemetry.stopReasons.length > 0;
  telemetry.organicStopReasons = partitionStopReasons(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.ORGANIC_PRODUCTION, telemetry.stopReasons);
  telemetry.controlledStopReasons = partitionStopReasons(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.CONTROLLED_PRODUCTION_PROBE, telemetry.stopReasons);
  telemetry.unknownStopReasons = partitionStopReasons(source, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.UNKNOWN_PRODUCTION_SOURCE, telemetry.stopReasons);
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
  if (normalizeExfoliationNormativePolicyProductionSource(telemetry.productionSource) !== telemetry.productionSource) errors.push("invalid_production_source");
  for (const key of ["runtimeExecutionCount","runtimeErrorCount","runtimeLatencyMsTotal","runtimeLatencyMsMax","restrictEvaluationCount","hypotheticalExclusionCount","actualNormativeExclusionCount","fallbackCount","versionMismatchCount","activationGateRejectionCount","candidateCountBefore","candidateCountAfter","topKChangedCount","rollbackEventCount","organicRecommendationExecutionCount","controlledProductionProbeExecutionCount","unknownProductionSourceExecutionCount","organicFallbackCount","controlledFallbackCount","unknownFallbackCount","organicRuntimeErrorCount","controlledRuntimeErrorCount","unknownRuntimeErrorCount","organicHypotheticalExclusionCount","controlledHypotheticalExclusionCount","unknownHypotheticalExclusionCount","organicActualNormativeExclusionCount","controlledActualNormativeExclusionCount","unknownActualNormativeExclusionCount"]) if (!Number.isInteger(telemetry[key]) || telemetry[key] < 0) errors.push(`invalid_${key}`);
  for (const key of ["killSwitchRequested","killSwitchSuppressedExecution","stopRequired"]) if (typeof telemetry[key] !== "boolean") errors.push(`invalid_${key}`);
  if (!validActionCounts(telemetry.actionCounts)) errors.push("invalid_action_counts");
  for (const key of ["organicActionCounts","controlledActionCounts","unknownActionCounts"]) if (!validActionCounts(telemetry[key])) errors.push(`invalid_${key}`);
  if (!telemetry.reasonCodeDistribution || typeof telemetry.reasonCodeDistribution !== "object" || Array.isArray(telemetry.reasonCodeDistribution) || Object.values(telemetry.reasonCodeDistribution).some((value) => !Number.isInteger(value) || value < 0)) errors.push("invalid_reason_code_distribution");
  for (const key of ["stopReasons","organicStopReasons","controlledStopReasons","unknownStopReasons"]) if (!Array.isArray(telemetry[key]) || telemetry[key].some((reason) => !EXFOLIATION_NORMATIVE_POLICY_STOP_REASONS.includes(reason))) errors.push(`invalid_${key}`);
  if (!skipStopConsistency && telemetry.stopRequired !== (telemetry.stopReasons.length > 0)) errors.push("stop_state_mismatch");
  if (telemetry.organicRecommendationExecutionCount + telemetry.controlledProductionProbeExecutionCount + telemetry.unknownProductionSourceExecutionCount !== 1) errors.push("invalid_source_execution_partition");
  for (const action of ACTIONS) if (telemetry.organicActionCounts[action] + telemetry.controlledActionCounts[action] + telemetry.unknownActionCounts[action] !== telemetry.actionCounts[action]) errors.push("invalid_action_source_partition");
  if (telemetry.organicFallbackCount + telemetry.controlledFallbackCount + telemetry.unknownFallbackCount !== telemetry.fallbackCount) errors.push("invalid_fallback_source_partition");
  if (telemetry.organicRuntimeErrorCount + telemetry.controlledRuntimeErrorCount + telemetry.unknownRuntimeErrorCount !== telemetry.runtimeErrorCount) errors.push("invalid_runtime_error_source_partition");
  if (telemetry.organicHypotheticalExclusionCount + telemetry.controlledHypotheticalExclusionCount + telemetry.unknownHypotheticalExclusionCount !== telemetry.hypotheticalExclusionCount) errors.push("invalid_hypothetical_exclusion_source_partition");
  if (telemetry.organicActualNormativeExclusionCount + telemetry.controlledActualNormativeExclusionCount + telemetry.unknownActualNormativeExclusionCount !== telemetry.actualNormativeExclusionCount) errors.push("invalid_actual_exclusion_source_partition");
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
