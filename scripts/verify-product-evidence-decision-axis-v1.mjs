#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_SHA = "b7c7275317b72df14835f2ed1da8c1e9737cb7d3";
const EXPECTED_CORPUS_SHA = "9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f";
const ARCHITECTURE_PATH = path.join(ROOT, "docs/architecture/product-evidence-decision-axis-v1.md");
const FIXTURE_PATH = path.join(ROOT, "evidence/product-evidence-decision-axis-v1/cleanser-poc-fixtures.json");
const CORPUS_INDEX_PATH = path.join(ROOT, "evidence/catalog/cleanser-field-review-v1.json");
const ALLOWED_CHANGED_FILES = [
  "docs/architecture/product-evidence-decision-axis-v1.md",
  "evidence/product-evidence-decision-axis-v1/cleanser-poc-fixtures.json",
  "scripts/verify-product-evidence-decision-axis-v1.mjs"
];

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digestWithoutSelf(corpus) {
  const copy = structuredClone(corpus);
  delete copy.canonical_sha256;
  return crypto.createHash("sha256").update(stableJson(copy), "utf8").digest("hex");
}

function loadFrozenCorpus() {
  const index = JSON.parse(fs.readFileSync(CORPUS_INDEX_PATH, "utf8"));
  const products = [];
  for (const relativePath of index.product_parts ?? []) {
    const shard = JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
    products.push(...(shard.products ?? []));
  }
  const { product_parts: _parts, ...indexWithoutParts } = index;
  return { index, corpus: { ...indexWithoutParts, products } };
}

function betaVariance(alpha, beta) {
  return (alpha * beta) / (((alpha + beta) ** 2) * (alpha + beta + 1));
}

function analyzedPosterior(fixture) {
  assert.equal(typeof fixture.observed_positive, "number");
  assert.equal(typeof fixture.analyzed_sample_size, "number");
  const failures = fixture.analyzed_sample_size - fixture.observed_positive;
  const alpha = fixture.prior.alpha + fixture.observed_positive;
  const beta = fixture.prior.beta + failures;
  return { alpha, beta, mean: alpha / (alpha + beta), variance: betaVariance(alpha, beta) };
}

function effectivePosterior(fixture) {
  assert.equal(typeof fixture.observed_positive, "number");
  assert.equal(typeof fixture.analyzed_sample_size, "number");
  assert.equal(typeof fixture.effective_sample_size, "number");
  const observedRatio = fixture.observed_positive / fixture.analyzed_sample_size;
  const effectivePositive = observedRatio * fixture.effective_sample_size;
  const effectiveNegative = fixture.effective_sample_size - effectivePositive;
  const alpha = fixture.prior.alpha + effectivePositive;
  const beta = fixture.prior.beta + effectiveNegative;
  return { alpha, beta, mean: alpha / (alpha + beta), variance: betaVariance(alpha, beta) };
}

function assertSampleOrdering(fixture) {
  const raw = fixture.raw_source_sample_size;
  const analyzed = fixture.analyzed_sample_size;
  const effective = fixture.effective_sample_size;

  for (const [name, value] of [
    ["raw_source_sample_size", raw],
    ["analyzed_sample_size", analyzed],
    ["effective_sample_size", effective]
  ]) {
    if (value !== null && value !== undefined) {
      assert.equal(typeof value, "number", `${fixture.case}.${name} must be numeric when present`);
      assert.ok(value >= 0, `${fixture.case}.${name} must be non-negative`);
    }
  }

  if (effective !== null && effective !== undefined && analyzed !== null && analyzed !== undefined) {
    assert.ok(effective <= analyzed, `${fixture.case}: effective_sample_size must be <= analyzed_sample_size`);
  }
  if (analyzed !== null && analyzed !== undefined && raw !== null && raw !== undefined) {
    assert.ok(analyzed <= raw, `${fixture.case}: analyzed_sample_size must be <= raw_source_sample_size`);
  }
}

function fact(productFixture, key) {
  return productFixture.facts.find((item) => item.fact_key === key);
}

function hasCommit(sha) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const architecture = fs.readFileSync(ARCHITECTURE_PATH, "utf8");
const fixtures = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
const { index, corpus } = loadFrozenCorpus();

for (const marker of [
  "Raw Evidence",
  "Product Facts",
  "Evidence Fusion",
  "Product Decision Axes",
  "User Concern / Condition",
  "Constraint + Utility",
  "fact_key",
  "evidence_digest",
  "reviewed_not_established",
  "evidence_conflict",
  "absence of a fact != false",
  "Beta-Binomial",
  "raw_source_sample_size",
  "analyzed_sample_size",
  "effective_sample_size",
  "ProductIdentityState",
  "cleansing_burden",
  "hydration_preservation",
  "irritation_burden",
  "sebum_pore_control",
  "signal_family"
]) {
  assert.ok(architecture.includes(marker), `architecture marker missing: ${marker}`);
}

