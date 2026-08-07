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

function posterior(fixture) {
  assert.equal(typeof fixture.observed_positive, "number");
  assert.equal(typeof fixture.analyzed_sample_size, "number");
  const failures = fixture.analyzed_sample_size - fixture.observed_positive;
  const alpha = fixture.prior.alpha + fixture.observed_positive;
  const beta = fixture.prior.beta + failures;
  return { alpha, beta, mean: alpha / (alpha + beta), variance: betaVariance(alpha, beta) };
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
  "absence of a fact != false",
  "Beta-Binomial",
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
  "evidence_insufficient"
]);
assert.deepEqual(fixtures.axis_keys, [
  "cleansing_burden",
  "hydration_preservation",
  "irritation_burden",
  "sebum_pore_control"
]);

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
  for (const productFact of productFixture.facts) {
    assert.ok(productFact.fact_key);
    assert.ok(["boolean", "string", "number"].includes(productFact.value_type));
    assert.ok(fixtures.fact_statuses.includes(productFact.status));
    for (const evidenceId of productFact.support_evidence_ids ?? []) {
      assert.ok(sourceEvidence.has(evidenceId), `${productFixture.case}.${productFact.fact_key}: support evidence missing ${evidenceId}`);
    }
  }
}

for (const caseName of ["beplain_multi_fact", "brmud_multi_fact_cross_source", "jumiso_multi_fact"]) {
  const product = fixtureByCase.get(caseName);
  assert.equal(fact(product, "low_ph")?.status, "supported");
  assert.equal(fact(product, "low_ph")?.value, true);
  assert.equal(fact(product, "deep_cleansing")?.status, "supported");
  assert.equal(fact(product, "deep_cleansing")?.value, true);
}

const laroche = fixtureByCase.get("laroche_partial_knowledge");
assert.equal(fact(laroche, "product_identity_match")?.status, "supported");
assert.equal(fact(laroche, "product_identity_match")?.value, "exact_official_product");
assert.equal(fact(laroche, "low_ph")?.status, "reviewed_not_established");
assert.equal(fact(laroche, "deep_cleansing")?.status, "reviewed_not_established");
assert.ok(laroche.facts.some((item) => item.status === "supported"));
assert.ok(laroche.facts.some((item) => item.status === "reviewed_not_established"));

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

const small = fixtures.review_sample_fixtures.find((item) => item.case === "same_ratio_small_n");
const large = fixtures.review_sample_fixtures.find((item) => item.case === "same_ratio_large_n");
const missingDenominator = fixtures.review_sample_fixtures.find((item) => item.case === "signal_count_without_denominator");
assert.equal(small.observed_positive / small.analyzed_sample_size, large.observed_positive / large.analyzed_sample_size);
const smallPosterior = posterior(small);
const largePosterior = posterior(large);
assert.ok(smallPosterior.variance > largePosterior.variance * 100, "small-n posterior must be materially wider");
assert.equal(missingDenominator.analyzed_sample_size, null);
assert.equal(missingDenominator.expected.prevalence_estimate_allowed, false);
assert.equal(missingDenominator.expected.prevalence_estimate, null);
assert.equal(missingDenominator.source, "hwahae");
assert.match(missingDenominator.expected.reason, /review_count is not assumed/i);

if (hasCommit(BASE_SHA)) {
  const changedFiles = execFileSync("git", ["diff", "--name-only", `${BASE_SHA}..HEAD`], {
    cwd: ROOT,
    encoding: "utf8"
  }).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changedFiles, [
    "docs/architecture/product-evidence-decision-axis-v1.md",
    "evidence/product-evidence-decision-axis-v1/cleanser-poc-fixtures.json",
    "scripts/verify-product-evidence-decision-axis-v1.mjs"
  ]);
}

console.log("PASS verify-product-evidence-decision-axis-v1");
console.log(`baseline=${BASE_SHA}`);
console.log(`frozen_corpus_sha256=${EXPECTED_CORPUS_SHA}`);
console.log(`products=${fixtures.products.length} fact_statuses=${fixtures.fact_statuses.length} axes=${fixtures.axis_keys.length}`);
console.log(`posterior_variance_n5=${smallPosterior.variance.toFixed(8)} posterior_variance_n5000=${largePosterior.variance.toFixed(8)}`);
console.log("denominator_unavailable_prevalence=forbidden");
console.log("production_runtime_paths_delta=0");
