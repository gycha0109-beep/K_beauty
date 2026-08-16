#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
  evaluateExfoliationNormativeProductionPolicyShadow,
  EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_VERSION,
  EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION
} from "../../lib/exfoliation-non-numeric-pda-normative-production-policy-shadow.js";
import {
  EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_DUAL_RUN_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_DIVERGENCE_CLASSES
} from "../../lib/exfoliation-non-numeric-pda-normative-production-policy-dual-run.js";
import {
  runExfoliationNormativeProductionPolicyShadowObservation,
  EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_OBSERVATION_VERSION
} from "../../lib/exfoliation-non-numeric-pda-normative-production-policy-observation.js";

const STAGE = "V2.1-8Y";
const TERMINAL = "NORMATIVE_PRODUCTION_POLICY_SHADOW_RUNTIME_VALIDATED";
const BASE_MAIN = "7dd6f3566ca3a680627eb64430ca8d34178b53bd";
const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const CANONICAL_8X = `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-canonical-examples-v1.json`;
const CONTRACT_8X = `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1.json`;
const GOVERNED_8O = "evidence/product-decision-axis-non-numeric-contract-v1/exfoliation-non-numeric-pda-examples-v1.json";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((a, b) => a.localeCompare(b, "en"))
        .map((key) => [key, stable(value[key])])
    );
  }
  return value;
}
const canonical = (value) => `${JSON.stringify(stable(value))}\n`;
const json = (path) => JSON.parse(fs.readFileSync(path, "utf8"));

function asEnvelope(row) {
  return {
    version: "exfoliation-non-numeric-pda-production-consumption-shadow-v1",
    contract_version: "exfoliation-non-numeric-pda-production-consumption-contract-v1",
    product_id: row.case_id,
    neutral_gate: row.neutral_envelope.neutral_gate,
    production_decision: "UNSPECIFIED",
    production_authority: false,
    derived_relations: {
      identity_overlap: {
        state: row.governed_pda_state?.governed_identity_overlap ? "present" : "not_established",
        identities: row.governed_pda_state?.governed_identity_overlap ? ["fixture_overlap"] : []
      },
      identity_count_is_potency: false,
      multiple_is_stronger: false
    },
    intrinsic: {
      signal_status: row.governed_pda_state?.signal_status || null,
      active_identity_set: { items: row.governed_pda_state?.active_identities || [], semantic_ordering: "NONE" },
      coverage_state: row.governed_pda_state?.coverage || null,
      uncertainty: row.uncertainty || null
    },
    provenance: { source: "frozen_8x_canonical_example", case_id: row.case_id }
  };
}

function provenanceView(provenance = {}) {
  const upstream = provenance.upstream_provenance || {};
  return {
    upstream_case_id: upstream.case_id || null,
    upstream_evidence: (upstream?.intrinsic?.evidence_provenance || []).map((row) => ({
      fact_key: row.fact_key || null,
      source_record_id: row.source_record_id || null
    })),
    external_policy_source:
      provenance?.external_policy_provenance?.source ||
      provenance?.external_policy_provenance?.recent_instability_guard_policy?.version ||
      null
  };
}

function normativeView(result) {
  return {
    policy_action: result.policy_action,
    eligibility_effect: result.eligibility_effect,
    ranking_effect: result.ranking_effect,
    score_effect: result.score_effect,
    top_k_effect: result.top_k_effect,
    warning_effect: result.warning_effect,
    matched_rule_ids: result.matched_rule_ids,
    reason_codes: result.reason_codes,
    authority_sources: result.authority_sources,
    uncertainty: result.uncertainty,
    provenance: provenanceView(result.provenance),
    production_activation: result.production_activation
  };
}

