#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";

const artifactPath = "evidence/product-fact-subject-coverage-v1/trust-p11-lrp-same-formulation-pa-source-recovery-boundary-v1.json";
const p9Path = "evidence/product-fact-subject-coverage-v1/trust-p9-lrp-first-party-fact-source-recovery-v1.json";
const p10Path = "evidence/product-fact-adoption-v1/trust-p10-lrp-recovered-spf-hosted-adoption-execution-v1.json";
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const p9 = JSON.parse(fs.readFileSync(p9Path, "utf8"));
const p10 = JSON.parse(fs.readFileSync(p10Path, "utf8"));

const productId = "9983f167-24e7-4223-bd86-446ce6ced31b";
const subjectId = "614db853-7865-408b-8f40-a4dcfe6a2ea5";
const sourceMain = "ad7a8ce3ae46abed433e2ff2544e9bfd2f087007";
const krUrl = "https://www.larocheposay.co.kr/product/view/4833.do";
const auUrl = "https://www.laroche-posay.com.au/sun-protection/face-sunscreens/anthelios-invisible-fluid-facial-sunscreen-spf-50/3337875733748.html";
const clUrl = "https://www.laroche-posay.cl/anthelios/anthelios-invisible-fluid-non-perfumed-spf50-plus";
const siUrl = "https://www.laroche-posay.si/anthelios/anthelios-nevidni-fluid-spf50-brez-vonja";
const jpUrl = "https://www.laroche-posay.jp/product/uv/toneup/uvidea-xl-protection-tone-up-kit-20220726/LRPJP-UVI-013.html";
const hkUrl = "https://www.laroche-posay.hk/anthelios/anthelios-uvmune-400-invisible-fluid-spf50-without-perfume";
const twUrl = "https://www.lrp.com.tw/Product/Content?strProductID=MB459200";
const thUrl = "https://www.larocheposay-th.com/anthelios/anthelios-uvmune-400-invisible-fluid-spf50";

assert.equal(artifact.version, "trust-p11-lrp-same-formulation-pa-source-recovery-boundary-v1");
assert.equal(artifact.stage, "TRUST-P11");
assert.equal(artifact.status, "NO_ADMISSIBLE_SAME_FORMULATION_DIRECT_PA_LABEL_FOUND");
assert.equal(artifact.authority.source_main_sha, sourceMain);
assert.equal(artifact.authority.upstream_p9_artifact, p9Path);
assert.equal(artifact.authority.upstream_p10_execution_artifact, p10Path);
assert.equal(artifact.authority.production_project_id, "bygrczggxfuisupcevaz");
assert.equal(artifact.authority.registry_version, "product-fact-registry-cross-category-v1");
assert.equal(artifact.authority.research_role, "negative_admission_boundary_freeze_not_product_fact_evidence_ingest");
assert.equal(artifact.authority.source_observation_digest, "a15f1b73a2fa6a202d20e7e2a45697209df517219dc9ec023b61ad0ace4d7bf8");
assert.ok(Number.isFinite(Date.parse(artifact.authority.researched_at)));

assert.equal(p9.version, "trust-p9-lrp-first-party-fact-source-recovery-v1");
assert.equal(p9.product.product_id, productId);
assert.equal(p9.product.blocked_fact_support.length, 1);
assert.equal(p9.product.blocked_fact_support[0].fact_key, "uva_label");
assert.equal(p9.product.blocked_fact_support[0].required_value_kind, "direct_pa_label");
assert.equal(p9.product.blocked_fact_support[0].observed_same_formula_claim, "UVA-PF 46");
assert.equal(p9.product.blocked_fact_support[0].disposition, "FACT_SOURCE_RECOVERY_REQUIRED");
assert.equal(p9.invariants.uva_pf_to_pa_conversion_allowed, false);

assert.equal(p10.status, "PRODUCTION_CONFIRMED");
assert.equal(p10.product.product_id, productId);
assert.equal(p10.product.subject_id, subjectId);
assert.equal(p10.fact.fact_key, "spf_value");
assert.equal(p10.fact.value_number, 50);
assert.equal(p10.production_poststate.target_subjects, 1);
assert.equal(p10.production_poststate.target_spf_current, 1);
assert.equal(p10.production_poststate.target_uva_current, 0);
assert.equal(p10.execution_policy.uva_label_write, false);
assert.equal(p10.execution_policy.uva_pf_to_pa_conversion, false);

assert.deepEqual(artifact.admission_rule, {
  fact_key: "uva_label",
  required_market: "KR",
  required_value: "PA++++",
  required_source_authority: "first_party",
  required_identity_relation: "same_formulation",
  required_claim_kind: "direct_pa_label",
  all_conditions_required: true,
  uva_pf_to_pa_conversion_allowed: false,
  uva_pf_declared_substitution_allowed: false,
  reason: "TRUST-P9 explicitly left uva_label blocked pending a same-formulation first-party direct PA label. TRUST-P11 does not widen that adjudication scope."
});
assert.equal(artifact.registry_snapshot.fact_key, "uva_label");
assert.equal(artifact.registry_snapshot.value_type, "enum");
assert.equal(artifact.registry_snapshot.deprecated, false);
assert.deepEqual(artifact.registry_snapshot.allowed_values, ["PA+", "PA++", "PA+++", "PA++++", "UVA-PF-declared"]);
assert.deepEqual(artifact.registry_snapshot.permitted_evidence_classes, ["product_claim"]);
assert.equal(artifact.registry_snapshot.positive_evidence_requirement, "product-specific evidence");

