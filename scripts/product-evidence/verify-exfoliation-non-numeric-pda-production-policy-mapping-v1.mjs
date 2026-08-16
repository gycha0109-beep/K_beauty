#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  buildExfoliationProductionPolicyAuthorityGapArtifact,
  buildExfoliationProductionPolicyCanonicalExamplesArtifact
} from "./build-exfoliation-non-numeric-pda-production-policy-mapping-v1.mjs";

const STAGE = "V2.1-8W";
const TERMINAL = "PRODUCTION_POLICY_MAPPING_REQUIRES_NORMATIVE_POLICY_DECISION";
const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const AUTHORITY_PATH = `${ROOT}/exfoliation-non-numeric-pda-production-policy-authority-gap-v1.json`;
const EXAMPLES_PATH = `${ROOT}/exfoliation-non-numeric-pda-production-policy-mapping-canonical-examples-v1.json`;
const DOC_PATH = "docs/evidence/exfoliation-non-numeric-pda-production-policy-authority-gap-v1.md";

let assertions = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const read = (path) => fs.readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");

const authorityBytes = read(AUTHORITY_PATH);
const exampleBytes = read(EXAMPLES_PATH);
eq(authorityBytes, buildExfoliationProductionPolicyAuthorityGapArtifact(), "authority-gap deterministic regeneration");
eq(exampleBytes, buildExfoliationProductionPolicyCanonicalExamplesArtifact(), "canonical-examples deterministic regeneration");

const authority = json(AUTHORITY_PATH);
const examples = json(EXAMPLES_PATH);
eq(authority.stage, STAGE, "stage");
eq(authority.primary_terminal_outcome, TERMINAL, "exact terminal");
eq(authority.governed_pda_normative_authority.exists, false, "no governed-PDA normative mapping authority");
eq(authority.architecture_compatibility.irreducible_semantic_incompatibility, false, "no irreducible semantic incompatibility");
eq(authority.architecture_compatibility.future_versioned_policy_contract_feasible, true, "future versioned policy feasible");
eq(authority.normative_authority_gap.production_policy_action, "UNSPECIFIED", "authority gap keeps production action unspecified");
eq(authority.normative_authority_gap.production_authority, false, "authority gap is not production authority");

const requiredComponents = [
  "8U production-consumption contract",
  "8V production-consumption shadow",
  "8V dual-run observer",
  "CandidateExposurePolicy",
  "CandidateExposurePolicy contract",
  "RoutinePolicy",
  "RecentInstabilityGuardPolicy",
  "EvaluatorBoundaryPolicy shadow",
  "FunctionalRankingContract",
  "ProductFunctionalProfile",
  "CurrentProductFindings",
  "SkinMatchDecisionEngine"
];
for (const component of requiredComponents) {
  ok(authority.production_decision_ownership_matrix.some((row) => row.component === component), `ownership complete: ${component}`);
}
for (const row of authority.production_decision_ownership_matrix) {
  eq(row.governed_pda_normative_mapping_authority, false, `${row.component}: no governed-PDA normative authority`);
}

eq(examples.stage, STAGE, "examples stage");
eq(examples.primary_terminal_outcome, TERMINAL, "examples exact terminal");
eq(examples.cases.length, 13, "13 authority-boundary examples");
const requiredCases = [
  "ready_no_external_concern",
  "ready_governed_identity_overlap",
  "ready_duplicate_exfoliation",
  "ready_same_window_conflict",
  "ready_sensitivity",
  "ready_recent_reaction_instability",
  "defer_insufficient_authority",
  "defer_blocked_authority",
  "defer_context_conflict",
  "not_applicable",
  "multi_active",
  "unknown_authority",
  "legacy_strength_conflict"
];
for (const caseId of requiredCases) {
  const row = examples.cases.find((item) => item.case_id === caseId);
  ok(row, `case exists: ${caseId}`);
  eq(row.repository_authoritative_normative_action, "UNSPECIFIED", `${caseId}: action unspecified`);
  eq(row.neutral_envelope.production_decision, "UNSPECIFIED", `${caseId}: envelope action unspecified`);
  eq(row.neutral_envelope.production_authority, false, `${caseId}: no production authority`);
  eq(row.normative_authority_status, "ABSENT_FOR_GOVERNED_PDA_MAPPING", `${caseId}: authority absent`);
}

