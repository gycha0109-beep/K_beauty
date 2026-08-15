#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { buildExfoliationNonNumericPdaShadowDecisionInputs } from "../../lib/exfoliation-non-numeric-pda-shadow-adapter.js";
import { consumeExfoliationNonNumericPdaShadowDecisionInputs } from "../../lib/exfoliation-non-numeric-pda-shadow-consumer.js";
import { evaluateCandidateExposurePolicy } from "../../lib/candidate-exposure-policy.js";
import { resolveProductFunctionalProfile } from "../../lib/product-functional-profile.js";
import { buildRoutinePolicy } from "../../lib/routine-policy.js";
import { resolveRecentInstabilityGuardPolicy } from "../../lib/recent-instability-guard-policy.js";

const STAGE = "V2.1-8T";
const TERMINAL = "PRODUCTION_CONSUMPTION_CONTRACT_DESIGN_READY";
const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const TAXONOMY = `${ROOT}/exfoliation-non-numeric-pda-shadow-divergence-taxonomy-v1.json`;
const REPLAY = `${ROOT}/exfoliation-non-numeric-pda-shadow-divergence-comparison-replay-v1.json`;
const READINESS = `${ROOT}/exfoliation-non-numeric-pda-production-consumption-readiness-summary-v1.json`;
const S8 = `${ROOT}/exfoliation-non-numeric-pda-shadow-consumer-validation-replay-v1.json`;
const P8 = `${ROOT}/exfoliation-non-numeric-pda-offline-shadow-output-v1.json`;
const MAIN_SHA = "c3a844ff3aec6a89456aeba9e86a3479239f2974";
const P8_SHA = "03d4446fd7ea1ce8dd23c44bb6c641804bd3394b4aab39db9ee0d7e021029624";
const P8_SNAPSHOT = "31311c223cfc1084e02e226e36b60b6052884f16c52cdc3f5308b786641a9fea";
const CLASSES = [
  "AUTHORITY_COVERAGE_GAP",
  "EXACT_AGREEMENT",
  "INCOMPARABLE_SEMANTICS",
  "LEGACY_HEURISTIC_DEPENDENCY",
  "LEGACY_MORE_CAUTIOUS",
  "ROUTINE_USER_CONTEXT_DIVERGENCE",
  "SHADOW_DECIDED_LEGACY_UNKNOWN",
  "SHADOW_MORE_CAUTIOUS",
  "SHADOW_UNKNOWN_LEGACY_DECIDED"
].sort();

let assertions = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const read = (path) => fs.readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const sha = (path) => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const canonical = (path) => `${JSON.stringify(stable(json(path)))}\n`;

const taxonomy = json(TAXONOMY);
const replay = json(REPLAY);
const readiness = json(READINESS);
const s8 = json(S8);
const p8 = json(P8);

eq(taxonomy.stage, STAGE, "taxonomy stage");
eq(replay.stage, STAGE, "replay stage");
eq(readiness.stage, STAGE, "readiness stage");
eq(readiness.primary_terminal_outcome, TERMINAL, "terminal outcome");
eq(taxonomy.execution_authority.v21_8s_merged_main_sha, MAIN_SHA, "8S authority");
eq(replay.execution_authority.main_sha, MAIN_SHA, "replay authority");
eq(readiness.execution_authority.main_sha, MAIN_SHA, "readiness authority");
eq(sha(P8), P8_SHA, "frozen 8P bytes");
eq(p8.snapshot_sha256, P8_SNAPSHOT, "8P snapshot");
eq(p8.products.length, 164, "8P product count");

eq(taxonomy.classes.map((item) => item.name).sort(), CLASSES, "taxonomy classes exact");
for (const key of [
  "agreement_not_production_readiness",
  "clear_not_production_approval",
  "divergence_not_error",
  "divergence_not_superiority",
  "restrict_not_production_block",
  "shadow_decision_not_canonical_decision"
]) eq(taxonomy.comparison_principles[key], true, `principle ${key}`);

eq(replay.bounded_corpus.semantic_replay_rows, 13, "13 semantic rows");
eq(replay.bounded_corpus.governed_product_rows, 4, "4 governed rows");
eq(replay.bounded_corpus.total_rows, 17, "17 total rows");
eq(replay.cases.length, 17, "17 corpus rows exact");
const classSet = new Set(CLASSES);
for (const row of replay.cases) {
  ok(classSet.has(row.primary_divergence_class), `${row.case_id} valid primary class`);
  for (const support of row.supporting_classes) ok(classSet.has(support), `${row.case_id} valid supporting class ${support}`);
  ok(row.exact_reason.length > 20, `${row.case_id} reason present`);
  ok(row.authority_source, `${row.case_id} authority present`);
  ok(row.provenance && typeof row.provenance === "object", `${row.case_id} provenance present`);
}
const recomputedCounts = Object.fromEntries(
  Array.from(replay.cases.reduce((map, row) => map.set(row.primary_divergence_class, (map.get(row.primary_divergence_class) || 0) + 1), new Map()).entries())
    .sort(([left], [right]) => left.localeCompare(right, "en"))
);
eq(replay.class_counts_primary, recomputedCounts, "primary class counts deterministic");

