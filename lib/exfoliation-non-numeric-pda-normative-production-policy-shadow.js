export const EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_VERSION =
  "exfoliation-non-numeric-pda-normative-production-policy-shadow-v1";

export const EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION =
  "exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1";

export const EXFOLIATION_NORMATIVE_POLICY_ACTIONS = Object.freeze([
  "ALLOW",
  "CAUTION",
  "RESTRICT",
  "DEFER",
  "NOT_APPLICABLE"
]);

const EFFECTS = Object.freeze({
  ALLOW: Object.freeze({
    eligibility_effect: "PRESERVE_EXISTING_ELIGIBILITY",
    ranking_effect: "NO_DIRECT_RANK_MUTATION",
    score_effect: "NO_DIRECT_SCORE_MUTATION",
    top_k_effect: "NO_DIRECT_TOP_K_MUTATION",
    warning_effect: "NO_WARNING_REQUIRED"
  }),
  CAUTION: Object.freeze({
    eligibility_effect: "PRESERVE_EXISTING_ELIGIBILITY",
    ranking_effect: "NO_DIRECT_RANK_MUTATION",
    score_effect: "NO_DIRECT_SCORE_MUTATION",
    top_k_effect: "NO_DIRECT_TOP_K_MUTATION",
    warning_effect: "WARNING_REQUIRED"
  }),
  RESTRICT: Object.freeze({
    eligibility_effect: "EXCLUDE_WHEN_POLICY_ENFORCED",
    ranking_effect: "NO_DIRECT_RANK_MUTATION",
    score_effect: "NO_DIRECT_SCORE_MUTATION",
    top_k_effect: "INDIRECT_VIA_ELIGIBILITY_WHEN_ENFORCED",
    warning_effect: "RESTRICTION_EXPLANATION_REQUIRED"
  }),
  DEFER: Object.freeze({
    eligibility_effect: "PRESERVE_EXISTING_ELIGIBILITY",
    ranking_effect: "NO_DIRECT_RANK_MUTATION",
    score_effect: "NO_DIRECT_SCORE_MUTATION",
    top_k_effect: "NO_DIRECT_TOP_K_MUTATION",
    warning_effect: "UNCERTAINTY_EXPLANATION_REQUIRED"
  }),
  NOT_APPLICABLE: Object.freeze({
    eligibility_effect: "PRESERVE_EXISTING_ELIGIBILITY",
    ranking_effect: "NO_DIRECT_RANK_MUTATION",
    score_effect: "NO_DIRECT_SCORE_MUTATION",
    top_k_effect: "NO_DIRECT_TOP_K_MUTATION",
    warning_effect: "NOT_APPLICABLE_EXPLANATION_OPTIONAL"
  })
});

const READY = "READY_FOR_SEPARATE_POLICY_EVALUATION";
const CONTRIBUTION_PRIORITY = Object.freeze({
  NONE: 0,
  CAUTION: 1,
  DEFER: 2,
  RESTRICT: 3
});

function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeRoutineAction(value) {
  const normalized = text(value, "keep").toLowerCase();
  if (normalized === "maintain") return "keep";
  return ["keep", "reduce", "hold", "check_needed"].includes(normalized)
    ? normalized
    : "check_needed";
}

function normalizeSameWindow(value) {
  const normalized = text(value, "none").toLowerCase();
  return ["none", "warning", "blocked"].includes(normalized) ? normalized : "none";
}

function normalizeSafety(value) {
  const normalized = text(value, "insufficient_data").toLowerCase();
  return [
    "no_guard",
    "allow_with_context",
    "soft_penalty_candidate",
    "collapsed_exposure_candidate",
    "hard_block_candidate",
    "insufficient_data"
  ].includes(normalized)
    ? normalized
    : "insufficient_data";
}

