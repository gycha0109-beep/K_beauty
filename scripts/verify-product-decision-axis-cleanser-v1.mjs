#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_MAIN_SHA, FUSION_SHA256, HISTORICAL_POC_ARTIFACT_BLOB, OUT_JSON, OUT_MD, buildTexts } from "./build-product-decision-axis-cleanser-v1.mjs";
import { FACT_KEYS, AXIS_KEYS, ESTIMATE_BOUNDS, makeAxisResult, mapCleanserDecisionAxes, validateBoundedEstimate } from "./product-evidence/product-decision-axis-cleanser-v1.mjs";
import { resolveProductCurrentFacts } from "./product-evidence/product-fact-current-resolver-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IDS = Object.freeze({
  BRMUD: "5448b8c3-cf87-4561-a699-3baf3dcb3dab",
  BEPLAIN: "cd3b66be-cddc-47e1-906f-a871dea84412",
  JUMISO: "3f83bb85-cc53-4aa0-a0f0-e08535288749",
  LRP: "cb04b777-9a57-4246-9431-3018638354db",
  MEDIHEAL: "51d526de-b127-47c4-83f1-64fc1ec4aa10",
  SENKA: "e6c3f88c-6908-401f-83d1-a5164f1dd60a",
});

function productById(output, id) {
  const product = output.products.find((item) => item.product_id === id);
  assert.ok(product, `missing product ${id}`);
  return product;
}
function fact(product, key) {
  const value = product.facts.find((item) => item.fact_key === key);
  assert.ok(value, `missing Fact ${key}`);
  return value;
}
function axis(product, key) {
  const value = product.axes.find((item) => item.axis_key === key);
  assert.ok(value, `missing axis ${key}`);
  return value;
}
function syntheticRow({ factKey, semanticStatus, value, authority = "product_specific_primary", confidence = "high", suffix = factKey }) {
  return {
    product_id: "synthetic-product",
    subject_id: "synthetic-subject",
    identity_status: "resolved",
    subject_current_state: "current",
    proposition_key: "a".repeat(64),
    fact_instance_id: `fact-${suffix}`,
    confirmation_id: `confirmation-${suffix}`,
    registry_version: "fixture-registry",
    fact_key: factKey,
    semantic_status: semanticStatus,
    value_type: semanticStatus === "supported" ? "boolean" : null,
    value_boolean: semanticStatus === "supported" ? value : null,
    value_enum: null,
    value_number: null,
    value_unit: null,
    value_range_min: null,
    value_range_max: null,
    value_entity_identifier: null,
    authority_ceiling: authority,
    fused_confidence: confidence,
    fusion_policy_version: "fixture-fusion",
    fusion_input_digest: suffix.padEnd(64, "a").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
  };
}

const currentMain = execFileSync("git", ["rev-parse", "refs/remotes/origin/main"], { cwd: ROOT, encoding: "utf8" }).trim();
assert.equal(currentMain, BASE_MAIN_SHA, "V2.1-5 main authority drift");
assert.equal(execFileSync("git", ["rev-parse", `${BASE_MAIN_SHA}:evidence/product-fact-fusion-v1/cleanser-evidence-fusion-review-uncertainty-v1.json`], { cwd: ROOT, encoding: "utf8" }).trim(), "f1563196d39277b1f133c8acd4a15e52d1e59d0b", "V2.1-4 fusion artifact blob drift");
assert.equal(execFileSync("git", ["rev-parse", `${BASE_MAIN_SHA}:evidence/product-evidence-decision-axis-v1/cleanser-poc-output-v1.json`], { cwd: ROOT, encoding: "utf8" }).trim(), HISTORICAL_POC_ARTIFACT_BLOB, "historical POC artifact drift");
assert.equal(execFileSync("sha256sum", ["evidence/product-fact-fusion-v1/cleanser-evidence-fusion-review-uncertainty-v1.json"], { cwd: ROOT, encoding: "utf8" }).trim().split(/\s+/)[0], FUSION_SHA256, "V2.1-4 fusion SHA-256 drift");

const { output, json, markdown } = buildTexts();
assert.equal(output.summary.products, 26);
assert.equal(output.summary.unique_fact_inputs, 52);
assert.equal(output.summary.axis_outputs, 104);
assert.equal(output.summary.numeric_estimates, 0, "uncalibrated real cleanser facts must not receive numeric Decision Axis magnitudes");
assert.equal(output.summary.null_estimates, 104);
assert.equal(output.summary.conflict_blocked_outputs, 0);
assert.equal(output.summary.missing_fact_outputs, 0);
assert.equal(output.summary.authority_limited_outputs, 2, "Mediheal deep-cleansing limited authority must limit two dependent axes");
assert.equal(output.summary.hosted_product_fact_writes, 0);

