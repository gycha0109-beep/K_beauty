#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASELINE_SHA,
  CORPUS_SHA256,
  FACT_KEYS,
  AXIS_KEYS,
  buildArtifactFromCorpus,
  canonicalJson,
  evaluateReviewReliability,
  fuseFact,
  mapDecisionAxes,
  normalizeEvidence,
} from "./product-evidence/cleanser-poc-core.mjs";
import { loadFrozenCorpus } from "./build-product-evidence-cleanser-poc-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = path.join(ROOT, "evidence/product-evidence-decision-axis-v1/cleanser-poc-output-v1.json");
const ALLOWED_PHASE2_FILES = new Set([
  "scripts/product-evidence/cleanser-poc-core.mjs",
  "scripts/build-product-evidence-cleanser-poc-v1.mjs",
  "scripts/verify-product-evidence-cleanser-poc-v1.mjs",
  "evidence/product-evidence-decision-axis-v1/cleanser-poc-output-v1.json",
]);

function byId(products, id) {
  const product = products.find((item) => item.product_id === id);
  assert.ok(product, `missing mandatory product ${id}`);
  return product;
}
function fact(product, key) {
  return product.facts.find((item) => item.fact_key === key);
}
function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
function hasGitCommit(sha) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function verifyFrozenArchitectureBaseline() {
  assert.ok(hasGitCommit(BASELINE_SHA), `required baseline commit unavailable: ${BASELINE_SHA}`);
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "product-evidence-arch-v1-"));
  try {
    execFileSync("git", ["worktree", "add", "--detach", worktree, BASELINE_SHA], { cwd: ROOT, stdio: "ignore" });
    const output = execFileSync(process.execPath, ["scripts/verify-product-evidence-decision-axis-v1.mjs"], {
      cwd: worktree,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    assert.match(output, /PASS verify-product-evidence-decision-axis-v1/);
    assert.match(output, new RegExp(`frozen_corpus_sha256=${CORPUS_SHA256}`));
    return output;
  } finally {
    try { execFileSync("git", ["worktree", "remove", "--force", worktree], { cwd: ROOT, stdio: "ignore" }); } catch {}
    try { fs.rmSync(worktree, { recursive: true, force: true }); } catch {}
  }
}
function verifyPhase2PathBoundary() {
  assert.ok(hasGitCommit(BASELINE_SHA), `required baseline commit unavailable: ${BASELINE_SHA}`);
  const changed = execFileSync("git", ["diff", "--name-only", `${BASELINE_SHA}..HEAD`], {
    cwd: ROOT,
    encoding: "utf8",
  }).split(/\r?\n/).filter(Boolean);
  assert.equal(changed.length, 4, `Phase 2 must change exactly four files, got ${changed.length}`);
  for (const file of changed) assert.ok(ALLOWED_PHASE2_FILES.has(file), `unexpected Phase 2 file: ${file}`);
  const forbidden = changed.find((file) =>
    file.startsWith("app/")
      || file.startsWith("components/")
      || file.startsWith("lib/")
      || file.startsWith("supabase/migrations/")
      || file.startsWith(".github/workflows/")
      || file === "package.json"
  );
  assert.equal(forbidden, undefined, `Production/runtime path changed: ${forbidden}`);
  execFileSync("git", ["diff", "--check", `${BASELINE_SHA}..HEAD`], { cwd: ROOT, stdio: "pipe" });
  return changed;
}

const { index, corpus } = loadFrozenCorpus();
assert.equal(index.canonical_sha256, CORPUS_SHA256, "frozen corpus SHA changed");
assert.equal(corpus.products.length, 26);
assert.equal(new Set(corpus.products.map((item) => item.product_id)).size, 26, "product IDs must be unique");

const normalizedAll = corpus.products.flatMap((product) => product.evidence.map((item) => normalizeEvidence(product, item)));
for (const evidence of normalizedAll) {
  for (const key of [
    "catalog_evidence_id", "source_reference", "source_class", "supported_value", "evidence_summary", "accessed_at",
    "admin_v2_evidence_type_candidate", "admin_v2_ingestion_eligible", "support_direction", "fact_proposition",
    "authority_class", "normalization_reason_codes",
  ]) assert.ok(Object.hasOwn(evidence, key), `normalized evidence missing ${key}`);
  if (evidence.source_class === "manual_conflict_record") {
    assert.equal(evidence.support_direction, "context_only");
    assert.equal(evidence.supported_value, null);
  }
  if (evidence.source_class === "official_brand_site_listing") assert.notEqual(evidence.authority_class, "product_specific_primary");
  if (evidence.source_class === "retailer_product_page") assert.notEqual(evidence.authority_class, "product_specific_primary");
}

const generated = buildArtifactFromCorpus(corpus);
assert.equal(generated.products.length, 26);
assert.equal(generated.products.every((item) => item.identity_state && !item.facts.some((f) => f.fact_key === "product_identity_match")), true);
assert.equal(generated.products.every((item) => item.identity_state.confidence === null), true, "identity confidence must remain uncalibrated/null");
assert.equal(generated.products.every((item) => item.facts.length === FACT_KEYS.length), true);
assert.deepEqual(Object.keys(generated.products[0].decision_axes).sort(), [...AXIS_KEYS].sort());

const allFacts = generated.products.flatMap((item) => item.facts);
assert.equal(allFacts.length, 52);
const lowSupported = allFacts.filter((item) => item.fact_key === "low_ph" && item.status === "supported");
const deepSupported = allFacts.filter((item) => item.fact_key === "deep_cleansing" && item.status === "supported");
assert.equal(lowSupported.length, 13);
assert.equal(deepSupported.length, 15);
assert.equal(allFacts.filter((item) => item.status === "supported").length, 28);
assert.equal(allFacts.filter((item) => item.status === "evidence_conflict").length, 0, "real corpus same-fact conflict must remain zero");
assert.equal(allFacts.filter((item) => item.value === false).length, 0, "absence must never become false");

for (const id of [
  "5448b8c3-cf87-4561-a699-3baf3dcb3dab",
  "cd3b66be-cddc-47e1-906f-a871dea84412",
  "3f83bb85-cc53-4aa0-a0f0-e08535288749",
]) {
  const product = byId(generated.products, id);
  assert.equal(fact(product, "low_ph").status, "supported");
  assert.equal(fact(product, "low_ph").value, true);
  assert.equal(fact(product, "deep_cleansing").status, "supported");
  assert.equal(fact(product, "deep_cleansing").value, true);
  assert.notEqual(fact(product, "low_ph").status, "evidence_conflict");
  assert.notEqual(fact(product, "deep_cleansing").status, "evidence_conflict");
}

const laroche = byId(generated.products, "cb04b777-9a57-4246-9431-3018638354db");
assert.equal(laroche.identity_state.status, "resolved");
assert.equal(laroche.identity_state.canonical_product_id, laroche.product_id);
assert.equal(fact(laroche, "low_ph").status, "reviewed_not_established");
assert.equal(fact(laroche, "low_ph").value, null);
assert.equal(fact(laroche, "deep_cleansing").status, "reviewed_not_established");
assert.equal(fact(laroche, "deep_cleansing").value, null);
assert.equal(Object.hasOwn(laroche, "unknown_product"), false);

const mediheal = byId(generated.products, "51d526de-b127-47c4-83f1-64fc1ec4aa10");
assert.equal(fact(mediheal, "deep_cleansing").status, "supported");
assert.equal(fact(mediheal, "deep_cleansing").value, true);
assert.equal(fact(mediheal, "deep_cleansing").authority_ceiling, "limited_non_product_specific");
assert.equal(fact(mediheal, "deep_cleansing").confidence, "medium");
assert.equal(mediheal.decision_axes.sebum_pore_control.coverage, "authority_limited");

const syntheticConflict = fuseFact({
  factKey: "low_ph",
  normalizedEvidence: [
    { catalog_evidence_id: "synthetic-support", source_class: "official_product_page", fact_proposition: "low_ph", support_direction: "supports", authority_class: "product_specific_primary" },
    { catalog_evidence_id: "synthetic-oppose", source_class: "manufacturer_documentation", fact_proposition: "low_ph", support_direction: "opposes", authority_class: "product_specific_primary" },
    { catalog_evidence_id: "synthetic-manual", source_class: "manual_conflict_record", fact_proposition: "low_ph", support_direction: "supports", authority_class: "adjudication_only" },
  ],
});
assert.equal(syntheticConflict.status, "evidence_conflict");
assert.equal(syntheticConflict.value, null);
assert.deepEqual(syntheticConflict.supporting_evidence, ["synthetic-support"]);
assert.deepEqual(syntheticConflict.opposing_evidence, ["synthetic-oppose"]);
assert.equal(syntheticConflict.supporting_evidence.includes("synthetic-manual"), false, "manual adjudication cannot select physical truth");

const claimAxes = mapDecisionAxes({
  facts: [{ fact_key: "deep_cleansing", status: "supported", value: true, authority_ceiling: "product_specific_primary" }],
  normalizedEvidence: [{ catalog_evidence_id: "synthetic-claim", evidence_type: "official_claim", fact_proposition: "deep_cleansing" }],
});
assert.equal(claimAxes.cleansing_burden.coverage, "claim_only");
assert.equal(claimAxes.cleansing_burden.estimate, null);
assert.equal(claimAxes.sebum_pore_control.estimate, null);

const lowPhAxes = mapDecisionAxes({
  facts: [{ fact_key: "low_ph", status: "supported", value: true, authority_ceiling: "product_specific_primary" }],
  normalizedEvidence: [],
});
assert.equal(lowPhAxes.hydration_preservation.coverage, "indirect_fact_only");
assert.equal(lowPhAxes.hydration_preservation.estimate, null);

const measurementAxes = mapDecisionAxes({
  facts: [],
  normalizedEvidence: [{
    catalog_evidence_id: "synthetic-measurement",
    evidence_type: "official_measurement",
    metric: "cleansing_test_score",
    numeric_value: 0.42,
    unit: "fixture_unit",
    method_context: "synthetic measurement-shaped structural fixture only",
  }],
});
assert.equal(measurementAxes.cleansing_burden.coverage, "measurement_supported");
assert.equal(measurementAxes.cleansing_burden.estimate, 0.42);

const realNumericAxes = generated.products.flatMap((product) => Object.values(product.decision_axes)).filter((axis) => axis.estimate !== null);
assert.equal(realNumericAxes.length, 0, "real corpus must not receive invented numeric magnitude");

const small = evaluateReviewReliability({ observed_positive: 3, raw_source_sample_size: 5, analyzed_sample_size: 5, effective_sample_size: 5, prior: { alpha: 1, beta: 1 } });
const large = evaluateReviewReliability({ observed_positive: 3000, raw_source_sample_size: 5000, analyzed_sample_size: 5000, effective_sample_size: 5000, prior: { alpha: 1, beta: 1 } });
assert.ok(small.uncertainty > large.uncertainty);
const effectiveFull = evaluateReviewReliability({ observed_positive: 3000, raw_source_sample_size: 5000, analyzed_sample_size: 5000, effective_sample_size: 5000, prior: { alpha: 1, beta: 1 } });
const effectiveReduced = evaluateReviewReliability({ observed_positive: 3000, raw_source_sample_size: 5000, analyzed_sample_size: 5000, effective_sample_size: 100, prior: { alpha: 1, beta: 1 } });
assert.ok(effectiveReduced.uncertainty > effectiveFull.uncertainty);
assert.throws(() => evaluateReviewReliability({ observed_positive: 3, raw_source_sample_size: 4, analyzed_sample_size: 5, effective_sample_size: 5 }), /analyzed_sample_size must be <= raw_source_sample_size/);

const missingDenominator = evaluateReviewReliability({ signal_count: 27, review_count: 10000, raw_source_sample_size: null, analyzed_sample_size: null, effective_sample_size: null });
assert.equal(missingDenominator.prevalence_estimate_allowed, false);
assert.equal(missingDenominator.prevalence_estimate, null);
assert.equal(missingDenominator.confidence_cap, "limited");
assert.ok(missingDenominator.reason_codes.includes("review_count_not_substituted"));

const committedText = fs.readFileSync(OUTPUT_PATH, "utf8");
const regeneratedText = canonicalJson(generated);
assert.equal(committedText, regeneratedText, "committed generated artifact drifted from in-memory regeneration");
const deterministicAgain = canonicalJson(buildArtifactFromCorpus(corpus));
assert.equal(regeneratedText, deterministicAgain, "artifact generation must be byte-identical");

const frozenVerifier = execFileSync(process.execPath, ["scripts/verify-cleanser-catalog-field-review-v1.mjs"], { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
assert.match(frozenVerifier, /PASS verify-cleanser-catalog-field-review-v1/);
assert.match(frozenVerifier, new RegExp(`canonical_sha256=${CORPUS_SHA256}`));
verifyFrozenArchitectureBaseline();
const changedFiles = verifyPhase2PathBoundary();

console.log("PASS verify-product-evidence-cleanser-poc-v1");
console.log(`baseline=${BASELINE_SHA}`);
console.log(`frozen_corpus_sha256=${CORPUS_SHA256}`);
console.log(`products=${generated.products.length} propositions=${allFacts.length}`);
console.log(`low_ph_supported=${lowSupported.length} deep_cleansing_supported=${deepSupported.length} total_supported=28`);
console.log("real_same_fact_conflicts=0");
console.log("identity_state=separate confidence=null");
console.log("mediheal_authority_ceiling=limited_non_product_specific");
console.log("real_numeric_axis_estimates=0");
console.log(`review_variance_n5=${small.uncertainty.toFixed(8)} review_variance_n5000=${large.uncertainty.toFixed(8)}`);
console.log(`effective_variance_n5000=${effectiveFull.uncertainty.toFixed(8)} effective_variance_n100=${effectiveReduced.uncertainty.toFixed(8)}`);
console.log("missing_denominator_prevalence=forbidden");
console.log(`artifact_sha256=${sha256(committedText)}`);
console.log(`changed_files=${changedFiles.join(",")}`);
console.log("production_runtime_delta=0");
console.log("frozen_architecture_verifier_at_baseline=PASS");
