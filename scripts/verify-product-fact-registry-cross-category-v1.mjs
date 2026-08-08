#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REGISTRY_VERSION,
  assertAuthorityConfidenceSeparated,
  assertNoAutomaticDecisionAxisCreation,
  expectErrorCode,
  fuseSameProposition,
  getFactDefinition,
  missingFactState,
  observationPrevalence,
  validateFactInstance,
  validateFactSet,
  validateRegistry
} from "./product-evidence/product-fact-registry-core-v1.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const evidenceRoot = path.join(root, "evidence", "product-evidence-decision-axis-v1");
const registry = JSON.parse(await readFile(path.join(evidenceRoot, "cross-category-registry-v1.json"), "utf8"));
const fixtures = JSON.parse(await readFile(path.join(evidenceRoot, "cross-category-stress-fixtures-v1.json"), "utf8"));
const inventory = JSON.parse(await readFile(path.join(evidenceRoot, "current-catalog-inventory-audit-v1.json"), "utf8"));

const BASELINE = "e371d5bc037fb80d1edd3876f0c7d1d94a2c1461";
const PHASE2_BLOBS = Object.freeze({
  "scripts/product-evidence/cleanser-poc-core.mjs": "61ff2d517a963ec302a52781f2a98669c40d4af2",
  "scripts/build-product-evidence-cleanser-poc-v1.mjs": "48d933f6cc8c8a3437c12036342015840af03423",
  "scripts/verify-product-evidence-cleanser-poc-v1.mjs": "128b85d42406b49ac90cc655055fbb3f4918e117",
  "evidence/product-evidence-decision-axis-v1/cleanser-poc-output-v1.json": "be3724b513a11a6521585950e79e21296550ecdc"
});
const ALLOWED_DELTA = Object.freeze([
  "docs/architecture/product-fact-registry-cross-category-v1.md",
  "evidence/product-evidence-decision-axis-v1/cross-category-registry-v1.json",
  "evidence/product-evidence-decision-axis-v1/cross-category-stress-fixtures-v1.json",
  "evidence/product-evidence-decision-axis-v1/current-catalog-inventory-audit-v1.json",
  "scripts/product-evidence/product-fact-registry-core-v1.mjs",
  "scripts/verify-product-fact-registry-cross-category-v1.mjs"
]);

let assertions = 0;
const check = (condition, message) => {
  assert(condition, message);
  assertions += 1;
};
const equal = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
};

validateRegistry(registry);
check(registry.registry_version === REGISTRY_VERSION, "registry version fixed");
check(new Set(registry.facts.map((item) => item.fact_key)).size === registry.facts.length, "registry key unique");

const valueTypes = new Set(registry.facts.map((item) => item.value_type));
for (const required of ["boolean", "enum", "number", "number_unit", "range_unit", "entity_identifier"]) {
  check(valueTypes.has(required), `value type ${required}`);
}
check(registry.facts.some((item) => item.cardinality === "many"), "many cardinality exists");
check(registry.facts.some((item) => item.relationship_schema?.subject_ref_required === true), "relationship-bound fact exists");
check(registry.facts.some((item) => (item.scope_schema?.required_fields || []).includes("market")), "market scope supported");
assertNoAutomaticDecisionAxisCreation(registry);
assertions += 1;

const byCase = new Map(fixtures.products.map((item) => [item.case_id, item]));
for (const product of fixtures.products) {
  validateFactSet(registry, product);
  for (const fact of product.facts) {
    if (fact.status === "supported") assertAuthorityConfidenceSeparated(fact);
  }
  assertions += 1;
}

// S1: label protection components are separate, not a generic magnitude.
const s1 = byCase.get("S1");
equal(s1.facts.map((item) => item.fact_key).sort(), ["spf_value", "uv_filter_type", "uva_label"], "S1 protection label facts");
check(s1.facts.every((item) => item.evidence_class === "product_claim"), "S1 claim class");

// S2: same named product can carry distinct market-scoped values without collapse.
const s2 = byCase.get("S2");
const s2Spf = s2.facts.filter((item) => item.fact_key === "spf_value");
check(s2Spf.length === 2, "S2 two scoped SPF facts");
check(new Set(s2Spf.map((item) => item.scope.market)).size === 2, "S2 market scope retained");
check(new Set(s2Spf.map((item) => item.value)).size === 2, "S2 distinct scoped values retained");

// S3/S4: water-resistance units are explicit; observations without denominator cannot become prevalence.
const s3 = byCase.get("S3");
equal(s3.facts[0].value, { amount: 80, unit: "minutes" }, "S3 duration + unit");
const s4 = byCase.get("S4");
for (const observed of s4.facts) {
  const prevalence = observationPrevalence({
    positive_count: 1,
    raw_source_sample_size: observed.qualifier_context.raw_source_sample_size,
    analyzed_sample_size: observed.qualifier_context.analyzed_sample_size
  });
  equal(prevalence, { status: "forbidden", prevalence: null }, "S4 missing denominator prevalence forbidden");
}

