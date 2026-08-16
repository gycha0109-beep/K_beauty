#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  buildNormativeProductionPolicyDecisionContractArtifact,
  buildNormativeProductionPolicyCanonicalExamplesArtifact
} from "./build-exfoliation-non-numeric-pda-normative-production-policy-decision-v1.mjs";

const STAGE = "V2.1-8X";
const TERMINAL = "NORMATIVE_PRODUCTION_POLICY_DECISION_CONTRACT_FROZEN";
const VERSION = "exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1";
const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const CONTRACT_PATH = `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1.json`;
const EXAMPLES_PATH = `${ROOT}/exfoliation-non-numeric-pda-normative-production-policy-canonical-examples-v1.json`;
const DOC_PATH = "docs/evidence/exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1.md";

let assertions = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const read = (p) => fs.readFileSync(p, "utf8");
const json = (p) => JSON.parse(read(p));
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");

const contractBytes = read(CONTRACT_PATH);
const examplesBytes = read(EXAMPLES_PATH);
eq(contractBytes, buildNormativeProductionPolicyDecisionContractArtifact(), "contract deterministic regeneration");
eq(examplesBytes, buildNormativeProductionPolicyCanonicalExamplesArtifact(), "examples deterministic regeneration");

const contract = json(CONTRACT_PATH);
const examples = json(EXAMPLES_PATH);
eq(contract.stage, STAGE, "stage");
eq(contract.primary_terminal_outcome, TERMINAL, "exact terminal");
eq(contract.version, VERSION, "contract version");
eq(contract.normative_classification.all_mapping_rules_are, "POLICY_DECISION", "normative rules classified as policy decisions");
eq(contract.normative_classification.explicitly_not, ["PRODUCT_FACT", "PDA_FACT", "EFFICACY_FACT", "POTENCY_FACT"], "not facts");

const vocabulary = contract.policy_vocabulary.map((row) => row.action);
eq(vocabulary, ["ALLOW", "CAUTION", "RESTRICT", "DEFER", "NOT_APPLICABLE"], "exact policy vocabulary");
for (const row of contract.policy_vocabulary) {
  ok(row.definition && row.definition.length > 30, `${row.action}: definition`);
  ok(Array.isArray(row.permitted_authority_sources) && row.permitted_authority_sources.length > 0, `${row.action}: permitted sources`);
  ok(Array.isArray(row.forbidden_interpretations) && row.forbidden_interpretations.length > 0, `${row.action}: forbidden interpretations`);
  ok(row.downstream_effect_contract && typeof row.downstream_effect_contract === "object", `${row.action}: downstream effect contract`);
  ok(row.explanation_semantics, `${row.action}: explanation semantics`);
  ok(Array.isArray(row.provenance_requirements) && row.provenance_requirements.length > 0, `${row.action}: provenance`);
}

const effects = new Map(contract.action_effect_matrix.map((row) => [row.policy_action, row]));
eq(effects.size, 5, "five action effect rows");
for (const action of vocabulary) ok(effects.has(action), `effects cover ${action}`);
for (const row of contract.action_effect_matrix) {
  eq(row.ranking_effect, "NO_DIRECT_RANK_MUTATION", `${row.policy_action}: no rank coupling`);
  eq(row.score_effect, "NO_DIRECT_SCORE_MUTATION", `${row.policy_action}: no score coupling`);
}
eq(effects.get("ALLOW").eligibility_effect, "PRESERVE_EXISTING_ELIGIBILITY", "ALLOW does not grant eligibility");
eq(effects.get("CAUTION").eligibility_effect, "PRESERVE_EXISTING_ELIGIBILITY", "CAUTION does not exclude");
eq(effects.get("RESTRICT").eligibility_effect, "EXCLUDE_WHEN_POLICY_ENFORCED", "RESTRICT future eligibility effect explicit");
eq(effects.get("DEFER").eligibility_effect, "PRESERVE_EXISTING_ELIGIBILITY", "DEFER does not block by itself");
eq(effects.get("NOT_APPLICABLE").eligibility_effect, "PRESERVE_EXISTING_ELIGIBILITY", "NOT_APPLICABLE neutral eligibility");
eq(effects.get("CAUTION").warning_effect, "WARNING_REQUIRED", "CAUTION warning required");
eq(effects.get("RESTRICT").warning_effect, "RESTRICTION_EXPLANATION_REQUIRED", "RESTRICT explanation required");
eq(effects.get("DEFER").warning_effect, "UNCERTAINTY_EXPLANATION_REQUIRED", "DEFER uncertainty explanation required");