function externalContribution(state) {
  const safety = normalizeSafety(state.recent_instability_guard_decision);
  const routine = normalizeRoutineAction(state.routine_action);
  const sameWindow = normalizeSameWindow(state.same_window_severity);
  const contributions = [];

  if (safety === "hard_block_candidate") {
    contributions.push({ source: "safety", contribution: "RESTRICT", rule_id: "R20_SAFETY_HARD_BLOCK" });
  } else if (safety === "insufficient_data") {
    contributions.push({ source: "safety", contribution: "DEFER", rule_id: "R30_EXTERNAL_CONTEXT_INSUFFICIENT" });
  } else if (["allow_with_context", "soft_penalty_candidate", "collapsed_exposure_candidate"].includes(safety)) {
    contributions.push({ source: "safety", contribution: "CAUTION", rule_id: "R40_SAFETY_CONTEXT_CAUTION" });
  }

  if (routine === "hold" || sameWindow === "blocked") {
    contributions.push({ source: "routine", contribution: "RESTRICT", rule_id: "R21_ROUTINE_HOLD_OR_BLOCKED" });
  } else if (routine === "check_needed") {
    contributions.push({ source: "routine", contribution: "DEFER", rule_id: "R30_EXTERNAL_CONTEXT_INSUFFICIENT" });
  } else if (routine === "reduce" || sameWindow === "warning" || state.duplicate_exfoliation === true) {
    contributions.push({ source: "routine", contribution: "CAUTION", rule_id: "R41_ROUTINE_CONTEXT_CAUTION" });
  }

  if (state.governed_identity_overlap === true) {
    contributions.push({ source: "governed_identity_overlap", contribution: "CAUTION", rule_id: "R42_IDENTITY_OVERLAP_CAUTION" });
  }

  return contributions;
}

function highestContribution(contributions) {
  return contributions.reduce(
    (best, row) =>
      CONTRIBUTION_PRIORITY[row.contribution] > CONTRIBUTION_PRIORITY[best]
        ? row.contribution
        : best,
    "NONE"
  );
}

function buildReadyReasons({ action, external, governed, contributions }) {
  if (action === "ALLOW") {
    const reasons = ["NPP_ADEQUATE_GOVERNED_AUTHORITY"];
    if (String(governed.multi_active_status || "").toUpperCase() === "MULTIPLE") {
      reasons.push("NPP_MULTI_ACTIVE_NO_POTENCY_INFERENCE");
    }
    if (String(governed.concentration_state || "").toUpperCase() === "MISSING") {
      reasons.push("NPP_MISSING_CONCENTRATION_PRESERVED");
    }
    if (String(governed.legacy_strength_comparable || "") === "DISAGREES_WITH_GOVERNED_NON_NUMERIC_STATE") {
      reasons.push("NPP_LEGACY_DISAGREEMENT_NON_AUTHORITATIVE");
    }
    reasons.push("NPP_ALLOW_DOES_NOT_MEAN_SAFE_OR_ELIGIBLE");
    return reasons;
  }

  const reasons = [];
  const safety = normalizeSafety(external.recent_instability_guard_decision);
  const routine = normalizeRoutineAction(external.routine_action);
  const sameWindow = normalizeSameWindow(external.same_window_severity);

  if (external.sensitivity_context === true) reasons.push("NPP_SENSITIVITY_CONTEXT");
  if (external.recent_reaction_or_instability === true) reasons.push("NPP_RECENT_INSTABILITY");

  if (safety === "hard_block_candidate") reasons.push("NPP_SAFETY_HARD_BLOCK");
  else if (safety === "insufficient_data") reasons.push("NPP_SAFETY_INFORMATION_INSUFFICIENT");
  else if (["allow_with_context", "soft_penalty_candidate", "collapsed_exposure_candidate"].includes(safety)) {
    reasons.push("NPP_SAFETY_CONTEXT_CAUTION");
  }

  if (routine === "hold") reasons.push("NPP_ROUTINE_HOLD");
  else if (routine === "check_needed") reasons.push("NPP_ROUTINE_CHECK_NEEDED");
  else if (routine === "reduce") reasons.push("NPP_ROUTINE_REDUCE");

  if (sameWindow === "blocked") reasons.push("NPP_SAME_WINDOW_BLOCKED");
  else if (sameWindow === "warning") reasons.push("NPP_SAME_WINDOW_WARNING");

  if (external.duplicate_exfoliation === true && routine !== "reduce") {
    reasons.push("NPP_DUPLICATE_EXFOLIATION");
  }

  if (external.governed_identity_overlap === true) reasons.push("NPP_IDENTITY_OVERLAP");

  if (safety === "hard_block_candidate" && external.preference_ranking_benefit === true) {
    reasons.push("NPP_SAFETY_PRECEDENCE_OVER_PREFERENCE");
  }

  const contributingExternalSources = new Set(
    contributions
      .filter((row) => ["safety", "routine"].includes(row.source))
      .map((row) => row.source)
  );
  if (contributingExternalSources.size > 1) reasons.push("NPP_MULTIPLE_EXTERNAL_CONCERNS");

  if (action === "RESTRICT") reasons.push("NPP_RESTRICT_DOES_NOT_IMPLY_POTENCY");
  if (action === "DEFER") reasons.push("NPP_DEFER_DOES_NOT_MEAN_BLOCK");
  return unique(reasons);
}

