import crypto from "node:crypto";
import { evaluateCandidateExposurePolicy } from "./candidate-exposure-policy.js";
import { evaluateFunctionalRankingCandidate } from "./functional-ranking-contract.js";
import { resolveProductFunctionalProfile } from "./product-functional-profile.js";
import { buildRoutinePolicy } from "./routine-policy.js";
import { resolveRecentInstabilityGuardPolicy } from "./recent-instability-guard-policy.js";
import { materializeExfoliationProductionConsumptionFromGovernedRecord } from "./exfoliation-non-numeric-pda-production-consumption-shadow.js";
import {
  evaluateExfoliationNormativeProductionPolicyShadow,
  EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_VERSION
} from "./exfoliation-non-numeric-pda-normative-production-policy-shadow.js";

export const EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_DUAL_RUN_VERSION =
  "exfoliation-non-numeric-pda-normative-production-policy-dual-run-v1";

export const EXFOLIATION_NORMATIVE_POLICY_DIVERGENCE_CLASSES = Object.freeze([
  "AUTHORITY_COVERAGE_GAP",
  "EXACT_AGREEMENT",
  "INCOMPARABLE_SEMANTICS",
  "LEGACY_HEURISTIC_DEPENDENCY",
  "LEGACY_MORE_CAUTIOUS",
  "ROUTINE_USER_CONTEXT_DIVERGENCE",
  "SHADOW_DECIDED_LEGACY_UNKNOWN",
  "SHADOW_MORE_CAUTIOUS",
  "SHADOW_UNKNOWN_LEGACY_DECIDED"
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((key) => [key, stable(value[key])])
    );
  }
  return value;
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function productId(product) {
  return String(product?.id || product?.productId || product?.product_id || "").trim() || null;
}

function productName(product) {
  return String(product?.name || "").trim() || null;
}

function normalizeRoutineAction(value) {
  const normalized = String(value || "keep").trim().toLowerCase();
  return normalized === "maintain" ? "keep" : normalized;
}

function routineProductAction(routinePolicy, id) {
  const exact = Array.isArray(routinePolicy?.productActions)
    ? routinePolicy.productActions.find((row) => String(row?.productId || "") === String(id || ""))
    : null;
  if (exact?.action) return normalizeRoutineAction(exact.action);

  const treatment = routinePolicy?.windows?.evening?.steps?.find(
    (step) => step?.stepKey === "pm.treatment"
  );
  return normalizeRoutineAction(treatment?.action || "keep");
}

function sameWindowSeverity(routinePolicy) {
  const rows = Array.isArray(routinePolicy?.prohibitedSameWindow)
    ? routinePolicy.prohibitedSameWindow
    : [];
  if (rows.some((row) => row?.severity === "blocked")) return "blocked";
  if (rows.some((row) => row?.severity === "warning")) return "warning";
  return "none";
}

function recentSafetyFlags(recentGuard) {
  const reasons = Array.isArray(recentGuard?.reasons) ? recentGuard.reasons : [];
  return {
    sensitivity_context: reasons.includes("high_sensitivity_detected"),
    recent_reaction_or_instability: reasons.includes("recent_instability_detected")
  };
}

function governedContextFromEnvelope(envelope, governedRecord) {
  const pda = governedRecord?.pda || governedRecord?.expected_output || governedRecord || {};
  const activeItems = Array.isArray(pda?.active_identities?.items) ? pda.active_identities.items : [];
  const uncertaintyReasons = Array.isArray(pda?.uncertainty?.reasons) ? pda.uncertainty.reasons : [];
  const missingConcentration = uncertaintyReasons.includes("ACTIVE_CONCENTRATION_MISSING");
  return {
    signal_status: pda.signal_status || null,
    active_identities: activeItems.map((item) => item?.identity).filter(Boolean),
    multi_active_status:
      String(pda.multi_active_status || "").toLowerCase() === "multiple" ? "MULTIPLE" : "SINGLE",
    coverage: pda?.coverage?.state || null,
    uncertainty: uncertaintyReasons.length ? "HIGH" : "LOW",
    concentration_state: missingConcentration ? "MISSING" : "AVAILABLE_OR_NOT_REQUIRED",
    legacy_strength_comparable: "NOT_RELEVANT",
    governed_identity_overlap: envelope?.derived_relations?.identity_overlap?.state === "present"
  };
}

