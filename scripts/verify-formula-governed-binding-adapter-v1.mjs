#!/usr/bin/env node
import assert from "node:assert/strict";
import {compareGovernedFormulaPresentationsV1 as compare} from "../lib/trust/formula-governed-binding-adapter-v1.mjs";
const P="11111111-1111-4111-8111-111111111111";
const S="22222222-2222-4222-8222-222222222222";
const NEW="33333333-3333-4333-8333-333333333333";
const SOURCE="44444444-4444-4444-8444-444444444444";
const BY="55555555-5555-4555-8555-555555555555";
const digest="a".repeat(64);
const entry=(sku,physical,sid=S)=>({
  requested_presentation:{product_id:P,sku,presentation_key:physical,market:"KR"},
  source_subject_binding:{product_id:P,subject_id:sid,source_id:SOURCE,
    reviewed_by:BY,reviewed_at:"2026-10-23T01:00:00Z",
    binding_state:"equivalent_presentation_match",scope_relation:"equivalent",
    presentation_metadata:{exact_sku_reviewed:true,verified_sku:sku,
      verified_presentation_key:physical,verified_market:"KR",
      exact_source_locator:"https://manufacturer.example/items/"+sku}},
  evidence_source:{source_id:SOURCE,source_kind:"official_product_page",
    publisher:"Manufacturer",market:"KR",content_digest:digest,
    external_snapshot_reference:"frozen-evidence:example/"+sku,
    canonical_locator:"https://manufacturer.example/items/"+sku},
  subject:{subject_id:sid,product_id:P,current_state:"current",
    identity_status:"resolved",market_applicability:"KR",
    formulation_revision_key:"reviewed-v1",predecessor_subject_id:null,
    supersession_kind:null}
});
const fixture=()=>({left:entry("sku-120","unit-120"),right:entry("sku-150","unit-150")});
const result=compare(fixture());
assert.equal(result.decision,"SAME_FORMULA_CONFIRMED");
for(const f of ["fact_reuse_authorized","subject_creation_authorized",
  "source_binding_approval_authorized","production_admission_authorized"])
  assert.equal(result[f],false);
const changed=fixture();
changed.right.subject={...changed.right.subject,subject_id:NEW,
  formulation_revision_key:"reviewed-v2",predecessor_subject_id:S,
  supersession_kind:"reformulation"};
changed.right.source_subject_binding.subject_id=NEW;
assert.equal(compare(changed).decision,"DIFFERENT_FORMULA_CONFIRMED");
const unknown=fixture();
unknown.right.subject={...unknown.right.subject,subject_id:NEW};
unknown.right.source_subject_binding.subject_id=NEW;
assert.equal(compare(unknown).decision,"FORMULA_UNRESOLVED");
// Real legacy PF-1 metadata gives size/family info, NOT exact SKU attestation.
for(const meta of [
  {source_fill_size_ml:35,target_fill_size_ml:50,formula_digest:digest,
    same_formulation_bridge:true},
  {bundle_units:2,exact_unit_match:"yes",
    presentation_relation:"same_exact_50ml_unit_x2"}
]) {
  const x=fixture();x.right.source_subject_binding.presentation_metadata=meta;
  const y=compare(x);
  assert.equal(y.decision,"FORMULA_UNRESOLVED");
  assert.ok(y.reasons.some(r=>r.includes("EXACT_SKU_PRESENTATION_ATTESTATION_REQUIRED")));
}
for(const mutate of [
  x=>x.right.evidence_source=null,
  x=>x.right.subject=null,
  x=>x.right.source_subject_binding.reviewed_by=null,
  x=>x.right.source_subject_binding.binding_state="product_family_only",
  x=>x.right.source_subject_binding.scope_relation="narrower",
  x=>x.right.source_subject_binding.presentation_metadata.verified_sku="wrong-sku",
  x=>x.right.source_subject_binding.presentation_metadata.exact_source_locator="https://manufacturer.example/items/other",
  x=>x.right.evidence_source.external_snapshot_reference=null,
  x=>x.right.evidence_source.content_digest=null,
  x=>x.right.evidence_source.source_kind="review_aggregate",
  x=>x.right.evidence_source.market="US",
  x=>x.right.evidence_source.canonical_locator="http://manufacturer.example/items/sku-150",
  x=>x.right.requested_presentation.product_id=NEW,
  x=>x.right.requested_presentation.market="US",
  x=>x.right.subject.identity_status="ambiguous",
  x=>x.right.subject.market_applicability="US",
  x=>x.right.subject.formulation_revision_key=null
]) {
  const x=fixture();mutate(x);
  const out=compare(x);
  assert.equal(out.decision,"FORMULA_UNRESOLVED",JSON.stringify(out.reasons));
  assert.ok(out.reasons.length>0);
  assert.equal(out.fact_reuse_authorized,false);
}
// No Product row / no exact binding is a HOLD, never a fabricated confirmation.
const missing=compare({left:{requested_presentation:fixture().left.requested_presentation},right:null});
assert.equal(missing.decision,"FORMULA_UNRESOLVED");
assert.equal(compare(fixture()).decision,result.decision);
console.log("PF-1 actual-DB-shape governed binding adapter: PASS (legacy metadata HOLD, zero writes)");
