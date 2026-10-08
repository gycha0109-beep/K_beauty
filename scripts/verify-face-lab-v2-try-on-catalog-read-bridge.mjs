#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  FACE_LAB_SHADE_PROFILE_VERSION
} from "../lib/face-lab-v2/product-variant-authority.js";
import {
  FACE_LAB_TRY_ON_CATALOG_READ_BRIDGE_VERSION,
  resolveFaceLabTryOnCatalogRead,
  prepareFaceLabTryOnCatalogRead
} from "../lib/face-lab-v2/try-on-catalog-read-bridge.js";

const actorId = "f1111111-1111-4111-8111-111111111111";
const otherActor = "f2222222-2222-4222-8222-222222222222";
const productId = "a1111111-1111-4111-8111-111111111111";
const subjectId = "b1111111-1111-4111-8111-111111111111";
const taxonomyVersion = "test-canonical-v1";
const png = (seed) => Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,seed,seed+1,seed+2,seed+3]);
const digest = buffer => createHash("sha256").update(buffer).digest("hex");
const source = png(1);
const pixels = png(10);

function selection({slotKey="lip_color",shade="coral",categoryKey="lip"}={}) {
  const attrs = {hueFamily:"coral_orange",opacity:"medium"};
  const term = `${taxonomyVersion}:category:${categoryKey}`;
  return {
    slotKey,
    product:{id:productId},
    subject:{
      subject_id:subjectId,
      product_id:productId,
      variant_key:shade,
      identity_status:"resolved",
      current_state:"current"
    },
    taxonomyVersion:{version:taxonomyVersion,lifecycle_state:"active",authority_mode:"canonical"},
    taxonomyTerm:{
      term_id:term,taxonomy_version:taxonomyVersion,
      axis:"category",term_key:categoryKey,lifecycle_state:"active"
    },
    taxonomyAssignment:{
      product_id:productId,
      taxonomy_version:taxonomyVersion,
      category_term_id:term,
      assignment_state:"canonical"
    },
    categoryBinding:{
      approvalState:"approved",
      mappingVersion:"catalog-fixture-v1",
      taxonomyVersion,
      categoryTermId:term,
      tryOnCategoryKey:categoryKey,
      evidenceRefs:["catalog_taxonomy_review:approved-lip"]
    },
    variant:{
      productId,variantId:shade,
      identityVersion:"test-variant-v1",
      identityState:"resolved",lifecycleState:"active",
      variantAxes:{shade,market:"KR"},
      identityEvidenceRefs:[`product_fact_subject:${subjectId}`],
      sourceVariantRefs:[`product_fact_subject:${subjectId}`],
      shadeProfile:{
        profileVersion:FACE_LAB_SHADE_PROFILE_VERSION,
        shadeKey:shade,displayLabel:shade,
        attributes:attrs,
        evidenceRefsByAttribute:Object.fromEntries(Object.keys(attrs).map(key=>[
          key,[`catalog_attribute_review:${key}`]
        ])),
        colorAnchors:[]
      }
    },
    capabilityClaims:[{
      capabilityKey:slotKey,
      supportState:"supported",
      proofClass:"governed_catalog_attribute_mapping",
      proofVersion:"catalog-fixture-v1",
      evidenceRefs:[`catalog_slot_review:${slotKey}`]
    }]
  };
}
const selections = {
  lip_color:selection(),
  lip_finish:selection({slotKey:"lip_finish"})
};
const refs = Object.values(selections).map(s=>({
  assetRef:`brand_swatch:${s.slotKey}`,
  candidateRef:`product_variant:${productId}:coral`,
  slotKey:s.slotKey,
  role:"brand_swatch",
  evidenceRef:`brand_swatch_review:${s.slotKey}`,
  approvalState:"approved",
  assetStatus:"active",
  usagePermission:"virtual_try_on",
  storageKind:"governed_blob",
  storageKey:`catalog/face-lab/${s.slotKey}.png`,
  mimeType:"image/png",byteLength:pixels.length,sha256:digest(pixels)
}));
const inputs = Object.keys(selections).map(slotKey=>({productId,subjectId,slotKey}));
function readers({
  mutateSelection = null,
  mutateAssets = null,
  crashSelection = false
}={}) {
  return {
    readAuthorizedSelection:async ({actorId:viewer,slotKey,...scope})=>{
      if(crashSelection)throw Error("private database issue");
      const original = selections[slotKey];
      const reply = {
        contractVersion:FACE_LAB_TRY_ON_CATALOG_READ_BRIDGE_VERSION,
        actorId:viewer,
        status:"authorized",
        selection:structuredClone(original)
      };
      return mutateSelection ? mutateSelection(reply,{actorId:viewer,slotKey,...scope}) : reply;
    },
    readAuthorizedAssets:async ({actorId:viewer})=>{
      const reply = {
        contractVersion:FACE_LAB_TRY_ON_CATALOG_READ_BRIDGE_VERSION,
        actorId:viewer,status:"authorized",
        assets:structuredClone(refs)
      };
      return mutateAssets ? mutateAssets(reply) : reply;
    }
  };
}
const resolve=(extra={})=>resolveFaceLabTryOnCatalogRead({
  actorId,sessionId:"catalog-session-1",
  requests:[...inputs].reverse(),
  ...readers(),
  ...extra
});
let rejected=0;
function deny(result,reason) {
  assert.equal(result.status,"invalid",JSON.stringify(result));
  assert.equal(result.reason,reason);
  assert.equal(result.imageModelInvoked,false);
  rejected++;
}
const base=await resolve();
assert.equal(base.status,"ready",JSON.stringify(base));
assert.equal(base.authority.status,"ready");
assert.equal(base.referenceManifest.length,0);
assert.equal(base.authority.providerPayload,null);
assert.equal(base.renderSpec.operations.length,2);
assert.equal(base.catalogAssets.length,2);
assert.deepEqual(base.provenance.map(x=>x.slotKey),["lip_color","lip_finish"]);
assert.equal(base.imageModelInvoked,false);

