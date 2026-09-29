import { createHash } from "node:crypto";

export const GROUPED_RELOCATION_OPERATOR_PREFLIGHT_HASH_CONTRACT =
  "trust-phase8i4f-operator-preflight-hash-v1";

const SHA256 = /^[0-9a-f]{64}$/;

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

function requireDigest(value, name) {
  if (!SHA256.test(String(value || ""))) {
    throw new Error(`TRUST_PHASE8I4F_OPERATOR_${name}_INVALID`);
  }
}

function normalizedIds(values) {
  return [...new Set((values || []).map(String))].sort();
}

export function buildGroupedRelocationOperatorPreflightHash(source) {
  for (const key of [
    "case_id",
    "evaluation_id",
    "product_id",
    "subject_id",
    "qualified_historical_source_id",
    "old_binding_id",
    "old_review_id",
  ]) {
    if (!source?.[key]) {
      throw new Error(
        `TRUST_PHASE8I4F_OPERATOR_${key.toUpperCase()}_REQUIRED`,
      );
    }
  }

  for (const [key, label] of [
    ["group_prestate_digest", "GROUP_PRESTATE_DIGEST"],
    ["group_plan_digest", "GROUP_PLAN_DIGEST"],
    ["phase8h_anchor_prestate_digest", "PHASE8H_PRESTATE_DIGEST"],
    [
      "phase8h_anchor_relocation_plan_digest",
      "PHASE8H_RELOCATION_PLAN_DIGEST",
    ],
    ["qualification_digest", "QUALIFICATION_DIGEST"],
  ]) {
    requireDigest(source[key], label);
  }

  return digest({
    contract: GROUPED_RELOCATION_OPERATOR_PREFLIGHT_HASH_CONTRACT,
    case_id: source.case_id,
    evaluation_id: source.evaluation_id,
    product_id: source.product_id,
    subject_id: source.subject_id,
    qualified_historical_source_id:
      source.qualified_historical_source_id,
    historical_source_ids: normalizedIds(source.historical_source_ids),
    incident_ids: normalizedIds(source.incident_ids),
    old_binding_id: source.old_binding_id,
    old_review_id: source.old_review_id,
    qualification_digest: source.qualification_digest,
    group_prestate_digest: source.group_prestate_digest,
    group_plan_digest: source.group_plan_digest,
    phase8h_anchor_prestate_digest:
      source.phase8h_anchor_prestate_digest,
    phase8h_anchor_relocation_plan_digest:
      source.phase8h_anchor_relocation_plan_digest,
  });
}

function equalIds(left, right) {
  return (
    JSON.stringify(normalizedIds(left)) ===
    JSON.stringify(normalizedIds(right))
  );
}

function equal(left, right) {
  return String(left ?? "") === String(right ?? "");
}

export function assertGroupedRelocationOperatorParity({
  dbPreflight,
  jsPreflight,
  confirmationRequest,
}) {
  if (
    dbPreflight?.status !==
      "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION" ||
    jsPreflight?.status !==
      "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION"
  ) {
    throw new Error("TRUST_PHASE8I4F_OPERATOR_PREFLIGHT_NOT_READY");
  }

  const comparisons = [
    ["case_id", dbPreflight.case_id, jsPreflight.case_id],
    ["evaluation_id", dbPreflight.evaluation_id, jsPreflight.evaluation_id],
    ["product_id", dbPreflight.product_id, jsPreflight.product_id],
    ["subject_id", dbPreflight.subject_id, jsPreflight.subject_id],
    [
      "qualified_historical_source_id",
      dbPreflight.qualified_historical_source_id,
      jsPreflight.qualified_historical_source_id,
    ],
    ["old_binding_id", dbPreflight.old_binding_id, jsPreflight.old_binding_id],
    ["old_review_id", dbPreflight.old_review_id, jsPreflight.old_review_id],
    ["old_locator", dbPreflight.old_locator, jsPreflight.old_locator],
    [
      "replacement_locator",
      dbPreflight.replacement_locator,
      jsPreflight.replacement_locator,
    ],
    [
      "replacement_external_id",
      dbPreflight.replacement_external_id,
      jsPreflight.replacement_external_id,
    ],
    [
      "qualification_digest",
      dbPreflight.qualification_digest,
      jsPreflight.qualification_digest,
    ],
    [
      "group_prestate_digest",
      dbPreflight.group_prestate_digest,
      jsPreflight.group_prestate_digest,
    ],
    [
      "group_plan_digest",
      dbPreflight.group_plan_digest,
      jsPreflight.group_plan_digest,
    ],
    [
      "phase8h_anchor_prestate_digest",
      dbPreflight.phase8h_anchor_prestate_digest,
      confirmationRequest?.phase8h_anchor_prestate_digest,
    ],
    [
      "phase8h_anchor_relocation_plan_digest",
      dbPreflight.phase8h_anchor_relocation_plan_digest,
      confirmationRequest?.phase8h_anchor_relocation_plan_digest,
    ],
  ];

  const mismatches = comparisons
    .filter(([, left, right]) => !equal(left, right))
    .map(([key]) => key);

  if (
    !equalIds(
      dbPreflight.historical_source_ids,
      jsPreflight.historical_source_ids,
    )
  ) {
    mismatches.push("historical_source_ids");
  }
  if (!equalIds(dbPreflight.incident_ids, jsPreflight.incident_ids)) {
    mismatches.push("incident_ids");
  }

  if (mismatches.length > 0) {
    throw new Error(
      "TRUST_PHASE8I4F_OPERATOR_PREFLIGHT_PARITY_MISMATCH:" +
        mismatches.sort().join(","),
    );
  }

  return {
    contract: "trust-phase8i4f-operator-preflight-parity-v1",
    result: "PASS",
    case_id: dbPreflight.case_id,
    evaluation_id: dbPreflight.evaluation_id,
    group_prestate_digest: dbPreflight.group_prestate_digest,
    group_plan_digest: dbPreflight.group_plan_digest,
    phase8h_anchor_prestate_digest:
      dbPreflight.phase8h_anchor_prestate_digest,
    phase8h_anchor_relocation_plan_digest:
      dbPreflight.phase8h_anchor_relocation_plan_digest,
  };
}
