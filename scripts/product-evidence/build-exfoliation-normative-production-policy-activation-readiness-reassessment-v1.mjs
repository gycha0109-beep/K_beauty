#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const STAGE = "V2.1-9C";
export const TERMINAL = "NORMATIVE_PRODUCTION_POLICY_READY_FOR_SEPARATE_ACTIVATION_AUTHORIZATION";
export const VERSION = "exfoliation-normative-production-policy-activation-readiness-reassessment-v1";
export const BASE_MAIN = "851eac78646c04196673e57ab7b52f77cacae8ae";

const FROZEN = Object.freeze({
  v21_8x: "7dd6f3566ca3a680627eb64430ca8d34178b53bd",
  v21_8y: "5ce7195670eab6f2e9a2aff7810d4f48c9b6f688",
  v21_8z: "57211ec9c2c99ea02da74c4f8d2c707ca89aa597",
  v21_9a: "1c65eced12e05ca4a81d74bbef167f367e170582",
  v21_9b: "851eac78646c04196673e57ab7b52f77cacae8ae",
});

const EVIDENCE_ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const INPUTS = Object.freeze({
  readiness8z: "exfoliation-non-numeric-pda-normative-production-policy-activation-readiness-contract-v1.json",
  assessment8z: "exfoliation-non-numeric-pda-normative-production-policy-readiness-evidence-assessment-v1.json",
  gate8z: "exfoliation-non-numeric-pda-normative-production-policy-activation-gate-v1.json",
  observability8z: "exfoliation-non-numeric-pda-normative-production-policy-observability-requirements-v1.json",
  rollback8z: "exfoliation-non-numeric-pda-normative-production-policy-rollback-requirements-v1.json",
  fallback8z: "exfoliation-non-numeric-pda-normative-production-policy-failure-fallback-matrix-v1.json",
  simulation8z: "exfoliation-non-numeric-pda-normative-production-policy-hypothetical-enforcement-simulation-v1.json",
  enforcement8z: "exfoliation-non-numeric-pda-normative-production-policy-enforcement-boundary-contract-v1.json",
  runtime8y: "exfoliation-non-numeric-pda-normative-production-policy-shadow-runtime-evidence-v1.json",
  summary9a: "exfoliation-non-numeric-pda-additional-shadow-evidence-summary-v1.json",
  divergence9a: "exfoliation-non-numeric-pda-additional-shadow-divergence-distribution-v1.json",
  gaps9a: "exfoliation-non-numeric-pda-additional-shadow-readiness-gap-reassessment-v1.json",
  summary9b: "exfoliation-existing-eligibility-candidate-availability-shadow-evidence-summary-v1.json",
  gaps9b: "exfoliation-existing-eligibility-candidate-availability-gap-reassessment-v1.json",
  restrict9b: "exfoliation-existing-eligibility-candidate-availability-restrict-classification-v1.json",
  boundary9b: "exfoliation-existing-eligibility-candidate-availability-enforcement-boundary-validation-v1.json",
});

