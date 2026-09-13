#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";

const artifactPath = "evidence/product-fact-subject-coverage-v1/trust-p25-skin1004-us-direct-pa-source-recovery-boundary-v1.json";
const p16Path = "evidence/product-fact-subject-coverage-v1/trust-p16-skin1004-uv-market-formulation-source-recovery-v1.json";
const p18Path = "evidence/product-fact-adoption-v1/trust-p18-skin1004-uv-us-spf-hosted-adoption-execution-v1.json";
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const p16 = JSON.parse(fs.readFileSync(p16Path, "utf8"));
const p18 = JSON.parse(fs.readFileSync(p18Path, "utf8"));

const productId = "fdf06871-db8e-4e73-a48c-c057c5ce925d";
const subjectId = "9dcd611d-e353-47f5-b349-e1f22d73551e";
const sourceMain = "41f1476af33a2ddcd6c04761ec1aa4452d3a0814";
const exactUrl = "https://www.skin1004.com/products/hyalu-cica-water-fit-sun-serum-uv";
const usOriginUrl = "https://skin1004-us.myshopify.com/products/hyalu-cica-water-fit-sun-serum-uv";
const bundleUrl = "https://www.skin1004.com/products/daily-moisture-routine-duo";
const landingUrl = "https://www.skin1004.com/pages/sun-serum-uv";
const nonUvUrl = "https://www.skin1004.com/products/hyalu-cica-water-fit-sun-serum-spf50-pa";

assert.equal(artifact.version, "trust-p25-skin1004-us-direct-pa-source-recovery-boundary-v1");
assert.equal(artifact.stage, "TRUST-P25");
assert.equal(artifact.status, "NO_ADMISSIBLE_SAME_FORMULATION_DIRECT_PA_LABEL_FOUND");
assert.equal(artifact.authority.source_main_sha, sourceMain);
assert.equal(artifact.authority.production_project_id, "bygrczggxfuisupcevaz");
assert.equal(artifact.authority.registry_version, "product-fact-registry-cross-category-v1");
assert.equal(artifact.authority.research_role, "negative_admission_boundary_freeze_not_product_fact_evidence_ingest");
assert.equal(artifact.authority.source_observation_digest, "c9192ac664e6b54b8894190b42c4f45e79e7611b264f3de6302615ca2eefbca9");
assert.ok(Number.isFinite(Date.parse(artifact.authority.researched_at)));

assert.equal(p16.version, "trust-p16-skin1004-uv-market-formulation-source-recovery-v1");
assert.equal(p16.target.product_id, productId);
assert.equal(p16.formulation_adjudication.result, "DISTINCT_FORMULATIONS");
assert.equal(p16.formulation_adjudication.cross_formula_pa_transfer_prohibited, true);
assert.equal(p16.invariants.broad_spectrum_to_pa_conversion, false);
assert.equal(p16.invariants.cross_formula_pa_transfer, false);
assert.deepEqual(p16.registry_constraints.uva_label.allowed_values, ["PA+", "PA++", "PA+++", "PA++++", "UVA-PF-declared"]);
assert.equal(p16.registry_constraints.uva_label.broad_spectrum_allowed, false);

assert.equal(p18.version, "trust-p18-skin1004-uv-us-spf-hosted-adoption-execution-v1");
assert.equal(p18.status, "PRODUCTION_CONFIRMED");
assert.equal(p18.subject.product_id, productId);
assert.equal(p18.subject.subject_id, subjectId);
assert.equal(p18.subject.market_applicability, "US");
assert.equal(p18.fact.fact_key, "spf_value");
assert.equal(p18.fact.value_number, 50);
assert.equal(p18.poststate.target_subjects, 1);
assert.equal(p18.poststate.target_spf_current, 1);
assert.equal(p18.poststate.target_uva_current, 0);
assert.equal(p18.execution_policy.uva_write_performed, false);
assert.equal(p18.execution_policy.broad_spectrum_to_pa_conversion, false);
assert.equal(p18.execution_policy.cross_formula_pa_transfer, false);

assert.deepEqual(artifact.admission_rule, {
  fact_key: "uva_label",
  required_market: "US",
  required_source_authority: "first_party",
  required_identity_relation: "exact_us_uv_same_formulation",
  required_claim_kind: "direct_pa_label",
  all_conditions_required: true,
  broad_spectrum_to_pa_conversion_allowed: false,
  non_uv_pa_transfer_allowed: false,
  reason: "The current US Product Fact Subject is the distinct UV formulation. A direct PA label must come from first-party evidence applicable to that exact US UV formulation; Broad Spectrum and the separate non-UV PA++++ product cannot satisfy this gate."
});

assert.equal(artifact.registry_snapshot.fact_key, "uva_label");
assert.equal(artifact.registry_snapshot.value_type, "enum");
assert.deepEqual(artifact.registry_snapshot.allowed_values, ["PA+", "PA++", "PA+++", "PA++++", "UVA-PF-declared"]);
assert.equal(artifact.registry_snapshot.broad_spectrum_allowed, false);
assert.equal(artifact.registry_snapshot.market_required, true);

