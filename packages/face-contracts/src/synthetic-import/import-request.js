import { createCandidateImportError } from "./import-errors.js";

export const CANDIDATE_IMPORT_REQUEST_SCHEMA_VERSION = "candidate-import-request-v1";
export const CANDIDATE_IMPORT_LIMITS = Object.freeze({
  maxBytes: 25 * 1024 * 1024,
  minDimension: 512,
  maxDimension: 4096,
  maxPixels: 16_777_216,
  allowedFormats: Object.freeze(["png", "jpeg", "webp"])
});

const TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion",
  "source",
  "generationArtifact",
  "providerRun",
  "grouping",
  "operatorAttestation",
  "operatorHints"
]);
const SOURCE_KEYS = Object.freeze(["inboxRelativePath", "originalDownloadName"]);
const GENERATION_KEYS = Object.freeze([
  "finalizedSpecPath",
  "compiledPromptPath",
  "expectedSpecDigest",
  "expectedPromptDigest"
]);
const PROVIDER_KEYS = Object.freeze([
  "providerProfileId",
  "providerProfileVersion",
  "executionMode",
  "providerModelLabel",
  "providerModelVersion",
  "providerGenerationId",
  "generatedAt",
  "downloadedAt",
  "exactReproductionAvailable"
]);
const GROUPING_KEYS = Object.freeze(["campaignId", "campaignSeriesId", "conditionId", "lineage"]);
const LINEAGE_KEYS = Object.freeze(["kind", "parentCandidateId"]);
const ATTESTATION_KEYS = Object.freeze([
  "syntheticOnly",
  "realPersonReferenceUsed",
  "termsAndRightsReviewed",
  "downloadedBy"
]);
const HINT_KEYS = Object.freeze(["visibleExternalMark", "notes"]);
const MARK_KEYS = Object.freeze(["status", "location", "provenanceStatus"]);

