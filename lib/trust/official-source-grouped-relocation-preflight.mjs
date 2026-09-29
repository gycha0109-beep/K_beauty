import { createHash } from "node:crypto";

export const GROUPED_RELOCATION_PREFLIGHT_INPUT_CONTRACT =
  "trust-phase8i4-grouped-relocation-preflight-input-v1";
export const GROUPED_RELOCATION_PREFLIGHT_CONTRACT =
  "trust-phase8i4-grouped-relocation-preflight-v1";

const SHA256 = /^[0-9a-f]{64}$/;
const SOURCE_NAME = /^[a-z0-9][a-z0-9_-]{0,54}_official$/;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function digest(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function same(left, right) {
  return left == null || right == null
    ? left == null && right == null
    : String(left) === String(right);
}

function httpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function uniqueSorted(values) {
  return [...new Set((values || []).map(String))].sort();
}

function add(blockers, condition, code) {
  if (!condition) blockers.push(code);
}

function canonicalHistoricalSources(rows) {
  return [...(rows || [])]
    .map((row) => ({
      source_id: String(row.source_id || ""),
      canonical_locator: row.canonical_locator ?? null,
      product_id: row.product_id ?? null,
      subject_id: row.subject_id ?? null,
      source_subject_binding_id: row.source_subject_binding_id ?? null,
      binding_state: row.binding_state ?? null,
      scope_relation: row.scope_relation ?? null,
      reviewed_binding_id: row.reviewed_binding_id ?? null,
      reviewed_review_id: row.reviewed_review_id ?? null,
    }))
    .sort((a, b) => a.source_id.localeCompare(b.source_id));
}

export function preflightGroupedOfficialSourceRelocation(input) {
  if (!input || input.contract !== GROUPED_RELOCATION_PREFLIGHT_INPUT_CONTRACT) {
    throw new Error("TRUST_PHASE8I4_GROUPED_PREFLIGHT_CONTRACT_INVALID");
  }

  for (const key of [
    "case",
    "evaluation",
    "governed_subject",
    "current_reviewed_binding",
    "replacement",
  ]) {
    if (!input[key] || typeof input[key] !== "object") {
      throw new Error(
        `TRUST_PHASE8I4_GROUPED_PREFLIGHT_${key.toUpperCase()}_INVALID`,
      );
    }
  }
  if (!Array.isArray(input.historical_sources)) {
    throw new Error("TRUST_PHASE8I4_GROUPED_PREFLIGHT_HISTORICAL_SOURCES_INVALID");
  }

  const driftCase = input.case;
  const evaluation = input.evaluation;
  const subject = input.governed_subject;
  const reviewed = input.current_reviewed_binding;
  const replacement = input.replacement;
  const historicalSources = canonicalHistoricalSources(input.historical_sources);
  const blockers = [];

  const caseSourceIdsRaw = (driftCase.historical_source_ids || []).map(String);
  const caseSourceIds = uniqueSorted(caseSourceIdsRaw);
  const actualSourceIdsRaw = historicalSources.map((row) => row.source_id);
  const actualSourceIds = uniqueSorted(actualSourceIdsRaw);
  const incidentIdsRaw = (driftCase.incident_ids || []).map(String);
  const incidentIds = uniqueSorted(incidentIdsRaw);

  add(blockers, Boolean(driftCase.case_id), "CASE_ID_REQUIRED");
  add(blockers, Boolean(driftCase.product_id), "CASE_PRODUCT_REQUIRED");
  add(blockers, Boolean(driftCase.subject_id), "CASE_SUBJECT_REQUIRED");
  add(blockers, SHA256.test(String(driftCase.case_digest || "")), "CASE_DIGEST_INVALID");
  add(blockers, caseSourceIds.length >= 2, "GROUPED_SOURCE_COUNT_REQUIRES_MULTIPLE");
  add(
    blockers,
    caseSourceIdsRaw.length === caseSourceIds.length,
    "CASE_HISTORICAL_SOURCE_IDS_DUPLICATE",
  );
  add(blockers, incidentIds.length >= 1, "CASE_INCIDENT_IDS_REQUIRED");
  add(
    blockers,
    incidentIdsRaw.length === incidentIds.length,
    "CASE_INCIDENT_IDS_DUPLICATE",
  );
  add(
    blockers,
    actualSourceIdsRaw.length === actualSourceIds.length,
    "HISTORICAL_SOURCE_ROWS_DUPLICATE",
  );
  add(
    blockers,
    JSON.stringify(actualSourceIds) === JSON.stringify(caseSourceIds),
    "HISTORICAL_SOURCE_SET_MISMATCH",
  );

  add(blockers, evaluation.case_id === driftCase.case_id, "EVALUATION_CASE_MISMATCH");
  add(blockers, evaluation.result_kind === "READY_FOR_8I4", "EVALUATION_NOT_READY_FOR_8I4");
  add(blockers, Boolean(evaluation.policy_version), "EVALUATION_POLICY_VERSION_REQUIRED");
  add(
    blockers,
    evaluation.qualification_contract === "trust-phase8h-source-identity-qualification-v1",
    "QUALIFICATION_CONTRACT_MISMATCH",
  );
  add(
    blockers,
    SHA256.test(String(evaluation.qualification_digest || "")),
    "QUALIFICATION_DIGEST_INVALID",
  );
  add(
    blockers,
    SHA256.test(String(evaluation.input_digest || "")),
    "EVALUATION_INPUT_DIGEST_INVALID",
  );
  add(
    blockers,
    SHA256.test(String(evaluation.result_digest || "")),
    "EVALUATION_RESULT_DIGEST_INVALID",
  );
  add(blockers, httpsUrl(evaluation.candidate_locator), "CANDIDATE_LOCATOR_INVALID");
  add(
    blockers,
    Boolean(evaluation.qualified_historical_source_id),
    "QUALIFIED_HISTORICAL_SOURCE_ID_REQUIRED",
  );
  add(
    blockers,
    caseSourceIds.includes(String(evaluation.qualified_historical_source_id || "")),
    "QUALIFIED_HISTORICAL_SOURCE_NOT_IN_CASE",
  );
  add(
    blockers,
    actualSourceIds.includes(String(evaluation.qualified_historical_source_id || "")),
    "QUALIFIED_HISTORICAL_SOURCE_NOT_IN_GROUP",
  );

  add(blockers, subject.product_id === driftCase.product_id, "SUBJECT_PRODUCT_MISMATCH");
  add(blockers, subject.subject_id === driftCase.subject_id, "SUBJECT_ID_MISMATCH");
  add(blockers, subject.identity_status === "resolved", "SUBJECT_NOT_RESOLVED");
  add(blockers, subject.current_state === "current", "SUBJECT_NOT_CURRENT");
  add(blockers, Boolean(subject.formulation_revision_key), "SUBJECT_FORMULATION_MISSING");

  add(blockers, reviewed.product_id === driftCase.product_id, "REVIEWED_BINDING_PRODUCT_MISMATCH");
  add(blockers, reviewed.subject_id === driftCase.subject_id, "REVIEWED_BINDING_SUBJECT_MISMATCH");
  add(blockers, reviewed.binding_state === "resolved", "REVIEWED_BINDING_NOT_RESOLVED");
  add(
    blockers,
    reviewed.binding_method === "trust_official_source_review_v1",
    "REVIEWED_BINDING_METHOD_INVALID",
  );
  add(blockers, reviewed.product_scope_state === "product", "REVIEWED_BINDING_SCOPE_INVALID");
  add(blockers, Boolean(reviewed.binding_id), "REVIEWED_BINDING_ID_REQUIRED");
  add(blockers, Boolean(reviewed.review_id), "REVIEWED_REVIEW_ID_REQUIRED");
  add(blockers, httpsUrl(reviewed.source_url), "REVIEWED_BINDING_LOCATOR_INVALID");
  add(blockers, SOURCE_NAME.test(String(reviewed.source_name || "")), "REVIEWED_SOURCE_NAME_INVALID");
  add(
    blockers,
    reviewed.review_version === "trust-official-source-review-v1",
    "REVIEW_VERSION_INVALID",
  );
  add(
    blockers,
    ["equivalent", "narrower"].includes(reviewed.review_scope_relation),
    "REVIEW_SCOPE_INVALID",
  );
  add(blockers, same(reviewed.review_subject_market, subject.market_applicability), "REVIEW_SUBJECT_MARKET_MISMATCH");
  add(blockers, same(reviewed.review_source_market, reviewed.market_code), "REVIEW_SOURCE_MARKET_MISMATCH");
  add(blockers, same(reviewed.review_variant_key, subject.variant_key), "REVIEW_VARIANT_MISMATCH");
  add(
    blockers,
    same(reviewed.review_formulation_revision_key, subject.formulation_revision_key),
    "REVIEW_FORMULATION_MISMATCH",
  );
  add(blockers, reviewed.review_source_kind === reviewed.external_type, "REVIEW_SOURCE_KIND_MISMATCH");

  for (const row of historicalSources) {
    add(blockers, Boolean(row.source_id), "HISTORICAL_SOURCE_ID_REQUIRED");
    add(blockers, row.product_id === driftCase.product_id, "HISTORICAL_SOURCE_PRODUCT_MISMATCH");
    add(blockers, row.subject_id === driftCase.subject_id, "HISTORICAL_SOURCE_SUBJECT_MISMATCH");
    add(blockers, Boolean(row.source_subject_binding_id), "HISTORICAL_SOURCE_SUBJECT_BINDING_ID_REQUIRED");
    add(blockers, row.binding_state === "exact_subject_match", "HISTORICAL_SOURCE_BINDING_NOT_EXACT");
    add(
      blockers,
      ["equivalent", "narrower"].includes(row.scope_relation),
      "HISTORICAL_SOURCE_SCOPE_INVALID",
    );
    add(
      blockers,
      row.reviewed_binding_id === reviewed.binding_id,
      "HISTORICAL_SOURCE_REVIEWED_BINDING_MISMATCH",
    );
    add(
      blockers,
      row.reviewed_review_id === reviewed.review_id,
      "HISTORICAL_SOURCE_REVIEWED_REVIEW_MISMATCH",
    );
    add(
      blockers,
      row.canonical_locator === reviewed.source_url,
      "HISTORICAL_SOURCE_LOCATOR_MISMATCH",
    );
  }

  add(blockers, httpsUrl(replacement.source_url), "REPLACEMENT_HTTPS_REQUIRED");
  add(blockers, replacement.source_url !== reviewed.source_url, "REPLACEMENT_LOCATOR_UNCHANGED");
  add(
    blockers,
    replacement.source_url === evaluation.candidate_locator,
    "REPLACEMENT_CANDIDATE_MISMATCH",
  );
  add(blockers, replacement.source_name === reviewed.source_name, "REPLACEMENT_SOURCE_NAME_MISMATCH");
  add(blockers, replacement.external_type === reviewed.external_type, "REPLACEMENT_SOURCE_KIND_MISMATCH");
  add(blockers, same(replacement.market_code, reviewed.market_code), "REPLACEMENT_MARKET_MISMATCH");
  add(blockers, same(replacement.locale, reviewed.locale), "REPLACEMENT_LOCALE_MISMATCH");

  const canonicalCase = {
    case_id: driftCase.case_id,
    product_id: driftCase.product_id,
    subject_id: driftCase.subject_id,
    case_digest: driftCase.case_digest,
    historical_source_ids: caseSourceIds,
    incident_ids: incidentIds,
  };

  const canonicalEvaluation = {
    evaluation_id: evaluation.evaluation_id,
    case_id: evaluation.case_id,
    policy_version: evaluation.policy_version,
    result_kind: evaluation.result_kind,
    candidate_locator: evaluation.candidate_locator,
    qualified_historical_source_id:
      evaluation.qualified_historical_source_id,
    qualification_contract: evaluation.qualification_contract,
    qualification_digest: evaluation.qualification_digest,
    input_digest: evaluation.input_digest,
    result_digest: evaluation.result_digest,
  };

  const prestate = {
    case: canonicalCase,
    evaluation: canonicalEvaluation,
    governed_subject: subject,
    current_reviewed_binding: reviewed,
    historical_sources: historicalSources,
  };

  const groupPrestateDigest = digest(prestate);
  const replacementExternalId = httpsUrl(replacement.source_url)
    ? "official-url-sha256:" +
      createHash("sha256").update(replacement.source_url).digest("hex")
    : null;

  const result = {
    contract: GROUPED_RELOCATION_PREFLIGHT_CONTRACT,
    status:
      blockers.length === 0
        ? "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION"
        : "HOLD",
    blockers: [...new Set(blockers)].sort(),
    case_id: driftCase.case_id,
    evaluation_id: evaluation.evaluation_id,
    product_id: driftCase.product_id,
    subject_id: driftCase.subject_id,
    historical_source_ids: caseSourceIds,
    incident_ids: incidentIds,
    qualified_historical_source_id:
      evaluation.qualified_historical_source_id ?? null,
    old_binding_id: reviewed.binding_id,
    old_review_id: reviewed.review_id,
    old_locator: reviewed.source_url,
    replacement_locator: replacement.source_url,
    replacement_external_id: replacementExternalId,
    qualification_contract: evaluation.qualification_contract,
    qualification_digest: evaluation.qualification_digest,
    group_prestate_digest: groupPrestateDigest,
    mutation_policy: "READ_ONLY_GROUPED_PREFLIGHT_NO_PRODUCTION_WRITE",
    authority:
      blockers.length === 0
        ? "PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_GROUPED_CONFIRMATION"
        : "NON_AUTHORITATIVE_HOLD",
  };

  return {
    ...result,
    group_plan_digest: digest(result),
  };
}
