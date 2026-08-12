#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadFrozenCorpus } from "./build-product-evidence-cleanser-poc-v1.mjs";
import { buildTexts, OUT_JSON, OUT_MD } from "./build-product-fact-evidence-fusion-review-uncertainty-v1.mjs";
import {
  BASE_MAIN_SHA,
  CORPUS_SHA256,
  FACT_KEYS,
  HISTORICAL_POC_ARTIFACT_BLOB,
  HISTORICAL_POC_HEAD,
  PF_AUTHORITIES,
  PF_CONFIDENCE,
  buildFusionArtifact,
  evaluateReviewUncertainty,
  fuseProductFact,
  normalizeCleanserEvidence,
} from "./product-evidence/product-fact-evidence-fusion-review-uncertainty-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED = new Set([
  ".github/workflows/v21-4-evidence-fusion-review-uncertainty.yml",
  "docs/evidence/product-fact-evidence-fusion-review-uncertainty-v1.md",
  "evidence/product-fact-fusion-v1/cleanser-evidence-fusion-review-uncertainty-v1.json",
  "scripts/build-product-fact-evidence-fusion-review-uncertainty-v1.mjs",
  "scripts/product-evidence/product-fact-evidence-fusion-review-uncertainty-v1.mjs",
  "scripts/verify-product-fact-evidence-fusion-review-uncertainty-v1.mjs",
]);