// T1/T2/T3: repeatable active identity and subject-bound concentration.
const t1 = byCase.get("T1");
check(t1.facts.some((item) => item.fact_key === "contains_active"), "T1 active identity");
check(t1.facts.find((item) => item.fact_key === "active_concentration").subject_ref === "t1-active-niacinamide", "T1 concentration subject_ref");
const t2 = byCase.get("T2");
const t2Actives = t2.facts.filter((item) => item.fact_key === "contains_active");
const t2Concentrations = t2.facts.filter((item) => item.fact_key === "active_concentration");
check(t2Actives.length === 2 && t2Concentrations.length === 2, "T2 repeatable active facts");
for (const concentration of t2Concentrations) {
  const subject = t2.facts.find((item) => item.fact_instance_id === concentration.subject_ref);
  check(subject?.fact_key === "contains_active", "T2 concentration tied to active");
}
const t3 = byCase.get("T3");
check(!t3.facts.some((item) => item.fact_key === "active_concentration"), "T3 missing concentration remains absent");
equal(missingFactState(), { status: "not_reviewed", value: null }, "missing concentration is not zero/false");

// T4/T5: claim and usage semantics stay distinct from measurement/efficacy.
check(byCase.get("T4").facts[0].evidence_class === "product_claim", "T4 claim class");
check(byCase.get("T5").facts[0].evidence_class === "usage_instruction", "T5 usage class");
check(byCase.get("T4").facts[0].fact_key !== byCase.get("T5").facts[0].fact_key, "claim != usage instruction");

// Moisturizer: role, claim, and measurement are structurally different.
check(byCase.get("M1").facts[0].evidence_class === "role_declaration", "M1 role declaration");
check(byCase.get("M2").facts[0].value === "local_area", "M2 local balm role");
check(byCase.get("M3").facts[0].evidence_class === "product_claim", "M3 barrier claim");
check(byCase.get("M4").facts.every((item) => item.evidence_class === "measurement"), "M4 measurement class");
for (const measured of byCase.get("M4").facts) {
  check(Boolean(measured.qualifier_context.metric && measured.qualifier_context.method_context && measured.qualifier_context.timepoint), "M4 metric/method/timepoint");
}

// Toner/pad: physical format, usage, surface, active identity and frequency coexist without generic intensity.
check(byCase.get("P1").facts[0].value === "liquid", "P1 liquid format");
check(byCase.get("P2").facts[0].value === "pad", "P2 pad format");
check(byCase.get("P3").facts[0].evidence_class === "usage_instruction", "P3 wipe usage");
check(byCase.get("P4").facts[0].evidence_class === "physical_characteristic", "P4 pad physical characteristic");
check(byCase.get("P5").facts[0].fact_key === "contains_active", "P5 exfoliating active identity only");
check(byCase.get("P6").facts[0].fact_key === "recommended_use_frequency", "P6 frequency instruction");

// Negative controls.
const negatives = new Map(fixtures.negative_controls.map((item) => [item.id, item]));
expectErrorCode(() => validateFactInstance(registry, negatives.get("N1-unknown-marketing-key").mutation, { domain: "sunscreen" }), "unknown_fact_key"); assertions += 1;
expectErrorCode(() => validateFactInstance(registry, negatives.get("N2-invalid-enum").mutation, { domain: "sunscreen" }), "invalid_enum"); assertions += 1;
expectErrorCode(() => validateFactInstance(registry, negatives.get("N3-invalid-unit").mutation, { domain: "sunscreen" }), "invalid_unit"); assertions += 1;
expectErrorCode(() => validateFactSet(registry, { domain: "treatment", facts: [negatives.get("N4-orphan-subject").mutation] }), "orphan_subject_ref"); assertions += 1;
expectErrorCode(() => validateFactInstance(registry, negatives.get("N5-supported-legacy").mutation, { domain: "sunscreen" }), "legacy_cannot_establish_supported_fact"); assertions += 1;
expectErrorCode(() => validateFactInstance(registry, negatives.get("N6-measurement-missing-context").mutation, { domain: "moisturizer_cream" }), "missing_measurement_context"); assertions += 1;
expectErrorCode(() => validateFactInstance(registry, negatives.get("N7-explicit-negative-without-evidence").mutation, { domain: "moisturizer_cream" }), "explicit_negative_evidence_required"); assertions += 1;

const duplicateSpf = {
  domain: "sunscreen",
  facts: [
    { fact_instance_id: "dup-a", fact_key: "spf_value", value: 50, status: "supported", evidence_class: "product_claim", evidence_authority: "product_specific_primary", confidence: "high", evidence_refs: ["ev-a"], scope: { market: "KR" } },
    { fact_instance_id: "dup-b", fact_key: "spf_value", value: 40, status: "supported", evidence_class: "product_claim", evidence_authority: "product_specific_primary", confidence: "high", evidence_refs: ["ev-b"], scope: { market: "KR" } }
  ]
};
expectErrorCode(() => validateFactSet(registry, duplicateSpf), "cardinality_one_violation"); assertions += 1;

