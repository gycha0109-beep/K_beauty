import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildProtectionExpansionWave1,
  loadProtectionExpansionSnapshot,
  isEligibleProtectionExpansionCandidate,
} from "./product-evidence/data-ai29c-protection-expansion-selection-v1.mjs";

const root = process.cwd();
const selectionPath = "evidence/product-fact-catalog-expansion-v1/data-ai29c-protection-expansion-wave-1-selection-v1.json";
const docPath = "docs/evidence/data-ai29c-protection-expansion-wave-1-selection-v1.md";
const workflowPath = ".github/workflows/data-ai-product-query-static.yml";
const builderPath = "scripts/build-data-ai29c-protection-expansion-wave-v1.mjs";
const verifierPath = "scripts/verify-data-ai29c-protection-expansion-wave-v1.mjs";
const selectorPath = "scripts/product-evidence/data-ai29c-protection-expansion-selection-v1.mjs";
const policyPath = "scripts/product-evidence/data-ai29c-protection-expansion-selection-policy-v1.mjs";

const expectedSelected = [
  "77856d50-a033-4646-ae23-2a1162138319",
  "fd94a38e-ce09-4f4e-8bfd-882f47e071b5",
  "d433bd51-6bea-4647-a82e-18dafdccd45b",
  "30104119-75e7-4527-9b89-21c2a2fb37a8",
  "0af31488-09c8-417c-8cfe-d1ad05231814",
  "787e1c41-7d42-48f1-be74-e6d5c9837b7f",
  "1eae1cd9-ede3-41c8-87e2-c8bab93ff9e0",
  "16fe9bcb-ef37-41cd-a379-8db8ab1eb2d0",
];

const frozen = loadProtectionExpansionSnapshot(root);
const snapshot = frozen.snapshot;
assert.equal(snapshot.source_main_sha, "a10df31e73f4ad453eb5f64b4057c44cf40fe5a4");
assert.equal(snapshot.registry_version, "product-fact-registry-cross-category-v1");
assert.equal(snapshot.taxonomy_version, "catalog-taxonomy-v1");
assert.equal(snapshot.candidate_pool_count, 37);
assert.equal(snapshot.candidates.length, 37);
assert.equal(snapshot.limits.productionCutoverAuthorized, false);
assert.equal(snapshot.limits.outdoorRankableSignalAuthorized, false);
assert.equal(snapshot.authority_boundary.candidate_source_is_product_fact_authority, false);
assert.equal(snapshot.authority_boundary.planning_may_promote_products, false);
assert.equal(snapshot.authority_boundary.planning_may_write_product_facts, false);
assert.equal(snapshot.authority_boundary.planning_may_change_recommendation, false);

assert.deepEqual(snapshot.protection_audit_summary, {
  sunscreenCount: 12,
  spfEligibleCount: 12,
  uvaEligibleCount: 10,
  waterEligibleCount: 0,
  spfDistinctScoringBuckets: 1,
  uvaDistinctScoringBuckets: 1,
  waterDistinctScoringBuckets: 0,
});

const eligible = snapshot.candidates.filter(isEligibleProtectionExpansionCandidate);
assert.equal(eligible.length, 36);
assert.equal(snapshot.candidates.filter((candidate) => candidate.review_status === "promoted").length, 1);
assert.equal(eligible.filter((candidate) => candidate.discovery_leads.spf_non_50).length, 0);
assert.equal(eligible.filter((candidate) => candidate.discovery_leads.uva_non_pa4).length, 0);
assert.equal(eligible.filter((candidate) => candidate.discovery_leads.water_duration).length, 0);
assert.equal(eligible.filter((candidate) => candidate.discovery_leads.water_claim_research).length, 1);

for (const candidate of eligible) {
  assert.equal(candidate.product_write_allowed, false);
  assert.equal(candidate.product_promotion_allowed, false);
  assert.equal(candidate.recommendation_admission_allowed, false);
  assert.equal(candidate.classification_state, "active_shadow");
  assert.equal(candidate.matched_product_id, null);
  assert.equal(candidate.duplicate_of_product_id, null);
}