function envelopeView(envelope = {}) {
  return {
    version: envelope.version || null,
    product_id: envelope.product_id || null,
    neutral_gate: envelope.neutral_gate || null,
    production_decision: envelope.production_decision || null,
    production_authority: envelope.production_authority === true,
    signal_status: envelope?.intrinsic?.signal_status || null,
    active_identities: (envelope?.intrinsic?.active_identity_set?.items || []).map((row) => ({
      identity: row.identity || null,
      concentration_state: row.concentration_state || null
    })),
    coverage_state: envelope?.intrinsic?.coverage_state || null,
    uncertainty: envelope?.intrinsic?.uncertainty || null,
    identity_overlap_state: envelope?.derived_relations?.identity_overlap?.state || null,
    evidence_fact_keys: (envelope?.provenance?.intrinsic?.evidence_provenance || [])
      .map((row) => row.fact_key)
      .filter(Boolean)
  };
}

function externalView(external = {}) {
  return {
    recent_instability_guard_decision: external.recent_instability_guard_decision || null,
    routine_action: external.routine_action || null,
    same_window_severity: external.same_window_severity || null,
    duplicate_exfoliation: external.duplicate_exfoliation === true,
    sensitivity_context: external.sensitivity_context === true,
    recent_reaction_or_instability: external.recent_reaction_or_instability === true,
    preference_ranking_benefit: external.preference_ranking_benefit === true
  };
}

function candidateView(candidate = null) {
  if (!candidate) return null;
  return {
    candidate_ref: candidate.candidateRef || null,
    exposure: candidate.exposure || null,
    lane_eligibility: candidate.laneEligibility || null,
    reason_codes: candidate.reasonCodes || [],
    evidence_state: candidate.evidenceState || null,
    current_product_relation: candidate.currentProductRelation || null
  };
}

function legacyView(legacy = {}) {
  const ranking = legacy.functional_ranking_candidate || {};
  return {
    product_functional_profile: legacy.product_functional_profile || null,
    functional_ranking_candidate: {
      eligible: ranking.eligible ?? null,
      hard_filter_status: ranking.hardFilterStatus || null,
      total_score: ranking.totalScore ?? null,
      confidence: ranking.confidence || null,
      reasons: ranking.reasons || [],
      penalties: ranking.penalties || []
    }
  };
}

function canonicalReplay() {
  const frozen = json(CANONICAL_8X);
  return {
    stage: STAGE,
    terminal: TERMINAL,
    contract_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION,
    shadow_runtime_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_VERSION,
    source_artifact: CANONICAL_8X,
    case_count: frozen.cases.length,
    guards: {
      production_authority: false,
      restrict_enforced: false,
      allow_promoted_to_canonical_approval: false
    },
    cases: frozen.cases.map((row) => {
      const result = evaluateExfoliationNormativeProductionPolicyShadow({
        productionConsumptionEnvelope: asEnvelope(row),
        externalPolicyContext: {
          ...row.external_context,
          governed_identity_overlap: row.governed_pda_state?.governed_identity_overlap === true,
          provenance: { source: "frozen_8x_external_context_fixture", case_id: row.case_id }
        },
        governedContext: row.governed_pda_state,
        uncertainty: row.uncertainty,
        provenance: { canonical_case_id: row.case_id }
      });
      return {
        case_id: row.case_id,
        neutral_gate: row.neutral_envelope.neutral_gate,
        governed_pda_state: row.governed_pda_state,
        external_context: row.external_context,
        actual: normativeView(result)
      };
    })
  };
}

function runtimeState() {
  return {
    decisionBundle: { context: {
      version: "shared-skin-decision-context-v4",
      skinState: { priorityAxis: "pores", concernScores: { pores: 20 }, sensitivity: "low" },
      survey: { answers: { makeupUse: false }, completeness: "available" },
      safetyState: {
        level: "stable",
        sensitiveBurden: false,
        exfoliationExpansionAllowed: true,
        recentSkinChange: "no",
        recentlyChangedProduct: "no"
      },
      productExposureState: {
        rows: [], duplicateActiveAxes: [], unknownProductCount: 0, unknownExposurePresent: false,
        recentExposureState: "none_reported", reactionLinkState: "none_reported"
      },
      conditionSignalState: { recentSkinChange: "no", recentProductChange: "no", productReaction: "no" }
    } },
    functionalPolicy: {
      version: "functional-policy-v1", functionalDirection: "tone_care", planMode: "START",
      recommendationSuppressed: false,
      safety: { level: "stable", activeExpansionAllowed: true, protectionMustMaintain: true }
    },
    consistency: { version: "cross-domain-consistency-v1", effectivePolicySource: "raw" },
    currentProductFindings: {
      findings: [],
      summary: { evaluableSelectedCount: 0, notInDbCount: 0, notUsingCount: 0, unansweredCount: 0 }
    }
  };
}