for (const evidenceType of [
  "official_claim",
  "official_measurement",
  "clinical_or_human_test",
  "ingredient_basis",
  "review_observation",
  "manual_adjudication"
]) {
  assert.ok(architecture.includes(evidenceType), `evidence type missing: ${evidenceType}`);
}

for (const concern of ["barrier", "dehydration", "oiliness", "redness", "acne", "pores", "uneven_tone", "uv"]) {
  assert.ok(architecture.includes(concern), `existing concern axis missing from boundary: ${concern}`);
}

assert.match(architecture, /effective_sample_size\s*[\r\n]+\s*<= analyzed_sample_size\s*[\r\n]+\s*<= raw_source_sample_size/);
assert.match(architecture, /large raw\/analyzed `n` must not automatically imply near-zero real-world uncertainty/i);
assert.match(architecture, /manual adjudication.*cannot by itself select physical truth/i);
assert.match(architecture, /Identity resolution metadata is not directly scoreable recommendation evidence/i);

const frozenVerifierOutput = execFileSync(
  process.execPath,
  [path.join(ROOT, "scripts/verify-cleanser-catalog-field-review-v1.mjs")],
  { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
);
assert.ok(frozenVerifierOutput.includes("PASS verify-cleanser-catalog-field-review-v1"));
assert.ok(frozenVerifierOutput.includes(`canonical_sha256=${EXPECTED_CORPUS_SHA}`));

assert.equal(index.version, "cleanser-catalog-field-review-v1");
assert.equal(index.canonical_sha256, EXPECTED_CORPUS_SHA);
assert.equal(fixtures.input.corpus_version, index.version);
assert.equal(fixtures.input.canonical_sha256, EXPECTED_CORPUS_SHA);
assert.equal(fixtures.input.immutable, true);
assert.equal(digestWithoutSelf(corpus), EXPECTED_CORPUS_SHA, "frozen corpus digest changed");

assert.deepEqual(fixtures.fact_statuses, [
  "supported",
  "reviewed_not_established",
  "not_reviewed",
  "evidence_insufficient",
  "evidence_conflict"
]);
assert.deepEqual(fixtures.axis_keys, [
  "cleansing_burden",
  "hydration_preservation",
  "irritation_burden",
  "sebum_pore_control"
]);

const conflictByCase = new Map(fixtures.fact_conflict_fixtures.map((item) => [item.case, item]));
assert.equal(conflictByCase.size, 2);

const independent = conflictByCase.get("independent_supported_facts_not_conflict");
assert.equal(independent.expected.conflict, false);
assert.equal(independent.facts.length, 2);
assert.notEqual(independent.facts[0].fact_key, independent.facts[1].fact_key);
for (const independentFact of independent.facts) {
  assert.equal(independentFact.status, "supported");
  assert.equal(independentFact.value, true);
  assert.notEqual(independentFact.status, "evidence_conflict");
}
assert.equal(independent.facts.find((item) => item.fact_key === "low_ph")?.value, true);
assert.equal(independent.facts.find((item) => item.fact_key === "deep_cleansing")?.value, true);

const sameFactConflict = conflictByCase.get("same_low_ph_proposition_conflict");
assert.equal(sameFactConflict.fact_key, "low_ph");
assert.equal(sameFactConflict.status, "evidence_conflict");
assert.equal(sameFactConflict.value, null);
assert.equal(sameFactConflict.expected.authoritative_value, null);
assert.equal(sameFactConflict.manual_adjudication_selects_physical_truth, false);
assert.ok(sameFactConflict.supporting_evidence.length > 0);
assert.ok(sameFactConflict.opposing_evidence.length > 0);
assert.ok(sameFactConflict.supporting_evidence.every((item) => item.support_direction === "supports" && item.credible === true));
assert.ok(sameFactConflict.opposing_evidence.every((item) => item.support_direction === "opposes" && item.credible === true));

const frozenProducts = new Map(corpus.products.map((product) => [product.product_id, product]));
assert.equal(frozenProducts.size, 26);
const fixtureByCase = new Map(fixtures.products.map((product) => [product.case, product]));
assert.equal(fixtureByCase.size, 6);

for (const productFixture of fixtures.products) {
  const sourceProduct = frozenProducts.get(productFixture.product_id);
  assert.ok(sourceProduct, `${productFixture.case}: frozen product missing`);
  assert.equal(sourceProduct.brand, productFixture.brand);
  assert.equal(sourceProduct.name, productFixture.name);
  const sourceEvidence = new Map(sourceProduct.evidence.map((item) => [item.catalog_evidence_id, item]));

  for (const evidenceId of productFixture.source_evidence_ids) {
    assert.ok(sourceEvidence.has(evidenceId), `${productFixture.case}: frozen evidence missing ${evidenceId}`);
  }

  if (productFixture.identity_state) {
    assert.equal(productFixture.identity_state.canonical_product_id, productFixture.product_id);
    assert.equal(productFixture.identity_state.status, "resolved");
    for (const evidenceId of productFixture.identity_state.identity_evidence ?? []) {
      assert.ok(sourceEvidence.has(evidenceId), `${productFixture.case}: identity evidence missing ${evidenceId}`);
    }
  }

  for (const productFact of productFixture.facts) {
    assert.ok(productFact.fact_key);
    assert.ok(["boolean", "string", "number"].includes(productFact.value_type));
    assert.ok(fixtures.fact_statuses.includes(productFact.status));
    assert.notEqual(productFact.domain, "identity", `${productFixture.case}: identity metadata must not be a Product Fact domain`);
    for (const evidenceId of productFact.support_evidence_ids ?? []) {
      assert.ok(sourceEvidence.has(evidenceId), `${productFixture.case}.${productFact.fact_key}: support evidence missing ${evidenceId}`);
    }
    for (const evidenceId of productFact.opposing_evidence_ids ?? []) {
      assert.ok(sourceEvidence.has(evidenceId), `${productFixture.case}.${productFact.fact_key}: opposing evidence missing ${evidenceId}`);
    }
    if (productFact.status === "evidence_conflict") {
      assert.equal(productFact.value, null, `${productFixture.case}.${productFact.fact_key}: conflict value must be null`);
      assert.ok((productFact.support_evidence_ids ?? []).length > 0);
      assert.ok((productFact.opposing_evidence_ids ?? []).length > 0);
    }
  }
}

for (const caseName of ["beplain_multi_fact", "brmud_multi_fact_cross_source", "jumiso_multi_fact"]) {
  const product = fixtureByCase.get(caseName);
  assert.equal(fact(product, "low_ph")?.status, "supported");
  assert.equal(fact(product, "low_ph")?.value, true);
  assert.equal(fact(product, "deep_cleansing")?.status, "supported");
  assert.equal(fact(product, "deep_cleansing")?.value, true);
  assert.notEqual(fact(product, "low_ph")?.status, "evidence_conflict");
  assert.notEqual(fact(product, "deep_cleansing")?.status, "evidence_conflict");
}

const laroche = fixtureByCase.get("laroche_partial_knowledge");
assert.equal(laroche.identity_state?.status, "resolved");
assert.equal(laroche.identity_state?.canonical_product_id, laroche.product_id);
assert.equal(laroche.identity_state?.confidence, "high");
assert.ok((laroche.identity_state?.identity_evidence ?? []).includes("cfrv1-03-01"));
assert.equal(fact(laroche, "product_identity_match"), undefined);
assert.ok(!laroche.facts.some((item) => item.fact_key === "product_identity_match"));
assert.ok(!laroche.facts.some((item) => item.domain === "identity"));
assert.equal(fact(laroche, "low_ph")?.status, "reviewed_not_established");
assert.equal(fact(laroche, "low_ph")?.value, null);
assert.equal(fact(laroche, "deep_cleansing")?.status, "reviewed_not_established");
assert.equal(fact(laroche, "deep_cleansing")?.value, null);
assert.ok(laroche.facts.every((item) => item.status !== "supported"), "La Roche facts may remain unestablished while identity stays resolved");

const mediheal = fixtureByCase.get("mediheal_authority_limited");
assert.equal(fact(mediheal, "deep_cleansing")?.status, "supported");
assert.match(fact(mediheal, "deep_cleansing")?.authority_note ?? "", /no frozen product-specific high-authority/i);
assert.equal(frozenProducts.get(mediheal.product_id).confidence, "medium");
assert.equal(frozenProducts.get(mediheal.product_id).admin_v2_ingestion_readiness, "evidence_upgrade_required");

const beplain = fixtureByCase.get("beplain_multi_fact");
const senka = fixtureByCase.get("senka_claim_not_magnitude");
assert.equal(beplain.axis_expectation.sebum_pore_control.estimate, null);
assert.equal(senka.axis_expectation.sebum_pore_control.estimate, null);
assert.equal(beplain.axis_expectation.sebum_pore_control.coverage, "claim_only");
assert.equal(senka.axis_expectation.sebum_pore_control.coverage, "claim_only");

for (const reviewFixture of fixtures.review_sample_fixtures) {
  assertSampleOrdering(reviewFixture);
}

const small = fixtures.review_sample_fixtures.find((item) => item.case === "same_ratio_small_n");
const large = fixtures.review_sample_fixtures.find((item) => item.case === "same_ratio_large_n");
const effectiveFull = fixtures.review_sample_fixtures.find((item) => item.case === "same_ratio_effective_n_full");
const effectiveReduced = fixtures.review_sample_fixtures.find((item) => item.case === "same_ratio_effective_n_reduced");
const missingDenominator = fixtures.review_sample_fixtures.find((item) => item.case === "signal_count_without_denominator");

assert.equal(small.observed_positive / small.analyzed_sample_size, large.observed_positive / large.analyzed_sample_size);
const smallPosterior = analyzedPosterior(small);
const largePosterior = analyzedPosterior(large);
assert.ok(smallPosterior.variance > largePosterior.variance * 100, "small-n posterior must be materially wider");

assert.equal(
  effectiveFull.observed_positive / effectiveFull.analyzed_sample_size,
  effectiveReduced.observed_positive / effectiveReduced.analyzed_sample_size
);
assert.equal(effectiveFull.analyzed_sample_size, effectiveReduced.analyzed_sample_size);
assert.equal(effectiveFull.raw_source_sample_size, effectiveReduced.raw_source_sample_size);
assert.ok(effectiveReduced.effective_sample_size < effectiveFull.effective_sample_size);
const effectiveFullPosterior = effectivePosterior(effectiveFull);
const effectiveReducedPosterior = effectivePosterior(effectiveReduced);
assert.ok(
  effectiveReducedPosterior.variance > effectiveFullPosterior.variance,
  "lower effective n must produce higher posterior uncertainty at the same analyzed n and observed ratio"
);
assert.ok((effectiveReduced.uncertainty_floor_reasons ?? []).length >= 5);

assert.equal(missingDenominator.raw_source_sample_size, null);
assert.equal(missingDenominator.analyzed_sample_size, null);
assert.equal(missingDenominator.effective_sample_size, null);
assert.equal(missingDenominator.expected.prevalence_estimate_allowed, false);
assert.equal(missingDenominator.expected.prevalence_estimate, null);
assert.equal(missingDenominator.source, "hwahae");
assert.match(missingDenominator.expected.reason, /review_count is not assumed/i);

let productionRuntimePathsDelta = "not_evaluated_without_git_baseline";
if (hasCommit(BASE_SHA)) {
  const changedFiles = execFileSync("git", ["diff", "--name-only", `${BASE_SHA}..HEAD`], {
    cwd: ROOT,
    encoding: "utf8"
  }).split(/\r?\n/).filter(Boolean).sort();

  assert.deepEqual(changedFiles, [...ALLOWED_CHANGED_FILES].sort());

  const forbiddenRuntimePath = changedFiles.find((file) =>
    file.startsWith("app/")
    || file.startsWith("components/")
    || file.startsWith("lib/")
    || file.startsWith("supabase/migrations/")
    || file === "package.json"
    || file.startsWith(".github/workflows/")
  );
  assert.equal(forbiddenRuntimePath, undefined, `Production/runtime path changed: ${forbiddenRuntimePath}`);
  productionRuntimePathsDelta = "0";
}

console.log("PASS verify-product-evidence-decision-axis-v1");
console.log(`baseline=${BASE_SHA}`);
console.log(`frozen_corpus_sha256=${EXPECTED_CORPUS_SHA}`);
console.log(`products=${fixtures.products.length} fact_statuses=${fixtures.fact_statuses.length} axes=${fixtures.axis_keys.length}`);
console.log("independent_facts_conflict=false");
console.log("same_fact_conflict=evidence_conflict authoritative_value=null");
console.log(`posterior_variance_n5=${smallPosterior.variance.toFixed(8)} posterior_variance_n5000=${largePosterior.variance.toFixed(8)}`);
console.log(`effective_variance_n5000=${effectiveFullPosterior.variance.toFixed(8)} effective_variance_n100=${effectiveReducedPosterior.variance.toFixed(8)}`);
console.log("denominator_unavailable_prevalence=forbidden");
console.log("product_identity_state=separate_from_product_facts");
console.log(`production_runtime_paths_delta=${productionRuntimePathsDelta}`);