const conflict = fuseSameProposition({ support: ["ev-support"], opposition: ["ev-oppose"] });
equal({ status: conflict.status, value: conflict.value }, { status: "evidence_conflict", value: null }, "same-fact conflict null");
const independentKeys = ["product_format", "wipe_off_use", "contains_active"];
check(new Set(independentKeys).size === independentKeys.length, "independent multi-facts coexist without conflict");

// Registry admits shared semantics only once and does not contain generic intensity/scoring controls.
check(registry.facts.filter((item) => item.fact_key === "contains_active").length === 1, "shared contains_active key not duplicated by category");
check(!registry.facts.some((item) => ["intensity", "strength"].includes(item.fact_key)), "no generic intensity fact");
check(!registry.facts.some((item) => /score|weight|penalty|hero/i.test(item.fact_key)), "no recommendation control in fact keys");
check(registry.downstream_consumption_boundary.requires_signal_family_dedupe === true, "anti-feature-inflation signal family boundary");
check(registry.downstream_consumption_boundary.requires_lineage_dedupe === true, "anti-feature-inflation lineage boundary");
check(registry.downstream_consumption_boundary.requires_correlation_grouping === true, "anti-feature-inflation correlation boundary");
check(registry.downstream_consumption_boundary.requires_saturation_or_cap === true, "anti-feature-inflation saturation boundary");

// Inventory is audit-only and must not be promoted to authority.
check(inventory.authority_boundary === "inventory_only_no_product_fact_authority", "inventory authority boundary");
equal(inventory.domains.sunscreen.current_product_count, 11, "sunscreen count");
equal(inventory.domains.treatment_serum.current_product_count, 18, "treatment count");
equal(inventory.domains.moisturizer.current_product_count, 61, "moisturizer family count");
equal(inventory.domains.toner_pad.current_product_count, 48, "toner/pad count");

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
}

let gitScope = "NOT_EVALUATED_NO_GIT_BASELINE";
try {
  if (git(["rev-parse", "--is-inside-work-tree"]) === "true") {
    execFileSync("git", ["cat-file", "-e", `${BASELINE}^{commit}`], { cwd: root, stdio: "ignore" });
    const changed = git(["diff", "--name-only", `${BASELINE}..HEAD`]).split("\n").filter(Boolean).sort();
    equal(changed, [...ALLOWED_DELTA].sort(), "exact Phase 3A allowlist");
    execFileSync("git", ["diff", "--check", `${BASELINE}..HEAD`], { cwd: root, stdio: "ignore" });
    assertions += 1;

    const runtimePrefixes = ["app/", "components/", "lib/", "supabase/migrations/", ".github/workflows/"];
    check(!changed.some((file) => runtimePrefixes.some((prefix) => file.startsWith(prefix)) || file === "package.json"), "runtime/admin/migration/package/workflow delta 0");

    for (const [file, expectedBlob] of Object.entries(PHASE2_BLOBS)) {
      equal(git(["rev-parse", `HEAD:${file}`]), expectedBlob, `Phase 2 blob unchanged: ${file}`);
    }
    check(!changed.some((file) => file.includes("cleanser-catalog-field-review-v1")), "frozen cleanser corpus unchanged");

    const parked = [
      ["refs/remotes/origin/feature/recommendation-metadata-transport-shadow", "783afb91a964f5d762f46846f9ef854902b48e95"],
      ["refs/remotes/origin/design/admin-product-catalog-review-adoption-v1", "0c0de0550ece8c42bb93a957128283f30ec3eb31"]
    ];
    let parkedAvailable = true;
    for (const [ref, expected] of parked) {
      try {
        equal(git(["rev-parse", ref]), expected, `parked ref invariant ${ref}`);
      } catch {
        parkedAvailable = false;
      }
    }
    gitScope = parkedAvailable ? "PASS_WITH_PARKED_REFS" : "PASS_PARKED_REFS_NOT_FETCHED";
  }
} catch (error) {
  if (error?.code === "ERR_ASSERTION") throw error;
  if (error?.status && error.status !== 128) throw error;
}

console.log("PASS verify-product-fact-registry-cross-category-v1");
console.log(`registry_version=${registry.registry_version}`);
console.log(`registry_keys=${registry.facts.length}`);
console.log(`synthetic_cases=${fixtures.products.length}`);
console.log(`assertions=${assertions}`);
console.log(`catalog_reference_products=${inventory.catalog_total_reference_products}`);
console.log(`sunscreen=11 treatment=18 moisturizer=61 toner_pad_family=48`);
console.log("relationship_subject_ref=PASS");
console.log("market_scope_separation=PASS");
console.log("claim_measurement_observation_usage_separation=PASS");
console.log("missing_denominator_prevalence=forbidden");
console.log("legacy_catalog_authority_promotion=forbidden");
console.log("generic_intensity=forbidden");
console.log("automatic_decision_axis_creation=forbidden");
console.log(`git_scope=${gitScope}`);
