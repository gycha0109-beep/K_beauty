#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";

const artifactPath = "evidence/product-fact-subject-coverage-v1/trust-p9-lrp-first-party-fact-source-recovery-v1.json";
const p7Path = "evidence/product-fact-subject-coverage-v1/trust-p7-sunscreen-stage-b-identity-source-research-v1.json";
const p8Path = "evidence/product-fact-adoption-v1/trust-p8-sunscreen-hosted-adoption-execution-v1.json";
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const p7 = JSON.parse(fs.readFileSync(p7Path, "utf8"));
const p8 = JSON.parse(fs.readFileSync(p8Path, "utf8"));

const productId = "9983f167-24e7-4223-bd86-446ce6ced31b";
const sourceMain = "cef8a05a333b56f4244fc2d1295200230c97a52c";
const krUrl = "https://www.larocheposay.co.kr/product/view/4833.do";
const siUrl = "https://www.laroche-posay.si/anthelios/anthelios-nevidni-fluid-spf50-brez-vonja";
const allowedFactKeys = ["spf_value", "uva_label"];
const sha40 = /^[0-9a-f]{40}$/i;

assert.equal(artifact.version, "trust-p9-lrp-first-party-fact-source-recovery-v1");
assert.equal(artifact.stage, "TRUST-P9");
assert.equal(artifact.scope, "la-roche-posay-anthelios-first-party-fact-source-recovery-freeze");
assert.match(artifact.authority.source_main_sha, sha40);
assert.equal(artifact.authority.source_main_sha, sourceMain);
assert.equal(artifact.authority.upstream_p8_merge_sha, sourceMain);
assert.equal(artifact.authority.upstream_p7_artifact, p7Path);
assert.equal(artifact.authority.upstream_p8_execution_artifact, p8Path);
assert.equal(artifact.authority.production_project_id, "bygrczggxfuisupcevaz");
assert.equal(artifact.authority.registry_version, "product-fact-registry-cross-category-v1");
assert.equal(artifact.authority.subject_serializer, "product-fact-subject-identity-v1");
assert.equal(artifact.authority.proposition_serializer, "product-fact-proposition-pilot-v1");
assert.equal(artifact.authority.research_role, "adjudication_freeze_not_product_fact_evidence_ingest");
assert.ok(Number.isFinite(Date.parse(artifact.authority.researched_at)));
assert.deepEqual([...artifact.allowed_fact_keys].sort(), [...allowedFactKeys].sort());

const p7Row = p7.products.find((row) => row.product_id === productId);
assert.ok(p7Row);
assert.equal(p7Row.identity.status, "resolved");
assert.equal(p7Row.disposition, "FACT_SOURCE_RECOVERY_REQUIRED");
assert.equal(p7Row.accepted_fact_support.length, 0);
assert.equal(p7Row.sources[0].url, krUrl);

const p8Row = p8.product_poststate.find((row) => row.product_id === productId);
assert.ok(p8Row);
assert.equal(p8Row.subject_count, 0);
assert.equal(p8Row.current_count, 0);
assert.match(p8Row.status, /EXCLUDED$/);

assert.equal(artifact.production_prestate.product_id, productId);
assert.equal(artifact.production_prestate.subject_count, 0);
assert.equal(artifact.production_prestate.current_count, 0);
assert.equal(artifact.production_prestate.global_counts.subjects, 19);
assert.equal(artifact.production_prestate.global_counts.sources, 19);
assert.equal(artifact.production_prestate.global_counts.bindings, 19);
assert.equal(artifact.production_prestate.global_counts.evidence, 47);
assert.equal(artifact.production_prestate.global_counts.fact_instances, 47);
assert.equal(artifact.production_prestate.global_counts.review_assignments, 47);
assert.equal(artifact.production_prestate.global_counts.confirmations, 47);
assert.equal(artifact.production_prestate.global_counts.current, 47);

const product = artifact.product;
assert.equal(product.product_id, productId);
assert.equal(product.catalog.market, "KR");
assert.equal(product.catalog.size_ml, 50);
assert.equal(product.identity.status, "resolved");
assert.equal(product.identity.relation, "equivalent");
assert.equal(product.formulation_bridge.status, "resolved_for_spf_source_scope");
assert.equal(product.formulation_bridge.kr_formula_code_machine_readable, false);
assert.equal(product.formulation_bridge.foreign_formula_code, "C227022/1");
assert.equal(product.formulation_bridge.foreign_formula_code_source, siUrl);
assert.equal(product.formulation_bridge.scope_relation_to_kr_subject_proposal, "broader");
assert.equal(product.formulation_bridge.kr_normalized_inci_order.length, 22);
assert.equal(product.formulation_bridge.foreign_inci_order.length, 22);
assert.deepEqual(product.formulation_bridge.kr_normalized_inci_order, product.formulation_bridge.foreign_inci_order);
assert.deepEqual(product.formulation_bridge.ordered_ingredient_match, {
  kr_ingredient_count: 22,
  foreign_ingredient_count: 22,
  matched_in_order: 22,
  missing_from_foreign: 0,
  extra_in_foreign: 0,
  result: "EXACT_ORDERED_INCI_EQUIVALENCE_AFTER_NAME_NORMALIZATION"
});