const TOKEN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const CANDIDATE_ID_PATTERN = /^cand_[a-f0-9]{24}$/;
const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-](\d{2}):(\d{2}))$/;
const MARK_LOCATIONS = new Set(["bottom_right", "bottom_left", "top_right", "top_left", "other"]);
const EXECUTION_MODES = new Set(["manual_web", "local_workflow"]);
const MARK_STATUSES = new Set(["present", "absent", "unknown"]);
const SENSITIVE_PATTERN = /(bearer\s+[a-z0-9._-]+|api[_ -]?key|session[_ -]?token|cookie\s*=|sk-[a-z0-9_-]{8,}|https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  if (!isObject(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function nullableString(value, max = 256) {
  return value === null || (typeof value === "string" && value.length <= max);
}

function validIso(value, nullable = false) {
  if (nullable && value === null) {
    return true;
  }
  if (typeof value !== "string") {
    return false;
  }
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === "Z" ? 0 : Number(match[9]);
  const offsetMinute = match[8] === "Z" ? 0 : Number(match[10]);

  if (
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  ) {
    return false;
  }

  const calendar = new Date(Date.UTC(year, month - 1, day));
  const validCalendarDate =
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day;
  return validCalendarDate && Number.isFinite(Date.parse(value));
}

function push(errors, code, path, detail = null) {
  errors.push(createCandidateImportError(code, path, detail));
}

export function validateCandidateImportRequest(value) {
  const errors = [];
  if (!hasExactKeys(value, TOP_LEVEL_KEYS)) {
    push(errors, "invalid_request_schema", "$", "unexpected top-level shape");
    return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  }
  if (value.schemaVersion !== CANDIDATE_IMPORT_REQUEST_SCHEMA_VERSION) {
    push(errors, "invalid_request_schema", "schemaVersion");
  }

  if (!hasExactKeys(value.source, SOURCE_KEYS)) {
    push(errors, "invalid_request_schema", "source");
  } else {
    if (typeof value.source.inboxRelativePath !== "string" || !value.source.inboxRelativePath.trim()) {
      push(errors, "unsafe_source_path", "source.inboxRelativePath");
    }
    if (
      typeof value.source.originalDownloadName !== "string" ||
      !value.source.originalDownloadName.trim() ||
      value.source.originalDownloadName.length > 255 ||
      /[\\/\0]/.test(value.source.originalDownloadName)
    ) {
      push(errors, "invalid_request_schema", "source.originalDownloadName");
    }
  }

  if (!hasExactKeys(value.generationArtifact, GENERATION_KEYS)) {
    push(errors, "invalid_request_schema", "generationArtifact");
  } else {
    for (const key of ["finalizedSpecPath", "compiledPromptPath"]) {
      if (typeof value.generationArtifact[key] !== "string" || !value.generationArtifact[key].trim()) {
        push(errors, "unsafe_source_path", `generationArtifact.${key}`);
      }
    }
    if (!DIGEST_PATTERN.test(value.generationArtifact.expectedSpecDigest || "")) {
      push(errors, "spec_digest_mismatch", "generationArtifact.expectedSpecDigest");
    }
    if (!DIGEST_PATTERN.test(value.generationArtifact.expectedPromptDigest || "")) {
      push(errors, "prompt_digest_mismatch", "generationArtifact.expectedPromptDigest");
    }
  }

  if (!hasExactKeys(value.providerRun, PROVIDER_KEYS)) {
    push(errors, "invalid_request_schema", "providerRun");
  } else {
    if (!TOKEN_PATTERN.test(value.providerRun.providerProfileId || "")) {
      push(errors, "invalid_request_schema", "providerRun.providerProfileId");
    }
    if (!TOKEN_PATTERN.test(value.providerRun.providerProfileVersion || "")) {
      push(errors, "invalid_request_schema", "providerRun.providerProfileVersion");
    }
    if (!EXECUTION_MODES.has(value.providerRun.executionMode)) {
      push(errors, "provider_execution_mode_forbidden", "providerRun.executionMode");
    }
    for (const key of ["providerModelLabel", "providerModelVersion", "providerGenerationId"]) {
      if (!nullableString(value.providerRun[key])) {
        push(errors, "invalid_request_schema", `providerRun.${key}`);
      }
      if (typeof value.providerRun[key] === "string" && SENSITIVE_PATTERN.test(value.providerRun[key])) {
        push(errors, "sensitive_provenance_forbidden", `providerRun.${key}`);
      }
    }
    if (!validIso(value.providerRun.generatedAt, true)) {
      push(errors, "invalid_request_schema", "providerRun.generatedAt");
    }
    if (!validIso(value.providerRun.downloadedAt, false)) {
      push(errors, "invalid_request_schema", "providerRun.downloadedAt");
    }
    if (typeof value.providerRun.exactReproductionAvailable !== "boolean") {
      push(errors, "invalid_request_schema", "providerRun.exactReproductionAvailable");
    }
  }

  if (!hasExactKeys(value.grouping, GROUPING_KEYS) || !hasExactKeys(value.grouping?.lineage, LINEAGE_KEYS)) {
    push(errors, "invalid_grouping_contract", "grouping");
  } else {
    if (!TOKEN_PATTERN.test(value.grouping.campaignId || "")) {
      push(errors, "invalid_grouping_contract", "grouping.campaignId");
    }
    for (const key of ["campaignSeriesId", "conditionId"]) {
      if (!(value.grouping[key] === null || TOKEN_PATTERN.test(value.grouping[key] || ""))) {
        push(errors, "invalid_grouping_contract", `grouping.${key}`);
      }
    }
    const lineage = value.grouping.lineage;
    if (!new Set(["independent", "reference_edit"]).has(lineage.kind)) {
      push(errors, "invalid_grouping_contract", "grouping.lineage.kind");
    }
    if (lineage.kind === "independent" && lineage.parentCandidateId !== null) {
      push(errors, "invalid_grouping_contract", "grouping.lineage.parentCandidateId");
    }
    if (lineage.kind === "reference_edit" && !CANDIDATE_ID_PATTERN.test(lineage.parentCandidateId || "")) {
      push(errors, "parent_candidate_missing", "grouping.lineage.parentCandidateId");
    }
  }

  if (!hasExactKeys(value.operatorAttestation, ATTESTATION_KEYS)) {
    push(errors, "invalid_request_schema", "operatorAttestation");
  } else {
    if (value.operatorAttestation.syntheticOnly !== true || value.operatorAttestation.realPersonReferenceUsed !== false) {
      push(errors, "synthetic_attestation_required", "operatorAttestation");
    }
    if (value.operatorAttestation.termsAndRightsReviewed !== true) {
      push(errors, "rights_review_required", "operatorAttestation.termsAndRightsReviewed");
    }
    if (value.operatorAttestation.downloadedBy !== "human_operator") {
      push(errors, "invalid_request_schema", "operatorAttestation.downloadedBy");
    }
  }

  if (!hasExactKeys(value.operatorHints, HINT_KEYS) || !hasExactKeys(value.operatorHints?.visibleExternalMark, MARK_KEYS)) {
    push(errors, "invalid_request_schema", "operatorHints");
  } else {
    const mark = value.operatorHints.visibleExternalMark;
    if (!MARK_STATUSES.has(mark.status) || mark.provenanceStatus !== "unverified") {
      push(errors, "invalid_request_schema", "operatorHints.visibleExternalMark");
    }
    if (mark.status === "present" && !MARK_LOCATIONS.has(mark.location)) {
      push(errors, "invalid_request_schema", "operatorHints.visibleExternalMark.location");
    }
    if (mark.status !== "present" && mark.location !== null) {
      push(errors, "invalid_request_schema", "operatorHints.visibleExternalMark.location");
    }
    if (!nullableString(value.operatorHints.notes, 500)) {
      push(errors, "invalid_request_schema", "operatorHints.notes");
    } else if (typeof value.operatorHints.notes === "string" && SENSITIVE_PATTERN.test(value.operatorHints.notes)) {
      push(errors, "sensitive_provenance_forbidden", "operatorHints.notes");
    }
  }

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}