assert.equal(artifact.production_state.product_id, productId);
assert.equal(artifact.production_state.subject_id, subjectId);
assert.deepEqual(artifact.production_state.global_counts, {
  subjects: 20,
  sources: 20,
  bindings: 20,
  evidence: 48,
  fact_instances: 48,
  evidence_links: 48,
  review_assignments: 48,
  confirmations: 48,
  current: 48
});
assert.deepEqual(artifact.production_state.target_counts, {subjects: 1, spf_current: 1, uva_current: 0});

assert.equal(artifact.product_identity.product_id, productId);
assert.equal(artifact.product_identity.market, "KR");
assert.equal(artifact.product_identity.size_ml, 50);
assert.equal(artifact.product_identity.variant_key, "ANTHELIOS_SUN_FLUID_KR_50ML");
assert.equal(artifact.product_identity.formulation_revision_key, "trust-p7-lrp-4833-current");
assert.equal(artifact.product_identity.same_formula_code_bridge, "C227022/1");

const same = artifact.same_formulation_first_party_observations;
assert.equal(same.length, 4);
assert.deepEqual(same.map((row) => row.url), [krUrl, auUrl, clUrl, siUrl]);
assert.ok(same.every((row) => row.same_formulation_support === true));
assert.ok(same.every((row) => row.direct_pa_label_present === false));
assert.equal(same.filter((row) => row.formula_code === "C227022/1").length, 3);
assert.equal(same.filter((row) => row.admission === "BLOCKED_UVA_PF_ONLY").length, 2);
assert.ok(same.find((row) => row.url === auUrl).observed_claims.includes("Very High UVA/UVB Protection"));
assert.ok(same.find((row) => row.url === clUrl).observed_claims.some((claim) => claim.includes("UVA-FP 46")));
assert.ok(same.find((row) => row.url === siUrl).observed_claims.some((claim) => claim.includes("UVA-PF 46")));

const rejected = artifact.direct_pa_first_party_rejected_candidates;
assert.equal(rejected.length, 4);
assert.deepEqual(rejected.map((row) => row.url), [jpUrl, hkUrl, twUrl, thUrl]);
assert.ok(rejected.every((row) => row.observed_claims.some((claim) => claim.includes("PA++++"))));
assert.ok(rejected.every((row) => row.rejection.includes("MISMATCH")));
const jp = rejected.find((row) => row.url === jpUrl);
assert.equal(jp.rejection, "FORMULATION_MISMATCH");
assert.equal(jp.identity_evidence.result, "MATERIALLY_DIFFERENT_FROM_CURRENT_KR_22_ITEM_FORMULA");
for (const ingredient of ["DIMETHICONE", "ISOHEXADECANE", "OCTOCRYLENE"]) {
  assert.ok(jp.identity_evidence.jp_only_ingredients_examples.includes(ingredient));
}
for (const row of rejected.filter((row) => row.url !== jpUrl)) {
  assert.equal(row.rejection, "FORMULATION_GENERATION_MISMATCH");
  assert.ok(row.observed_claims.some((claim) => /Mexoryl 400/i.test(claim)));
}

assert.equal(artifact.non_first_party_corroboration.length, 1);
assert.equal(artifact.non_first_party_corroboration[0].publisher, "Hwahae");
assert.equal(artifact.non_first_party_corroboration[0].admission, "EXCLUDED_NON_FIRST_PARTY_FOR_P11_POSITIVE_SUPPORT");
assert.ok(artifact.non_first_party_corroboration[0].observed_claims.some((claim) => claim.includes("PA++++")));

assert.deepEqual(artifact.adjudication, {
  same_formula_first_party_sources_reviewed: 4,
  same_formula_first_party_direct_pa_hits: 0,
  direct_pa_first_party_candidates_rejected_for_formula_mismatch: 4,
  accepted_positive_uva_support: 0,
  disposition: "FACT_SOURCE_RECOVERY_REQUIRED",
  reason: "No reviewed first-party source simultaneously establishes the P9 same formulation and directly declares PA++++. Same-formulation first-party sources expose SPF50+ and/or UVA-PF 46 only; PA++++ first-party sources reviewed belong to materially different formulations or the UVMUNE 400 generation."
});
assert.deepEqual(artifact.counts, {
  target_products: 1,
  same_formula_first_party_sources: 4,
  same_formula_direct_pa_hits: 0,
  rejected_first_party_pa_candidates: 4,
  non_first_party_corroboration_sources: 1,
  hosted_product_fact_writes: 0,
  direct_product_fact_writes: 0
});

for (const key of [
  "uva_label_write_authorized_by_this_artifact",
  "uva_pf_to_pa_conversion_allowed",
  "uva_pf_declared_substitution_allowed",
  "schema_change",
  "rpc_change",
  "registry_change"
]) {
  assert.equal(artifact.invariants[key], false, key);
}
assert.equal(artifact.invariants.non_first_party_sources_used_for_positive_fact_support, 0);
assert.equal(artifact.invariants.recommendation_or_ranking_changes, 0);
assert.equal(artifact.next_gate.blocked_fact_key, "uva_label");
assert.equal(artifact.next_gate.eligible_production_write, false);
assert.equal(artifact.next_gate.eligible_action, "continue_source_recovery_only");
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
  hosted_product_fact_writes: artifact.counts.hosted_product_fact_writes,
  direct_product_fact_writes: artifact.counts.direct_product_fact_writes
}, null, 2));