function governedSetup() {
  const source = json(GOVERNED_8O);
  const products = source.examples.map((row) => ({
    id: row.source_product.product_id,
    product_id: row.source_product.product_id,
    name: row.source_product.name,
    brand: row.source_product.brand,
    category: row.source_product.category
  }));
  const records = source.examples.map((row) => ({
    product_id: row.source_product.product_id,
    category: row.source_product.category,
    pda: row.expected_output
  }));
  return { products, pdaArtifact: { products: records } };
}

function governedDualRun() {
  const { products, pdaArtifact } = governedSetup();
  return runExfoliationNormativeProductionPolicyShadowObservation({
    canonicalState: runtimeState(),
    candidates: products,
    pdaArtifact,
    responseValue: { stable: true, surface: "8y-bounded-governed-replay" },
    snapshotValue: { stable: true, surface: "8y-bounded-governed-replay" },
    pdaAuthority: {
      mapper_version: "product-decision-axis-mapper-contract-v1",
      snapshot_sha256: "31311c223cfc1084e02e226e36b60b6052884f16c52cdc3f5308b786641a9fea"
    },
    surveyContract: { safety: { sensitivityRisk: "low", recentSkinChange: "no", recentlyChangedProduct: "no" } },
    surveySafety: { sensitivityRisk: "low", recentSkinChange: "no", recentlyChangedProduct: "no" },
    goalPolicy: { rankingGoal: "pores", safetyGoal: "pores", recommendationGuard: "normal", hasTension: false }
  });
}

function governedReplay() {
  const dual = governedDualRun();
  return {
    stage: STAGE,
    terminal: TERMINAL,
    contract_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION,
    source_artifact: GOVERNED_8O,
    product_count: dual.rows.length,
    products: dual.rows.map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      neutral_envelope: envelopeView(row.neutral_envelope),
      external_policy_context: externalView(row.external_policy_context),
      normative_policy_shadow: normativeView(row.normative_policy_shadow)
    }))
  };
}

function dualRunReplay() {
  const dual = governedDualRun();
  return {
    stage: STAGE,
    terminal: TERMINAL,
    contract_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION,
    observation_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_OBSERVATION_VERSION,
    dual_run_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_DUAL_RUN_VERSION,
    divergence_taxonomy_version: "V2.1-8T_FROZEN_TAXONOMY_REUSED",
    divergence_classes: EXFOLIATION_NORMATIVE_POLICY_DIVERGENCE_CLASSES,
    comparison_principles: {
      divergence_not_defect: true,
      divergence_not_superiority: true,
      agreement_not_activation_readiness: true,
      restrict_not_canonical_block: true,
      allow_not_canonical_approval: true
    },
    result: {
      mode: dual.mode,
      runtime_shadow_wired: dual.runtime_shadow_wired,
      wiring_boundary: dual.wiring_boundary,
      production_authority: dual.production_authority,
      production_activation: dual.production_activation,
      restrict_enforcement_implemented: dual.restrict_enforcement_implemented,
      allow_promoted_to_canonical_approval: dual.allow_promoted_to_canonical_approval,
      divergence_distribution: dual.divergence_distribution,
      rows: dual.rows.map((row) => ({
        product_id: row.product_id,
        product_name: row.product_name,
        neutral_gate: row.neutral_envelope.neutral_gate,
        external_policy_context: externalView(row.external_policy_context),
        new_policy_shadow: normativeView(row.normative_policy_shadow),
        current_production: {
          candidate_exposure_policy: candidateView(row.current_production.candidate_exposure_policy),
          existing_eligibility: row.current_production.existing_eligibility,
          score: row.current_production.score,
          rank: row.current_production.rank,
          top_k: row.current_production.top_k,
          public_response: row.current_production.public_response,
          persistence: row.current_production.persistence
        },
        legacy_comparable: legacyView(row.legacy_comparable),
        divergence: row.divergence
      })),
      invariance: dual.invariance
    }
  };
}

