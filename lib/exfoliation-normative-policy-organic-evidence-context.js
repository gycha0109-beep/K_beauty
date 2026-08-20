import { buildSurveyInputContract } from "./survey-input-contract.js";

export const V21_9L_ORGANIC_EVIDENCE_SCHEMA_VERSION =
  "exfoliation-normative-organic-shadow-evidence-daily-v1";
export const V21_9L_CONTEXT_BUCKET_VERSION =
  "privacy-safe-recommendation-context-bucket-v1";

const SOURCES = new Set([
  "ORGANIC_PRODUCTION",
  "CONTROLLED_PRODUCTION_PROBE",
  "UNKNOWN_PRODUCTION_SOURCE"
]);
const ACTIONS = Object.freeze(["ALLOW", "CAUTION", "RESTRICT", "DEFER", "NOT_APPLICABLE"]);
const CONCERNS = new Set([
  "barrier",
  "dehydration",
  "oiliness",
  "redness",
  "acne",
  "pores",
  "uneven_tone",
  "uv"
]);
const STOP_REASONS = new Set([
  "activation_gate_rejected",
  "evaluator_error",
  "fallback_legacy_not_preserved",
  "invalid_policy_output",
  "invalid_telemetry",
  "kill_switch_execution_violation",
  "response_schema_changed",
  "shadow_canonical_eligibility_delta",
  "shadow_persistence_delta",
  "shadow_public_response_delta",
  "shadow_ranking_delta",
  "shadow_score_delta",
  "shadow_top1_top3_delta",
  "unexpected_db_mutation",
  "unexpected_storage_mutation",
  "unsupported_activation_scope",
  "version_mismatch"
]);
const PARTITION_VALUES = Object.freeze({
  TOTAL: new Set(["ALL"]),
  PRIMARY_CONCERN_CLASS: new Set([...CONCERNS, "UNKNOWN"]),
  SENSITIVITY_RISK_CLASS: new Set(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
  CONCERN_STRUCTURE_CLASS: new Set(["NONE", "SINGLE", "MULTI"]),
  SURVEY_COMPLETENESS_CLASS: new Set(["COMPLETE", "PARTIAL"]),
  RECENT_INSTABILITY_CLASS: new Set(["PRESENT", "ABSENT", "UNKNOWN"]),
  STOP_REASON: STOP_REASONS
});
const EXACT_ROW_KEYS = Object.freeze([
  "bucket_date",
  "evidence_schema_version",
  "activation_version",
  "policy_contract_version",
  "runtime_version",
  "production_source",
  "context_bucket_version",
  "partition_key",
  "partition_value",
  "execution_count",
  "candidate_evaluation_count",
  "allow_count",
  "caution_count",
  "restrict_count",
  "defer_count",
  "not_applicable_count",
  "fallback_count",
  "runtime_error_count",
  "hypothetical_exclusion_count",
  "actual_exclusion_count",
  "stop_required_count"
]);
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

function int(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function normalizeKey(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isForbiddenKey(value) {
  const key = normalizeKey(value);
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
  return Object.entries(value).some(([key, nested]) => isForbiddenKey(key) || hasForbiddenKey(nested));
}

function utcDate(now) {
  const parsed = now instanceof Date ? now : new Date(now ?? Date.now());
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function primaryConcernClass(contract) {
  const value = contract?.goals?.primaryConcern;
  return CONCERNS.has(value) ? value : "UNKNOWN";
}

function sensitivityRiskClass(contract) {
  const value = String(contract?.safety?.sensitivityRisk || "unknown").toUpperCase();
  return ["LOW", "MEDIUM", "HIGH"].includes(value) ? value : "UNKNOWN";
}

function concernStructureClass(contract) {
  const count = (contract?.goals?.primaryConcern ? 1 : 0) +
    (Array.isArray(contract?.goals?.secondaryConcerns) ? contract.goals.secondaryConcerns.length : 0);
  if (count === 0) return "NONE";
  if (count === 1) return "SINGLE";
  return "MULTI";
}

function surveyCompletenessClass(contract) {
  return Array.isArray(contract?.metadata?.missingFields) && contract.metadata.missingFields.length === 0
    ? "COMPLETE"
    : "PARTIAL";
}

function recentInstabilityClass(contract) {
  const values = [
    contract?.safety?.recentSkinChange,
    contract?.safety?.recentlyChangedProduct
  ];
  if (values.includes("yes")) return "PRESENT";
  if (values.every((value) => value === "no")) return "ABSENT";
  return "UNKNOWN";
}

function baseCounters(telemetry) {
  const actionCounts = telemetry?.actionCounts || {};
  return {
    execution_count: 1,
    candidate_evaluation_count: int(telemetry?.runtimeExecutionCount),
    allow_count: int(actionCounts.ALLOW),
    caution_count: int(actionCounts.CAUTION),
    restrict_count: int(actionCounts.RESTRICT),
    defer_count: int(actionCounts.DEFER),
    not_applicable_count: int(actionCounts.NOT_APPLICABLE),
    fallback_count: int(telemetry?.fallbackCount),
    runtime_error_count: int(telemetry?.runtimeErrorCount),
    hypothetical_exclusion_count: int(telemetry?.hypotheticalExclusionCount),
    actual_exclusion_count: int(telemetry?.actualNormativeExclusionCount),
    stop_required_count: telemetry?.stopRequired === true ? 1 : 0
  };
}

function buildRow(common, partitionKey, partitionValue, counters) {
  return Object.freeze({
    ...common,
    partition_key: partitionKey,
    partition_value: partitionValue,
    ...counters
  });
}

function zeroCountersForStopReason() {
  return {
    execution_count: 1,
    candidate_evaluation_count: 0,
    allow_count: 0,
    caution_count: 0,
    restrict_count: 0,
    defer_count: 0,
    not_applicable_count: 0,
    fallback_count: 0,
    runtime_error_count: 0,
    hypothetical_exclusion_count: 0,
    actual_exclusion_count: 0,
    stop_required_count: 1
  };
}

export function validateV21_9LOrganicEvidenceRows(rows) {
  const errors = [];
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 32) {
    return { valid: false, errors: ["rows_invalid"] };
  }
  if (hasForbiddenKey(rows)) errors.push("forbidden_persistence_field");

  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      errors.push("row_not_object");
      continue;
    }
    const keys = Object.keys(row).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...EXACT_ROW_KEYS].sort())) {
      errors.push("row_keys_invalid");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.bucket_date || ""))) errors.push("bucket_date_invalid");
    if (row.evidence_schema_version !== V21_9L_ORGANIC_EVIDENCE_SCHEMA_VERSION) errors.push("schema_version_invalid");
    if (row.context_bucket_version !== V21_9L_CONTEXT_BUCKET_VERSION) errors.push("context_bucket_version_invalid");
    if (![row.activation_version, row.policy_contract_version, row.runtime_version].every((value) => typeof value === "string" && value.length > 0 && value.length <= 160)) {
      errors.push("runtime_version_invalid");
    }
    if (!SOURCES.has(row.production_source)) errors.push("production_source_invalid");
    const allowedValues = PARTITION_VALUES[row.partition_key];
    if (!allowedValues || !allowedValues.has(row.partition_value)) errors.push("partition_invalid");
    for (const key of EXACT_ROW_KEYS.filter((key) => key.endsWith("_count"))) {
      if (!Number.isInteger(row[key]) || row[key] < 0) errors.push("counter_invalid");
    }
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

