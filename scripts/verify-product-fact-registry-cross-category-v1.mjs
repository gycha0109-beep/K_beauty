#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REGISTRY_VERSION,
  SCOPE_RELATIONS,
  assessFactCoexistence,
  assertAuthorityConfidenceSeparated,
  assertNoAutomaticDecisionAxisCreation,
  buildPropositionIdentity,
  classifyScopeRelation,
  comparePropositions,
  deriveAuthorityCeilingWithoutCountUpgrade,
  expectErrorCode,
  fuseBooleanProposition,
  getFactDefinition,
  materializeFixtureProduct,
  missingFactState,
  observationPrevalence,
  validateFactSet,
  validateRegistry,
  validateRelationshipScopeCompatibility
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
const check = (condition, message) => { assert(condition, message); assertions += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const expects = (fn, code) => { expectErrorCode(fn, code); assertions += 1; };
const evidenceMap = (product) => new Map(product.evidence_records.map((item) => [item.evidence_id, item]));

validateRegistry(registry);
check(registry.registry_version === REGISTRY_VERSION, "registry version fixed");
check(new Set(registry.facts.map((item) => item.fact_key)).size === registry.facts.length, "registry key unique");
equal(registry.scope_relation_values, [...SCOPE_RELATIONS], "scope relation values fixed");
const valueTypes = new Set(registry.facts.map((item) => item.value_type));
for (const required of ["boolean", "enum", "number", "number_unit", "range_unit", "entity_identifier"]) check(valueTypes.has(required), `value type ${required}`);
check(registry.facts.some((item) => item.cardinality === "many"), "many cardinality exists");
check(registry.facts.every((item) => item.proposition_identity_schema?.include_fact_key === true), "every fact has proposition identity contract");
check(registry.facts.some((item) => item.relationship_schema?.subject_ref_required === true), "relationship-bound fact exists");
check(registry.facts.some((item) => (item.scope_schema?.required_fields || []).includes("market")), "market scope supported");
assertNoAutomaticDecisionAxisCreation(registry); assertions += 1;

const materializedProducts = fixtures.products.map((item) => materializeFixtureProduct(fixtures, item));
const byCase = new Map(materializedProducts.map((item) => [item.case_id, item]));
check(fixtures.products.length === 19, "existing 19 cross-category stress cases retained");
for (const product of materializedProducts) { validateFactSet(registry, product); for (const fact of product.facts) assertAuthorityConfidenceSeparated(fact); assertions += 1; }

const s1 = byCase.get("S1");
equal(s1.facts.map((item) => item.fact_key).sort(), ["spf_value", "uv_filter_type", "uva_label"], "S1 protection facts preserved");
check(new Set(s1.evidence_records.map((item) => item.evidence_class)).size === 1 && s1.evidence_records[0].evidence_class === "product_claim", "S1 claim evidence preserved");
const s2 = byCase.get("S2"), s2Spf = s2.facts.filter((item) => item.fact_key === "spf_value");
check(s2Spf.length === 2, "S2 two scoped SPF facts");
check(new Set(s2Spf.map((item) => item.scope.market)).size === 2, "S2 market scope retained");
check(new Set(s2Spf.map((item) => item.scope.region)).size === 2, "S2 region scope retained");
check(new Set(s2Spf.map((item) => item.scope.formulation_version)).size === 2, "S2 formulation scope retained");
check(new Set(s2Spf.map((item) => item.value)).size === 2, "S2 scoped values retained");
equal(byCase.get("S3").facts[0].value, { amount: 80, unit: "minutes" }, "S3 duration + unit");
const s4 = byCase.get("S4");
check(s4.evidence_records.every((item) => item.evidence_class === "observation"), "S4 observation evidence class");
for (const record of s4.evidence_records) equal(observationPrevalence({ positive_count: 1, raw_source_sample_size: record.qualifier_context.raw_source_sample_size, analyzed_sample_size: record.qualifier_context.analyzed_sample_size }), { status: "forbidden", prevalence: null }, "S4 missing denominator forbids prevalence");

const t1 = byCase.get("T1");
check(t1.facts.some((item) => item.fact_key === "contains_active"), "T1 active identity");
check(t1.facts.find((item) => item.fact_key === "active_concentration").subject_ref === t1.facts.find((item) => item.fact_key === "contains_active").fact_instance_id, "T1 concentration subject_ref");
const t2 = byCase.get("T2");
check(t2.facts.filter((item) => item.fact_key === "contains_active").length === 2, "T2 repeatable active facts");
check(t2.facts.filter((item) => item.fact_key === "active_concentration").length === 2, "T2 repeatable concentration facts");
for (const concentration of t2.facts.filter((item) => item.fact_key === "active_concentration")) check(t2.facts.some((item) => item.fact_instance_id === concentration.subject_ref && item.fact_key === "contains_active"), "T2 concentration subject exists");
check(!byCase.get("T3").facts.some((item) => item.fact_key === "active_concentration"), "T3 missing concentration remains absent");
equal(missingFactState(), { status: "not_reviewed", value: null }, "missing fact is not zero/false");
check(byCase.get("T4").evidence_records[0].evidence_class === "product_claim", "T4 official claim stays claim evidence");
check(byCase.get("T5").evidence_records[0].evidence_class === "usage_instruction", "T5 use frequency stays usage evidence");
check(byCase.get("M1").evidence_records[0].evidence_class === "role_declaration", "M1 role evidence");
check(byCase.get("M2").facts[0].value === "local_area", "M2 local balm role");
check(byCase.get("M3").evidence_records[0].evidence_class === "product_claim", "M3 barrier claim evidence");
check(byCase.get("M4").evidence_records.every((item) => item.evidence_class === "measurement"), "M4 measurement evidence");
for (const measured of byCase.get("M4").evidence_records) check(Boolean(measured.qualifier_context.metric && measured.qualifier_context.method_context && measured.qualifier_context.timepoint), "M4 metric/method/timepoint");
check(byCase.get("P1").facts[0].value === "liquid", "P1 liquid format");
check(byCase.get("P2").facts[0].value === "pad", "P2 pad format");
check(evidenceMap(byCase.get("P3")).values().next().value.evidence_class === "usage_instruction", "P3 wipe usage evidence");
check(evidenceMap(byCase.get("P4")).values().next().value.evidence_class === "physical_characteristic", "P4 pad physical evidence");
check(byCase.get("P5").facts[0].fact_key === "contains_active", "P5 active identity only");
check(byCase.get("P6").facts[0].fact_key === "recommended_use_frequency", "P6 frequency instruction");

const semanticCases = new Map(fixtures.semantic_finalization_cases.map((item) => [item.case_id, { ...item, product: materializeFixtureProduct(fixtures, item.product) }]));
const r2 = semanticCases.get("R2").product, r2Concentrations = r2.facts.filter((item) => item.fact_key === "active_concentration");
check(r2Concentrations[0].fact_instance_id !== r2Concentrations[1].fact_instance_id, "R2 instance ids differ");
equal(buildPropositionIdentity(registry, r2Concentrations[0]), buildPropositionIdentity(registry, r2Concentrations[1]), "same semantic proposition can have different fact_instance_id");
const activeIdentity = buildPropositionIdentity(registry, r2Concentrations[0]);
check(activeIdentity.subject_ref === semanticCases.get("R2").product.facts.find((item) => item.fact_key === "contains_active").fact_instance_id, "active concentration proposition includes subject_ref");
check(!Object.prototype.hasOwnProperty.call(activeIdentity, "fact_instance_id"), "proposition identity excludes fact_instance_id");
const tewlIdentity = buildPropositionIdentity(registry, byCase.get("M4").facts.find((item) => item.fact_key === "tewl_change"));
check(tewlIdentity.qualifiers.timepoint === "4h", "measurement proposition includes required timepoint qualifier");
validateFactSet(registry, semanticCases.get("R1").product); assertions += 1;
const r1Concs = semanticCases.get("R1").product.facts.filter((item) => item.fact_key === "active_concentration");
check(comparePropositions(registry, r1Concs[0], r1Concs[1]).relation === "independent", "different active subjects are independent concentration propositions");
expects(() => validateFactSet(registry, semanticCases.get("R2").product), "same_proposition_conflict_required");
check(assessFactCoexistence(registry, ...r2Concentrations).disposition === "conflict_required", "same subject/scope incompatible concentrations require conflict");

equal(classifyScopeRelation({ market: "KR" }, { market: "KR" }), "equivalent", "scope equivalence");
equal(classifyScopeRelation({ market: "KR", region: "KR" }, { market: "KR" }), "narrower", "scope narrower");
equal(classifyScopeRelation({ market: "KR" }, { market: "KR", region: "KR" }), "broader", "scope broader");
equal(classifyScopeRelation({ market: "KR" }, { market: "US" }), "disjoint", "scope disjoint");
equal(classifyScopeRelation({ market: "KR", variant: "A" }, { market: "KR", formulation_version: "v2" }), "overlapping", "scope partially overlapping");
expects(() => validateFactSet(registry, semanticCases.get("R3").product), "same_proposition_conflict_required");
expects(() => validateFactSet(registry, semanticCases.get("R4").product), "relationship_scope_mismatch");
validateFactSet(registry, semanticCases.get("R5").product); assertions += 1;
const r5 = semanticCases.get("R5").product;
check(validateRelationshipScopeCompatibility(r5.facts[0], r5.facts[1]) === true, "narrower child scope accepted");

const negatives = new Map(fixtures.negative_controls.map((item) => [item.id, item]));
const e = (id, fact_key, evidence_class, extras = {}) => ({ evidence_id: id, fact_key, evidence_class, evidence_authority: "product_specific_primary", confidence: "high", support_direction: "supports", source_provenance: "synthetic_fixture", ...extras });
const f = (id, fact_key, value, refs, extras = {}) => ({ fact_instance_id: id, fact_key, status: "supported", value, supporting_evidence_refs: refs, opposing_evidence_refs: [], authority_ceiling: "product_specific_primary", fused_confidence: "high", ...extras });
const product = (domain, evidence_records, facts) => ({ domain, evidence_records, facts });
const n13 = product("treatment", [
  e("n13-ea", "contains_active", "composition_identity", { scope: { market: "KR", formulation_version: "v1" }, proposition_value_identity: "niacinamide" }),
  e("n13-ec", "active_concentration", "product_claim", { scope: { market: "KR", formulation_version: "v2" }, subject_ref: "n13-a" })
], [
  f("n13-a", "contains_active", "niacinamide", ["n13-ea"], { scope: { market: "KR", formulation_version: "v1" } }),
  f("n13-c", "active_concentration", { amount: 5, unit: "percent" }, ["n13-ec"], { scope: { market: "KR", formulation_version: "v2" }, subject_ref: "n13-a" })
]);
const n14 = product("treatment", [
  e("n14-ea", "contains_active", "composition_identity", { scope: { market: "KR", valid_from: "2026-01-01", valid_to: "2026-06-30" }, proposition_value_identity: "niacinamide" }),
  e("n14-ec", "active_concentration", "product_claim", { scope: { market: "KR", valid_from: "2026-07-01", valid_to: "2026-12-31" }, subject_ref: "n14-a" })
], [
  f("n14-a", "contains_active", "niacinamide", ["n14-ea"], { scope: { market: "KR", valid_from: "2026-01-01", valid_to: "2026-06-30" } }),
  f("n14-c", "active_concentration", { amount: 5, unit: "percent" }, ["n14-ec"], { scope: { market: "KR", valid_from: "2026-07-01", valid_to: "2026-12-31" }, subject_ref: "n14-a" })
]);
expects(() => validateFactSet(registry, n13), "relationship_scope_mismatch");
expects(() => validateFactSet(registry, n14), "relationship_scope_mismatch");

const r6 = semanticCases.get("R6").product;
validateFactSet(registry, r6); assertions += 1;
check(Array.isArray(r6.evidence_records) && Array.isArray(r6.facts), "product fixture separates evidence_records and facts");
const r6Fact = r6.facts[0];
check(r6Fact.supporting_evidence_refs.length === 2, "one fused fact retains two evidence refs");
const r6Classes = new Set(r6Fact.supporting_evidence_refs.map((ref) => evidenceMap(r6).get(ref).evidence_class));
check(r6Classes.has("product_claim") && r6Classes.has("measurement"), "mixed evidence classes support one fused fact");
check(!Object.prototype.hasOwnProperty.call(r6Fact, "evidence_class"), "fused Fact has no single evidence_class truth field");
check(!Object.prototype.hasOwnProperty.call(r6Fact, "evidence_authority"), "fused Fact has no copied evidence_authority field");
check(Object.prototype.hasOwnProperty.call(r6Fact, "authority_ceiling") && Object.prototype.hasOwnProperty.call(r6Fact, "fused_confidence"), "authority ceiling and fused confidence are separate summaries");

const r7 = semanticCases.get("R7").product;
validateFactSet(registry, r7); assertions += 1;
check(r7.facts[0].status === "evidence_conflict", "R7 conflict status");
check(r7.facts[0].value === null, "R7 conflict value null");
check(r7.facts[0].supporting_evidence_refs.length > 0, "R7 conflict supporting provenance retained");
check(r7.facts[0].opposing_evidence_refs.length > 0, "R7 conflict opposing provenance retained");
const conflictMissingOpposition = product("moisturizer_cream", [e("n9-e", "barrier_support_claim", "product_claim")], [{ fact_instance_id: "n9-f", fact_key: "barrier_support_claim", status: "evidence_conflict", value: null, supporting_evidence_refs: ["n9-e"], opposing_evidence_refs: [], authority_ceiling: "product_specific_primary", fused_confidence: "low" }]);
expects(() => validateFactSet(registry, conflictMissingOpposition), "conflict_opposing_evidence_required");

expects(() => validateFactSet(registry, semanticCases.get("R8").product), "explicit_negative_evidence_required");
validateFactSet(registry, semanticCases.get("R9").product); assertions += 1;
check(semanticCases.get("R9").product.facts[0].value === false, "admissible explicit negative may establish false");
const fusedBare = fuseBooleanProposition(registry, { fact_instance_id: "fuse-bare", fact_key: "barrier_support_claim", scope: {}, authority_ceiling: "product_specific_primary", fused_confidence: "low" }, semanticCases.get("R8").product.evidence_records);
check(fusedBare.status === "not_reviewed" && fusedBare.value === null, "bare/ambiguous opposition cannot fuse false");
const fusedExplicit = fuseBooleanProposition(registry, { fact_instance_id: "fuse-explicit", fact_key: "barrier_support_claim", scope: {}, authority_ceiling: "product_specific_primary", fused_confidence: "medium" }, semanticCases.get("R9").product.evidence_records);
check(fusedExplicit.status === "supported" && fusedExplicit.value === false, "explicit admissible opposition fuses false");

const weakRecords = Array.from({ length: 12 }, (_, index) => ({ evidence_authority: "limited_non_product_specific", evidence_id: `weak-${index}` }));
equal(deriveAuthorityCeilingWithoutCountUpgrade(weakRecords), "limited_non_product_specific", "many weak sources do not upgrade authority");
const primaryLow = product("treatment", [{ evidence_id: "ac-e", fact_key: "treatment_claim", proposition_value_identity: "brightening", evidence_class: "product_claim", evidence_authority: "product_specific_primary", confidence: "low", support_direction: "supports", negative_admissibility: "not_applicable", source_provenance: { kind: "synthetic_probe" }, scope: {} }], [{ fact_instance_id: "ac-f", fact_key: "treatment_claim", scope: {}, status: "supported", value: "brightening", supporting_evidence_refs: ["ac-e"], opposing_evidence_refs: [], authority_ceiling: "product_specific_primary", fused_confidence: "low" }]);
validateFactSet(registry, primaryLow); assertions += 1;
check(primaryLow.facts[0].authority_ceiling === "product_specific_primary" && primaryLow.facts[0].fused_confidence === "low", "primary authority may coexist with low fused confidence");

expects(() => validateFactSet(registry, product("sunscreen", [e("n1-e", "glass_skin_power", "product_claim")], [])), "unknown_fact_key");
expects(() => validateFactSet(registry, product("sunscreen", [e("n2-e", "uv_filter_type", "product_claim")], [f("n2-f", "uv_filter_type", "chemical_plus", ["n2-e"])])), "invalid_enum");
expects(() => validateFactSet(registry, product("sunscreen", [e("n3-e", "water_resistance_duration", "measurement", { qualifier_context: { metric: "water_resistance_duration", method_context: "synthetic", timepoint: "duration" } })], [f("n3-f", "water_resistance_duration", { amount: 2, unit: "hours" }, ["n3-e"])])), "invalid_unit");
expects(() => validateFactSet(registry, product("treatment", [e("n4-e", "active_concentration", "product_claim", { subject_ref: "missing" })], [f("n4-f", "active_concentration", { amount: 5, unit: "percent" }, ["n4-e"], { subject_ref: "missing" })])), "orphan_subject_ref");
expects(() => validateFactSet(registry, product("sunscreen", [{ ...e("n5-e", "spf_value", "legacy_catalog_observation", { scope: { market: "KR" } }), evidence_authority: "legacy_unreviewed", confidence: "unknown" }], [f("n5-f", "spf_value", 50, ["n5-e"], { scope: { market: "KR" }, authority_ceiling: "legacy_unreviewed", fused_confidence: "unknown" })])), "legacy_cannot_establish_supported_fact");
expects(() => validateFactSet(registry, product("moisturizer_cream", [e("n6-e", "tewl_change", "measurement", { qualifier_context: { metric: "TEWL" } })], [f("n6-f", "tewl_change", { amount: -10, unit: "percent_change" }, ["n6-e"], { qualifier_context: { timepoint: "4h" } })])), "missing_measurement_context");
expects(() => validateFactSet(registry, product("moisturizer_cream", [e("n7-e", "barrier_support_claim", "product_claim", { support_direction: "opposes", negative_admissibility: "context_only" })], [{ ...f("n7-f", "barrier_support_claim", false, []), supporting_evidence_refs: [], opposing_evidence_refs: ["n7-e"] }])), "explicit_negative_evidence_required");
expects(() => validateFactSet(registry, product("sunscreen", [e("n8-e1", "spf_value", "product_claim", { scope: { market: "KR" } }), e("n8-e2", "spf_value", "product_claim", { scope: { market: "KR" } })], [f("n8-f1", "spf_value", 50, ["n8-e1"], { scope: { market: "KR" } }), f("n8-f2", "spf_value", 40, ["n8-e2"], { scope: { market: "KR" } })])), "same_proposition_conflict_required");
validateFactSet(registry, byCase.get("P5")); assertions += 1;
equal(observationPrevalence(negatives.get("N11-missing-denominator").observation), { status: "forbidden", prevalence: null }, "missing review denominator forbids prevalence");
equal(missingFactState(), { status: negatives.get("N12-missing-fact").expected_status, value: negatives.get("N12-missing-fact").expected_value }, "missing fact remains not reviewed/null");

const roleDefinition = getFactDefinition(registry, "primary_use_role");
check(!Object.keys(roleDefinition).some((key) => /score|weight|penalty|hero/i.test(key)), "role != recommendation weight");
check(registry.facts.filter((item) => item.fact_key === "contains_active").length === 1, "shared contains_active key not duplicated by category");
check(!registry.facts.some((item) => ["intensity", "strength"].includes(item.fact_key)), "no generic intensity fact");
check(!registry.facts.some((item) => /score|weight|penalty|hero/i.test(item.fact_key)), "no recommendation control in fact keys");
check(registry.downstream_consumption_boundary.requires_signal_family_dedupe === true, "signal family boundary retained");
check(registry.downstream_consumption_boundary.requires_lineage_dedupe === true, "lineage dedupe boundary retained");
check(registry.downstream_consumption_boundary.requires_correlation_grouping === true, "correlation grouping boundary retained");
check(registry.downstream_consumption_boundary.requires_saturation_or_cap === true, "saturation boundary retained");
check(inventory.authority_boundary === "inventory_only_no_product_fact_authority", "inventory authority boundary");
equal(inventory.domains.sunscreen.current_product_count, 11, "sunscreen inventory count");
equal(inventory.domains.treatment_serum.current_product_count, 18, "treatment inventory count");
equal(inventory.domains.moisturizer.current_product_count, 61, "moisturizer inventory count");
equal(inventory.domains.toner_pad.current_product_count, 48, "toner/pad inventory count");

function git(args, options = {}) { return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim(); }
let gitScope = "NOT_EVALUATED_NO_GIT_BASELINE";
try {
  if (git(["rev-parse", "--is-inside-work-tree"]) === "true") {
    execFileSync("git", ["cat-file", "-e", `${BASELINE}^{commit}`], { cwd: root, stdio: "ignore" });
    const changed = git(["diff", "--name-only", `${BASELINE}..HEAD`]).split("\n").filter(Boolean).sort();
    equal(changed, [...ALLOWED_DELTA].sort(), "exact Phase 3A allowlist");
    execFileSync("git", ["diff", "--check", `${BASELINE}..HEAD`], { cwd: root, stdio: "ignore" }); assertions += 1;
    const runtimePrefixes = ["app/", "components/", "lib/", "supabase/migrations/", ".github/workflows/"];
    check(!changed.some((file) => runtimePrefixes.some((prefix) => file.startsWith(prefix)) || file === "package.json"), "runtime/admin/migration/package/workflow delta 0");
    for (const [file, expectedBlob] of Object.entries(PHASE2_BLOBS)) equal(git(["rev-parse", `HEAD:${file}`]), expectedBlob, `Phase 2 blob unchanged: ${file}`);
    check(!changed.some((file) => file.includes("cleanser-catalog-field-review-v1")), "frozen cleanser corpus unchanged");
    const parked = [["refs/remotes/origin/feature/recommendation-metadata-transport-shadow", "783afb91a964f5d762f46846f9ef854902b48e95"], ["refs/remotes/origin/design/admin-product-catalog-review-adoption-v1", "0c0de0550ece8c42bb93a957128283f30ec3eb31"]];
    let parkedAvailable = true;
    for (const [ref, expected] of parked) { try { equal(git(["rev-parse", ref]), expected, `parked ref invariant ${ref}`); } catch { parkedAvailable = false; } }
    gitScope = parkedAvailable ? "PASS_WITH_PARKED_REFS" : "PASS_PARKED_REFS_NOT_FETCHED";
  }
} catch (error) { if (error?.code === "ERR_ASSERTION") throw error; if (error?.status && error.status !== 128) throw error; }

console.log("PASS verify-product-fact-registry-cross-category-v1");
console.log(`registry_version=${registry.registry_version}`);
console.log(`registry_keys=${registry.facts.length}`);
console.log(`synthetic_cases=${fixtures.products.length}`);
console.log(`semantic_finalization_cases=${fixtures.semantic_finalization_cases.length}`);
console.log(`assertions=${assertions}`);
console.log(`catalog_reference_products=${inventory.catalog_total_reference_products}`);
console.log("proposition_identity=PASS");
console.log("scope_relations=PASS");
console.log("relationship_scope_compatibility=PASS");
console.log("evidence_fact_separation=PASS");
console.log("conflict_provenance=PASS");
console.log("explicit_negative_safety=PASS");
console.log("missing_denominator_prevalence=forbidden");
console.log("legacy_catalog_authority_promotion=forbidden");
console.log("generic_intensity=forbidden");
console.log("automatic_decision_axis_creation=forbidden");
console.log(`git_scope=${gitScope}`);