function implementationEvidence() {
  const contract = json(CONTRACT_8X);
  const replay = canonicalReplay();
  const governed = governedReplay();
  const dual = dualRunReplay();
  return {
    stage: STAGE,
    primary_terminal_outcome: TERMINAL,
    execution_authority: { repository: "gycha0109-beep/K_beauty", base_main_sha: BASE_MAIN },
    frozen_8x_contract: { path: CONTRACT_8X, version: contract.version, terminal: contract.primary_terminal_outcome },
    implementation: {
      shadow_runtime_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_VERSION,
      observation_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_OBSERVATION_VERSION,
      dual_run_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_DUAL_RUN_VERSION,
      runtime_shadow_wired: true,
      observation_boundary: "lib/exfoliation-non-numeric-pda-normative-production-policy-observation.js additive shadow-only entrypoint",
      frozen_8v_module_modified: false,
      canonical_consumer_imported: false,
      production_authority: false,
      production_activation: false
    },
    validation_summary: {
      canonical_cases: replay.case_count,
      governed_products: governed.product_count,
      dual_run_rows: dual.result.rows.length,
      divergence_distribution: dual.result.divergence_distribution,
      canonical_production_identical: dual.result.invariance.canonical_production_identical,
      canonical_response_identical: dual.result.invariance.canonical_response_identical,
      canonical_snapshot_identical: dual.result.invariance.canonical_snapshot_identical,
      candidate_order_identical: dual.result.invariance.candidate_order_identical
    },
    production_invariance_contract: {
      products: 164,
      scenarios: 12,
      candidate_evaluations: 1968,
      required_zero_delta_fields: [
        "production_score", "production_ranking", "top1", "top3", "eligibility",
        "public_response", "persistence", "candidate_policy_canonical_result"
      ],
      execution_verifier: "scripts/verify-product-decision-axis-comparator-v1.mjs + scripts/verify-skin-decision-recommendation-invariance.mjs"
    },
    invariants: {
      DECISION_AXIS_PRODUCTION_CONSUMPTION: "NO",
      NORMATIVE_POLICY_SHADOW_RUNTIME_IMPLEMENTED: "YES",
      NORMATIVE_POLICY_CANONICAL_RUNTIME_IMPLEMENTED: "NO",
      NORMATIVE_POLICY_RUNTIME_ACTIVE: "NO",
      PRODUCTION_POLICY_ACTIVATED: "NO",
      PRODUCTION_ACTIVATION_AUTHORIZED: "NO",
      RESTRICT_ENFORCEMENT_IMPLEMENTED: "NO",
      RESTRICT_CANONICAL_EXCLUSION_ACTIVE: "NO",
      ALLOW_PROMOTED_TO_CANONICAL_APPROVAL: "NO",
      RECOMMENDATION_SCORER_CHANGED: "NO",
      RECOMMENDATION_RANKER_CHANGED: "NO",
      RECOMMENDATION_ACTIVATED: "NO",
      CANDIDATE_POLICY_PRODUCTION_CHANGED: "NO",
      LEGACY_HEURISTIC_REPLACED: "NO",
      NUMERIC_FITTING: 0,
      POTENCY_ORDERING_CREATED: "NO",
      HOSTED_PRODUCT_FACT_WRITES: 0,
      REGISTRY_DEFINITION_DELTA: 0,
      MIGRATION_DELTA: 0
    }
  };
}

export const buildImplementationEvidence = implementationEvidence;
export const buildCanonicalRuntimeReplay = canonicalReplay;
export const buildGovernedRuntimeReplay = governedReplay;
export const buildDualRunReplay = dualRunReplay;

const builders = {
  implementation: buildImplementationEvidence,
  canonical: buildCanonicalRuntimeReplay,
  governed: buildGovernedRuntimeReplay,
  dualrun: buildDualRunReplay
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] || "implementation";
  if (!builders[mode]) {
    process.stderr.write(`unknown mode: ${mode}\n`);
    process.exit(2);
  }
  process.stdout.write(canonical(builders[mode]()));
}
