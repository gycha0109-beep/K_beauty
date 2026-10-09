#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
const p="evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16h-r2-kr-40-70-official-inci-audit-v1.json";
const d=JSON.parse(fs.readFileSync(p,"utf8"));
const report=fs.readFileSync("docs/evidence/v21-8h-r16h-r2-innisfree-40-70-firstparty-inci-equality-v1.md","utf8");
const workflow=fs.readFileSync(".github/workflows/taxonomy-ai-r16d-source-capture.yml","utf8");
assert.equal(d.stage,"V2.1-8H-R16H-R2_KR_INNISFREE_40_70_OFFICIAL_RAW_PROVENANCE_AUDIT");
assert.equal(d.version,"barrier-support-p1-r16h-r2-kr-40-70-official-inci-audit-v1");
assert.equal(d.source.run_id,37931941113);
assert.equal(d.source.artifact_id,11616921172);
assert.equal(d.source.head_sha,"1c4d407b4c49cd63889417f9eff77a5764b507a0");
assert.equal(d.source.manifest_head_sha,d.source.head_sha);
assert.equal(d.source.artifact_zip_sha256,"b9a12c7da48b7782d673e5b48d92c9bec6761bb14a3a931f822666e7e17b643f");
assert.equal(d.source.independent_full_response_sha256_recomputed,true);
assert.equal(d.source.independent_ingredient_panel_sha256_recomputed,true);
assert.equal(d.source.raw_files_kept_out_of_git,true);
assert.equal(d.source.ephemeral_retention_days,7);
const exp=[
 ["34622",40,555448,"d562438e70289b9bd5da5dfece7445de8d5c67f28f2184e61381bba81e1734b2"],
 ["34623",70,538371,"7b7e2c0821202fd6d1fc1bffe6c52829caf6f76d53debda5c38b8e378cc2a3bd"],
];
assert.equal(d.products.length,2);
for(let i=0;i<2;i++){
 const row=d.products[i],e=exp[i];
 assert.equal(row.official_product_no,e[0]);
 assert.equal(row.nominal_ml,e[1]);
 assert.equal(row.raw_byte_length,e[2]);
 assert.equal(row.raw_sha256,e[3]);
 assert.equal(row.official_ingredient_count,26);
 assert.equal(row.ordered_panel_sha256,"3a9ecd76e31282c42b245986c6b5f6adba0d9dd61c2adfa592a2f411403a8134");
 assert.equal(row.verified,true);
 assert.equal(new URL(row.first_party_url).hostname,"m.innisfree.com");
 assert.ok(row.first_party_url.includes("/dp/product/"+row.official_product_no));
 assert.ok(row.official_html_title.includes(String(row.nominal_ml)+"mL"));
}
assert.equal(d.comparison.exact_KR_presentations_confirmed,2);
assert.equal(d.comparison.exact_first_party_KR_ordered_panels_confirmed,2);
assert.equal(d.comparison.ordered_ingredient_lists_identical,true);
assert.equal(d.comparison.ingredient_order_match_all_26,true);
assert.equal(d.comparison.contains_bija_seed_oil,"비자나무씨오일(1,000ppm)");
assert.equal(d.comparison.same_manufacturing_formula_generation,"NOT_ESTABLISHED");
assert.equal(d.comparison.lot_bound_version,"NOT_ESTABLISHED");
assert.equal(d.comparison.effective_date,"NOT_ESTABLISHED");
for(const field of ["formulation_revision_key","subject_semantic_key"])assert.equal(d.authority[field],null);
for(const field of ["production_subject_registration_authorized","product_fact_adjudication_authorized","source_binding_reassignment_authorized"])assert.equal(d.authority[field],false);
assert.equal(d.authority.semantic_key_collision_check,"NOT_EVALUABLE_NO_MATERIALIZED_KEY");
assert.deepEqual([d.summary.raw_captured,d.summary.exact_KR_panels,d.summary.formula_revision_confirmed,d.summary.semantic_keys_materialized,d.summary.subjects_registered,d.summary.production_writes],[2,2,0,0,0,0]);
assert.equal(d.other_p1_status.snature_90ml_brand_first_party_panel_observed,false);
assert.equal(d.terminal,"R16H_R2_EXACT_KR_INCI_40_70_MATCH_FORMULATION_LINEAGE_HOLD");
assert.equal(d.next_gate,"R16H_R3_SNATURE_90ML_BRAND_INCI_AUTHORITY_AND_BOTH_FORMULAS_LOT_APPLICABILITY");
assert.equal(d.invariance.candidates*d.invariance.scenarios,d.invariance.evaluations);
assert.equal(d.invariance.evaluations,1968);
assert.equal(d.invariance.production_writes,0);
for(const needle of ["R16H_R2_EXACT_KR_INCI_40_70_MATCH_FORMULATION_LINEAGE_HOLD","34623","26/26","3a9ecd76","1,968","R16H_R3"])assert.ok(report.includes(needle),needle);
for(const needle of ["Capture R16H exact Korean 40ml and 70ml source evidence","r16h-p1-innisfree-kr-40-70-bytes","R16H_EXACT_CHECKOUT_SHA","retention-days: 7"])assert.ok(workflow.includes(needle),needle);
console.log(JSON.stringify({status:"PASS",stage:"R16H-R2",exact_kr_raw_sources:2,identical_ordered_inci:true,formula_revision_confirmed:0,registered:0,production_writes:0}));