assert.equal(product.sources.length, 2);
const krSource = product.sources.find((s) => s.url === krUrl);
const siSource = product.sources.find((s) => s.url === siUrl);
assert.ok(krSource && siSource);
assert.equal(krSource.publisher, "La Roche-Posay Korea");
assert.equal(krSource.identity_support, true);
assert.equal(krSource.machine_verifiable_fact_support, false);
assert.equal(krSource.scope_relation_to_subject_proposal, "equivalent");
assert.equal(siSource.publisher, "La Roche-Posay Slovenia");
assert.equal(siSource.identity_support, true);
assert.equal(siSource.machine_verifiable_fact_support, true);
assert.equal(siSource.scope_relation_to_subject_proposal, "broader");
assert.ok(siSource.observed_claims.includes("ANTHELIOS INVISIBLE FLUID SPF50+ / UVA-PF 46 NON-PERFUMED"));
assert.ok(siSource.observed_claims.includes("C227022/1"));

assert.equal(product.accepted_fact_support.length, 1);
const spf = product.accepted_fact_support[0];
assert.equal(spf.fact_key, "spf_value");
assert.equal(spf.raw_claim, "SPF50+");
assert.equal(spf.normalized_value, 50);
assert.deepEqual(spf.qualifier, {plus_modifier: "plus"});
assert.equal(spf.fact_market, "KR");
assert.equal(spf.evidence_source_url, siUrl);
assert.equal(spf.adjudication, "RECOVERED_SUPPORTED");

assert.equal(product.blocked_fact_support.length, 1);
const uva = product.blocked_fact_support[0];
assert.equal(uva.fact_key, "uva_label");
assert.equal(uva.required_value_kind, "direct_pa_label");
assert.equal(uva.observed_same_formula_claim, "UVA-PF 46");
assert.equal(uva.disposition, "FACT_SOURCE_RECOVERY_REQUIRED");
assert.equal(product.disposition, "PARTIAL_FACT_SOURCE_RECOVERY");

assert.equal(product.rejected_positive_candidates.length, 3);
assert.ok(product.rejected_positive_candidates.every((row) => row.observed_claims.includes("PA++++")));
assert.ok(product.rejected_positive_candidates.every((row) => row.rejection.includes("MISMATCH")));
assert.ok(!product.accepted_fact_support.some((row) => row.fact_key === "uva_label"));

assert.deepEqual(artifact.counts, {
  target_products: 1,
  allowed_fact_keys: 2,
  recovered_supported_facts: 1,
  remaining_fact_source_gaps: 1,
  hosted_product_fact_writes: 0,
  direct_product_fact_writes: 0
});
for (const key of ["subject_creation_authorized_by_this_artifact","fact_ingest_authorized_by_this_artifact","confirmation_authorized_by_this_artifact","current_update_authorized_by_this_artifact","uva_pf_to_pa_conversion_allowed","schema_change","rpc_change","registry_change"]) {
  assert.equal(artifact.invariants[key], false, key);
}
assert.equal(artifact.invariants.non_first_party_sources_used_for_positive_fact_support, 0);
assert.equal(artifact.invariants.recommendation_or_ranking_changes, 0);
assert.deepEqual(artifact.next_gate.eligible_fact_keys, ["spf_value"]);
assert.deepEqual(artifact.next_gate.blocked_fact_keys, ["uva_label"]);
assert.equal(artifact.next_gate.eligible_action, "deterministic_hosted_adoption_plan_freeze_for_recovered_spf_only");
assert.equal(artifact.next_gate.blocked_action, "continue_first_party_same_formulation_direct_pa_label_recovery_without_inference");

console.log(JSON.stringify({
  ok: true,
  stage: artifact.stage,
  product_id: productId,
  disposition: product.disposition,
  ordered_ingredient_match: 22,
  recovered_fact_keys: artifact.next_gate.eligible_fact_keys,
  blocked_fact_keys: artifact.next_gate.blocked_fact_keys,
  hosted_product_fact_writes: artifact.counts.hosted_product_fact_writes,
  direct_product_fact_writes: artifact.counts.direct_product_fact_writes
}, null, 2));