const precedenceLayers = contract.authority_precedence.map((row) => row.layer);
eq(precedenceLayers, [
  "applicability",
  "governed_authority_validity",
  "external_safety_restriction",
  "external_routine_restriction",
  "governed_identity_overlap",
  "preference_ranking_context",
  "legacy_compatibility"
], "authority precedence complete and ordered");
eq(contract.multi_external_conflict_resolution.contribution_priority, ["RESTRICT", "DEFER", "CAUTION", "NONE"], "external contribution precedence");
eq(contract.multi_external_conflict_resolution.only_after_ready_authority_gate, true, "external mapping only after READY");

const rules = new Map(contract.mapping_rules.map((row) => [row.rule_id, row]));
const requiredRules = [
  "R00_NOT_APPLICABLE",
  "R10_DEFER_INSUFFICIENT",
  "R11_DEFER_BLOCKED",
  "R12_DEFER_CONTEXT_CONFLICT",
  "R20_SAFETY_HARD_BLOCK",
  "R21_ROUTINE_HOLD_OR_BLOCKED",
  "R30_EXTERNAL_CONTEXT_INSUFFICIENT",
  "R40_SAFETY_CONTEXT_CAUTION",
  "R41_ROUTINE_CONTEXT_CAUTION",
  "R42_IDENTITY_OVERLAP_CAUTION",
  "R50_READY_ALLOW"
];
for (const ruleId of requiredRules) ok(rules.has(ruleId), `mapping rule exists: ${ruleId}`);
eq(rules.get("R00_NOT_APPLICABLE").action, "NOT_APPLICABLE", "not applicable mapping");
eq(rules.get("R10_DEFER_INSUFFICIENT").action, "DEFER", "insufficient mapping");
eq(rules.get("R11_DEFER_BLOCKED").action, "DEFER", "blocked authority mapping");
eq(rules.get("R12_DEFER_CONTEXT_CONFLICT").action, "DEFER", "context conflict mapping");
eq(rules.get("R20_SAFETY_HARD_BLOCK").action, "RESTRICT", "hard block mapping");
eq(rules.get("R21_ROUTINE_HOLD_OR_BLOCKED").action, "RESTRICT", "routine hard restriction mapping");
eq(rules.get("R30_EXTERNAL_CONTEXT_INSUFFICIENT").action, "DEFER", "external context incomplete mapping");
eq(rules.get("R40_SAFETY_CONTEXT_CAUTION").action, "CAUTION", "safety contextual mapping");
eq(rules.get("R41_ROUTINE_CONTEXT_CAUTION").action, "CAUTION", "routine caution mapping");
eq(rules.get("R42_IDENTITY_OVERLAP_CAUTION").action, "CAUTION", "identity overlap mapping");
eq(rules.get("R50_READY_ALLOW").action, "ALLOW", "ready no-concern mapping");

const external = new Map(contract.external_context_mapping.map((row) => [`${row.source}:${row.state}`, row]));
const externalExpectations = [
  ["RecentInstabilityGuardPolicy:no_guard", "NONE"],
  ["RecentInstabilityGuardPolicy:allow_with_context", "CAUTION"],
  ["RecentInstabilityGuardPolicy:soft_penalty_candidate", "CAUTION"],
  ["RecentInstabilityGuardPolicy:collapsed_exposure_candidate", "CAUTION"],
  ["RecentInstabilityGuardPolicy:hard_block_candidate", "RESTRICT"],
  ["RecentInstabilityGuardPolicy:insufficient_data", "DEFER"],
  ["RoutinePolicy.productAction:keep/maintain", "NONE"],
  ["RoutinePolicy.productAction:reduce", "CAUTION"],
  ["RoutinePolicy.productAction:hold", "RESTRICT"],
  ["RoutinePolicy.productAction:check_needed", "DEFER"],
  ["RoutinePolicy.prohibitedSameWindow:warning", "CAUTION"],
  ["RoutinePolicy.prohibitedSameWindow:blocked", "RESTRICT"],
  ["CurrentProductFindings/governed relation:duplicate exfoliation", "CAUTION"]
];
for (const [key, contribution] of externalExpectations) {
  ok(external.has(key), `external mapping exists: ${key}`);
  eq(external.get(key).contribution, contribution, `external mapping contribution: ${key}`);
}

