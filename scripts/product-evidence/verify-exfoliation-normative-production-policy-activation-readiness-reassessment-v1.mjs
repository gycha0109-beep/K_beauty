#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildAll, canonical, OUTPUTS, STAGE, TERMINAL } from "./build-exfoliation-normative-production-policy-activation-readiness-reassessment-v1.mjs";

const EVIDENCE_ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const all = buildAll();
  const { summary, matrix, prerequisites, lineage, risk, live, boundary } = all;

  assert(summary.stage === STAGE, "stage mismatch");
  assert(summary.terminal === TERMINAL, "terminal mismatch");
  assert(summary.activation_readiness_passed === true, "activation readiness must pass");
  assert(summary.ready_for_separate_activation_authorization === true, "separate authorization readiness must pass");
  assert(summary.invariants.PRODUCTION_ACTIVATION_AUTHORIZED === "NO", "readiness must not authorize activation");
  assert(summary.invariants.ACTIVATION_EXECUTED === "NO", "activation must remain unexecuted");
  assert(summary.invariants.NORMATIVE_POLICY_RUNTIME_ACTIVE === "NO", "normative runtime must remain inactive");
  assert(summary.invariants.RESTRICT_ENFORCEMENT_IMPLEMENTED === "NO", "RESTRICT enforcement must remain unimplemented");
  assert(summary.invariants.RESTRICT_CANONICAL_EXCLUSION_ACTIVE === "NO", "RESTRICT canonical exclusion must remain inactive");
  assert(summary.invariants.ALLOW_PROMOTED_TO_CANONICAL_APPROVAL === "NO", "ALLOW must not be approval");
  assert(summary.invariants.DEFER_PROMOTED_TO_ALLOW === "NO", "DEFER must not be promoted to ALLOW");
  assert(summary.invariants.LIVE_PRODUCTION_OBSERVATION_FABRICATED === "NO", "live evidence must not be fabricated");
  assert(summary.invariants.NUMERIC_READINESS_THRESHOLD_INVENTED === "NO", "numeric threshold must not be invented");
  assert(summary.current_evidence.live_observations === 0, "live observation count must remain zero");
  assert(summary.current_evidence.bounded_evaluations_9a_9b === 1968, "1968 bounded evaluations required");
  assert(summary.current_evidence.restrict_classification_9b.DEFINITE_NEW_EXCLUSION === 6, "RESTRICT 6/6 definite exclusions required");
  assert(summary.current_evidence.top1_changed_9b === 0, "bounded Top1 impact drift");
  assert(summary.current_evidence.top3_changed_9b === 0, "bounded Top3 impact drift");
  assert(summary.current_evidence.refill_count_9b === 0, "bounded refill drift");
  assert(summary.current_evidence.top_k_insufficient_9b === 0, "bounded Top-K insufficiency drift");

  const requiredDimensions = [
    "SEMANTIC","RUNTIME","ACTION_COVERAGE","REAL_PRODUCT_COVERAGE","EXTERNAL_CONTEXT_COVERAGE","NOT_APPLICABLE_COVERAGE","DIVERGENCE","ELIGIBILITY","CANDIDATE_AVAILABILITY","RESTRICT_EXCLUSION","TOP_K_MECHANISM","FAILURE_FALLBACK","OBSERVABILITY_CONTRACT","ROLLBACK_CONTRACT","ACTIVATION_GATE_CONTRACT","VERSION_PINNING","LEGACY_FALLBACK","LIVE_PRODUCTION_EVIDENCE",
  ];
  assert(matrix.rows.length === requiredDimensions.length, "readiness matrix row count mismatch");
  assert(JSON.stringify(matrix.rows.map((x) => x.dimension)) === JSON.stringify(requiredDimensions), "readiness matrix ordering/completeness mismatch");
  assert(matrix.blocker_count === 0, "readiness blocker must be zero");
  assert(matrix.material_not_ready_count === 0, "material NOT_READY/BLOCKED row present");
  assert(matrix.rows.every((x) => x.blocker_boolean === false && x.blocker_reason === null), "silent blocker linkage mismatch");
  assert(matrix.rows.find((x) => x.dimension === "LIVE_PRODUCTION_EVIDENCE")?.status === "NOT_REQUIRED_AT_THIS_STAGE", "live traffic stage requirement mismatch");
  assert(matrix.rows.find((x) => x.dimension === "OBSERVABILITY_CONTRACT")?.status === "READY_AS_CONTRACT", "observability contract readiness mismatch");
  assert(matrix.rows.find((x) => x.dimension === "ROLLBACK_CONTRACT")?.status === "READY_AS_CONTRACT", "rollback contract readiness mismatch");
  assert(matrix.rows.find((x) => x.dimension === "ACTIVATION_GATE_CONTRACT")?.status === "READY_AS_CONTRACT", "activation gate readiness mismatch");

  assert(prerequisites.rows.length === 9, "frozen 8Z prerequisite count mismatch");
  assert(prerequisites.pre_authorization_unsatisfied_count === 0, "pre-authorization prerequisite remains unsatisfied");
  assert(prerequisites.numeric_threshold_invented === false, "numeric threshold invention detected");
  assert(prerequisites.rows.filter((x) => x.required_before_authorization_stage === false).every((x) => x.required_before_activation === true), "downstream implementation prerequisite classification invalid");
  assert(prerequisites.rows.filter((x) => x.required_before_authorization_stage === false).length === 2, "8Z downstream implementation grouping drift");

  assert(lineage.rows.length === 8, "evidence lineage completeness mismatch");
  assert(risk.unexplained_high_risk_divergence === 0, "unexplained high-risk divergence detected");
  assert(risk.enforcement_relevant_rows === 6 && risk.enforcement_relevant_rows_definite_new_exclusion === 6, "enforcement-relevant divergence classification drift");
  assert(risk.activation_authorization_blocking_divergence === 0, "activation-blocking divergence detected");
  assert(JSON.stringify(risk.bounded_restrict_positions) === JSON.stringify([72,118,130,147,149,153]), "bounded RESTRICT positions drift");
  assert(risk.bounded_restrict_inside_top3 === 0, "bounded RESTRICT Top3 occurrence drift");
  assert(risk.additional_evidence_acquisition_required_before_authorization_stage === false, "additional evidence incorrectly required");

  assert(live.finding === "LIVE_TRAFFIC_NOT_REQUIRED_BEFORE_AUTHORIZATION_STAGE", "live traffic finding mismatch");
  assert(live.live_production_observation_count === 0, "live traffic falsely claimed");
  assert(live.live_production_observation_fabricated === false, "live traffic fabricated");
  assert(live.frozen_8z_explicit_live_traffic_numeric_threshold === null, "unexpected live threshold");
  assert(live.frozen_8z_quantitative_sample_threshold === "NOT_ARBITRARILY_DEFINED", "8Z quantitative threshold drift");
  assert(live.numeric_readiness_threshold_invented === false, "numeric readiness threshold invented");
  assert(live.blocker_boolean === false, "live traffic incorrectly made pre-authorization blocker");

  assert(boundary.activation_readiness_passed === true, "authorization boundary readiness mismatch");
  assert(boundary.ready_for_separate_activation_authorization === true, "authorization boundary next-stage readiness mismatch");
  assert(boundary.production_activation_authorized === false, "boundary artifact must not authorize activation");
  assert(boundary.activation_executed === false, "boundary artifact must not execute activation");
  assert(boundary.normative_policy_runtime_active === false, "boundary artifact must keep runtime inactive");
  assert(boundary.restrict_enforcement_implemented === false, "boundary artifact must not implement RESTRICT");
  assert(boundary.readiness_pass_does_not_authorize.includes("ENFORCE"), "ENFORCE non-authorization missing");
  assert(boundary.readiness_pass_does_not_authorize.includes("production activation"), "production activation non-authorization missing");
  assert(boundary.next_stage_may_independently_decide.includes("required runtime observability implementation"), "next-stage observability implementation boundary missing");
  assert(boundary.next_stage_may_independently_decide.includes("runtime rollback/kill-switch implementation"), "next-stage rollback implementation boundary missing");

  const requireCheckedIn = process.env.V21_9C_REQUIRE_CHECKED_IN === "1";
  if (requireCheckedIn) {
    for (const [mode, file] of Object.entries(OUTPUTS)) {
      const filePath = path.join(EVIDENCE_ROOT, file);
      assert(fs.existsSync(filePath), `checked-in artifact missing: ${filePath}`);
      const expected = canonical(all[mode]);
      const actual = fs.readFileSync(filePath, "utf8");
      assert(actual === expected, `checked-in byte mismatch: ${filePath}`);
    }
  }

  process.stdout.write(canonical({
    stage: STAGE,
    terminal: TERMINAL,
    status: "PASS",
    readiness_rows: matrix.rows.length,
    blockers: matrix.blocker_count,
    checked_in_byte_equality_required: requireCheckedIn,
    activation_readiness_passed: summary.activation_readiness_passed,
    production_activation_authorized: false,
  }));
}

main();