let calls=0;
const prepared=await prepareFaceLabTryOnCatalogRead({
  resolved:base,sourceImageBuffer:source,sourceMimeType:"image/png",
  loadAuthorizedBlob:async descriptor=>{
    assert.equal(descriptor.actorId,actorId);
    assert.ok(["brand_swatch:lip_color","brand_swatch:lip_finish"].includes(descriptor.assetRef));
    assert.equal(descriptor.byteLength,pixels.length);
    calls++;
    return Buffer.from(pixels);
  }
});
assert.equal(prepared.status,"ready",JSON.stringify(prepared));
assert.equal(prepared.referenceManifest.length,2);
assert.deepEqual(prepared.referenceManifest.map(x=>x.providerImageIndex),[2,3]);
assert.equal(prepared.providerRequest.status,"ready");
assert.equal(prepared.providerRequest.referenceImages.length,2);
assert.equal(prepared.imageModelInvoked,false);
assert.equal(calls,2);
assert.ok(!base.catalogAssets.some(x=>Buffer.isBuffer(x.imageBuffer)));

deny(await resolve({actorId:null}),"actor_identity_required");
deny(await resolve({requests:[]}),"catalog_read_contract_invalid");
deny(await resolve({requests:[...inputs,inputs[0]]}),"catalog_read_contract_invalid");
deny(await resolve({requests:[{...inputs[0],referenceAssets:[]}]}),"catalog_read_contract_invalid");
deny(await resolve({requests:[{...inputs[0],slotKey:"not_registered"}]}),"catalog_read_contract_invalid");
deny(await resolve({...readers({crashSelection:true})}),"catalog_selection_read_unavailable");
deny(await resolve({...readers({mutateSelection:reply=>({...reply,actorId:otherActor})})}),
  "catalog_selection_authorization_mismatch");
deny(await resolve({...readers({mutateSelection:reply=>({...reply,status:"unreviewed"})})}),
  "catalog_selection_authorization_mismatch");
deny(await resolve({...readers({mutateSelection:reply=>({
  ...reply,selection:{...reply.selection,subject:{...reply.selection.subject,subject_id:otherActor}}
})})}),"catalog_selection_authorization_mismatch");
deny(await resolve({...readers({mutateSelection:reply=>({
  ...reply,selection:{...reply.selection,taxonomyVersion:{
    ...reply.selection.taxonomyVersion,authority_mode:"shadow_only"
  }}
})})}),"taxonomy_not_canonical");
deny(await resolve({...readers({mutateAssets:reply=>({...reply,actorId:otherActor})})}),
  "catalog_assets_authorization_mismatch");
deny(await resolve({...readers({mutateAssets:reply=>({
  ...reply,assets:[...reply.assets,{
    ...reply.assets[0],
    candidateRef:"product_variant:unselected",
    assetRef:"brand_swatch:unselected"
  }]
})})}),"catalog_assets_scope_violation");
deny(await resolve({...readers({mutateAssets:reply=>({
  ...reply,assets:reply.assets.map(a=>({...a,usagePermission:"none"}))
})})}),"catalog_reference_not_governed");
deny(await resolve({...readers({mutateAssets:reply=>({...reply,assets:[]})})}),
  "catalog_reference_unavailable");

const badPrepare=await prepareFaceLabTryOnCatalogRead({
  resolved:{...base,actorId:otherActor,status:"invalid"},
  sourceImageBuffer:source,sourceMimeType:"image/png",
  loadAuthorizedBlob:async()=>pixels
});
deny(badPrepare,"catalog_preparation_contract_invalid");
deny(await prepareFaceLabTryOnCatalogRead({
  resolved:base,sourceImageBuffer:source,sourceMimeType:"image/png",
  loadAuthorizedBlob:async()=>{throw Error("private storage unavailable");}
}),"catalog_reference_blob_unavailable");
deny(await prepareFaceLabTryOnCatalogRead({
  resolved:base,sourceImageBuffer:source,sourceMimeType:"image/png",
  loadAuthorizedBlob:async()=>png(55)
}),"catalog_reference_blob_integrity_failed");

console.log(JSON.stringify({
  status:"PASS",
  trustedReadRequests:inputs.length,
  referenceCount:prepared.referenceManifest.length,
  rejectedCases:rejected,
  referenceByteChecks:true,
  untrustedScopeBlocked:true,
  providerCalls:0
}));