export function buildV21_9LOrganicEvidenceRows({ input = {}, observation = {}, now = Date.now() } = {}) {
  const telemetry = observation?.telemetry;
  const source = observation?.productionSource || telemetry?.productionSource;
  const bucketDate = utcDate(now);

  if (
    !telemetry ||
    observation?.effectiveMode !== "SHADOW" ||
    observation?.runtimeActive !== true ||
    !SOURCES.has(source) ||
    !bucketDate
  ) {
    return Object.freeze([]);
  }

  const surveyContract = buildSurveyInputContract(input, {
    source: "v21_9l_privacy_safe_context_bucket",
    generatedAt: `${bucketDate}T00:00:00.000Z`
  });
  const common = Object.freeze({
    bucket_date: bucketDate,
    evidence_schema_version: V21_9L_ORGANIC_EVIDENCE_SCHEMA_VERSION,
    activation_version: String(telemetry.activationVersion || ""),
    policy_contract_version: String(telemetry.policyContractVersion || ""),
    runtime_version: String(telemetry.runtimeVersion || ""),
    production_source: source,
    context_bucket_version: V21_9L_CONTEXT_BUCKET_VERSION
  });
  const counters = baseCounters(telemetry);
  const rows = [
    buildRow(common, "TOTAL", "ALL", counters),
    buildRow(common, "PRIMARY_CONCERN_CLASS", primaryConcernClass(surveyContract), counters),
    buildRow(common, "SENSITIVITY_RISK_CLASS", sensitivityRiskClass(surveyContract), counters),
    buildRow(common, "CONCERN_STRUCTURE_CLASS", concernStructureClass(surveyContract), counters),
    buildRow(common, "SURVEY_COMPLETENESS_CLASS", surveyCompletenessClass(surveyContract), counters),
    buildRow(common, "RECENT_INSTABILITY_CLASS", recentInstabilityClass(surveyContract), counters)
  ];

  if (telemetry.stopRequired === true) {
    for (const reason of Array.isArray(telemetry.stopReasons) ? telemetry.stopReasons : []) {
      if (STOP_REASONS.has(reason)) {
        rows.push(buildRow(common, "STOP_REASON", reason, zeroCountersForStopReason()));
      }
    }
  }

  const validation = validateV21_9LOrganicEvidenceRows(rows);
  return validation.valid ? Object.freeze(rows) : Object.freeze([]);
}
