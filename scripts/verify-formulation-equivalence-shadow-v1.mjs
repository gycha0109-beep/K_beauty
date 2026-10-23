#!/usr/bin/env node
import assert from "node:assert/strict";
import {evaluateFormulationEquivalenceShadowV1 as decide,
  FORMULA_EQUIVALENCE_SHADOW_VERSION} from "../lib/trust/formulation-equivalence-shadow-v1.mjs";
const product="11111111-1111-4111-8111-111111111111";
const subj="22222222-2222-4222-8222-222222222222";
const other="33333333-3333-4333-8333-333333333333";
const side=(id,sku)=>({product_id:product,presentation_key:id,sku,market:"KR"});
const subject=(id,otherFields={})=>({subject_id:id,product_id:product,
  identity_status:"resolved",current_state:"current",market_applicability:"KR",
  formulation_revision_key:"reviewed-kr-v1",predecessor_subject_id:null,
  supersession_kind:null,...otherFields});
const binding=(side,subjectId)=>({product_id:product,subject_id:subjectId,
  presentation_key:side.presentation_key,sku:side.sku,market:"KR",
  source_scope:"exact_sku",scope_relation:"equivalent",
  binding_state:"equivalent_presentation_match",source_class:"manufacturer_official",
  source_id:"44444444-4444-4444-8444-444444444444",
  source_content_digest:"a".repeat(64),
  reviewed_by:"55555555-5555-4555-8555-555555555555",
  reviewed_at:"2026-10-22T15:00:00Z"});
const a=side("physical-120","sku120"),b=side("physical-150","sku150");
const normal=()=>({left:a,right:b,left_binding:binding(a,subj),right_binding:binding(b,subj),
  left_subject:subject(subj),right_subject:subject(subj)});
const frozen=state=>{assert.equal(state.version,FORMULA_EQUIVALENCE_SHADOW_VERSION);
  assert.equal(state.product_id,product);
  for(const key of ["fact_reuse_authorized","subject_creation_authorized",
    "evidence_write_authorized","production_admission_authorized"])
    assert.equal(state[key],false);
};
const same=decide(normal());
assert.equal(same.decision,"SAME_FORMULA_CONFIRMED");
frozen(same);
const diff=normal();
diff.right_subject=subject(other,{formulation_revision_key:"reviewed-kr-v2",
  predecessor_subject_id:subj,supersession_kind:"reformulation"});
diff.right_binding=binding(b,other);
assert.equal(decide(diff).decision,"DIFFERENT_FORMULA_CONFIRMED");
frozen(decide(diff));
// Separate subjects, capacity mismatch or a mere package revision cannot confirm reformulation.
for(const mutate of [
  x=>{x.right_subject=subject(other);x.right_binding=binding(b,other)},
  x=>{x.right_binding=null},
  x=>{x.left_binding=null},
  x=>{x.right_binding.binding_state="product_family_only"},
  x=>{x.right_binding.scope_relation="narrower"},
  x=>{x.right_binding.sku="sku-other"},
  x=>{x.right_binding.presentation_key="physical-other"},
  x=>{x.right_binding.source_scope="product_family"},
  x=>{x.right_binding.source_class="retailer_index"},
  x=>{x.right_binding.source_content_digest=null},
  x=>{x.right_binding.reviewed_by=null},
  x=>{x.right_binding.reviewed_at=null},
  x=>{x.right_subject.identity_status="ambiguous"},
  x=>{x.right_subject.market_applicability=null},
  x=>{x.right.market="US"},
  x=>{x.right.product_id=other},
  x=>{x.right_subject.formulation_revision_key=null},
  x=>{x.right_subject=subject(other,{supersession_kind:"identity_correction",
    predecessor_subject_id:subj});x.right_binding=binding(b,other)},
]) {
  const x=normal();mutate(x);
  const answer=decide(x);
  assert.equal(answer.decision,"FORMULA_UNRESOLVED",JSON.stringify(answer.reasons));
  assert.ok(answer.reasons.length>0);frozen(answer);
}
const repeated=normal();
repeated.right={...a};
repeated.right_binding=binding(repeated.right,other);
repeated.right_subject=subject(other);
assert.equal(decide(repeated).decision,"FORMULA_UNRESOLVED");
// No binding for a cleanser is never interpreted as Boolean false or same formula.
const absent=decide({left:a,right:b,left_binding:null,right_binding:null,
  left_subject:null,right_subject:null});
assert.equal(absent.decision,"FORMULA_UNRESOLVED");
assert.equal(Object.hasOwn(absent,"same_formula"),false);
assert.deepEqual(decide(normal()),same);
console.log("TRUST R2/C2 governed formulation equivalence shadow: PASS (offline, no Fact authority)");