for (const product of output.products) {
  assert.equal(product.hosted_current, false);
  assert.equal(product.catalog_adopted, false);
  assert.equal(product.facts.length, FACT_KEYS.length);
  assert.deepEqual(product.axes.map((item) => item.axis_key), AXIS_KEYS);
  for (const item of product.axes) {
    assert.equal(item.mapper_version, "product-decision-axis-cleanser-v1");
    assert.match(item.mapper_input_digest, /^[0-9a-f]{64}$/);
    assert.ok(Array.isArray(item.reason_codes) && item.reason_codes.length > 0);
    assert.ok(Array.isArray(item.fact_inputs));
    if (item.estimate !== null) assert.ok(item.estimate >= ESTIMATE_BOUNDS.min && item.estimate <= ESTIMATE_BOUNDS.max);
  }
}

for (const id of [IDS.BEPLAIN, IDS.BRMUD, IDS.JUMISO]) {
  const product = productById(output, id);
  assert.equal(fact(product, "low_ph").semantic_status, "supported");
  assert.equal(fact(product, "low_ph").typed_value, true);
  assert.equal(fact(product, "deep_cleansing").semantic_status, "supported");
  assert.equal(fact(product, "deep_cleansing").typed_value, true);
  assert.equal(axis(product, "cleansing_burden").estimate, null);
  assert.equal(axis(product, "hydration_preservation").estimate, null);
  assert.equal(axis(product, "sebum_pore_control").estimate, null);
  assert.equal(axis(product, "irritation_burden").coverage, "no_relevant_fact");
}

const brmud = productById(output, IDS.BRMUD);
const brmudDeepInput = axis(brmud, "cleansing_burden").fact_inputs[0];
assert.deepEqual(brmudDeepInput.provenance.supporting_evidence, ["v21-4-brmud-official-deep-clean-001"]);
assert.ok(brmudDeepInput.provenance.context_evidence.includes("cfrv1-09-02"));
assert.equal(brmudDeepInput.authority_ceiling, "product_specific_primary");

const lrp = productById(output, IDS.LRP);
for (const key of ["low_ph", "deep_cleansing"]) {
  assert.equal(fact(lrp, key).semantic_status, "reviewed_not_established");
  assert.equal(fact(lrp, key).typed_value, null);
}
assert.equal(axis(lrp, "cleansing_burden").coverage, "insufficient_fact");
assert.ok(axis(lrp, "cleansing_burden").reason_codes.includes("reviewed_not_established_preserved_not_false"));
assert.equal(axis(lrp, "cleansing_burden").estimate, null);

const mediheal = productById(output, IDS.MEDIHEAL);
assert.equal(fact(mediheal, "deep_cleansing").authority_ceiling, "limited_non_product_specific");
for (const key of ["cleansing_burden", "sebum_pore_control"]) {
  assert.equal(axis(mediheal, key).coverage, "authority_limited");
  assert.equal(axis(mediheal, key).authority_ceiling, "limited_non_product_specific");
  assert.equal(axis(mediheal, key).estimate, null);
}

const beplain = productById(output, IDS.BEPLAIN);
const senka = productById(output, IDS.SENKA);
assert.equal(fact(beplain, "deep_cleansing").typed_value, true);
assert.equal(fact(senka, "deep_cleansing").typed_value, true);
assert.equal(axis(beplain, "cleansing_burden").estimate, null);
assert.equal(axis(senka, "cleansing_burden").estimate, null);
assert.equal(axis(beplain, "cleansing_burden").coverage, "claim_only");
assert.equal(axis(senka, "cleansing_burden").coverage, "claim_only");

const missingResolved = resolveProductCurrentFacts({ product_id: "synthetic-product", current_rows: [], fact_keys: FACT_KEYS });
const missingAxes = mapCleanserDecisionAxes(missingResolved);
assert.equal(missingResolved.facts.every((item) => item.presence === "missing_current" && item.typed_value === null), true);
for (const key of ["cleansing_burden", "hydration_preservation", "sebum_pore_control"]) {
  const item = missingAxes.find((value) => value.axis_key === key);
  assert.equal(item.coverage, "missing_fact");
  assert.equal(item.estimate, null);
  assert.ok(item.reason_codes.includes("current_fact_missing_not_false"));
}

const falseResolved = resolveProductCurrentFacts({
  product_id: "synthetic-product",
  current_rows: [
    syntheticRow({ factKey: "low_ph", semanticStatus: "supported", value: false, suffix: "b" }),
    syntheticRow({ factKey: "deep_cleansing", semanticStatus: "supported", value: false, suffix: "c" }),
  ],
  fact_keys: FACT_KEYS,
});
assert.equal(falseResolved.facts.every((item) => item.semantic_status === "supported" && item.typed_value === false), true);
const falseAxes = mapCleanserDecisionAxes(falseResolved);
for (const key of ["cleansing_burden", "hydration_preservation", "sebum_pore_control"]) {
  const item = falseAxes.find((value) => value.axis_key === key);
  assert.equal(item.coverage, "explicit_negative_fact");
  assert.equal(item.estimate, null);
  assert.ok(item.reason_codes.includes("supported_false_preserved_as_explicit_negative_fact"));
}