function buildAuthoritySources({ gate, action, external, governed }) {
  if (gate !== READY) {
    return ["8V neutral envelope", EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION];
  }

  const sources = [];
  const safety = normalizeSafety(external.recent_instability_guard_decision);
  const routine = normalizeRoutineAction(external.routine_action);
  const sameWindow = normalizeSameWindow(external.same_window_severity);

  if (safety !== "no_guard") sources.push("RecentInstabilityGuardPolicy");
  if (routine !== "keep") sources.push("RoutinePolicy.productAction");
  if (sameWindow !== "none") sources.push("RoutinePolicy.prohibitedSameWindow");
  if (external.duplicate_exfoliation === true && routine !== "reduce") {
    sources.push("CurrentProductFindings/governed relation");
  }
  if (external.governed_identity_overlap === true) sources.push("8V governed identities");
  if (external.preference_ranking_benefit === true) sources.push("legacy preference/ranking comparable");

  const multi = String(governed.multi_active_status || "").toUpperCase() === "MULTIPLE";
  const missingConcentration = String(governed.concentration_state || "").toUpperCase() === "MISSING";
  const legacyDisagreement =
    String(governed.legacy_strength_comparable || "") === "DISAGREES_WITH_GOVERNED_NON_NUMERIC_STATE";

  if (action === "ALLOW" && (multi || missingConcentration || legacyDisagreement)) {
    sources.unshift("8V governed PDA state");
    if (legacyDisagreement) sources.push("FunctionalRankingContract legacy comparable");
  }

  if (!sources.length) sources.push("8V neutral envelope");
  sources.push(EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION);
  return unique(sources);
}

function gateDecision(gate, governed) {
  if (gate === "NOT_APPLICABLE") {
    return {
      action: "NOT_APPLICABLE",
      matched_rule_ids: ["R00_NOT_APPLICABLE"],
      reason_codes: ["NPP_NOT_APPLICABLE", "NPP_NOT_APPLICABLE_NOT_NEGATIVE"]
    };
  }
  if (gate === "DEFER_INSUFFICIENT_AUTHORITY") {
    const unknown =
      String(governed.signal_status || "").toUpperCase() === "UNKNOWN" &&
      String(governed.coverage || "").toUpperCase() === "UNKNOWN";
    return {
      action: "DEFER",
      matched_rule_ids: ["R10_DEFER_INSUFFICIENT"],
      reason_codes: [
        ...(unknown ? ["NPP_UNKNOWN_GOVERNED_AUTHORITY"] : []),
        "NPP_INSUFFICIENT_GOVERNED_AUTHORITY",
        "NPP_DEFER_DOES_NOT_MEAN_BLOCK"
      ]
    };
  }
  if (gate === "DEFER_BLOCKED_AUTHORITY") {
    return {
      action: "DEFER",
      matched_rule_ids: ["R11_DEFER_BLOCKED"],
      reason_codes: ["NPP_BLOCKED_GOVERNED_AUTHORITY", "NPP_DEFER_DOES_NOT_MEAN_BLOCK"]
    };
  }
  if (gate === "DEFER_CONTEXT_CONFLICT") {
    return {
      action: "DEFER",
      matched_rule_ids: ["R12_DEFER_CONTEXT_CONFLICT"],
      reason_codes: ["NPP_CONTEXT_CONFLICT", "NPP_DEFER_DOES_NOT_MEAN_BLOCK"]
    };
  }
  return null;
}