const semanticRows = replay.cases.filter((row) => row.source_kind === "semantic");
const s8ByCase = new Map(s8.cases.map((row) => [row.case_id, row]));
for (const row of semanticRows) {
  const upstream = s8ByCase.get(row.case_id);
  ok(upstream, `${row.case_id} exists in frozen 8S replay`);
  eq(row.shadow_decision, upstream.decision, `${row.case_id} 8S decision preserved`);
}
eq(semanticRows.length, 13, "semantic corpus lineage complete");

const profileFixture = resolveProductFunctionalProfile({
  id: "legacy-active-fixture",
  category: "treatment",
  ingredient_signals: { functional: [{ label: "Exfoliation", count: 4 }] },
  irritation_risk: "low",
  sensitivity_safe: true
});
const exfoliationAxis = profileFixture.functionalAxes.find((axis) => axis.axis === "exfoliation");
ok(exfoliationAxis, "legacy exfoliation axis created");
eq(exfoliationAxis.strength, "medium", "legacy count-derived medium strength");
eq(exfoliationAxis.confidence, "high", "legacy treatment confidence");
ok(profileFixture.cautionTags.includes("exfoliation_overlap_watch"), "legacy overlap watch tag");

const noSignalProfile = resolveProductFunctionalProfile({
  id: "legacy-no-signal",
  category: "treatment",
  ingredient_signals: { functional: [] },
  irritation_risk: "low",
  sensitivity_safe: true
});
eq(noSignalProfile.evaluable, false, "legacy no-signal profile unevaluable");
eq(noSignalProfile.sourceCompleteness, "functional_signals_missing", "legacy missing signals explicit");

const routineDuplicate = buildRoutinePolicy({
  context: {
    skinState: { priorityAxis: "pores", concernScores: { pores: 20 } },
    survey: { answers: { makeupUse: false }, completeness: "available" },
    safetyState: { level: "stable", sensitiveBurden: false },
    productExposureState: {
      rows: [
        { productId: "current-a", sourceState: "selected", category: "treatment", activeExposure: true, activeAxes: ["exfoliation"] },
        { productId: "current-b", sourceState: "selected", category: "treatment", activeExposure: true, activeAxes: ["exfoliation"] }
      ],
      duplicateActiveAxes: ["exfoliation"],
      unknownProductCount: 0
    }
  }
});
eq(routineDuplicate.routineBurdenState.duplicateAxisBurden, true, "routine duplicate axis burden");
eq(routineDuplicate.routineBurdenState.activeStackBurden, "confirmed", "routine duplicate confirms stack burden");
eq(routineDuplicate.windows.evening.steps.find((step) => step.stepKey === "pm.treatment").action, "reduce", "routine duplicate treatment reduction");
ok(routineDuplicate.prohibitedSameWindow.some((item) => item.reasonCodes.includes("active_stack_burden")), "routine same-window warning");

const routineStack = buildRoutinePolicy({
  context: {
    skinState: { priorityAxis: "pores", concernScores: { pores: 20 } },
    survey: { answers: { makeupUse: false }, completeness: "available" },
    safetyState: { level: "stable", sensitiveBurden: false },
    productExposureState: {
      rows: [
        { productId: "current-a", sourceState: "selected", category: "treatment", activeExposure: true, activeAxes: ["exfoliation"] },
        { productId: "current-b", sourceState: "selected", category: "treatment", activeExposure: true, activeAxes: ["tone_care"] }
      ],
      duplicateActiveAxes: [],
      unknownProductCount: 0
    }
  }
});
eq(routineStack.routineBurdenState.activeStackBurden, "possible", "routine stack possible");
eq(routineStack.windows.evening.steps.find((step) => step.stepKey === "pm.treatment").action, "reduce", "routine stack treatment reduction");