assert.equal(artifact.product_identity.product_id, productId);
assert.equal(artifact.product_identity.subject_id, subjectId);
assert.equal(artifact.product_identity.subject_semantic_key, "6ea35ff44d90264c4cb8f845b1f04f28adc794872220f41e4cc9e03d13561320");
assert.equal(artifact.product_identity.variant_key, "HYALU_CICA_WATER_FIT_SUN_SERUM_UV_US_50ML");
assert.equal(artifact.product_identity.formulation_revision_key, "trust-p17-skin1004-uv-us-current");
assert.equal(artifact.product_identity.market, "US");
assert.equal(artifact.product_identity.source_id, "f72a2781-2d6a-45f1-82a6-c33674088523");
assert.equal(artifact.product_identity.binding_id, "903517b0-c91b-4802-9f51-88b0d305a164");

assert.deepEqual(artifact.production_state.target_counts, {subjects: 1, spf_current: 1, uva_current: 0});
assert.equal(artifact.production_state.current_spf.fact_instance_id, "304b8be8-e80a-49a5-9ceb-dfafef6b0828");
assert.equal(artifact.production_state.current_spf.confirmation_id, "eea66ab9-abee-46c5-bb57-e3f9f119e5b3");
assert.equal(artifact.production_state.current_spf.value_number, 50);
assert.equal(artifact.production_state.current_spf.market, "US");

const same = artifact.same_formulation_first_party_observations;
assert.equal(same.length, 4);
assert.deepEqual(same.map((row) => row.url), [exactUrl, usOriginUrl, bundleUrl, landingUrl]);
assert.ok(same.every((row) => row.direct_pa_label_present === false));
assert.ok(same.every((row) => row.admission === "BLOCKED_NO_DIRECT_PA_LABEL"));
assert.ok(same[0].observed_claims.some((claim) => claim.includes("SPF50 broad-spectrum")));
assert.ok(same[0].observed_claims.some((claim) => claim.includes("UVA/UVB")));
assert.ok(same[0].observed_claims.some((claim) => claim.includes("Avobenzone 2.7%")));

const rejected = artifact.direct_pa_first_party_rejected_candidates;
assert.equal(rejected.length, 1);
assert.equal(rejected[0].url, nonUvUrl);
assert.equal(rejected[0].rejection, "FORMULATION_MISMATCH");
assert.ok(rejected[0].observed_claims.includes("PA++++"));
assert.equal(rejected[0].identity_evidence.result, "DISTINCT_FROM_CURRENT_US_UV_FORMULATION");
assert.ok(rejected[0].identity_evidence.uv_target_filter_system.includes("Avobenzone 2.7%"));
assert.ok(rejected[0].identity_evidence.non_uv_filter_system.includes("Ethylhexyl Triazone"));

assert.equal(artifact.adjudication.same_formula_first_party_sources_reviewed, 4);
assert.equal(artifact.adjudication.same_formula_first_party_direct_pa_hits, 0);
assert.equal(artifact.adjudication.direct_pa_first_party_candidates_rejected_for_formula_mismatch, 1);
assert.equal(artifact.adjudication.accepted_positive_uva_support, 0);
assert.equal(artifact.adjudication.disposition, "FACT_SOURCE_RECOVERY_REQUIRED");
assert.deepEqual(artifact.counts, {
  target_products: 1,
  same_formula_first_party_sources: 4,
  same_formula_direct_pa_hits: 0,
  rejected_first_party_pa_candidates: 1,
  hosted_product_fact_writes: 0,
  direct_product_fact_writes: 0
});

for (const key of [
  "uva_label_write_authorized_by_this_artifact",
  "broad_spectrum_to_pa_conversion_allowed",
  "cross_formula_pa_transfer_allowed",
  "absence_treated_as_negative_product_fact",
  "schema_change",
  "rpc_change",
  "registry_change"
]) assert.equal(artifact.invariants[key], false, key);
assert.equal(artifact.invariants.third_party_sources_used_for_positive_fact_support, 0);
assert.equal(artifact.invariants.recommendation_or_ranking_changes, 0);
assert.equal(artifact.next_gate.blocked_fact_key, "uva_label");
assert.equal(artifact.next_gate.eligible_production_write, false);
assert.equal(artifact.next_gate.production_state_expected_to_remain, "SPF_CURRENT_1_UVA_CURRENT_0");

console.log(JSON.stringify({
  ok: true,
  stage: artifact.stage,
  status: artifact.status,
  same_formula_first_party_sources: same.length,
  same_formula_direct_pa_hits: artifact.adjudication.same_formula_first_party_direct_pa_hits,
  rejected_first_party_pa_candidates: rejected.length,
  accepted_positive_uva_support: artifact.adjudication.accepted_positive_uva_support,
  disposition: artifact.adjudication.disposition,
  hosted_product_fact_writes: artifact.counts.hosted_product_fact_writes
}, null, 2));
