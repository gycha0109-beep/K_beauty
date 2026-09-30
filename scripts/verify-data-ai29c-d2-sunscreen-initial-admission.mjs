#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_INITIAL_ADMISSION_GRANT_SEMANTICS,
  SUNSCREEN_INITIAL_ADMISSION_POLICY_VERSION,
  evaluateSunscreenInitialAdmissionGrant,
} from "../lib/sunscreen-initial-admission-grant-policy.mjs";
import {
  CATEGORY_CLASSIFICATION,
} from "./product-evidence/initial-admission-grant-policy-v1.mjs";

const AUTHORITY_FIXTURE_PATH =
  "fixtures/data-ai29c-d2-sunscreen-initial-admission-v1.json";
const SEMANTIC_FIXTURE_PATH =
  "fixtures/data-ai29c-d1b-sunscreen-semantic-projection-v1.json";

const authorityFixture = JSON.parse(
  fs.readFileSync(AUTHORITY_FIXTURE_PATH, "utf8"),
);
const semanticFixture = JSON.parse(
  fs.readFileSync(SEMANTIC_FIXTURE_PATH, "utf8"),
);

const semanticByProduct = new Map(
  semanticFixture.products.map((bundle) => [bundle.productId, bundle]),
);

function clone(value) {
  return structuredClone(value);
}

function buildInput(row) {
  const semanticTemplate = semanticByProduct.get(row.product.id);
  assert.ok(semanticTemplate, `missing D1B semantic fixture for ${row.product.id}`);
  const semanticBundle = clone(semanticTemplate);
  semanticBundle.subjectId = row.subject.subjectId;

  return {
    product: clone(row.product),
    taxonomy: clone(row.taxonomy),
    subject: clone(row.subject),
    registry: clone(row.registry),
    currentFacts: clone(row.currentFacts),
    semanticBundle,
  };
}

function expectGrant(input) {
  const result = evaluateSunscreenInitialAdmissionGrant(input);
  assert.equal(result.grant, true, result.reasons?.join(","));
  assert.equal(result.decision, "SUNSCREEN_INITIAL_ADMISSION_GRANT");
  assert.equal(result.policyVersion, SUNSCREEN_INITIAL_ADMISSION_POLICY_VERSION);
  return result;
}

function expectNoGrant(input, reasonFragment) {
  const result = evaluateSunscreenInitialAdmissionGrant(input);
  assert.equal(result.grant, false);
  assert.equal(result.decision, "NO_GRANT");
  assert.ok(
    result.reasons.some((reason) => reason.includes(reasonFragment)),
    `${reasonFragment} not found in ${result.reasons.join(",")}`,
  );
  return result;
}

assert.equal(authorityFixture.observedFromProduction, true);
assert.equal(authorityFixture.productCount, 5);
assert.equal(authorityFixture.products.length, 5);
assert.equal(semanticFixture.product_count, 5);

// D2-1: all five D1 primary products have enough governed authority for a
// sunscreen-specific initial admission grant.
for (const row of authorityFixture.products) {
  const input = buildInput(row);
  const result = expectGrant(input);
  assert.equal(input.currentFacts.length, 3);
  assert.deepEqual(
    input.currentFacts.map((fact) => fact.factKey).sort(),
    ["spf_value", "uv_filter_type", "uva_label"],
  );
  assert.equal(result.semantics.productionAdmissionGateWired, false);
}

// D2-2: SPF, UVA and UV filter are independently mandatory.
for (const factKey of ["spf_value", "uva_label", "uv_filter_type"]) {
  const input = buildInput(authorityFixture.products[0]);
  input.currentFacts = input.currentFacts.filter(
    (fact) => fact.factKey !== factKey,
  );
  expectNoGrant(input, `REQUIRED_CURRENT_FACT_MISSING:${factKey}`);
}

// D2-3: water resistance is not an admission requirement and remains HOLD.
{
  const input = buildInput(authorityFixture.products[0]);
  assert.equal(
    input.currentFacts.some((fact) => fact.factKey === "water_resistance_duration"),
    false,
  );
  expectGrant(input);
}

// D2-4: taxonomy is canonical and sunscreen-specific; Product.category null is
// not promoted into authority.
{
  const input = buildInput(authorityFixture.products[0]);
  input.taxonomy.categoryTermId = "catalog-taxonomy-v1:category:cleanser";
  expectNoGrant(input, "CANONICAL_SUNSCREEN_TAXONOMY_UNRESOLVED");
}
{
  const input = buildInput(authorityFixture.products[0]);
  input.taxonomy.productId = "00000000-0000-4000-8000-000000000001";
  expectNoGrant(input, "CANONICAL_SUNSCREEN_TAXONOMY_UNRESOLVED");
}
{
  const input = buildInput(authorityFixture.products[0]);
  input.taxonomy.assignmentState = "active";
  expectNoGrant(input, "CANONICAL_SUNSCREEN_TAXONOMY_UNRESOLVED");
}

