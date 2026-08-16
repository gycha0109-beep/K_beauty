#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  evaluateExfoliationNormativeProductionPolicyShadow,
  EXFOLIATION_NORMATIVE_POLICY_ACTIONS,
  EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_VERSION,
  EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION
} from "../../lib/exfoliation-non-numeric-pda-normative-production-policy-shadow.js";
import {
  EXFOLIATION_NORMATIVE_POLICY_DIVERGENCE_CLASSES
} from "../../lib/exfoliation-non-numeric-pda-normative-production-policy-dual-run.js";
import {
  runExfoliationNormativeProductionPolicyShadowDualRun as wiredRun
} from "../../lib/exfoliation-non-numeric-pda-production-consumption-dual-run.js";
import {
  buildImplementationEvidence,
  buildCanonicalRuntimeReplay,
  buildGovernedRuntimeReplay,
  buildDualRunReplay
} from "./build-exfoliation-non-numeric-pda-normative-production-policy-shadow-v1.mjs";

const STAGE = "V2.1-8Y";
const TERMINAL = "NORMATIVE_PRODUCTION_POLICY_SHADOW_RUNTIME_VALIDATED";
const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const FILES = {
  implementation: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-shadow-runtime-evidence-v1.json`,
  canonical: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-canonical-runtime-replay-v1.json`,
  governed: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-governed-runtime-replay-v1.json`,
  dualrun: `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-dual-run-comparison-v1.json`
};
const FROZEN_8X = `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-canonical-examples-v1.json`;
const CONTRACT_8X = `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1.json`;

let assertions = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const read = (p) => fs.readFileSync(p, "utf8");
const json = (p) => JSON.parse(read(p));
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

const generated = {
  implementation: buildImplementationEvidence(),
  canonical: buildCanonicalRuntimeReplay(),
  governed: buildGovernedRuntimeReplay(),
  dualrun: buildDualRunReplay()
};
for (const [key, path] of Object.entries(FILES)) {
  eq(json(path), generated[key], `${key}: checked-in artifact equals deterministic builder`);
}

const implementation = json(FILES.implementation);
const canonical = json(FILES.canonical);
const governed = json(FILES.governed);
const dual = json(FILES.dualrun);
const frozen = json(FROZEN_8X);
const contract = json(CONTRACT_8X);

eq(implementation.stage, STAGE, "stage");
eq(implementation.primary_terminal_outcome, TERMINAL, "exact terminal");
eq(implementation.frozen_8x_contract.version, EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION, "8X contract version");
eq(contract.primary_terminal_outcome, "NORMATIVE_PRODUCTION_POLICY_DECISION_CONTRACT_FROZEN", "8X terminal intact");
eq(EXFOLIATION_NORMATIVE_POLICY_ACTIONS, ["ALLOW", "CAUTION", "RESTRICT", "DEFER", "NOT_APPLICABLE"], "exact action vocabulary");
eq(implementation.implementation.shadow_runtime_version, EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_VERSION, "shadow version");
eq(implementation.implementation.runtime_shadow_wired, true, "runtime shadow wired");
eq(typeof wiredRun, "function", "8Y dual-run exported through 8V observation boundary");

eq(canonical.case_count, 17, "17 canonical cases");
eq(frozen.cases.length, 17, "frozen 8X has 17 cases");
const actionSet = new Set();
for (const row of canonical.cases) {
  actionSet.add(row.actual.policy_action);
  for (const field of [
    "policy_action",
    "eligibility_effect",
    "ranking_effect",
    "score_effect",
    "top_k_effect",
    "warning_effect",
    "matched_rule_ids",
    "reason_codes",
    "authority_sources",
    "production_activation"
  ]) {
    eq(row.actual[field], row.expected[field], `${row.case_id}: exact frozen ${field}`);
  }
  eq(row.actual.production_authority, false, `${row.case_id}: no production authority`);
  eq(row.actual.restrict_enforced, false, `${row.case_id}: restrict not enforced`);
  eq(row.actual.allow_promoted_to_canonical_approval, false, `${row.case_id}: allow not approval`);
  ok(row.actual.provenance?.contract_version === EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_CONTRACT_VERSION, `${row.case_id}: provenance contract`);
}
eq(Array.from(actionSet).sort(), ["ALLOW", "CAUTION", "DEFER", "NOT_APPLICABLE", "RESTRICT"].sort(), "all action categories materialized");

eq(governed.product_count, 4, "4 governed products");
const expectedIds = [
  "0b88019a-9eb2-4be9-842d-f1e60e42cf51",
  "c4a5f510-8d9e-46bd-a31c-3c0a34fee331",
  "230f1c9c-cbf8-4458-aaac-ea1010a21e8c",
  "24a339bf-f380-493f-88b5-68e6be887c30"
];
eq(governed.products.map((row) => row.product_id), expectedIds, "governed cohort exact");
eq(governed.products.map((row) => row.neutral_envelope.neutral_gate), [
  "READY_FOR_SEPARATE_POLICY_EVALUATION",
  "DEFER_INSUFFICIENT_AUTHORITY",
  "DEFER_INSUFFICIENT_AUTHORITY",
  "READY_FOR_SEPARATE_POLICY_EVALUATION"
], "governed neutral gates");
eq(governed.products.map((row) => row.policy_action), ["ALLOW", "DEFER", "DEFER", "ALLOW"], "governed actions");
for (const row of governed.products) {
  eq(row.production_activation, false, `${row.product_id}: no activation`);
  ok(row.provenance?.upstream_provenance?.intrinsic?.evidence_provenance?.length > 0, `${row.product_id}: upstream evidence provenance preserved`);
  eq(row.ranking_effect, "NO_DIRECT_RANK_MUTATION", `${row.product_id}: no rank mutation`);
  eq(row.score_effect, "NO_DIRECT_SCORE_MUTATION", `${row.product_id}: no score mutation`);
}

eq(dual.result.mode, "SHADOW_OBSERVATION_ONLY", "dual-run mode");
eq(dual.result.runtime_shadow_wired, true, "dual runtime wired");
eq(dual.result.production_authority, false, "dual no authority");
eq(dual.result.production_activation, false, "dual no activation");
eq(dual.result.restrict_enforcement_implemented, false, "restrict enforcement absent");
eq(dual.result.allow_promoted_to_canonical_approval, false, "allow approval absent");
eq(dual.result.rows.length, 4, "dual bounded rows");
for (const row of dual.result.rows) {
  ok(EXFOLIATION_NORMATIVE_POLICY_DIVERGENCE_CLASSES.includes(row.divergence.primary_class), `${row.product_id}: frozen 8T divergence class`);
  eq(row.divergence.divergence_is_defect, false, `${row.product_id}: divergence not defect`);
  eq(row.divergence.divergence_implies_superiority, false, `${row.product_id}: divergence not superiority`);
  eq(row.divergence.agreement_implies_activation_readiness, false, `${row.product_id}: agreement not readiness`);
  eq(row.current_production.public_response, "UNCHANGED_BY_SHADOW_BOUNDARY", `${row.product_id}: public response unchanged`);
  eq(row.current_production.persistence, "UNCHANGED_BY_SHADOW_BOUNDARY", `${row.product_id}: persistence unchanged`);
}
for (const field of [
  "canonical_production_identical",
  "canonical_response_identical",
  "canonical_snapshot_identical",
  "candidate_order_identical"
]) eq(dual.result.invariance[field], true, `dual invariance ${field}`);

const restrictProbe = evaluateExfoliationNormativeProductionPolicyShadow({
  productionConsumptionEnvelope: {
    neutral_gate: "READY_FOR_SEPARATE_POLICY_EVALUATION",
    production_decision: "UNSPECIFIED",
    production_authority: false
  },
  externalPolicyContext: {
    recent_instability_guard_decision: "hard_block_candidate",
    routine_action: "keep",
    same_window_severity: "none"
  },
  governedContext: { uncertainty: "LOW" }
});
eq(restrictProbe.policy_action, "RESTRICT", "restrict computes");
eq(restrictProbe.eligibility_effect, "EXCLUDE_WHEN_POLICY_ENFORCED", "restrict future effect");
eq(restrictProbe.restrict_enforced, false, "restrict not enforced");
eq(restrictProbe.canonical_eligibility_mutated, false, "restrict no canonical exclusion");
eq(restrictProbe.canonical_score_mutated, false, "restrict no score");
eq(restrictProbe.canonical_rank_mutated, false, "restrict no rank");
eq(restrictProbe.canonical_top_k_mutated, false, "restrict no top-k");

const allowProbe = evaluateExfoliationNormativeProductionPolicyShadow({
  productionConsumptionEnvelope: {
    neutral_gate: "READY_FOR_SEPARATE_POLICY_EVALUATION",
    production_decision: "UNSPECIFIED",
    production_authority: false
  },
  externalPolicyContext: {
    recent_instability_guard_decision: "no_guard",
    routine_action: "keep",
    same_window_severity: "none"
  },
  governedContext: { uncertainty: "LOW" }
});
eq(allowProbe.policy_action, "ALLOW", "allow computes");
eq(allowProbe.allow_promoted_to_canonical_approval, false, "allow not canonical approval");
ok(allowProbe.reason_codes.includes("NPP_ALLOW_DOES_NOT_MEAN_SAFE_OR_ELIGIBLE"), "allow semantic guard");

const inv = implementation.invariants;
for (const key of [
  "DECISION_AXIS_PRODUCTION_CONSUMPTION",
  "NORMATIVE_POLICY_CANONICAL_RUNTIME_IMPLEMENTED",
  "NORMATIVE_POLICY_RUNTIME_ACTIVE",
  "PRODUCTION_POLICY_ACTIVATED",
  "PRODUCTION_ACTIVATION_AUTHORIZED",
  "RESTRICT_ENFORCEMENT_IMPLEMENTED",
  "RESTRICT_CANONICAL_EXCLUSION_ACTIVE",
  "ALLOW_PROMOTED_TO_CANONICAL_APPROVAL",
  "RECOMMENDATION_SCORER_CHANGED",
  "RECOMMENDATION_RANKER_CHANGED",
  "RECOMMENDATION_ACTIVATED",
  "CANDIDATE_POLICY_PRODUCTION_CHANGED",
  "LEGACY_HEURISTIC_REPLACED",
  "POTENCY_ORDERING_CREATED"
]) eq(inv[key], "NO", `explicit NO ${key}`);
eq(inv.NORMATIVE_POLICY_SHADOW_RUNTIME_IMPLEMENTED, "YES", "shadow runtime implemented");
eq(inv.NUMERIC_FITTING, 0, "numeric fitting zero");
eq(inv.HOSTED_PRODUCT_FACT_WRITES, 0, "hosted writes zero");
eq(inv.REGISTRY_DEFINITION_DELTA, 0, "registry delta zero");
eq(inv.MIGRATION_DELTA, 0, "migration delta zero");

const canonicalConsumerFiles = [
  "lib/skin-match-decision-engine.js",
  "lib/candidate-exposure-policy.js",
  "lib/functional-ranking-contract.js"
];
for (const file of canonicalConsumerFiles) {
  const source = read(file);
  ok(!source.includes(EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_SHADOW_VERSION), `${file}: no 8Y version import`);
  ok(!source.includes("normative-production-policy-shadow"), `${file}: no 8Y shadow import`);
}
const boundarySource = read("lib/exfoliation-non-numeric-pda-production-consumption-dual-run.js");
ok(boundarySource.includes("runExfoliationNormativeProductionPolicyShadowDualRun"), "8V boundary exposes 8Y only");
ok(boundarySource.includes("SHADOW_OBSERVATION_ONLY"), "8V boundary remains shadow only");

const shadowSource = read("lib/exfoliation-non-numeric-pda-normative-production-policy-shadow.js");
ok(!shadowSource.includes("potency_order"), "runtime does not create potency ordering");
ok(!shadowSource.includes("numeric_estimate"), "runtime does not fit numeric estimate");

const result = {
  stage: STAGE,
  terminal: TERMINAL,
  assertions,
  canonical_examples: canonical.case_count,
  governed_products: governed.product_count,
  divergence_distribution: dual.result.divergence_distribution,
  artifact_sha256: Object.fromEntries(
    Object.entries(FILES).map(([key, path]) => [key, sha(path)])
  ),
  normative_policy_shadow_runtime_implemented: true,
  runtime_shadow_wired: true,
  production_activation_authorized: false,
  restrict_enforcement_implemented: false
};
process.stdout.write(`${JSON.stringify(result)}\n`);