const governedRules = new Map(contract.governed_context_rules.map((row) => [row.state, row]));
eq(governedRules.get("governed identity overlap").action_contribution, "CAUTION", "identity overlap caution");
eq(governedRules.get("multi-active").action_contribution, "NONE", "multi active no escalation");
eq(governedRules.get("missing concentration with otherwise READY authority").action_contribution, "NONE", "missing concentration no escalation");
eq(governedRules.get("legacy strength disagreement").action_contribution, "NONE", "legacy disagreement no escalation");

const reasonSet = new Set(contract.reason_codes.map((row) => row.code));
const requiredReasons = [
  "NPP_ADEQUATE_GOVERNED_AUTHORITY",
  "NPP_INSUFFICIENT_GOVERNED_AUTHORITY",
  "NPP_BLOCKED_GOVERNED_AUTHORITY",
  "NPP_CONTEXT_CONFLICT",
  "NPP_IDENTITY_OVERLAP",
  "NPP_DUPLICATE_EXFOLIATION",
  "NPP_SAME_WINDOW_WARNING",
  "NPP_SAME_WINDOW_BLOCKED",
  "NPP_SENSITIVITY_CONTEXT",
  "NPP_RECENT_INSTABILITY",
  "NPP_MULTIPLE_EXTERNAL_CONCERNS",
  "NPP_NOT_APPLICABLE",
  "NPP_MULTI_ACTIVE_NO_POTENCY_INFERENCE",
  "NPP_MISSING_CONCENTRATION_PRESERVED",
  "NPP_UNKNOWN_GOVERNED_AUTHORITY",
  "NPP_LEGACY_DISAGREEMENT_NON_AUTHORITATIVE",
  "NPP_SAFETY_PRECEDENCE_OVER_PREFERENCE"
];
for (const code of requiredReasons) ok(reasonSet.has(code), `reason code complete: ${code}`);
for (const row of contract.reason_codes) eq(row.classification, "POLICY_REASON", `${row.code}: policy reason classification`);

const frozenDecisions = contract.owner_policy_decisions_frozen.join("\n");
ok(frozenDecisions.includes("Duplicate exfoliation/identity overlap is CAUTION by default"), "owner decision: duplicate/overlap caution");
ok(frozenDecisions.includes("RESTRICT is reserved"), "owner decision: restrict reserved for hard external states");
ok(frozenDecisions.includes("No normative action directly changes numeric score or rank"), "owner decision: no numeric coupling");
ok(frozenDecisions.includes("Preference/ranking benefit cannot override"), "owner decision: safety precedence");

const legacy = contract.legacy_coexistence;
eq(legacy.mode_before_activation, "DUAL_RUN_SHADOW_ONLY", "legacy coexistence shadow only");
eq(legacy.new_policy_output_separate, true, "new output separate");
eq(legacy.existing_production_output_unchanged, true, "production unchanged");
eq(legacy.divergence_logging_required, true, "divergence logging required");
eq(legacy.automatic_legacy_replacement, false, "no automatic legacy replacement");
eq(legacy.rollback_path_required, true, "rollback required");
eq(legacy.versioned_activation_gate_required, true, "activation gate required");
eq(legacy.scorer_ranker_formula_change_authorized, false, "no scorer/ranker authorization");
eq(legacy.candidate_exposure_policy_mutation_authorized, false, "no candidate policy mutation");

