#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
const p="evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16g-visual-content-audit-v1.json";
const docPath="docs/evidence/v21-8h-r16g-r2-firstparty-image-visual-review-v1.md";
const d=JSON.parse(fs.readFileSync(p,"utf8"));
const doc=fs.readFileSync(docPath,"utf8");
assert.equal(d.stage,"V2.1-8H-R16G_R2_FIRST_PARTY_VISUAL_CONTENT_REVIEW");
assert.equal(d.reviewed_on,"2026-10-09");
assert.equal(d.run_id,37914831456);
assert.equal(d.artifact_id,11608812161);
assert.equal(d.exact_capture_sha,"a67c46e0e7ad881b49845ea64f206b12506467c2");
assert.equal(d.head_manifest_consistent,true);
assert.equal(d.product_id,"5848640c-84ca-4079-9d9e-8f3113159fe1");
assert.equal(d.official_sku,"cafe24_smasteri_1_99");
assert.equal(d.current_size_ml,80);
assert.equal(d.images.length,3);
const expected=[
 ["snature_80ml_product_notice",127146,"4d62a3be8996ef8b2ab52421cc2f153e63eb20c73f453cac95c0f3d583b696c6"],
 ["snature_90ml_detail_first",115606,"2acfba92e91890c63529d9c0e486ae091a61b2fc815ee224cd1ff1c267f3cf70"],
 ["snature_90ml_detail_last",167772,"80a35274ac6cc06f64dc30a437ce551b4750a670d93d7aa1b83da84638a153a7"]
];
for(let i=0;i<3;i++){
 const [id,bytes,sha]=expected[i],asset=d.images[i];
 assert.equal(asset.id,id);
 assert.equal(asset.bytes,bytes);
 assert.equal(asset.sha256,sha);
 assert.equal(asset.verified,true);
 assert.equal(asset.visual_inspection,true);
 assert.equal(asset.manufacturer_lot_linked,false);
}
assert.equal(d.images[0].notice_size_ml,80);
assert.equal(d.images[0].full_ingredient_field,true);
for(const x of d.images.slice(1)){
 assert.equal(x.actual_90ml_label_in_image,false);
 assert.equal(x.full_ingredient_field,false);
}
assert.equal(d.interpretation.official_80ml_ingredient_panel_observed,true);
assert.equal(d.interpretation.marketing_90ml_directory_images_do_not_prove_90ml_actual_presentation,true);
assert.equal(d.interpretation.manufacturer_lot_or_revision_available,false);
assert.equal(d.interpretation.formula_identity_80_and_90_same,"NOT_ESTABLISHED");
assert.equal(d.interpretation.formulation_revision_key,null);
assert.equal(d.interpretation.subject_semantic_key,null);
assert.equal(d.interpretation.subjects_registerable,0);
assert.equal(d.decision,"R16G_80ML_OFFICIAL_INGREDIENT_NOTICE_RECOVERED_REVISION_LINEAGE_UNBOUND_HOLD2");
assert.equal(d.next_gate,"R16H_MANUFACTURER_APPLICABILITY_AND_LOT_FORMULATION_EVIDENCE");
assert.equal(d.production_writes,0);
assert.equal(d.non_numeric_pda_evaluations,1968);
for(const keyword of ["R16G_80ML_OFFICIAL_INGREDIENT_NOTICE_RECOVERED_REVISION_LINEAGE_UNBOUND_HOLD2","127,146","115,606","167,772","전성분","로트","R16H","80ml","90ml"]){
 assert.ok(doc.includes(keyword),keyword);
}
console.log(JSON.stringify({status:"PASS",stage:"R16G-R2",first_party_image_bytes:3,ingredient_panels_recovered:1,formula_revisions:0,production_writes:0}));