function resolvedExternalPolicyContext({
  canonicalState,
  product,
  surveySafety,
  goalPolicy,
  override
}) {
  if (override && typeof override === "object") {
    return {
      recent_instability_guard_decision:
        override.recent_instability_guard_decision || "no_guard",
      routine_action: override.routine_action || "keep",
      same_window_severity: override.same_window_severity || "none",
      duplicate_exfoliation: override.duplicate_exfoliation === true,
      sensitivity_context: override.sensitivity_context === true,
      recent_reaction_or_instability: override.recent_reaction_or_instability === true,
      preference_ranking_benefit: override.preference_ranking_benefit === true,
      provenance: {
        source: "caller_supplied_resolved_external_policy_context",
        ...(override.provenance || {})
      }
    };
  }

  const context = canonicalState?.decisionBundle?.context || {};
  const routine = buildRoutinePolicy({ context });
  const profile = resolveProductFunctionalProfile(product);
  const recentGuard = resolveRecentInstabilityGuardPolicy({
    surveySafety: surveySafety || {},
    goalPolicy: goalPolicy || {},
    product,
    productProfile: profile
  });
  const flags = recentSafetyFlags(recentGuard);

  return {
    recent_instability_guard_decision: recentGuard.decision,
    routine_action: routineProductAction(routine, productId(product)),
    same_window_severity: sameWindowSeverity(routine),
    duplicate_exfoliation: false,
    sensitivity_context: flags.sensitivity_context,
    recent_reaction_or_instability: flags.recent_reaction_or_instability,
    preference_ranking_benefit: false,
    provenance: {
      recent_instability_guard_policy: recentGuard,
      routine_policy: {
        product_action: routineProductAction(routine, productId(product)),
        same_window_severity: sameWindowSeverity(routine),
        routine_burden_state: routine.routineBurdenState || null
      },
      duplicate_relation: "NOT_RESOLVED_AT_THIS_BOUNDARY"
    }
  };
}

function currentCandidateDecision(candidatePolicyResult, id) {
  return (
    candidatePolicyResult?.decisions?.find(
      (row) => String(row?.candidateRef || "") === String(id || "")
    ) || null
  );
}

function legacyExfoliationComparable(profile) {
  const axis = Array.isArray(profile?.functionalAxes)
    ? profile.functionalAxes.find((row) => row?.axis === "exfoliation")
    : null;
  return {
    profile_evaluable: profile?.evaluable !== false,
    exfoliation_axis_present: Boolean(axis),
    count_derived_strength: axis?.strength || null,
    confidence: axis?.confidence || null,
    semantic_guard:
      "LEGACY_COUNT_DERIVED_STRENGTH_IS_NOT_GOVERNED_PDA_POTENCY"
  };
}