const inv = contract.invariants;
for (const flag of [
  "DECISION_AXIS_PRODUCTION_CONSUMPTION",
  "PRODUCTION_POLICY_RUNTIME_IMPLEMENTED",
  "PRODUCTION_POLICY_ACTIVATED",
  "PRODUCTION_ACTIVATION_AUTHORIZED",
  "RECOMMENDATION_SCORER_CHANGED",
  "RECOMMENDATION_RANKER_CHANGED",
  "RECOMMENDATION_ACTIVATED",
  "CANDIDATE_POLICY_PRODUCTION_CHANGED",
  "LEGACY_HEURISTIC_REPLACED",
  "POTENCY_ORDERING_CREATED",
  "NORMATIVE_POLICY_RUNTIME_ACTIVE"
]) eq(inv[flag], "NO", `explicit NO: ${flag}`);
eq(inv.NORMATIVE_POLICY_CONTRACT_FROZEN, "YES", "normative contract frozen yes");
eq(inv.NUMERIC_FITTING, 0, "numeric fitting zero");
eq(inv.HOSTED_PRODUCT_FACT_WRITES, 0, "hosted writes zero");
eq(inv.REGISTRY_DEFINITION_DELTA, 0, "registry delta zero");
eq(inv.MIGRATION_DELTA, 0, "migration delta zero");

eq(examples.stage, STAGE, "examples stage");
eq(examples.contract_version, VERSION, "examples contract version");
eq(examples.primary_terminal_outcome, TERMINAL, "examples terminal");
eq(examples.cases.length, 17, "17 required normative cases");

const requiredCases = [
  "ready_no_external_concern",
  "ready_governed_identity_overlap",
  "ready_duplicate_exfoliation",
  "ready_same_window_stacking",
  "ready_sensitivity",
  "ready_recent_reaction_instability",
  "ready_multiple_external_concerns",
  "defer_insufficient_authority",
  "defer_blocked_authority",
  "defer_context_conflict",
  "not_applicable",
  "multi_active",
  "missing_concentration",
  "unknown_governed_authority",
  "legacy_strength_disagreement",
  "safety_conflict_with_preference_ranking_benefit",
  "multiple_external_policy_state_conflict"
];
for (const caseId of requiredCases) ok(examples.cases.some((row) => row.case_id === caseId), `canonical case exists: ${caseId}`);

for (const row of examples.cases) {
  ok(vocabulary.includes(row.selected_normative_action), `${row.case_id}: action in vocabulary`);
  eq(row.normative_classification, "POLICY_DECISION", `${row.case_id}: policy decision`);
  eq(row.normative_contract_authority, true, `${row.case_id}: contract authority`);
  eq(row.production_activation, false, `${row.case_id}: not activated`);
  eq(row.neutral_envelope.production_decision, "UNSPECIFIED", `${row.case_id}: upstream neutral decision preserved`);
  eq(row.neutral_envelope.production_authority, false, `${row.case_id}: upstream neutral authority preserved`);
  ok(row.matched_rule_ids.length > 0, `${row.case_id}: matched rules`);
  for (const ruleId of row.matched_rule_ids) ok(rules.has(ruleId), `${row.case_id}: rule exists ${ruleId}`);
  for (const reasonCode of row.reason_codes) ok(reasonSet.has(reasonCode), `${row.case_id}: reason exists ${reasonCode}`);
  const effect = effects.get(row.selected_normative_action);
  eq(row.eligibility_effect, effect.eligibility_effect, `${row.case_id}: eligibility effect traceable`);
  eq(row.ranking_effect, effect.ranking_effect, `${row.case_id}: ranking effect traceable`);
  eq(row.score_effect, effect.score_effect, `${row.case_id}: score effect traceable`);
  eq(row.top_k_effect, effect.top_k_effect, `${row.case_id}: top-k effect traceable`);
  eq(row.warning_effect, effect.warning_effect, `${row.case_id}: warning effect traceable`);
}