const neutral = new Map(authority.neutral_gate_compatibility_matrix.map((row) => [row.gate, row]));
for (const gate of [
  "READY_FOR_SEPARATE_POLICY_EVALUATION",
  "DEFER_INSUFFICIENT_AUTHORITY",
  "DEFER_BLOCKED_AUTHORITY",
  "DEFER_CONTEXT_CONFLICT",
  "NOT_APPLICABLE"
]) ok(neutral.has(gate), `neutral gate covered: ${gate}`);
ok(neutral.get("READY_FOR_SEPARATE_POLICY_EVALUATION").prohibited.includes("ALLOW"), "READY -> ALLOW prohibited");
ok(neutral.get("DEFER_INSUFFICIENT_AUTHORITY").prohibited.includes("BLOCK"), "insufficient -> BLOCK prohibited");
ok(neutral.get("DEFER_BLOCKED_AUTHORITY").prohibited.includes("automatic exclusion"), "blocked authority -> exclusion prohibited");
ok(neutral.get("DEFER_CONTEXT_CONFLICT").prohibited.includes("intrinsic PDA invalidation"), "context conflict stays external");
ok(neutral.get("NOT_APPLICABLE").prohibited.includes("bad product"), "not applicable != bad product");

const forbidden = authority.prohibited_transformations.join("\n");
for (const assertion of [
  "READY_FOR_SEPARATE_POLICY_EVALUATION -> ALLOW",
  "multiple -> stronger",
  "identity count -> potency",
  "legacy strength -> governed PDA potency",
  "unknown -> safe",
  "missing -> inactive/zero"
]) ok(forbidden.includes(assertion), `forbidden transform frozen: ${assertion}`);

const inv = authority.invariants;
for (const flag of [
  "DECISION_AXIS_PRODUCTION_CONSUMPTION",
  "PRODUCTION_CONSUMPTION_CANONICAL_IMPLEMENTED",
  "PRODUCTION_POLICY_RUNTIME_IMPLEMENTED",
  "PRODUCTION_POLICY_ACTIVATED",
  "PRODUCTION_ACTIVATION_AUTHORIZED",
  "NORMATIVE_ALLOW_RULE_INVENTED",
  "NORMATIVE_CAUTION_RULE_INVENTED",
  "NORMATIVE_RESTRICT_RULE_INVENTED",
  "NEUTRAL_READY_PROMOTED_TO_ALLOW",
  "RECOMMENDATION_SCORER_CHANGED",
  "RECOMMENDATION_RANKER_CHANGED",
  "RECOMMENDATION_ACTIVATED",
  "CANDIDATE_POLICY_PRODUCTION_CHANGED",
  "LEGACY_HEURISTIC_REPLACED",
  "POTENCY_ORDERING_CREATED"
]) eq(inv[flag], "NO", `explicit NO: ${flag}`);
eq(inv.NUMERIC_FITTING, 0, "numeric fitting zero");
eq(inv.HOSTED_PRODUCT_FACT_WRITES, 0, "Hosted writes zero");
eq(inv.REGISTRY_DEFINITION_DELTA, 0, "Registry delta zero");
eq(inv.MIGRATION_DELTA, 0, "migration delta zero");

