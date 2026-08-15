export const EXFOLIATION_NON_NUMERIC_PDA_SHADOW_CONSUMER_VERSION =
  "exfoliation-non-numeric-pda-shadow-decision-consumer-v1";

export const EXFOLIATION_NON_NUMERIC_PDA_SHADOW_DECISIONS = Object.freeze([
  "CLEAR",
  "CAUTION",
  "RESTRICT",
  "UNKNOWN",
  "NOT_APPLICABLE"
]);

const DECISION_BY_CAUTION_STATE = Object.freeze({
  caution: "CAUTION",
  restriction_candidate: "RESTRICT",
  not_applicable: "NOT_APPLICABLE"
});
const UNKNOWN_STATES = new Set(["missing", "unknown", "blocked"]);
const COVERAGE_UNKNOWN_STATES = new Set(["missing", "unknown", "blocked", "missing_fact"]);

function text(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function cloneStable(value) {
  return value == null ? value : stable(structuredClone(value));
}

function sortedUnique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "en")
  );
}

function uncertaintySummary(input = {}) {
  const coverage = input?.coverage_state || {};
  const uncertainty = input?.uncertainty_state || {};
  return {
    missing_context_keys: sortedUnique(coverage?.missing_context_keys),
    intrinsic_reasons: sortedUnique(uncertainty?.intrinsic_reasons),
    external_context_reasons: sortedUnique(uncertainty?.external_context_reasons),
    unknown_preserved: uncertainty?.unknown_preserved === true,
    missing_preserved: uncertainty?.missing_preserved === true
  };
}

function hasDecisionBlockingUncertainty(input = {}) {
  const coverage = input?.coverage_state || {};
  const uncertainty = uncertaintySummary(input);
  return COVERAGE_UNKNOWN_STATES.has(text(coverage?.state).toLowerCase()) ||
    uncertainty.missing_context_keys.length > 0 ||
    uncertainty.external_context_reasons.length > 0;
}

function decisionFor(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { decision: "UNKNOWN", reason_codes: ["SHADOW_DECISION_INPUT_MISSING"] };
  }

  const presence = text(input?.active_presence_state).toLowerCase() || "missing";
  const caution = input?.caution_restriction_shadow_input || {};
  const cautionState = text(caution?.state).toLowerCase() || "missing";
  const upstreamReasons = sortedUnique(caution?.reason_codes);

  if (presence === "not_applicable" || cautionState === "not_applicable") {
    return { decision: "NOT_APPLICABLE", reason_codes: upstreamReasons.length ? upstreamReasons : ["EXFOLIATION_PDA_NOT_APPLICABLE"] };
  }
  if (UNKNOWN_STATES.has(presence) || UNKNOWN_STATES.has(cautionState)) {
    return { decision: "UNKNOWN", reason_codes: upstreamReasons.length ? upstreamReasons : ["UPSTREAM_SHADOW_STATE_UNKNOWN"] };
  }
  if (DECISION_BY_CAUTION_STATE[cautionState]) {
    return { decision: DECISION_BY_CAUTION_STATE[cautionState], reason_codes: upstreamReasons };
  }
  if (cautionState === "none_established") {
    if (hasDecisionBlockingUncertainty(input)) {
      return { decision: "UNKNOWN", reason_codes: sortedUnique([...upstreamReasons, "MISSING_OR_UNCERTAIN_CONTEXT_PRESERVED"]) };
    }
    return { decision: "CLEAR", reason_codes: upstreamReasons.length ? upstreamReasons : ["NO_CAUTION_OR_RESTRICTION_ESTABLISHED"] };
  }
  return { decision: "UNKNOWN", reason_codes: sortedUnique([...upstreamReasons, "UNRECOGNIZED_UPSTREAM_SHADOW_STATE"]) };
}

export function consumeExfoliationNonNumericPdaShadowDecisionInput(row = {}) {
  const input = row?.shadow_decision_input;
  const resolved = decisionFor(input);
  return {
    product_id: text(row?.product_id),
    shadow_consumer_decision: {
      decision: resolved.decision,
      decision_basis: "CAUTION_RESTRICTION_SHADOW_INPUT_PROJECTION_ONLY",
      source_caution_restriction_state: text(input?.caution_restriction_shadow_input?.state).toLowerCase() || "missing",
      reason_codes: resolved.reason_codes,
      active_presence_state: text(input?.active_presence_state).toLowerCase() || "missing",
      coverage_state: cloneStable(input?.coverage_state || null),
      uncertainty_state: cloneStable(input?.uncertainty_state || null),
      provenance: {
        consumer_version: EXFOLIATION_NON_NUMERIC_PDA_SHADOW_CONSUMER_VERSION,
        adapter_version: input?.provenance?.adapter_version || null,
        pda_contract_version: input?.provenance?.pda_contract_version || null,
        pda_mapper_version: input?.provenance?.pda_mapper_version || null,
        pda_snapshot_sha256: input?.provenance?.pda_snapshot_sha256 || null,
        decision_derivation: "UPSTREAM_CAUTION_RESTRICTION_STATE_PLUS_UNCERTAINTY_GUARD_ONLY",
        source_provenance: cloneStable(input?.provenance || null),
        shadow_only: true,
        production_authority: false
      }
    }
  };
}

export function consumeExfoliationNonNumericPdaShadowDecisionInputs(adapterResult = {}) {
  if (adapterResult?.status !== "evaluated" || !Array.isArray(adapterResult?.rows)) {
    return {
      consumer_version: EXFOLIATION_NON_NUMERIC_PDA_SHADOW_CONSUMER_VERSION,
      status: "upstream_not_evaluated",
      shadow_only: true,
      rows: []
    };
  }
  return {
    consumer_version: EXFOLIATION_NON_NUMERIC_PDA_SHADOW_CONSUMER_VERSION,
    status: "evaluated",
    shadow_only: true,
    decision_authority: "ADAPTER_CAUTION_RESTRICTION_PROJECTION_ONLY",
    rows: adapterResult.rows.map(consumeExfoliationNonNumericPdaShadowDecisionInput)
  };
}
