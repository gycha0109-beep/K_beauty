#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";
import {
  VERSION, STAGE, AXIS_KEY, CONTRACT_VERSION, CONTRACT_MODE,
  PRIMARY_TERMINAL_OUTCOME, UPSTREAM_TERMINAL_OUTCOME,
  ACTIVE_IDENTITIES_V1, APPLICABLE_CATEGORIES, KNOWN_CATALOG_CATEGORIES,
  ACTIVE_IDENTITY_MAPPING_VERSION, CONTRACT_SHA256, SNAPSHOT_SHA256,
  INPUT, OUTPUTS, canonicalJson, sha256, buildAll, materialize,
} from "./exfoliation-non-numeric-pda-offline-shadow-v1.mjs";

const CONTRACT_PATH = "evidence/product-decision-axis-non-numeric-contract-v1/exfoliation-non-numeric-pda-contract-v1.json";
const EXAMPLES_PATH = "evidence/product-decision-axis-non-numeric-contract-v1/exfoliation-non-numeric-pda-examples-v1.json";
const REPLAY_8O_PATH = "evidence/product-decision-axis-non-numeric-contract-v1/exfoliation-non-numeric-pda-replay-v1.json";
const DOC_8O_PATH = "docs/evidence/exfoliation-non-numeric-product-decision-axis-contract-v1.md";
const EXPECTED_8O = Object.freeze({
  contract: "c85418df574b550672f9523bd6827e4265b57a9d7901e5bf8f6b4de203d45d40",
  examples: "3b93bee53229cf19c65f2bbb85db4f2f50570da086a370d4f9fe73ba83763cab",
  replay: "d7192c0f16f4916849b800dee24c4a073435de60e49de238e6a9d7893a938500",
  doc: "98bff1780121333b1b5d358d5581dde905380013b4dc1d67cb4e972b9adb39ba",
});
const SIGNAL_ENUM = new Set([
  "GOVERNED_SIGNAL_ESTABLISHED", "GOVERNED_SIGNAL_NOT_ESTABLISHED",
  "GOVERNED_SIGNAL_UNKNOWN", "GOVERNED_SIGNAL_BLOCKED", "NOT_APPLICABLE",
]);
const COVERAGE_ENUM = new Set([
  "active_identity_only", "active_identity_with_unscaled_context", "category_unknown",
  "conflict_blocked", "identity_blocked", "insufficient_fact", "missing_fact",
  "no_relevant_fact", "not_applicable",
]);
const MULTI_ENUM = new Set(["single","multiple","none_established","unknown","blocked","not_applicable"]);
const UNCERTAINTY_ENUM = new Set([
  "ACTIVE_CONCENTRATION_MISSING", "AUTHORITY_BELOW_PRODUCT_SPECIFIC_PRIMARY",
  "CATEGORY_UNKNOWN", "CONFLICTING_GOVERNED_FACT", "EVIDENCE_INSUFFICIENT",
  "IDENTITY_BLOCKED", "NEGATIVE_SIGNAL_NOT_AUTHORIZED",
  "NO_V1_RELEVANT_ACTIVE_IDENTITY_MATCH", "NOT_REVIEWED",
  "PAD_SURFACE_TEXTURE_MISSING", "PRODUCT_FORMAT_MISSING",
  "RECOMMENDED_USE_FREQUENCY_MISSING", "REVIEWED_NOT_ESTABLISHED",
  "SOURCE_BLOCKED_OR_MISSING_CURRENT", "WIPE_OFF_USE_MISSING",
]);

let assertions = 0;
function eq(a,b,msg) { assert.deepEqual(a,b,msg); assertions += 1; }
function ok(v,msg) { assert.ok(v,msg); assertions += 1; }
function hashFile(file) { return sha256(fs.readFileSync(file,"utf8")); }

const A = buildAll();
const B = buildAll();
const snapshot = A.snapshot;
const products = A.output.products;
const snapshotFactIds = new Set(A.facts.map((x) => x.fact_instance_id));
const snapshotConfirmationIds = new Set(A.facts.map((x) => x.confirmation_id));
const snapshotPropositionKeys = new Set(A.facts.map((x) => x.proposition_key));