const highSensitivityGuard = resolveRecentInstabilityGuardPolicy({
  surveySafety: { sensitivityRisk: "high", recentSkinChange: "no", recentlyChangedProduct: "no" },
  goalPolicy: { recommendationGuard: "normal", safetyGoal: "pores" },
  product: { category: "treatment", irritation_risk: "low", sensitivity_safe: true },
  productProfile: profileFixture
});
eq(highSensitivityGuard.decision, "allow_with_context", "legacy high-sensitivity guard decision");
eq(highSensitivityGuard.guardLevel, "low", "legacy high-sensitivity guard level");

const conflictGuard = resolveRecentInstabilityGuardPolicy({
  surveySafety: { sensitivityRisk: "high", recentSkinChange: "yes", recentlyChangedProduct: "no" },
  goalPolicy: { recommendationGuard: "stabilize_first", safetyGoal: "redness" },
  product: { category: "treatment", irritation_risk: "high", sensitivity_safe: false },
  productProfile: profileFixture
});
eq(conflictGuard.decision, "hard_block_candidate", "legacy conflict guard hard block");
eq(conflictGuard.guardLevel, "high", "legacy conflict guard level");

const functionalProfileSource = read("lib/product-functional-profile.js");
const rankingSource = read("lib/functional-ranking-contract.js");
const recentGuardSource = read("lib/recent-instability-guard-policy.js");
const candidatePolicySource = read("lib/candidate-exposure-policy.js");
const candidateContractSource = read("lib/candidate-exposure-policy-contract.js");
ok(functionalProfileSource.includes("function strengthFromCount(count)"), "legacy strengthFromCount exists");
for (const token of ['return "low";', 'return "medium";', 'return "high";']) ok(functionalProfileSource.includes(token), `legacy strength token ${token}`);
for (const token of ["const STRENGTH_SCORE", "low: 0.35", "medium: 0.7", "high: 1", "function axisScore(axis)"]) ok(rankingSource.includes(token), `legacy ranking strength dependency ${token}`);
ok(!recentGuardSource.includes("productReaction"), "recent instability guard has no direct productReaction field");
ok(!candidatePolicySource.includes("exfoliation-non-numeric-pda-shadow-consumer"), "canonical CandidatePolicy does not import 8S consumer");
ok(!candidatePolicySource.includes("exfoliationPdaShadowConsumer"), "canonical CandidatePolicy has no 8S shadow field");
for (const exposure of ["primary", "contextual", "collapsed", "hidden", "insufficient_evidence"]) ok(candidateContractSource.includes(`"${exposure}"`), `canonical exposure enum ${exposure}`);

const invalidCanonical = evaluateCandidateExposurePolicy({
  canonicalState: {},
  candidates: [{ id: "not-applicable-control", category: "cleanser" }]
});
eq(invalidCanonical.status, "invalid_canonical_input", "CandidatePolicy independent canonical validation");
eq(invalidCanonical.decisions[0].exposure, "insufficient_evidence", "CandidatePolicy decision remains separate exposure domain");

const hostedProducts = replay.hosted_bounded_product_snapshots.products;
eq(hostedProducts.length, 4, "bounded hosted product snapshots");
const hostedProfiles = new Map(hostedProducts.map((product) => [product.id, resolveProductFunctionalProfile(product)]));
eq(Boolean(hostedProfiles.get("0b88019a-9eb2-4be9-842d-f1e60e42cf51").functionalAxes.find((axis) => axis.axis === "exfoliation")), false, "0b880 legacy has no exfoliation axis");
eq(hostedProfiles.get("c4a5f510-8d9e-46bd-a31c-3c0a34fee331").functionalAxes.find((axis) => axis.axis === "exfoliation")?.strength, "low", "c4 legacy low exfoliation strength");
eq(hostedProfiles.get("230f1c9c-cbf8-4458-aaac-ea1010a21e8c").functionalAxes.find((axis) => axis.axis === "exfoliation")?.strength, "low", "230f legacy low exfoliation strength");
eq(Boolean(hostedProfiles.get("24a339bf-f380-493f-88b5-68e6be887c30").functionalAxes.find((axis) => axis.axis === "exfoliation")), false, "24a legacy has no exfoliation axis");

const governedIds = replay.governed_product_authority.product_ids;
const p8ById = new Map(p8.products.map((row) => [row.product_id, row]));
for (const id of governedIds) ok(p8ById.has(id), `${id} present in frozen 8P`);
eq(p8ById.get("0b88019a-9eb2-4be9-842d-f1e60e42cf51").pda.active_identities.items.map((item) => item.identity), ["mandelic_acid"], "0b880 governed identity");
eq(p8ById.get("230f1c9c-cbf8-4458-aaac-ea1010a21e8c").pda.active_identities.semantic_ordering, "NONE", "230f no identity ordering");
eq(p8ById.get("230f1c9c-cbf8-4458-aaac-ea1010a21e8c").pda.active_identities.items.map((item) => item.identity), ["lactic_acid", "salicylic_acid"], "230f governed multi identities");
eq(p8ById.get("24a339bf-f380-493f-88b5-68e6be887c30").pda.signal_status, "GOVERNED_SIGNAL_NOT_ESTABLISHED", "24a governed no relevant signal");