export function classifyExfoliationNormativePolicyDivergence({
  normativeResult,
  candidateDecision,
  legacyComparable,
  externalPolicyContext
} = {}) {
  const action = normativeResult?.policy_action;
  const exposure = candidateDecision?.exposure || null;
  const supporting = [];

  if (action === "NOT_APPLICABLE") {
    return {
      primary: "INCOMPARABLE_SEMANTICS",
      supporting,
      reason:
        "PDA applicability and CandidateExposurePolicy exposure are distinct semantic domains."
    };
  }

  if (action === "DEFER") {
    if (legacyComparable?.exfoliation_axis_present) {
      supporting.push("LEGACY_HEURISTIC_DEPENDENCY", "SHADOW_UNKNOWN_LEGACY_DECIDED");
    } else if (exposure) {
      supporting.push("SHADOW_UNKNOWN_LEGACY_DECIDED");
    }
    return {
      primary: "AUTHORITY_COVERAGE_GAP",
      supporting: Array.from(new Set(supporting)).sort(),
      reason:
        "Governed normative authority defers while existing production may still emit an independent legacy/candidate-policy decision."
    };
  }

  const hasRoutineOrSafetyContext =
    normativeResult?.contribution_trace?.some((row) =>
      ["safety", "routine"].includes(row?.source)
    ) || false;

  if (hasRoutineOrSafetyContext && ["CAUTION", "RESTRICT"].includes(action)) {
    supporting.push("INCOMPARABLE_SEMANTICS");
    if (
      (action === "RESTRICT" && exposure === "hidden") ||
      (action === "CAUTION" && ["contextual", "collapsed"].includes(exposure))
    ) {
      supporting.push("EXACT_AGREEMENT");
    }
    return {
      primary: "ROUTINE_USER_CONTEXT_DIVERGENCE",
      supporting: Array.from(new Set(supporting)).sort(),
      reason:
        "Normative action is driven by resolved safety/routine context while canonical candidate exposure remains a separate production policy domain."
    };
  }

  if (action === "RESTRICT") {
    return exposure === "hidden"
      ? {
          primary: "EXACT_AGREEMENT",
          supporting,
          reason:
            "Both bounded surfaces are restrictive, without equating shadow RESTRICT to canonical exclusion."
        }
      : {
          primary: "SHADOW_MORE_CAUTIOUS",
          supporting,
          reason:
            "The normative shadow is more restrictive than the current candidate exposure, but no enforcement follows."
        };
  }

  if (action === "CAUTION") {
    if (["hidden", "insufficient_evidence"].includes(exposure)) {
      return {
        primary: "LEGACY_MORE_CAUTIOUS",
        supporting,
        reason:
          "Existing production exposure is more cautious than the categorical normative warning state."
      };
    }
    if (["contextual", "collapsed"].includes(exposure)) {
      return {
        primary: "EXACT_AGREEMENT",
        supporting,
        reason:
          "Both bounded surfaces express a contextual/caution posture while retaining separate semantics."
      };
    }
    return {
      primary: "SHADOW_MORE_CAUTIOUS",
      supporting,
      reason:
        "The normative shadow adds a caution where current candidate exposure does not."
    };
  }

  if (action === "ALLOW") {
    if (legacyComparable?.exfoliation_axis_present) {
      supporting.push("LEGACY_HEURISTIC_DEPENDENCY");
    }
    if (exposure === "primary") {
      return {
        primary: "EXACT_AGREEMENT",
        supporting: Array.from(new Set(supporting)).sort(),
        reason:
          "Neither bounded surface adds a restriction; this agreement is not activation readiness."
      };
    }
    if (exposure) {
      return {
        primary: "LEGACY_MORE_CAUTIOUS",
        supporting: Array.from(new Set(supporting)).sort(),
        reason:
          "The new policy adds no restriction while current production retains a separate exposure limitation."
      };
    }
    return {
      primary: "SHADOW_DECIDED_LEGACY_UNKNOWN",
      supporting: Array.from(new Set(supporting)).sort(),
      reason:
        "The normative shadow decides ALLOW while the comparable production surface is unavailable."
    };
  }

  return {
    primary: "INCOMPARABLE_SEMANTICS",
    supporting,
    reason: "No direct cross-domain comparison is authorized."
  };
}