const conflictResolved = resolveProductCurrentFacts({
  product_id: "synthetic-product",
  current_rows: [
    syntheticRow({ factKey: "low_ph", semanticStatus: "evidence_conflict", value: null, authority: "product_specific_primary", confidence: "unknown", suffix: "d" }),
    syntheticRow({ factKey: "deep_cleansing", semanticStatus: "evidence_conflict", value: null, authority: "product_specific_primary", confidence: "unknown", suffix: "e" }),
  ],
  fact_keys: FACT_KEYS,
});
const conflictAxes = mapCleanserDecisionAxes(conflictResolved);
for (const key of ["cleansing_burden", "hydration_preservation", "sebum_pore_control"]) {
  const item = conflictAxes.find((value) => value.axis_key === key);
  assert.equal(item.coverage, "conflict_blocked");
  assert.equal(item.estimate, null);
  assert.ok(item.reason_codes.includes("evidence_conflict_not_resolved_by_mapper"));
}

const limitedFact = falseResolved.facts.find((item) => item.fact_key === "deep_cleansing");
limitedFact.authority_ceiling = "limited_non_product_specific";
assert.throws(() => makeAxisResult({ productId: "synthetic-product", axisKey: "cleansing_burden", estimate: null, coverage: "claim_only", authorityCeiling: "product_specific_primary", reasonCodes: ["fixture"], facts: [limitedFact] }), /axis authority exceeds input Fact authority/);
assert.throws(() => validateBoundedEstimate(-0.01), /out of bounds/);
assert.throws(() => validateBoundedEstimate(1.01), /out of bounds/);
for (const estimate of [0, 1]) assert.equal(validateBoundedEstimate(estimate), estimate);
assert.throws(() => makeAxisResult({ productId: "synthetic-product", axisKey: "cleansing_burden", estimate: 0.5, coverage: "direct_measurement", authorityCeiling: "none", reasonCodes: ["fixture"], facts: [] }), /numeric magnitude is not calibrated/);

assert.throws(() => resolveProductCurrentFacts({
  product_id: "synthetic-product",
  current_rows: [
    syntheticRow({ factKey: "low_ph", semanticStatus: "supported", value: true, suffix: "f" }),
    syntheticRow({ factKey: "low_ph", semanticStatus: "supported", value: true, suffix: "1" }),
  ],
  fact_keys: FACT_KEYS,
}), /multiple Current Facts for low_ph/);

const first = buildTexts();
const second = buildTexts();
assert.equal(first.json, second.json, "V2.1-5 JSON build must be byte deterministic");
assert.equal(first.markdown, second.markdown, "V2.1-5 markdown build must be byte deterministic");
if (fs.existsSync(OUT_JSON)) assert.equal(fs.readFileSync(OUT_JSON, "utf8"), json, "committed/generated JSON drift");
if (fs.existsSync(OUT_MD)) assert.equal(fs.readFileSync(OUT_MD, "utf8"), markdown, "committed/generated markdown drift");

const changed = execFileSync("git", ["diff", "--name-only", `${BASE_MAIN_SHA}..HEAD`], { cwd: ROOT, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
const productionPath = changed.find((name) => name.startsWith("app/") || name.startsWith("components/") || name.startsWith("lib/") || name.startsWith("supabase/migrations/") || name === "package.json");
assert.equal(productionPath, undefined, `Production/runtime path changed: ${productionPath}`);

console.log("PASS verify-product-decision-axis-cleanser-v1");
console.log(`main=${BASE_MAIN_SHA}`);
console.log(`fusion_sha256=${FUSION_SHA256}`);
console.log(`products=${output.summary.products} fact_inputs=${output.summary.unique_fact_inputs} axis_outputs=${output.summary.axis_outputs}`);
console.log(`numeric_estimates=${output.summary.numeric_estimates} null_estimates=${output.summary.null_estimates}`);
console.log(`authority_limited=${output.summary.authority_limited_outputs} conflict_blocked=${output.summary.conflict_blocked_outputs} missing_fact=${output.summary.missing_fact_outputs}`);
console.log("beplain=PASS brmud=PASS jumiso=PASS lrp=PASS mediheal_authority=PASS beplain_vs_senka_non_invention=PASS");
console.log("missing_not_false=PASS supported_false_distinct=PASS conflict_fail_closed=PASS bounds=PASS authority_no_inflation=PASS");
console.log("decision_axis_consumption=NO recommendation_activation=NO hosted_product_fact_writes=0");