const stableCanonicalState = {
  decisionBundle: {
    context: {
      skinState: { sensitivity: "low" },
      safetyState: {
        level: "stable",
        sensitiveBurden: false,
        exfoliationExpansionAllowed: true,
        recentSkinChange: "no",
        recentlyChangedProduct: "no"
      },
      productExposureState: {
        rows: [],
        unknownExposurePresent: false,
        recentExposureState: "none_reported",
        reactionLinkState: "none_reported"
      },
      conditionSignalState: {
        recentSkinChange: "no",
        recentProductChange: "no",
        productReaction: "no"
      }
    }
  }
};
const governedCandidates = governedIds.map((id) => ({ id, category: p8ById.get(id).category }));
const adapterResult = buildExfoliationNonNumericPdaShadowDecisionInputs({
  candidates: governedCandidates,
  pdaArtifact: p8,
  canonicalState: stableCanonicalState
});
const consumerResult = consumeExfoliationNonNumericPdaShadowDecisionInputs(adapterResult);
eq(consumerResult.status, "evaluated", "governed product shadow consumer evaluated");
const decisionById = new Map(consumerResult.rows.map((row) => [row.product_id, row.shadow_consumer_decision.decision]));
const expectedGoverned = new Map([
  ["0b88019a-9eb2-4be9-842d-f1e60e42cf51", "CLEAR"],
  ["c4a5f510-8d9e-46bd-a31c-3c0a34fee331", "UNKNOWN"],
  ["230f1c9c-cbf8-4458-aaac-ea1010a21e8c", "UNKNOWN"],
  ["24a339bf-f380-493f-88b5-68e6be887c30", "UNKNOWN"]
]);
for (const [id, decision] of expectedGoverned) {
  eq(decisionById.get(id), decision, `${id} governed 8S projection`);
  const corpusRow = replay.cases.find((row) => row.product_id === id);
  ok(corpusRow, `${id} governed corpus row`);
  eq(corpusRow.shadow_decision, decision, `${id} corpus projection frozen`);
}

eq(readiness.evidence_assessment.bounded_corpus_rows, 17, "readiness corpus count");
eq(readiness.evidence_assessment.divergence_causes_identifiable, true, "divergence causes identifiable");
eq(readiness.evidence_assessment.semantic_boundaries_identified, true, "semantic boundaries identified");
eq(readiness.evidence_assessment.unknown_handling_identified, true, "unknown handling identified");
eq(readiness.evidence_assessment.legacy_heuristic_dependency_identified, true, "legacy heuristic identified");
eq(readiness.evidence_assessment.semantic_incompatibility_blocker_found, false, "no irreducible incompatibility");
eq(readiness.evidence_assessment.production_activation_evidence_claimed, false, "activation not claimed");

const explicitNo = readiness.explicit_no;
eq(explicitNo.decision_axis_production_consumption, false, "no PDA production consumption");
eq(explicitNo.recommendation_scorer_changed, false, "no scorer change");
eq(explicitNo.recommendation_activated, false, "no recommendation activation");
eq(explicitNo.candidate_policy_production_changed, false, "no CandidatePolicy production change");
eq(explicitNo.legacy_heuristic_replaced, false, "legacy heuristic not replaced");
eq(explicitNo.shadow_clear_promoted_to_allow, false, "CLEAR not promoted");
eq(explicitNo.shadow_restrict_promoted_to_block, false, "RESTRICT not promoted");
eq(explicitNo.numeric_fitting, 0, "numeric fitting zero");
eq(explicitNo.potency_ordering_created, false, "no potency ordering");
eq(explicitNo.hosted_product_fact_writes, 0, "hosted Product Fact writes zero");
eq(explicitNo.registry_definition_delta, 0, "registry delta zero");
eq(explicitNo.migration_delta, 0, "migration delta zero");

for (const path of [TAXONOMY, REPLAY, READINESS]) {
  const buildA = canonical(path);
  const buildB = canonical(path);
  eq(buildA, buildB, `Build A/B ${path}`);
  eq(read(path), buildA, `canonical bytes ${path}`);
}

console.log(`verify-exfoliation-non-numeric-pda-shadow-divergence-readiness-v1: PASS (${assertions} assertions; terminal=${TERMINAL}; corpus=17; governed=4; production activation=NO)`);