export function evaluateExfoliationNormativeProductionPolicyShadow({
  productionConsumptionEnvelope,
  externalPolicyContext = {},
  governedContext = {},
  uncertainty = null,
  provenance = {}
} = {}) {
  const envelope = productionConsumptionEnvelope || {};
  const gate = text(envelope.neutral_gate, "DEFER_INSUFFICIENT_AUTHORITY");

  const external = {
    recent_instability_guard_decision: normalizeSafety(
      externalPolicyContext.recent_instability_guard_decision
    ),
    routine_action: normalizeRoutineAction(externalPolicyContext.routine_action),
    same_window_severity: normalizeSameWindow(externalPolicyContext.same_window_severity),
    duplicate_exfoliation: externalPolicyContext.duplicate_exfoliation === true,
    sensitivity_context: externalPolicyContext.sensitivity_context === true,
    recent_reaction_or_instability:
      externalPolicyContext.recent_reaction_or_instability === true,
    preference_ranking_benefit: externalPolicyContext.preference_ranking_benefit === true,
    governed_identity_overlap:
      externalPolicyContext.governed_identity_overlap === true ||
      envelope?.derived_relations?.identity_overlap?.state === "present"
  };

  const gated = gateDecision(gate, governedContext);
  let action;
  let matchedRuleIds;
  let reasonCodes;
  let contributions = [];

  if (gated) {
    action = gated.action;
    matchedRuleIds = gated.matched_rule_ids;
    reasonCodes = gated.reason_codes;
  } else if (gate === READY) {
    contributions = externalContribution(external);
    const highest = highestContribution(contributions);
    action = highest === "NONE" ? "ALLOW" : highest;
    matchedRuleIds = unique(contributions.map((row) => row.rule_id));
    if (!matchedRuleIds.length) matchedRuleIds = ["R50_READY_ALLOW"];
    reasonCodes = buildReadyReasons({
      action,
      external,
      governed: governedContext,
      contributions
    });
  } else {
    action = "DEFER";
    matchedRuleIds = ["R10_DEFER_INSUFFICIENT"];
    reasonCodes = [
      "NPP_UNKNOWN_GOVERNED_AUTHORITY",
      "NPP_INSUFFICIENT_GOVERNED_AUTHORITY",
      "NPP_DEFER_DOES_NOT_MEAN_BLOCK"
    ];
  }

  const effects = EFFECTS[action];

  return {
    version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_VERSION,
    contract_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION,
    mode: "SHADOW_OBSERVATION_ONLY",
    normative_classification: "POLICY_DECISION",
    policy_action: action,
    ...effects,
    matched_rule_ids: matchedRuleIds,
    reason_codes: reasonCodes,
    authority_sources: buildAuthoritySources({
      gate,
      action,
      external,
      governed: governedContext
    }),
    uncertainty:
      uncertainty ?? governedContext.uncertainty ?? envelope?.intrinsic?.uncertainty ?? null,
    provenance: {
      contract_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION,
      shadow_runtime_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_VERSION,
      upstream_neutral_gate: gate,
      upstream_shadow_version: envelope.version || null,
      upstream_provenance: envelope.provenance || null,
      external_policy_provenance: externalPolicyContext.provenance || null,
      ...provenance
    },
    production_activation: false,
    production_authority: false,
    restrict_enforced: false,
    canonical_eligibility_mutated: false,
    canonical_score_mutated: false,
    canonical_rank_mutated: false,
    canonical_top_k_mutated: false,
    allow_promoted_to_canonical_approval: false,
    external_policy_context: external,
    contribution_trace: contributions
  };
}

export const EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_EFFECTS = EFFECTS;