// 1-6 Stage / 8O / offline authority
eq(STAGE, "V2.1-8P", "1 stage");
eq(A.output.stage, "V2.1-8P", "1 output stage");
eq(A.output.contract_authority.upstream_primary_terminal_outcome, UPSTREAM_TERMINAL_OUTCOME, "2 frozen 8O outcome");
eq(hashFile(CONTRACT_PATH), EXPECTED_8O.contract, "3 8O contract SHA");
eq(hashFile(EXAMPLES_PATH), EXPECTED_8O.examples, "3 8O examples SHA");
eq(hashFile(REPLAY_8O_PATH), EXPECTED_8O.replay, "3 8O replay SHA");
eq(hashFile(DOC_8O_PATH), EXPECTED_8O.doc, "3 8O docs SHA");
eq(CONTRACT_SHA256, EXPECTED_8O.contract, "3 mapper contract SHA");
eq(A.output.contract_authority.contract_mode, "STRUCTURED_CATEGORICAL", "4 contract mode");
eq(A.output.production_status.pda_production_consumption, "NO", "4 offline/shadow");
eq(snapshot.source_authority.hosted_project, "bygrczggxfuisupcevaz", "6 hosted authority");
eq(snapshot.source_authority.registry, "product-fact-registry-cross-category-v1", "6 registry");
eq(snapshot.source_authority.registry_checksum, "79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575", "6 registry checksum");
eq(snapshot.source_authority.subject_serializer, "product-fact-subject-identity-v1", "6 subject serializer");
eq(snapshot.source_authority.proposition_serializer, "product-fact-proposition-pilot-v1", "6 proposition serializer");
eq(hashFile(INPUT), SNAPSHOT_SHA256, "6 frozen snapshot SHA");

// 7-13 Full catalog and null invariants
eq(snapshot.hosted_counts.catalog, 164, "7 snapshot catalog");
eq(products.length, snapshot.catalog.length, "7 output count");
eq(new Set(products.map((x) => x.product_id)).size, products.length, "8-9 exactly one/unique");
for (const x of products) {
  eq(x.pda.axis_key, AXIS_KEY, "10 axis");
  eq(x.pda.numeric_estimate, null, "11 numeric");
  eq(x.pda.ordinal_magnitude, null, "12 ordinal");
  eq(x.pda.potency_order, null, "13 potency");
  ok(SIGNAL_ENUM.has(x.pda.signal_status), "14 signal enum");
  ok(COVERAGE_ENUM.has(x.pda.coverage.state), "15 coverage enum");
  ok(MULTI_ENUM.has(x.pda.multi_active_status), "multi enum");
  for (const reason of x.pda.uncertainty.reasons) ok(UNCERTAINTY_ENUM.has(reason), "16 uncertainty enum");
}

// 17-23 identity/order/cardinality/context/missingness
eq(ACTIVE_IDENTITIES_V1, ["lactic_acid","mandelic_acid","salicylic_acid"], "17 exact identities");
eq(ACTIVE_IDENTITY_MAPPING_VERSION, "exfoliating-active-identity-set-v1", "17 mapping version");
for (const x of products) {
  const items = x.pda.active_identities.items;
  for (const item of items) ok(ACTIVE_IDENTITIES_V1.includes(item.identity), "18 no unsupported mapping");
  eq(x.pda.active_identities.semantic_ordering, "NONE", "19 semantic order none");
  const serialized = items.map((i) => `${i.identity}\u0000${i.provenance.proposition_key}`);
  eq(serialized, [...serialized].sort(), "20 deterministic identity serialization");
  if (x.pda.multi_active_status === "multiple") {
    ok(items.length > 1, "21 multiple cardinality");
    eq(x.pda.numeric_estimate, null, "21 multiple no numeric");
    eq(x.pda.ordinal_magnitude, null, "21 multiple no ordinal");
    eq(x.pda.potency_order, null, "21 multiple no potency");
  }
  for (const key of ["active_concentration","recommended_use_frequency","product_format","wipe_off_use","pad_surface_texture"]) {
    if (x.pda.coverage.missing_context_keys.includes(key)) {
      ok(!(key in x.pda.context), `23 missing ${key} not defaulted`);
    }
  }
}

// 24 concentration parent lineage
for (const x of products) {
  const mappedParents = new Set(x.pda.active_identities.items.map((i) => i.provenance.proposition_key));
  for (const item of x.pda.context.active_concentration || []) {
    ok(item.provenance.parent_proposition_key !== null, "24 concentration parent present");
    ok(mappedParents.has(item.provenance.parent_proposition_key), "24 concentration matches active parent");
  }
}

// 25-30 synthetic frozen state transition replay
const ordinarySubject = A.subjects.find((x) => x.product_id === "0b88019a-9eb2-4be9-842d-f1e60e42cf51");
const ordinaryFacts = A.facts.filter((x) => x.product_id === ordinarySubject.product_id);
const blocked = materialize(
  [ordinarySubject.product_id, "treatment"], ordinaryFacts, {...ordinarySubject, identity_status:"unresolved"}
).pda;
eq(blocked.signal_status, "GOVERNED_SIGNAL_BLOCKED", "25 identity block");
eq(blocked.coverage.state, "identity_blocked", "25 identity block coverage");
ok(blocked.uncertainty.reasons.includes("IDENTITY_BLOCKED"), "25 identity reason");
eq(blocked.active_identities.items, [], "25 block prevents active use");