function productById(products, id) {
  const value = products.find((item) => item.product_id === id);
  assert.ok(value, `missing product ${id}`);
  return value;
}
function fact(product, key) {
  const value = product.facts.find((item) => item.fact_key === key);
  assert.ok(value, `missing fact ${key}`);
  return value;
}
function replayHistoricalPoc() {
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "v21-4-historical-poc-"));
  try {
    execFileSync("git", ["worktree", "add", "--detach", worktree, HISTORICAL_POC_HEAD], { cwd: ROOT, stdio: "ignore" });
    const output = execFileSync(process.execPath, ["scripts/verify-product-evidence-cleanser-poc-v1.mjs"], { cwd: worktree, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    assert.match(output, /PASS verify-product-evidence-cleanser-poc-v1/);
    return output;
  } finally {
    try { execFileSync("git", ["worktree", "remove", "--force", worktree], { cwd: ROOT, stdio: "ignore" }); } catch {}
    try { fs.rmSync(worktree, { recursive: true, force: true }); } catch {}
  }
}

const currentMain = execFileSync("git", ["rev-parse", "refs/remotes/origin/main"], { cwd: ROOT, encoding: "utf8" }).trim();
assert.equal(currentMain, BASE_MAIN_SHA, "main authority drift");
assert.equal(execFileSync("git", ["rev-parse", `HEAD:evidence/product-evidence-decision-axis-v1/cleanser-poc-output-v1.json`], { cwd: ROOT, encoding: "utf8" }).trim(), HISTORICAL_POC_ARTIFACT_BLOB, "historical cleanser POC artifact drift");

const changed = execFileSync("git", ["diff", "--name-only", `${BASE_MAIN_SHA}..HEAD`], { cwd: ROOT, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
assert.equal(changed.length, ALLOWED.size, `V2.1-4 must change exactly ${ALLOWED.size} files`);
for (const name of changed) assert.ok(ALLOWED.has(name), `unexpected V2.1-4 path ${name}`);
assert.equal(changed.some((name) => name.startsWith("app/") || name.startsWith("components/") || name.startsWith("supabase/migrations/") || name.startsWith("lib/")), false, "Production/runtime path changed");
execFileSync("git", ["diff", "--check", `${BASE_MAIN_SHA}..HEAD`], { cwd: ROOT, stdio: "pipe" });

const { index, corpus } = loadFrozenCorpus();
assert.equal(index.canonical_sha256, CORPUS_SHA256);
assert.equal(corpus.products.length, 26);
const artifact = buildFusionArtifact(corpus);
assert.equal(artifact.products.length, 26);
assert.equal(artifact.products.every((item) => !Object.hasOwn(item, "decision_axes")), true, "Decision Axis belongs to V2.1-5");
assert.equal(artifact.summary.real_review_prevalence_estimates_emitted, 0);
assert.equal(artifact.review_uncertainty_contract.raw_review_count_substitution, "forbidden");
assert.equal(artifact.review_uncertainty_contract.production_calibrated, false);
assert.equal(artifact.lifecycle.REVIEW_BAYESIAN_MODEL_CALIBRATED, false);
assert.equal(artifact.lifecycle.EFFECTIVE_SAMPLE_MODEL_CALIBRATED, false);
assert.equal(artifact.lifecycle.DECISION_AXIS_CONSUMPTION, false);
assert.equal(artifact.lifecycle.RECOMMENDATION_ACTIVATED, false);

for (const product of artifact.products) {
  assert.equal(product.facts.length, FACT_KEYS.length);
  for (const item of product.facts) {
    assert.ok(PF_AUTHORITIES.includes(item.authority_ceiling), `non-PF authority ${item.authority_ceiling}`);
    assert.ok(PF_CONFIDENCE.includes(item.fused_confidence), `non-PF confidence ${item.fused_confidence}`);
    assert.match(item.fusion_input_digest, /^[0-9a-f]{64}$/);
  }
  for (const evidence of product.normalized_evidence) {
    if (evidence.source_class === "review_corpus" || evidence.source_class === "ingredient_list" || evidence.source_class === "manual_conflict_record") {
      assert.equal(evidence.admissible_for_fact, false, `${evidence.source_class} cannot establish cleanser fact under current Registry`);
    }
    if (evidence.source_class === "manual_conflict_record") {
      assert.equal(evidence.evidence_authority, "none");
      assert.equal(evidence.support_direction, "context_only");
    }
  }
}

for (const id of [
  "5448b8c3-cf87-4561-a699-3baf3dcb3dab",
  "cd3b66be-cddc-47e1-906f-a871dea84412",
  "3f83bb85-cc53-4aa0-a0f0-e08535288749",
]) {
  const product = productById(artifact.products, id);
  assert.equal(fact(product, "low_ph").semantic_status, "supported");
  assert.equal(fact(product, "low_ph").value, true);
  assert.equal(fact(product, "deep_cleansing").semantic_status, "supported");
  assert.equal(fact(product, "deep_cleansing").value, true);
}

const laroche = productById(artifact.products, "cb04b777-9a57-4246-9431-3018638354db");
assert.equal(laroche.identity_state.status, "resolved");
assert.equal(Object.hasOwn(laroche, "unknown_product"), false);
assert.equal(fact(laroche, "low_ph").semantic_status, "reviewed_not_established");
assert.equal(fact(laroche, "deep_cleansing").semantic_status, "reviewed_not_established");

const mediheal = productById(artifact.products, "51d526de-b127-47c4-83f1-64fc1ec4aa10");
assert.equal(fact(mediheal, "deep_cleansing").semantic_status, "supported");
assert.equal(fact(mediheal, "deep_cleansing").authority_ceiling, "limited_non_product_specific");
assert.equal(fact(mediheal, "deep_cleansing").fused_confidence, "medium");

const support = { catalog_evidence_id: "support", fact_key: "low_ph", admissible_for_fact: true, support_direction: "supports", negative_admissibility: "not_applicable", evidence_authority: "product_specific_primary", confidence: "high", reason_codes: [] };
const oppose = { catalog_evidence_id: "oppose", fact_key: "low_ph", admissible_for_fact: true, support_direction: "opposes", negative_admissibility: "conflict_opposition", evidence_authority: "product_specific_primary", confidence: "high", reason_codes: [] };
const conflictA = fuseProductFact({ factKey: "low_ph", normalizedEvidence: [support, oppose] });
const conflictB = fuseProductFact({ factKey: "low_ph", normalizedEvidence: [oppose, support] });
assert.equal(conflictA.semantic_status, "evidence_conflict");
assert.equal(conflictA.value, null);
assert.equal(conflictA.authority_ceiling, "product_specific_primary");
assert.equal(conflictA.fused_confidence, "unknown");
assert.equal(conflictA.fusion_input_digest, conflictB.fusion_input_digest, "input ordering must not change fusion digest");

const explicitNegative = { ...oppose, catalog_evidence_id: "explicit-negative", negative_admissibility: "explicit_negative" };
const supportedFalse = fuseProductFact({ factKey: "low_ph", normalizedEvidence: [explicitNegative] });
assert.equal(supportedFalse.semantic_status, "supported");
assert.equal(supportedFalse.value, false);
const reviewedNotEstablished = fuseProductFact({ factKey: "low_ph", normalizedEvidence: [], reviewState: "reviewed_unknown" });
assert.equal(reviewedNotEstablished.semantic_status, "reviewed_not_established");
assert.equal(reviewedNotEstablished.value, null);
assert.notDeepEqual(supportedFalse, reviewedNotEstablished);
const notReviewed = fuseProductFact({ factKey: "low_ph", normalizedEvidence: [], reviewState: null });
assert.equal(notReviewed.semantic_status, "not_reviewed");
assert.equal(notReviewed.value, null);

const coexistence = [
  fuseProductFact({ factKey: "low_ph", normalizedEvidence: [support] }),
  fuseProductFact({ factKey: "deep_cleansing", normalizedEvidence: [], reviewState: "reviewed_unknown" }),
];
assert.equal(coexistence[0].semantic_status, "supported");
assert.equal(coexistence[1].semantic_status, "reviewed_not_established");

const small = artifact.review_uncertainty_acceptance.same_ratio_n5;
const large = artifact.review_uncertainty_acceptance.same_ratio_n5000;
const reduced = artifact.review_uncertainty_acceptance.same_analyzed_n5000_effective_n100;
const missing = artifact.review_uncertainty_acceptance.missing_denominator;
assert.equal(small.estimate, 0.6);
assert.equal(large.estimate, 0.6);
assert.ok(small.uncertainty.value > large.uncertainty.value * 100, "n=5 uncertainty must materially exceed n=5000");
assert.ok(reduced.uncertainty.value > large.uncertainty.value, "lower explicit effective N must increase uncertainty");
assert.equal(missing.prevalence_estimate_allowed, false);
assert.equal(missing.estimate, null);
assert.equal(missing.confidence_cap, "limited");
assert.ok(missing.reason_codes.includes("raw_review_count_not_substituted"));
assert.throws(() => evaluateReviewUncertainty({ raw_source_review_count: 4, analyzed_review_count: 5, effective_sample_size: 5, signal_positive_count: 3, prior: { alpha: 1, beta: 1 } }), /analyzed_review_count must be <= raw_source_review_count/);
assert.throws(() => evaluateReviewUncertainty({ raw_source_review_count: 10, analyzed_review_count: 5, effective_sample_size: 6, signal_positive_count: 3, prior: { alpha: 1, beta: 1 } }), /effective_sample_size must be <= analyzed_review_count/);

const sourceA = evaluateReviewUncertainty({ source: "hwahae", extraction_policy_version: "fixture-v1", raw_source_review_count: 100, analyzed_review_count: 10, signal_positive_count: 3 });
const sourceB = evaluateReviewUncertainty({ source: "other_platform", extraction_policy_version: "fixture-v1", raw_source_review_count: 100, analyzed_review_count: 10, signal_positive_count: 3 });
assert.equal(sourceA.source, "hwahae");
assert.equal(sourceB.source, "other_platform");
assert.equal(Object.hasOwn(sourceA, "cross_source_estimate"), false);

const rawProduct = corpus.products[0];
const normalizedProbe = normalizeCleanserEvidence(rawProduct, { catalog_evidence_id: "review-probe", source_reference: "fixture", source_class: "review_corpus", supported_value: "deep_clean", evidence_summary: "fixture", accessed_at: "2026-08-12" });
assert.equal(normalizedProbe.evidence_authority, "review_observation");
assert.equal(normalizedProbe.admissible_for_fact, false);

const { json, markdown } = buildTexts();
assert.equal(fs.readFileSync(OUT_JSON, "utf8"), json, "committed JSON drift");
assert.equal(fs.readFileSync(OUT_MD, "utf8"), markdown, "committed markdown drift");
assert.equal(buildTexts().json, json, "deterministic JSON regeneration failed");
assert.equal(buildTexts().markdown, markdown, "deterministic markdown regeneration failed");

replayHistoricalPoc();
console.log("PASS verify-product-fact-evidence-fusion-review-uncertainty-v1");
console.log(`main=${BASE_MAIN_SHA}`);
console.log(`frozen_corpus_sha256=${CORPUS_SHA256}`);
console.log(`products=${artifact.summary.products} facts=${artifact.summary.fact_propositions} supported=${artifact.summary.supported}`);
console.log(`review_evidence=${artifact.summary.review_corpus_evidence} real_prevalence_estimates=0`);
console.log(`variance_n5=${small.uncertainty.value} variance_n5000=${large.uncertainty.value} variance_effective_n100=${reduced.uncertainty.value}`);
console.log("missing_denominator_prevalence=FORBIDDEN");
console.log("supported_false_distinct_from_reviewed_not_established=PASS");
console.log("historical_cleanser_poc_replay=PASS");
console.log("decision_axis_consumption=NO recommendation_activation=NO");