// D2-5: Subject and Product Fact lineage fail closed.
{
  const input = buildInput(authorityFixture.products[0]);
  input.subject.currentState = "superseded";
  expectNoGrant(input, "PRODUCT_FACT_SUBJECT_UNRESOLVED_OR_NON_CURRENT");
}
{
  const input = buildInput(authorityFixture.products[0]);
  input.currentFacts[0].authorityCeiling = "aggregate_secondary";
  expectNoGrant(input, "REQUIRED_CURRENT_FACT_AUTHORITY_INCOMPLETE:spf_value");
}
{
  const input = buildInput(authorityFixture.products[0]);
  input.currentFacts[0].valueType = "enum";
  expectNoGrant(input, "REQUIRED_CURRENT_FACT_VALUE_INVALID:spf_value");
}
{
  const input = buildInput(authorityFixture.products[0]);
  input.currentFacts[0].validTo = "2020-01-01";
  expectNoGrant(input, "REQUIRED_CURRENT_FACT_AUTHORITY_INCOMPLETE:spf_value");
}
{
  const input = buildInput(authorityFixture.products[0]);
  input.registry.registryChecksum = "0".repeat(64);
  expectNoGrant(input, "PRODUCT_FACT_REGISTRY_MISMATCH");
}
{
  const input = buildInput(authorityFixture.products[0]);
  input.registry.identitySerializerVersion = "unsupported-v2";
  expectNoGrant(input, "PRODUCT_FACT_REGISTRY_MISMATCH");
}

// D2-6: D1B envelope is required, but unresolved optional semantics do not
// become false/default values and do not block admission by themselves.
{
  const physical = authorityFixture.products.find(
    (row) => row.product.name === "Physical Daily Sunmilk",
  );
  const input = buildInput(physical);
  assert.equal(input.semanticBundle.fields.sensitivity_safe.state, "conflict");
  assert.equal(input.semanticBundle.fields.pilling_risk.state, "conflict");
  expectGrant(input);
}
{
  const input = buildInput(authorityFixture.products[0]);
  input.semanticBundle.fields.category_slot.state = "not_reviewed";
  input.semanticBundle.fields.category_slot.value = null;
  expectNoGrant(input, "SUNSCREEN_RECOMMENDATION_SEMANTIC_ENVELOPE_NOT_READY");
}

// D2-7: semantic UV filter must agree with governed Current Product Fact.
{
  const input = buildInput(authorityFixture.products[0]);
  input.semanticBundle.fields.uv_filter_type.value = "organic";
  expectNoGrant(input, "SUNSCREEN_UV_FILTER_SEMANTIC_FACT_MISMATCH");
}

// D2-8: generic initial-admission v1 remains unchanged and sunscreen-specific
// authority does not silently widen it.
assert.equal(
  CATEGORY_CLASSIFICATION.sunscreen,
  "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT",
);

// D2-9: production runtime is intentionally not wired in this stage.
const candidateAdmissionCore = fs.readFileSync(
  "lib/recommendation-candidate-admission-core.mjs",
  "utf8",
);
const productSource = fs.readFileSync("lib/product-source.js", "utf8");
assert.equal(
  candidateAdmissionCore.includes("SUNSCREEN_INITIAL_ADMISSION_GRANT"),
  false,
  "D2 must not wire sunscreen grants into Production candidate admission",
);
assert.equal(
  productSource.includes("sunscreen-initial-admission-grant-policy-v1"),
  false,
  "D2 must not mutate Product-source admission or projection",
);

for (const [key, expected] of Object.entries({
  createsInitialCandidateAuthorityOnly: true,
  productionAdmissionGateWired: false,
  impliesSafety: false,
  impliesEfficacy: false,
  impliesRecommendation: false,
  impliesHighScore: false,
  impliesTopPick: false,
  bypassesSemanticContextGate: false,
  bypassesHardReject: false,
  modifiesScoring: false,
  modifiesProductionRanking: false,
  authorizesOutdoorRankableSignal: false,
  authorizesPublicActivation: false,
})) {
  assert.equal(
    SUNSCREEN_INITIAL_ADMISSION_GRANT_SEMANTICS[key],
    expected,
    `grant semantic mismatch: ${key}`,
  );
}

console.log(
  "DATA_AI29C_D2_SUNSCREEN_INITIAL_ADMISSION=PASS products=5 grants=5 production_runtime_wired=0 water_required=0",
);