const result = buildProtectionExpansionWave1(root);
assert.equal(result.version, "data-ai29c-protection-expansion-wave-1-selection-v1");
assert.equal(result.stage, "DATA-AI29C-C5");
assert.equal(result.mode, "RESEARCH_READINESS_FALLBACK_WAVE");
assert.equal(result.candidate_pool_summary.frozen_candidate_count, 37);
assert.equal(result.candidate_pool_summary.eligible_candidate_count, 36);
assert.equal(result.candidate_pool_summary.excluded_candidate_count, 1);
assert.equal(result.candidate_pool_summary.selected_candidate_count, 8);
assert.equal(result.candidate_pool_summary.deferred_candidate_count, 28);
assert.equal(result.candidate_pool_summary.exact_discrimination_lead_candidates, 0);
assert.equal(result.candidate_pool_summary.water_claim_research_lead_candidates, 1);
assert.deepEqual(result.selected_candidates.map((candidate) => candidate.candidate_id), expectedSelected);
assert.equal(new Set(result.selected_candidates.map((candidate) => candidate.normalized_brand)).size, 8);
assert.equal(result.invariants.brand_cap_relaxation_count, 0);
assert.equal(result.invariants.hosted_writes, 0);
assert.equal(result.invariants.product_promotion_intent, 0);
assert.equal(result.invariants.product_fact_write_intent, 0);
assert.equal(result.invariants.recommendation_write_intent, 0);
assert.equal(result.invariants.production_ranking_changed, false);
assert.equal(result.invariants.candidate_source_used_as_product_fact_authority, false);
assert.equal(result.invariants.water_claim_research_lead_used_as_duration_evidence, false);
assert.equal(result.invariants.runtime_consumption, false);

const bushman = result.selected_candidates.find((candidate) => candidate.candidate_id === "77856d50-a033-4646-ae23-2a1162138319");
assert.ok(bushman);
assert.equal(bushman.discovery_leads.water_claim_research, true);
assert.equal(bushman.discovery_leads.water_duration, false);
assert.equal(bushman.discrimination_lead_count, 0);
assert.equal(bushman.priority_class, "PROTECTION_RESEARCH_LEAD");

const committed = JSON.parse(fs.readFileSync(selectionPath, "utf8"));
assert.deepEqual(committed, result, "committed selection artifact drifted from deterministic builder");

const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), "data-ai29c-c5-a-"));
const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), "data-ai29c-c5-b-"));
for (const outputRoot of [tmpA, tmpB]) {
  const run = spawnSync(process.execPath, [builderPath], {
    cwd: root,
    env: { ...process.env, DATA_AI29C_C5_OUTPUT_ROOT: outputRoot },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
}
const relJson = selectionPath;
const relMd = docPath;
const aJson = fs.readFileSync(path.join(tmpA, relJson));
const bJson = fs.readFileSync(path.join(tmpB, relJson));
const aMd = fs.readFileSync(path.join(tmpA, relMd));
const bMd = fs.readFileSync(path.join(tmpB, relMd));
assert.deepEqual(aJson, bJson, "Build A/B JSON must be byte-identical");
assert.deepEqual(aMd, bMd, "Build A/B Markdown must be byte-identical");
assert.deepEqual(aJson, fs.readFileSync(relJson), "committed JSON must equal deterministic build");
assert.deepEqual(aMd, fs.readFileSync(relMd), "committed Markdown must equal deterministic build");

for (const sourcePath of [builderPath, verifierPath, selectorPath, policyPath]) {
  const source = fs.readFileSync(sourcePath, "utf8");
  assert.ok(!/\b(insert\s+into|update|delete\s+from)\s+public\./i.test(source), sourcePath + ": planning code must not contain Hosted DML");
  assert.ok(!/promote_product_candidate_catalog_only_v1\s*\(/i.test(source), sourcePath + ": planning code must not promote candidates");
  assert.ok(!/admin_confirm_product_fact_v1\s*\(/i.test(source), sourcePath + ": planning code must not confirm Product Facts");
}

const workflow = fs.readFileSync(workflowPath, "utf8");
for (const triggerPath of [
  "scripts/build-data-ai29c-protection-expansion-wave-v1.mjs",
  "scripts/verify-data-ai29c-protection-expansion-wave-v1.mjs",
  "scripts/product-evidence/data-ai29c-protection-expansion-selection-v1.mjs",
  "scripts/product-evidence/data-ai29c-protection-expansion-selection-policy-v1.mjs",
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-protection-expansion-wave-1-snapshot-v1.json",
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-protection-expansion-wave-1-selection-v1.json",
  "docs/evidence/data-ai29c-protection-expansion-wave-1-selection-v1.md",
]) {
  assert.ok(workflow.includes('- "' + triggerPath + '"'), triggerPath + ": canonical CI path trigger missing");
}
assert.equal(
  workflow.split("node scripts/verify-data-ai29c-protection-expansion-wave-v1.mjs").length - 1,
  1,
  "DATA-AI29C-C5 verifier must execute exactly once in canonical static CI",
);

console.log("DATA_AI29C_C5_PROTECTION_EXPANSION_VERIFIED");
console.log("eligible=36 selected=8 exact_discrimination_leads=0 water_claim_research_leads=1");
