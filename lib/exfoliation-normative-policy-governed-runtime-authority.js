export const EXFOLIATION_NORMATIVE_POLICY_GOVERNED_RUNTIME_AUTHORITY_VERSION =
  "exfoliation-normative-policy-governed-runtime-authority-v1";

export const EXFOLIATION_NORMATIVE_POLICY_NEUTRAL_SHADOW_VERSION =
  "exfoliation-non-numeric-pda-production-consumption-shadow-v1";

const GOVERNED_RUNTIME_AUTHORITY = Object.freeze({
  "0b88019a-9eb2-4be9-842d-f1e60e42cf51": Object.freeze({
    active_identities: Object.freeze([
      Object.freeze({ concentration_state: null, identity: null })
    ]),
    coverage_state: "active_identity_with_unscaled_context",
    evidence_fact_keys: Object.freeze([
      "contains_active",
      "active_concentration",
      "recommended_use_frequency"
    ]),
    identity_overlap_state: "not_established",
    neutral_gate: "READY_FOR_SEPARATE_POLICY_EVALUATION",
    product_id: "0b88019a-9eb2-4be9-842d-f1e60e42cf51",
    production_authority: false,
    production_decision: "UNSPECIFIED",
    signal_status: "GOVERNED_SIGNAL_ESTABLISHED",
    uncertainty: null,
    version: EXFOLIATION_NORMATIVE_POLICY_NEUTRAL_SHADOW_VERSION
  }),
  "c4a5f510-8d9e-46bd-a31c-3c0a34fee331": Object.freeze({
    active_identities: Object.freeze([
      Object.freeze({ concentration_state: null, identity: null })
    ]),
    coverage_state: "active_identity_with_unscaled_context",
    evidence_fact_keys: Object.freeze(["contains_active", "product_format"]),
    identity_overlap_state: "not_established",
    neutral_gate: "DEFER_INSUFFICIENT_AUTHORITY",
    product_id: "c4a5f510-8d9e-46bd-a31c-3c0a34fee331",
    production_authority: false,
    production_decision: "UNSPECIFIED",
    signal_status: "GOVERNED_SIGNAL_ESTABLISHED",
    uncertainty: null,
    version: EXFOLIATION_NORMATIVE_POLICY_NEUTRAL_SHADOW_VERSION
  }),
  "230f1c9c-cbf8-4458-aaac-ea1010a21e8c": Object.freeze({
    active_identities: Object.freeze([
      Object.freeze({ concentration_state: null, identity: null }),
      Object.freeze({ concentration_state: null, identity: null })
    ]),
    coverage_state: "active_identity_with_unscaled_context",
    evidence_fact_keys: Object.freeze([
      "contains_active",
      "contains_active",
      "pad_surface_texture",
      "product_format",
      "wipe_off_use"
    ]),
    identity_overlap_state: "not_established",
    neutral_gate: "DEFER_INSUFFICIENT_AUTHORITY",
    product_id: "230f1c9c-cbf8-4458-aaac-ea1010a21e8c",
    production_authority: false,
    production_decision: "UNSPECIFIED",
    signal_status: "GOVERNED_SIGNAL_ESTABLISHED",
    uncertainty: null,
    version: EXFOLIATION_NORMATIVE_POLICY_NEUTRAL_SHADOW_VERSION
  }),
  "24a339bf-f380-493f-88b5-68e6be887c30": Object.freeze({
    active_identities: Object.freeze([]),
    coverage_state: "no_relevant_fact",
    evidence_fact_keys: Object.freeze([
      "contains_active",
      "contains_active",
      "recommended_use_frequency"
    ]),
    identity_overlap_state: "not_established",
    neutral_gate: "READY_FOR_SEPARATE_POLICY_EVALUATION",
    product_id: "24a339bf-f380-493f-88b5-68e6be887c30",
    production_authority: false,
    production_decision: "UNSPECIFIED",
    signal_status: "GOVERNED_SIGNAL_NOT_ESTABLISHED",
    uncertainty: null,
    version: EXFOLIATION_NORMATIVE_POLICY_NEUTRAL_SHADOW_VERSION
  })
});

function text(value) {
  return String(value ?? "").trim();
}

export function getExfoliationNormativePolicyGovernedRuntimeEnvelope(productId) {
  return GOVERNED_RUNTIME_AUTHORITY[text(productId)] || null;
}

export function buildExfoliationNormativePolicyAuthorityGapEnvelope(productId) {
  return Object.freeze({
    active_identities: Object.freeze([]),
    coverage_state: "unknown",
    evidence_fact_keys: Object.freeze([]),
    identity_overlap_state: "not_established",
    neutral_gate: "DEFER_INSUFFICIENT_AUTHORITY",
    product_id: text(productId) || null,
    production_authority: false,
    production_decision: "UNSPECIFIED",
    signal_status: "UNKNOWN",
    uncertainty: "HIGH",
    version: EXFOLIATION_NORMATIVE_POLICY_NEUTRAL_SHADOW_VERSION
  });
}

export function listExfoliationNormativePolicyGovernedRuntimeProductIds() {
  return Object.keys(GOVERNED_RUNTIME_AUTHORITY).sort((left, right) =>
    left.localeCompare(right, "en")
  );
}