const conflictFacts = ordinaryFacts.map((x) =>
  x.fact_key === "contains_active" && x.value_entity_identifier === "mandelic_acid"
    ? {...x, semantic_status:"evidence_conflict"} : x
);
const conflict = materialize([ordinarySubject.product_id,"treatment"], conflictFacts, ordinarySubject).pda;
eq(conflict.signal_status, "GOVERNED_SIGNAL_BLOCKED", "26 conflict block");
eq(conflict.coverage.state, "conflict_blocked", "26 conflict coverage");
ok(conflict.uncertainty.reasons.includes("CONFLICTING_GOVERNED_FACT"), "26 conflict reason");

const reviewedFacts = ordinaryFacts
  .filter((x) => x.fact_key === "contains_active" && x.value_entity_identifier === "mandelic_acid")
  .map((x) => ({...x, semantic_status:"reviewed_not_established"}));
const reviewed = materialize([ordinarySubject.product_id,"treatment"], reviewedFacts, ordinarySubject).pda;
eq(reviewed.signal_status, "GOVERNED_SIGNAL_NOT_ESTABLISHED", "27 reviewed_not_established not false");
ok(reviewed.uncertainty.reasons.includes("REVIEWED_NOT_ESTABLISHED"), "27 reviewed reason");
ok(reviewed.uncertainty.reasons.includes("NEGATIVE_SIGNAL_NOT_AUTHORIZED"), "27 no false conversion");

const insufficientFacts = reviewedFacts.map((x) => ({...x, semantic_status:"evidence_insufficient"}));
const insufficient = materialize([ordinarySubject.product_id,"treatment"], insufficientFacts, ordinarySubject).pda;
eq(insufficient.signal_status, "GOVERNED_SIGNAL_UNKNOWN", "28 evidence insufficient unknown");
ok(insufficient.uncertainty.reasons.includes("EVIDENCE_INSUFFICIENT"), "28 insufficient reason");

const missing = materialize(["synthetic-missing-current","treatment"], [], null).pda;
eq(missing.signal_status, "GOVERNED_SIGNAL_UNKNOWN", "29 missing current unknown");
ok(missing.uncertainty.reasons.includes("SOURCE_BLOCKED_OR_MISSING_CURRENT"), "29 missing current reason");
ok(!missing.uncertainty.reasons.includes("NEGATIVE_SIGNAL_NOT_AUTHORIZED"), "30 no invented explicit negative");

const unknownCategory = materialize(["synthetic-unknown-category","future_category"], [], null).pda;
eq(unknownCategory.signal_status, "GOVERNED_SIGNAL_UNKNOWN", "category unknown");
eq(unknownCategory.coverage.state, "category_unknown", "category unknown coverage");
eq(unknownCategory.uncertainty.reasons, ["CATEGORY_UNKNOWN"], "category unknown reason");

const notApplicable = materialize(["synthetic-cleanser","cleanser"], [], null).pda;
eq(notApplicable.signal_status, "NOT_APPLICABLE", "not applicable");
eq(notApplicable.multi_active_status, "not_applicable", "not applicable multi");

// 31-33 provenance integrity / no raw evidence
for (const x of products) {
  for (const prov of x.pda.evidence_provenance) {
    ok(snapshotFactIds.has(prov.fact_instance_id), "31 provenance Fact Instance exists");
    ok(snapshotConfirmationIds.has(prov.confirmation_id), "31 provenance Confirmation exists");
    ok(snapshotPropositionKeys.has(prov.proposition_key), "31 provenance proposition exists");
    for (const field of [
      "subject_id","fact_instance_id","confirmation_id","proposition_key","parent_proposition_key",
      "fact_key","semantic_status","authority_ceiling","fused_confidence","mapper_input_role"
    ]) ok(Object.hasOwn(prov, field), `32 provenance field ${field}`);
  }
}
eq(A.summary.provenance_integrity_summary.fabricated_provenance_count, 0, "32 fabricated provenance");
eq(A.summary.provenance_integrity_summary.raw_evidence_body_count, 0, "33 raw evidence");
ok(!JSON.stringify(snapshot).includes("canonical_evidence_digest"), "33 raw evidence metadata absent");
ok(!JSON.stringify(snapshot).includes("canonical_locator"), "33 source bodies/locators absent");

// 34 exact 8O canonical examples
const examples = JSON.parse(fs.readFileSync(EXAMPLES_PATH, "utf8"));
eq(examples.examples.length, 4, "34 example count");
for (const example of examples.examples) {
  const actual = products.find((x) => x.product_id === example.source_product.product_id);
  ok(actual, `34 product exists ${example.example_id}`);
  eq(actual.pda, example.expected_output, `34 exact example replay ${example.example_id}`);
}