export const OUTPUTS = Object.freeze({
  summary: "exfoliation-normative-production-policy-activation-readiness-reassessment-summary-v1.json",
  matrix: "exfoliation-normative-production-policy-readiness-matrix-v1.json",
  prerequisites: "exfoliation-normative-production-policy-activation-prerequisite-evaluation-v1.json",
  lineage: "exfoliation-normative-production-policy-evidence-lineage-map-v1.json",
  risk: "exfoliation-normative-production-policy-divergence-readiness-risk-summary-v1.json",
  live: "exfoliation-normative-production-policy-live-production-evidence-requirement-assessment-v1.json",
  boundary: "exfoliation-normative-production-policy-separate-activation-authorization-boundary-v1.json",
});

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(EVIDENCE_ROOT, INPUTS[name]), "utf8"));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function canonical(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ref(file) {
  return `${EVIDENCE_ROOT}/${file}`;
}

function row(id, status, source, evidenceRefs, materiality, note) {
  return {
    dimension: id,
    status,
    authority_source: source,
    evidence_refs: [...evidenceRefs].sort((a, b) => a.localeCompare(b, "en")),
    materiality,
    blocker_boolean: false,
    blocker_reason: null,
    note,
  };
}

export function buildAll() {
  const readiness8z = readJson("readiness8z");
  const assessment8z = readJson("assessment8z");
  const gate8z = readJson("gate8z");
  const observability8z = readJson("observability8z");
  const rollback8z = readJson("rollback8z");
  const fallback8z = readJson("fallback8z");
  const simulation8z = readJson("simulation8z");
  const enforcement8z = readJson("enforcement8z");
  const runtime8y = readJson("runtime8y");
  const summary9a = readJson("summary9a");
  const divergence9a = readJson("divergence9a");
  const gaps9a = readJson("gaps9a");
  const summary9b = readJson("summary9b");
  const gaps9b = readJson("gaps9b");
  const restrict9b = readJson("restrict9b");
  const boundary9b = readJson("boundary9b");

  assert(readiness8z.stage === "V2.1-8Z", "8Z readiness stage drift");
  assert(readiness8z.primary_terminal_outcome === "NORMATIVE_PRODUCTION_POLICY_ACTIVATION_REQUIRES_ADDITIONAL_SHADOW_EVIDENCE", "8Z terminal drift");
  assert(readiness8z.readiness_result.semantic_blocker_present === false, "8Z semantic blocker drift");
  assert(readiness8z.readiness_result.enforcement_semantics_fully_defined === true, "8Z enforcement semantics drift");
  assert(assessment8z.quantitative_sample_threshold === "NOT_ARBITRARILY_DEFINED", "numeric threshold authority drift");
  assert(gate8z.default_mode === "OFF" && gate8z.current_state.enforce_authorized === false, "8Z activation gate drift");
  assert(gate8z.activation_version_contract.production_enforce_requires_separate_authorization === true, "8Z separate authorization requirement drift");
  assert(observability8z.telemetry_state === "CONTRACT_ONLY_NOT_PRODUCTION_IMPLEMENTED", "8Z observability state drift");
  assert(rollback8z.rollback_state === "CONTRACT_ONLY_NOT_PRODUCTION_IMPLEMENTED", "8Z rollback state drift");
  assert(fallback8z.design_principles.default_allow_forbidden === true, "8Z fallback default-allow drift");
  assert(fallback8z.fallback_mode === "FAIL_CLOSED_TO_POLICY_DEFER_PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH", "8Z fallback mode drift");
  assert(simulation8z.scenario_count === 19, "8Z hypothetical simulation coverage drift");
  assert(enforcement8z.future_integration_boundary.preferred_boundary === "POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY", "8Z enforcement boundary drift");
  assert(runtime8y.validation_summary.canonical_cases === 17, "8Y canonical runtime coverage drift");
  assert(runtime8y.validation_summary.canonical_production_identical === true, "8Y production invariance drift");
  assert(summary9a.coverage.evaluations === 1968 && summary9a.coverage.contexts === 12, "9A bounded corpus drift");
  assert(JSON.stringify(summary9a.coverage.actions) === JSON.stringify({ALLOW:2,CAUTION:12,DEFER:772,NOT_APPLICABLE:1176,RESTRICT:6}), "9A action distribution drift");
  assert(summary9a.classification_model.live_count === 0, "live observation count drift");
  assert(divergence9a.unexplained_high_risk === 0, "9A unexplained high-risk divergence drift");
  assert(divergence9a.enforcement_relevance.REQUIRES_REVIEW === 6, "9A enforcement-relevant divergence drift");
  assert(gaps9a.remaining_material_gap.includes("existing eligibility"), "9A material gap drift");
  assert(summary9b.coverage.evaluations === 1968, "9B bounded corpus drift");
  assert(summary9b.coverage.eligibility.ELIGIBLE === 1968, "9B eligibility drift");
  assert(summary9b.coverage.availability.PRESENT_AT_ENFORCEMENT_BOUNDARY === 1968, "9B availability drift");
  assert(summary9b.coverage.restrict.DEFINITE_NEW_EXCLUSION === 6, "9B RESTRICT classification drift");
  assert(summary9b.boundary_validation === "BOUNDARY_CONFIRMED", "9B boundary validation drift");
  assert(gaps9b.material_eligibility_availability_gap_remaining === false, "9B material gap closure drift");
  assert(restrict9b.classification.DEFINITE_NEW_EXCLUSION === 6 && restrict9b.rows.every((x) => x.score_order_top3 === false), "9B RESTRICT row drift");
  assert(boundary9b.boundary_validation === "BOUNDARY_CONFIRMED", "9B boundary artifact drift");

  const e = {
    readiness8z: ref(INPUTS.readiness8z),
    assessment8z: ref(INPUTS.assessment8z),
    gate8z: ref(INPUTS.gate8z),
    observability8z: ref(INPUTS.observability8z),
    rollback8z: ref(INPUTS.rollback8z),
    fallback8z: ref(INPUTS.fallback8z),
    simulation8z: ref(INPUTS.simulation8z),
    enforcement8z: ref(INPUTS.enforcement8z),
    runtime8y: ref(INPUTS.runtime8y),
    summary9a: ref(INPUTS.summary9a),
    divergence9a: ref(INPUTS.divergence9a),
    gaps9a: ref(INPUTS.gaps9a),
    summary9b: ref(INPUTS.summary9b),
    gaps9b: ref(INPUTS.gaps9b),
    restrict9b: ref(INPUTS.restrict9b),
    boundary9b: ref(INPUTS.boundary9b),
  };

  const readinessRows = [
    row("SEMANTIC", "READY", "V2.1-8X + V2.1-8Z", [e.readiness8z, e.enforcement8z], "MATERIAL_PRE_AUTHORIZATION", "Five actions, precedence, uncertainty and downstream effects remain deterministic; ALLOW is not approval, DEFER is not ALLOW, and RESTRICT is eligibility-only."),
    row("RUNTIME", "READY", "V2.1-8Y", [e.runtime8y], "MATERIAL_PRE_AUTHORIZATION", "Shadow runtime remains deterministic, versioned, runtime-callable, exact on 17 canonical examples, provenance-preserving and canonical-output isolated."),
    row("ACTION_COVERAGE", "READY", "V2.1-9A", [e.summary9a], "MATERIAL_PRE_AUTHORIZATION", "Bounded 164x12 evidence contains all five actions: ALLOW 2, CAUTION 12, RESTRICT 6, DEFER 772, NOT_APPLICABLE 1176."),
    row("REAL_PRODUCT_COVERAGE", "READY", "V2.1-9A", [e.summary9a, e.gaps9a], "MATERIAL_PRE_AUTHORIZATION", "Actual governed products plus controlled-context shadow exercise governed ALLOW/DEFER and controlled CAUTION/RESTRICT; actual catalog non-applicability is separately observed. Controlled context is not promoted to live user observation."),
    row("EXTERNAL_CONTEXT_COVERAGE", "READY", "V2.1-9A", [e.summary9a, e.gaps9a], "MATERIAL_PRE_AUTHORIZATION", "All 12 controlled external-context families are covered on the real-product shadow corpus without claiming live traffic."),
    row("NOT_APPLICABLE_COVERAGE", "READY", "V2.1-9A", [e.summary9a], "MATERIAL_PRE_AUTHORIZATION", "1176 actual catalog evaluations are NOT_APPLICABLE under the frozen category contract."),
    row("DIVERGENCE", "READY", "V2.1-8T taxonomy + V2.1-9A + V2.1-9B", [e.divergence9a, e.restrict9b], "MATERIAL_PRE_AUTHORIZATION", "All six enforcement-relevant rows are now boundary-present, existing-eligible and definite hypothetical exclusions; unexplained high-risk divergence remains zero."),
    row("ELIGIBILITY", "READY", "V2.1-9B", [e.summary9b, e.gaps9b], "MATERIAL_PRE_AUTHORIZATION", "Existing eligibility is authoritatively materialized for 1968/1968 rows with UNKNOWN=0 in the frozen bounded comparator."),
    row("CANDIDATE_AVAILABILITY", "READY", "V2.1-9B", [e.summary9b, e.gaps9b], "MATERIAL_PRE_AUTHORIZATION", "Candidate availability is authoritatively materialized as PRESENT_AT_ENFORCEMENT_BOUNDARY for 1968/1968 rows."),
    row("RESTRICT_EXCLUSION", "READY", "V2.1-9B", [e.restrict9b], "MATERIAL_PRE_AUTHORIZATION", "All six 9A RESTRICT rows are DEFINITE_NEW_EXCLUSION; already-ineligible, unavailable and unresolved counts are zero."),
    row("TOP_K_MECHANISM", "READY", "V2.1-8Z synthetic mechanism + V2.1-9B bounded occurrence", [e.simulation8z, e.summary9b], "MATERIAL_PRE_AUTHORIZATION", "8Z covers RESTRICT inside/outside/multiple Top-K and refill mechanics; 9B shows current six RESTRICT rows are outside Top3 with zero current Top1/Top3 change, zero refill and zero K=3 insufficiency."),
    row("FAILURE_FALLBACK", "READY_AS_CONTRACT", "V2.1-8Z", [e.fallback8z, e.simulation8z], "MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE", "Failure maps to DEFER and preserves the legacy canonical path; default ALLOW and partial RESTRICT enforcement are forbidden. Runtime adapter validation remains a next-stage pre-activation obligation."),
    row("OBSERVABILITY_CONTRACT", "READY_AS_CONTRACT", "V2.1-8Z", [e.observability8z, e.readiness8z], "MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE", "Required metrics, versions and privacy boundary are frozen. Production telemetry implementation is explicitly not active and remains required before activation."),
    row("ROLLBACK_CONTRACT", "READY_AS_CONTRACT", "V2.1-8Z", [e.rollback8z, e.simulation8z], "MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE", "One-step disable to LEGACY_ONLY is frozen without Product Fact, Registry, migration or DB rollback. Runtime kill-switch validation remains required before activation."),
    row("ACTIVATION_GATE_CONTRACT", "READY_AS_CONTRACT", "V2.1-8Z", [e.gate8z], "MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE", "OFF/SHADOW/ENFORCE semantics, default OFF, kill-switch precedence and separate ENFORCE authorization are explicit. Canonical gate implementation remains downstream."),
    row("VERSION_PINNING", "READY_AS_CONTRACT", "V2.1-8Z", [e.gate8z], "MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE", "Exact policy/runtime/activation/upstream version pinning is required and specified; activation version implementation is not performed by 9C."),
    row("LEGACY_FALLBACK", "READY_AS_CONTRACT", "V2.1-8Z", [e.fallback8z, e.rollback8z, e.gate8z], "MATERIAL_BEFORE_ACTIVATION_NOT_BEFORE_AUTHORIZATION_STAGE", "Legacy-only canonical authority remains recoverable; policy failure cannot silently remove candidates or default to ALLOW."),
    row("LIVE_PRODUCTION_EVIDENCE", "NOT_REQUIRED_AT_THIS_STAGE", "Frozen 8Z readiness authority + V2.1-9A/V2.1-9B evidence separation", [e.assessment8z, e.summary9a, e.gaps9b], "NON_BLOCKING_FOR_ENTRY_TO_SEPARATE_AUTHORIZATION_STAGE", "Live observations remain zero. 8Z freezes no live-traffic count or numeric threshold as a prerequisite for entering a separate authorization stage; any staged SHADOW/live requirement belongs to that later authorization decision."),
  ];

  const readinessMatrix = {
    version: "exfoliation-normative-production-policy-readiness-matrix-v1",
    stage: STAGE,
    terminal: TERMINAL,
    rows: readinessRows,
    blocker_count: readinessRows.filter((x) => x.blocker_boolean).length,
    material_not_ready_count: readinessRows.filter((x) => ["NOT_READY", "BLOCKED"].includes(x.status) && x.materiality === "MATERIAL_PRE_AUTHORIZATION").length,
    activation_readiness_passed: true,
    ready_for_separate_activation_authorization: true,
  };

  const frozenGate = assessment8z.future_activation_evidence_gate;
  assert(Array.isArray(frozenGate) && frozenGate.length === 9, "8Z prerequisite list drift");
  const prerequisites = {
    version: "exfoliation-normative-production-policy-activation-prerequisite-evaluation-v1",
    stage: STAGE,
    terminal: TERMINAL,
    source_prerequisites: "V2.1-8Z future_activation_evidence_gate",
    rows: [
      { prerequisite: frozenGate[0], status: "SATISFIED", evidence_refs: [e.runtime8y, e.summary9a], required_before_activation: true, required_before_authorization_stage: true },
      { prerequisite: frozenGate[1], status: "SATISFIED", evidence_refs: [e.readiness8z], required_before_activation: true, required_before_authorization_stage: true },
      { prerequisite: frozenGate[2], status: "SATISFIED_BY_CLASSIFIED_REAL_PRODUCT_SHADOW_EVIDENCE", evidence_refs: [e.summary9a, e.gaps9a], required_before_activation: true, required_before_authorization_stage: true },
      { prerequisite: frozenGate[3], status: "SATISFIED_BY_REAL_PRODUCT_CONTROLLED_CONTEXT_SHADOW", evidence_refs: [e.summary9a, e.gaps9a], required_before_activation: true, required_before_authorization_stage: true },
      { prerequisite: frozenGate[4], status: "SATISFIED_BY_BOUNDED_CATALOG_OFFLINE_SHADOW_DISTRIBUTION", evidence_refs: [e.summary9a, e.divergence9a], required_before_activation: true, required_before_authorization_stage: true },
      { prerequisite: frozenGate[5], status: "SATISFIED", evidence_refs: [e.divergence9a, e.restrict9b, e.summary9b], required_before_activation: true, required_before_authorization_stage: true },
      { prerequisite: frozenGate[6], status: "NOT_REQUIRED_AT_THIS_STAGE_CONTRACT_READY_IMPLEMENTATION_REQUIRED_BEFORE_ACTIVATION", evidence_refs: [e.fallback8z, e.simulation8z, e.readiness8z], required_before_activation: true, required_before_authorization_stage: false },
      { prerequisite: frozenGate[7], status: "NOT_REQUIRED_AT_THIS_STAGE_CONTRACTS_READY_IMPLEMENTATION_REQUIRED_BEFORE_ACTIVATION", evidence_refs: [e.observability8z, e.rollback8z, e.gate8z, e.readiness8z], required_before_activation: true, required_before_authorization_stage: false },
      { prerequisite: frozenGate[8], status: "SATISFIED_AND_REVERIFIED_IN_9C_CI", evidence_refs: [e.runtime8y, e.summary9b], required_before_activation: true, required_before_authorization_stage: true },
    ],
    pre_authorization_unsatisfied_count: 0,
    downstream_pre_activation_implementation_obligations: [
      "failure/fallback runtime adapter validation",
      "observability runtime implementation and validation",
      "kill-switch/rollback runtime implementation and validation",
      "versioned activation gate implementation and validation",
    ],
    numeric_threshold_invented: false,
  };

  const lineage = {
    version: "exfoliation-normative-production-policy-evidence-lineage-map-v1",
    stage: STAGE,
    terminal: TERMINAL,
    rows: [
      { readiness_need: "deterministic five-action policy semantics", frozen_8z_state: "READY", evidence_progression: ["8X contract frozen", "8Y 17/17 runtime replay"], current_status: "SATISFIED" },
      { readiness_need: "real-product action/context coverage", frozen_8z_state: "ADDITIONAL_SHADOW_EVIDENCE_REQUIRED", evidence_progression: ["9A actual ALLOW/NOT_APPLICABLE/DEFER provenance", "9A controlled CAUTION/RESTRICT on real products", "9A 12/12 external contexts"], current_status: "SATISFIED" },
      { readiness_need: "production-distribution shadow action/divergence coverage", frozen_8z_state: "INSUFFICIENT", evidence_progression: ["9A 164x12 action distribution", "9A frozen 8T divergence distribution", "9A unexplained high-risk=0"], current_status: "SATISFIED_BY_BOUNDED_OFFLINE_SHADOW" },
      { readiness_need: "RESTRICT enforcement relevance and definite exclusion", frozen_8z_state: "PARTIAL", evidence_progression: ["9A RESTRICT=6 but existing eligibility unknown", "9B eligibility/availability=1968/1968 known", "9B RESTRICT=6/6 definite new exclusion"], current_status: "SATISFIED" },
      { readiness_need: "Top-K/refill mechanism", frozen_8z_state: "SYNTHETIC_MECHANISM_DEFINED_REAL_DISTRIBUTION_GAP", evidence_progression: ["8Z 19-case hypothetical enforcement simulation includes inside/outside/multiple RESTRICT", "9B bounded six RESTRICT outside Top3 with deterministic zero refill"], current_status: "SATISFIED_MECHANISM_VALIDATED" },
      { readiness_need: "enforcement boundary", frozen_8z_state: "CONTRACT_IDENTIFIED", evidence_progression: ["8Z post-score/post-sort overlay contract", "9B BOUNDARY_CONFIRMED against current production architecture"], current_status: "SATISFIED" },
      { readiness_need: "failure/observability/rollback/version safety contracts", frozen_8z_state: "CONTRACT_FROZEN_IMPLEMENTATION_REQUIRED_BEFORE_ACTIVATION", evidence_progression: ["8Z failure matrix", "8Z observability metrics", "8Z rollback contract", "8Z activation gate/version pins"], current_status: "CONTRACT_READY_DOWNSTREAM_IMPLEMENTATION_REQUIRED_BEFORE_ACTIVATION" },
      { readiness_need: "live production traffic", frozen_8z_state: "NO_EXPLICIT_PRE_AUTHORIZATION_THRESHOLD", evidence_progression: ["9A live count=0", "9B live distribution unavailable and non-blocking for shadow reassessment"], current_status: "NOT_REQUIRED_BEFORE_SEPARATE_AUTHORIZATION_STAGE" },
    ],
  };

  const risk = {
    version: "exfoliation-normative-production-policy-divergence-readiness-risk-summary-v1",
    stage: STAGE,
    terminal: TERMINAL,
    divergence_taxonomy: divergence9a.taxonomy,
    distribution: divergence9a.primary,
    supporting_distribution: divergence9a.supporting,
    unexplained_high_risk_divergence: divergence9a.unexplained_high_risk,
    enforcement_relevant_rows: 6,
    enforcement_relevant_rows_definite_new_exclusion: restrict9b.classification.DEFINITE_NEW_EXCLUSION,
    activation_authorization_blocking_divergence: 0,
    bounded_restrict_positions: restrict9b.rows.map((x) => x.sorted_position).sort((a, b) => a - b),
    bounded_restrict_inside_top3: restrict9b.rows.filter((x) => x.score_order_top3).length,
    interpretation: "The six bounded RESTRICT rows are enforcement-relevant and now mechanically explainable. Their current Top3 impact is zero because all are outside Top3; this does not claim future traffic can never place RESTRICT inside Top-K. The mechanism for that case is covered by the frozen 8Z hypothetical contract.",
    remaining_downstream_activation_risks: [
      "runtime observability implementation not yet production active",
      "runtime rollback/kill-switch implementation not yet production active",
      "canonical activation/version gate not yet implemented",
      "ENFORCE adapter not implemented or authorized",
    ],
    additional_evidence_acquisition_required_before_authorization_stage: false,
  };

  const live = {
    version: "exfoliation-normative-production-policy-live-production-evidence-requirement-assessment-v1",
    stage: STAGE,
    terminal: TERMINAL,
    finding: "LIVE_TRAFFIC_NOT_REQUIRED_BEFORE_AUTHORIZATION_STAGE",
    live_production_observation_count: summary9a.classification_model.live_count,
    live_production_observation_fabricated: false,
    frozen_8z_explicit_live_traffic_numeric_threshold: null,
    frozen_8z_quantitative_sample_threshold: assessment8z.quantitative_sample_threshold,
    numeric_readiness_threshold_invented: false,
    basis: [
      "8Z freezes bounded production-distribution shadow action/divergence evidence requirements but no live-traffic count threshold for entry to a separate authorization stage.",
      "9A supplies the bounded 164x12 catalog action/divergence distribution while explicitly preserving LIVE_PRODUCTION_OBSERVATION=0.",
      "9B closes the material eligibility/availability and definite-exclusion gap and classifies live distribution as unavailable/non-blocking for shadow reassessment.",
      "A later separately authorized SHADOW/staged rollout may define live-traffic evidence requirements before ENFORCE; 9C does not authorize that rollout.",
    ],
    blocker_boolean: false,
  };

  const boundary = {
    version: "exfoliation-normative-production-policy-separate-activation-authorization-boundary-v1",
    stage: STAGE,
    terminal: TERMINAL,
    activation_readiness_passed: true,
    ready_for_separate_activation_authorization: true,
    production_activation_authorized: false,
    activation_executed: false,
    normative_policy_runtime_active: false,
    restrict_enforcement_implemented: false,
    restrict_canonical_exclusion_active: false,
    readiness_pass_does_not_authorize: [
      "ENFORCE",
      "production activation",
      "RESTRICT canonical exclusion",
      "rollout percentage",
      "user exposure",
      "live SHADOW rollout",
    ],
    next_stage_may_independently_decide: [
      "whether activation is authorized",
      "rollout mode and initial blast radius",
      "required runtime observability implementation",
      "runtime rollback/kill-switch implementation",
      "versioned activation gate implementation",
      "enforcement adapter implementation prerequisites",
      "pre-activation and post-activation verification",
      "whether staged SHADOW live evidence is required before ENFORCE",
    ],
    next_stage_must_preserve: [
      "default OFF until explicitly authorized",
      "separate authorization for ENFORCE",
      "existing_eligibility AND normative_policy_eligibility",
      "RESTRICT-only exclusion semantics",
      "no score recomputation or reranking",
      "FAIL_CLOSED_TO_POLICY_DEFER_PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH",
      "LEGACY_ONLY one-step rollback target",
    ],
  };

  const summary = {
    version: `${VERSION}-summary`,
    stage: STAGE,
    terminal: TERMINAL,
    authority: { repository: "gycha0109-beep/K_beauty", base_main: BASE_MAIN, frozen: FROZEN },
    activation_readiness_passed: true,
    ready_for_separate_activation_authorization: true,
    blocker_count: readinessMatrix.blocker_count,
    pre_authorization_unsatisfied_prerequisites: prerequisites.pre_authorization_unsatisfied_count,
    additional_evidence_acquisition_required_before_authorization_stage: false,
    live_production_evidence_requirement: live.finding,
    current_evidence: {
      canonical_cases_8y: runtime8y.validation_summary.canonical_cases,
      bounded_evaluations_9a_9b: summary9a.coverage.evaluations,
      action_distribution_9a: summary9a.coverage.actions,
      unexplained_high_risk_divergence_9a: divergence9a.unexplained_high_risk,
      existing_eligibility_9b: summary9b.coverage.eligibility,
      candidate_availability_9b: summary9b.coverage.availability,
      restrict_classification_9b: restrict9b.classification,
      top1_changed_9b: summary9b.impact.score_order_top1_changed_scenarios,
      top3_changed_9b: summary9b.impact.score_order_top3_changed_scenarios,
      refill_count_9b: summary9b.impact.refill_count,
      top_k_insufficient_9b: summary9b.impact.top_k_insufficient_scenarios,
      live_observations: summary9a.classification_model.live_count,
    },
    downstream_pre_activation_implementation_obligations: prerequisites.downstream_pre_activation_implementation_obligations,
    invariants: {
      NORMATIVE_POLICY_SHADOW_RUNTIME_IMPLEMENTED: "YES",
      NORMATIVE_POLICY_CANONICAL_RUNTIME_IMPLEMENTED: "NO",
      NORMATIVE_POLICY_RUNTIME_ACTIVE: "NO",
      PRODUCTION_POLICY_ACTIVATED: "NO",
      PRODUCTION_ACTIVATION_AUTHORIZED: "NO",
      ACTIVATION_EXECUTED: "NO",
      RESTRICT_ENFORCEMENT_IMPLEMENTED: "NO",
      RESTRICT_CANONICAL_EXCLUSION_ACTIVE: "NO",
      ALLOW_PROMOTED_TO_CANONICAL_APPROVAL: "NO",
      DEFER_PROMOTED_TO_ALLOW: "NO",
      EXISTING_ELIGIBILITY_RULE_CHANGED: "NO",
      CANDIDATE_AVAILABILITY_RULE_CHANGED: "NO",
      RECOMMENDATION_SCORER_CHANGED: "NO",
      RECOMMENDATION_RANKER_CHANGED: "NO",
      CANDIDATE_POLICY_PRODUCTION_CHANGED: "NO",
      RECOMMENDATION_ACTIVATED: "NO",
      LEGACY_HEURISTIC_REPLACED: "NO",
      LIVE_PRODUCTION_OBSERVATION_FABRICATED: "NO",
      NUMERIC_READINESS_THRESHOLD_INVENTED: "NO",
      NUMERIC_FITTING: 0,
      POTENCY_ORDERING_CREATED: "NO",
      HOSTED_PRODUCT_FACT_WRITES: 0,
      REGISTRY_DEFINITION_DELTA: 0,
      MIGRATION_DELTA: 0,
      ACTIVATION_READINESS_PASSED: "YES",
      READY_FOR_SEPARATE_ACTIVATION_AUTHORIZATION: "YES",
    },
    next_stage: "SEPARATE_NORMATIVE_POLICY_ACTIVATION_AUTHORIZATION_AND_RUNTIME_SAFETY_IMPLEMENTATION",
  };

  return { summary, matrix: readinessMatrix, prerequisites, lineage, risk, live, boundary };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] || "summary";
  const all = buildAll();
  if (!(mode in all)) throw new Error(`unknown mode: ${mode}`);
  process.stdout.write(canonical(all[mode]));
}