const caseMap = new Map(examples.cases.map((row) => [row.case_id, row]));
eq(caseMap.get("ready_no_external_concern").selected_normative_action, "ALLOW", "ready no concern -> allow");
eq(caseMap.get("ready_governed_identity_overlap").selected_normative_action, "CAUTION", "identity overlap -> caution");
eq(caseMap.get("ready_duplicate_exfoliation").selected_normative_action, "CAUTION", "duplicate -> caution");
eq(caseMap.get("ready_same_window_stacking").selected_normative_action, "RESTRICT", "blocked same-window -> restrict");
eq(caseMap.get("ready_sensitivity").selected_normative_action, "CAUTION", "resolved sensitivity context -> caution");
eq(caseMap.get("ready_recent_reaction_instability").selected_normative_action, "CAUTION", "resolved recent instability context -> caution");
eq(caseMap.get("defer_insufficient_authority").selected_normative_action, "DEFER", "insufficient -> defer");
eq(caseMap.get("defer_blocked_authority").selected_normative_action, "DEFER", "blocked authority -> defer");
eq(caseMap.get("defer_context_conflict").selected_normative_action, "DEFER", "context conflict -> defer");
eq(caseMap.get("not_applicable").selected_normative_action, "NOT_APPLICABLE", "not applicable retained");
eq(caseMap.get("multi_active").selected_normative_action, "ALLOW", "multi active alone does not escalate");
eq(caseMap.get("missing_concentration").selected_normative_action, "ALLOW", "missing concentration alone does not escalate");
eq(caseMap.get("legacy_strength_disagreement").selected_normative_action, "ALLOW", "legacy disagreement alone does not escalate");
eq(caseMap.get("safety_conflict_with_preference_ranking_benefit").selected_normative_action, "RESTRICT", "safety restriction beats preference benefit");
eq(caseMap.get("multiple_external_policy_state_conflict").selected_normative_action, "RESTRICT", "restrict contribution wins external conflict");

const routine = read("lib/routine-policy.js");
const instability = read("lib/recent-instability-guard-policy.js");
const candidateContract = read("lib/candidate-exposure-policy-contract.js");
const ranking = read("lib/functional-ranking-contract.js");
ok(routine.includes('return "hold"') && routine.includes('return "reduce"') && routine.includes('return "check_needed"'), "RoutinePolicy vocabulary present");
ok(routine.includes('? "blocked" : "warning"') && routine.includes('severity: "warning"'), "RoutinePolicy same-window vocabulary present");
ok(instability.includes('"hard_block_candidate"') && instability.includes('"allow_with_context"') && instability.includes('"insufficient_data"'), "RecentInstabilityGuard vocabulary present");
ok(candidateContract.includes('"primary"') && candidateContract.includes('"contextual"') && candidateContract.includes('"hidden"'), "CandidateExposurePolicy vocabulary remains distinct");
ok(ranking.includes("SCORE_WEIGHTS") && ranking.includes("STRENGTH_SCORE"), "legacy numeric ranking exists separately");

function collectFiles(root) {
  const output = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...collectFiles(full));
    else output.push(full);
  }
  return output;
}
const runtimeFiles = collectFiles("lib").filter((p) => /\.(js|mjs|ts|tsx)$/.test(p));
for (const file of runtimeFiles) {
  const content = read(file);
  ok(!content.includes(VERSION), `runtime does not consume 8X contract: ${file}`);
}

const docs = read(DOC_PATH);
ok(docs.includes(TERMINAL), "docs terminal frozen");
ok(docs.includes("POLICY_DECISION"), "docs policy classification");
ok(docs.includes("ALLOW does not mean eligible or safe"), "docs allow guard");
ok(docs.includes("RESTRICT is reserved"), "docs restrict boundary");
ok(docs.includes("NO_DIRECT_SCORE_MUTATION"), "docs score separation");

const result = {
  stage: STAGE,
  terminal: TERMINAL,
  contract_version: VERSION,
  assertions,
  policy_vocabulary: vocabulary,
  canonical_examples: examples.cases.length,
  contract_sha256: sha(contractBytes),
  canonical_examples_sha256: sha(examplesBytes),
  normative_policy_contract_frozen: true,
  production_policy_runtime_implemented: false,
  production_activation_authorized: false
};
process.stdout.write(`${JSON.stringify(result)}\n`);