export function runExfoliationNormativeProductionPolicyShadowDualRun({
  canonicalState,
  candidates,
  pdaArtifact,
  responseValue = null,
  snapshotValue = null,
  pdaAuthority = {},
  surveyContract = {},
  surveySafety = null,
  goalPolicy = {},
  resolvedExternalPolicyContextByProduct = {}
} = {}) {
  const products = Array.isArray(candidates) ? candidates : [];
  const records = Array.isArray(pdaArtifact?.products) ? pdaArtifact.products : [];
  const recordById = new Map(
    records.map((row) => [String(row?.product_id || row?.productId || ""), row])
  );

  const beforeCanonical = evaluateCandidateExposurePolicy({
    canonicalState,
    candidates: products
  });
  const beforeProductionFingerprint = fingerprint(beforeCanonical);
  const beforeResponseFingerprint = fingerprint(responseValue);
  const beforeSnapshotFingerprint = fingerprint(snapshotValue);
  const beforeCandidateOrderFingerprint = fingerprint(products.map(productId));

  const rows = products.map((product) => {
    const id = productId(product);
    const record = recordById.get(String(id || ""));
    const envelope = materializeExfoliationProductionConsumptionFromGovernedRecord({
      record,
      productId: id,
      candidateIds: products.map(productId),
      currentProductIds:
        canonicalState?.decisionBundle?.context?.productExposureState?.rows
          ?.filter((row) => row?.activeExposure === true)
          .map((row) => row?.productId) || [],
      pdaAuthority
    });
    const profile = resolveProductFunctionalProfile(product);
    const functionalRanking = evaluateFunctionalRankingCandidate({
      product,
      surveyContract,
      goalPolicy,
      productProfile: profile,
      currentProductFindings: canonicalState?.currentProductFindings || null
    });
    const external = resolvedExternalPolicyContext({
      canonicalState,
      product,
      surveySafety: surveySafety || surveyContract?.safety || {},
      goalPolicy,
      override: resolvedExternalPolicyContextByProduct?.[id]
    });
    const governed = governedContextFromEnvelope(envelope, record);
    const normative = evaluateExfoliationNormativeProductionPolicyShadow({
      productionConsumptionEnvelope: envelope,
      externalPolicyContext: external,
      governedContext: governed,
      uncertainty: governed.uncertainty,
      provenance: {
        product_id: id,
        pda_authority: pdaAuthority
      }
    });
    const candidateDecision = currentCandidateDecision(beforeCanonical, id);
    const legacyComparable = legacyExfoliationComparable(profile);
    const divergence = classifyExfoliationNormativePolicyDivergence({
      normativeResult: normative,
      candidateDecision,
      legacyComparable,
      externalPolicyContext: external
    });

    return {
      product_id: id,
      product_name: productName(product),
      neutral_envelope: envelope,
      external_policy_context: external,
      normative_policy_shadow: normative,
      current_production: {
        candidate_exposure_policy: candidateDecision,
        existing_eligibility: candidateDecision?.laneEligibility || null,
        score: "OBSERVED_SEPARATELY_BY_1968_INVARIANCE_VERIFIER",
        rank: "OBSERVED_SEPARATELY_BY_1968_INVARIANCE_VERIFIER",
        top_k: "OBSERVED_SEPARATELY_BY_1968_INVARIANCE_VERIFIER",
        public_response: "UNCHANGED_BY_SHADOW_BOUNDARY",
        persistence: "UNCHANGED_BY_SHADOW_BOUNDARY"
      },
      legacy_comparable: {
        product_functional_profile: legacyComparable,
        functional_ranking_candidate: functionalRanking
      },
      divergence: {
        primary_class: divergence.primary,
        supporting_classes: divergence.supporting,
        exact_reason: divergence.reason,
        divergence_is_defect: false,
        divergence_implies_superiority: false,
        agreement_implies_activation_readiness: false
      }
    };
  });

  const afterCanonical = evaluateCandidateExposurePolicy({
    canonicalState,
    candidates: products
  });
  const afterProductionFingerprint = fingerprint(afterCanonical);
  const afterResponseFingerprint = fingerprint(responseValue);
  const afterSnapshotFingerprint = fingerprint(snapshotValue);
  const afterCandidateOrderFingerprint = fingerprint(products.map(productId));

  const divergenceDistribution = Object.fromEntries(
    Array.from(
      rows.reduce((map, row) => {
        const key = row.divergence.primary_class;
        map.set(key, (map.get(key) || 0) + 1);
        return map;
      }, new Map())
    ).sort(([left], [right]) => left.localeCompare(right, "en"))
  );

  return {
    version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_DUAL_RUN_VERSION,
    shadow_runtime_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_VERSION,
    mode: "SHADOW_OBSERVATION_ONLY",
    runtime_shadow_wired: true,
    production_authority: false,
    production_activation: false,
    restrict_enforcement_implemented: false,
    allow_promoted_to_canonical_approval: false,
    rows,
    divergence_distribution: divergenceDistribution,
    invariance: {
      canonical_production_fingerprint_before: beforeProductionFingerprint,
      canonical_production_fingerprint_after: afterProductionFingerprint,
      canonical_production_identical:
        beforeProductionFingerprint === afterProductionFingerprint,
      canonical_response_fingerprint_before: beforeResponseFingerprint,
      canonical_response_fingerprint_after: afterResponseFingerprint,
      canonical_response_identical:
        beforeResponseFingerprint === afterResponseFingerprint,
      canonical_snapshot_fingerprint_before: beforeSnapshotFingerprint,
      canonical_snapshot_fingerprint_after: afterSnapshotFingerprint,
      canonical_snapshot_identical:
        beforeSnapshotFingerprint === afterSnapshotFingerprint,
      candidate_order_fingerprint_before: beforeCandidateOrderFingerprint,
      candidate_order_fingerprint_after: afterCandidateOrderFingerprint,
      candidate_order_identical:
        beforeCandidateOrderFingerprint === afterCandidateOrderFingerprint
    }
  };
}