// 35-39 legacy / production / zero-mutation boundaries
const mapperSource = fs.readFileSync(new URL("./exfoliation-non-numeric-pda-offline-shadow-v1.mjs", import.meta.url), "utf8");
ok(!/legacy/i.test(mapperSource.split("// Frozen 8O examples")[0]), "35 no legacy fallback in mapper logic");
eq(A.output.production_status.pda_production_consumption, "NO", "36 no production consumption");
eq(A.output.production_status.recommendation_activation, "NO", "36 no activation");
eq(A.replay.hosted_invariance.registry_definition_delta_v21_8p, 0, "37 registry mutation zero");
eq(A.replay.hosted_invariance.hosted_product_fact_writes_v21_8p, 0, "38 hosted mutation zero");
eq(A.replay.hosted_invariance.migration_delta_v21_8p, 0, "38 migration zero");
ok(!/(from\s+["\'](?:node:https|node:http|@supabase)|fetch\s*\(|axios|supabase\.from|INSERT\s+INTO|UPDATE\s+product_fact|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)/i.test(mapperSource), "38 no live/network/write path");
eq(A.output.products.some((x) => x.pda.numeric_estimate !== null), false, "39 no numeric fitting output");

// 40-41 deterministic bytes and checked-in equality
for (const key of ["output","summary","replay"]) eq(A.rendered[key], B.rendered[key], `40 ${key} A/B`);
eq(A.rendered.doc, B.rendered.doc, "40 doc A/B");
for (const [key, rel] of Object.entries(OUTPUTS)) {
  eq(fs.readFileSync(rel,"utf8"), A.rendered[key], `41 ${rel} == generated`);
}
eq(fs.readFileSync(INPUT,"utf8"), canonicalJson(JSON.parse(fs.readFileSync(INPUT,"utf8"))), "41 snapshot canonical bytes");

// 42 exactly one primary outcome
eq(A.output.primary_terminal_outcome, PRIMARY_TERMINAL_OUTCOME, "42 terminal outcome");
eq(A.summary.primary_terminal_outcome, PRIMARY_TERMINAL_OUTCOME, "42 summary outcome");
eq(A.replay.primary_terminal_outcome, PRIMARY_TERMINAL_OUTCOME, "42 replay outcome");
eq(Object.keys(A.output).filter((k) => k === "primary_terminal_outcome").length, 1, "42 exactly one output terminal field");

// Count and replay facts
eq(A.summary.catalog_count, 164);
eq(A.summary.applicable_count, 66);
eq(A.summary.not_applicable_count, 98);
eq(A.summary.signal_state_counts.GOVERNED_SIGNAL_ESTABLISHED, 3);
eq(A.summary.signal_state_counts.GOVERNED_SIGNAL_NOT_ESTABLISHED, 4);
eq(A.summary.signal_state_counts.GOVERNED_SIGNAL_UNKNOWN, 59);
eq(A.summary.signal_state_counts.NOT_APPLICABLE, 98);
eq(A.summary.multi_active_state_counts.single, 2);
eq(A.summary.multi_active_state_counts.multiple, 1);
eq(A.summary.multi_active_state_counts.none_established, 4);
eq(A.summary.multi_active_state_counts.unknown, 59);
eq(A.summary.multi_active_state_counts.not_applicable, 98);
eq(A.summary.numeric_non_null_count, 0);
eq(A.summary.ordinal_non_null_count, 0);
eq(A.summary.potency_ordering_non_null_count, 0);
eq(A.summary.provenance_integrity_summary.concentration_parent_lineage_violation_count, 0);
eq(A.replay.production_invariance.evaluations, 1968);
for (const field of [
  "score_delta","ranking_delta","top1_delta","top3_delta","eligibility_delta",
  "public_response_delta","persistence_delta","candidate_policy_delta"
]) eq(A.replay.production_invariance[field], 0, field);
eq(A.replay.production_invariance.pda_production_consumption, "NO");
eq(A.replay.production_invariance.recommendation_activation, "NO");
eq(A.replay.historical_replay.map((x) => x.outcome), [
  "STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION",
  "NUMERIC_ANCHOR_GAP_CONFIRMED",
  "NUMERIC_ANCHOR_EVIDENCE_CONTRACT_DESIGNED",
  "NO_NUMERIC_ANCHOR_SOURCE_FOUND",
  "NON_NUMERIC_DECISION_REPRESENTATION_RECOMMENDED",
  "NON_NUMERIC_EXFOLIATION_PDA_CONTRACT_FROZEN",
]);

console.log(JSON.stringify({
  version: "verify-exfoliation-non-numeric-pda-offline-shadow-v1",
  status: "PASS",
  assertions,
  stage: STAGE,
  axis_key: AXIS_KEY,
  mapper_version: VERSION,
  primary_terminal_outcome: PRIMARY_TERMINAL_OUTCOME,
  hashes: A.hashes,
}));