const shadow = read("lib/exfoliation-non-numeric-pda-production-consumption-shadow.js");
const dual = read("lib/exfoliation-non-numeric-pda-production-consumption-dual-run.js");
const candidate = read("lib/candidate-exposure-policy.js");
const candidateContract = read("lib/candidate-exposure-policy-contract.js");
const routine = read("lib/routine-policy.js");
const instability = read("lib/recent-instability-guard-policy.js");
const boundary = read("lib/evaluator-boundary-policy-shadow.js");
const ranking = read("lib/functional-ranking-contract.js");
const profile = read("lib/product-functional-profile.js");
const findings = read("lib/current-product-findings.js");
const engine = read("lib/skin-match-decision-engine.js");

ok(shadow.includes('production_decision:"UNSPECIFIED"'), "8V shadow keeps decision unspecified");
ok(shadow.includes("production_authority:false"), "8V shadow keeps production authority false");
ok(dual.includes('mode:"SHADOW_OBSERVATION_ONLY"'), "8V dual-run is observation-only");
ok(!candidate.includes("exfoliation-non-numeric-pda-production-consumption"), "CandidateExposurePolicy does not consume 8V envelope");
ok(candidateContract.includes('"primary"') && candidateContract.includes('"contextual"') && candidateContract.includes('"hidden"'), "CandidateExposurePolicy vocabulary is exposure/presentation");
ok(candidateContract.includes("buildCandidateLaneEligibility"), "CandidateExposurePolicy owns lane eligibility");
ok(routine.includes('action: "hold"') && routine.includes("prohibitedSameWindow"), "RoutinePolicy owns routine action/window semantics");
ok(!routine.includes("READY_FOR_SEPARATE_POLICY_EVALUATION"), "RoutinePolicy has no governed neutral-gate mapping");
ok(instability.includes('"allow_with_context"') && instability.includes('"hard_block_candidate"'), "RecentInstabilityGuard owns safety-domain guard decisions");
ok(!instability.includes("READY_FOR_SEPARATE_POLICY_EVALUATION"), "RecentInstabilityGuard has no governed neutral-gate mapping");
ok(boundary.includes("evaluateFunctionalRankingCandidate") && boundary.includes("resolveRecentInstabilityGuardPolicy"), "Evaluator boundary composes legacy domains");
ok(!boundary.includes("exfoliation-non-numeric-pda-production-consumption"), "Evaluator boundary does not consume 8V envelope");
ok(ranking.includes("SCORE_WEIGHTS") && ranking.includes("STRENGTH_SCORE"), "FunctionalRankingContract owns legacy numeric scoring");
ok(!ranking.includes("READY_FOR_SEPARATE_POLICY_EVALUATION"), "FunctionalRankingContract has no governed neutral-gate mapping");
ok(profile.includes("strengthFromCount") && profile.includes('"low"') && profile.includes('"medium"') && profile.includes('"high"'), "ProductFunctionalProfile derives legacy strength from counts");
ok(!profile.includes("READY_FOR_SEPARATE_POLICY_EVALUATION"), "ProductFunctionalProfile has no governed neutral-gate mapping");
ok(findings.includes('"duplicate_axis"') && findings.includes('"not_evaluable"'), "CurrentProductFindings owns current-product relation state");
ok(engine.includes("scoreCanonicalProduct") && engine.includes("scoreSunscreenProduct"), "SkinMatchDecisionEngine owns current scoring orchestration");
ok(!engine.includes("exfoliation-non-numeric-pda-production-consumption"), "SkinMatchDecisionEngine does not consume 8V envelope");

const docs = read(DOC_PATH);
ok(docs.includes(TERMINAL), "docs terminal frozen");
ok(docs.includes("UNSPECIFIED != ALLOW"), "docs explicit unspecified guard");
ok(docs.includes("Governed-PDA normative authority: NO"), "docs authority answer");

const result = {
  stage: STAGE,
  terminal: TERMINAL,
  assertions,
  governed_pda_normative_authority: false,
  canonical_examples: examples.cases.length,
  authority_gap_sha256: sha(authorityBytes),
  canonical_examples_sha256: sha(exampleBytes),
  production_policy_runtime_implemented: false,
  production_activation_authorized: false
};
process.stdout.write(`${JSON.stringify(result)}\n`);
