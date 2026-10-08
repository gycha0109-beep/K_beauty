#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  FACE_LAB_SHADE_PROFILE_VERSION
} from "../lib/face-lab-v2/product-variant-authority.js";
import {
  FACE_LAB_CATALOG_REFERENCE_RESOLVER_VERSION,
  bindFaceLabCatalogTryOnReferences,
  prepareFaceLabCatalogTryOnReferences
} from "../lib/face-lab-v2/catalog-reference-resolver.js";

const P1="a1111111-1111-4111-8111-111111111111";
const P2="a2222222-2222-4222-8222-222222222222";
const S1="b1111111-1111-4111-8111-111111111111";
const S2="b2222222-2222-4222-8222-222222222222";
const VER="test-makeup-v1";
const img=(x)=>Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,x,x+1,x+2,x+3]);
const sha=(b)=>createHash("sha256").update(b).digest("hex");

function product({
  productId=P1,subjectId=S1,variantId="coral-01",
  category="lip",slot="lip_color",attributes={hueFamily:"coral_orange",finish:"glossy"}
}={}) {
  const term=`${VER}:category:${category}`;
  return {
    product:{id:productId},
    subject:{
      subject_id:subjectId,product_id:productId,
      variant_key:"formula-v1",identity_status:"resolved",current_state:"current"
    },
    subjectVariantBridge:{
      productId,subjectId,variantId,subjectVariantKey:"formula-v1",
      mappingVersion:"reviewed-v1",approvalState:"approved",
      evidenceRefs:[`variant_review:${productId}-${variantId}`]
    },
    taxonomyVersion:{version:VER,lifecycle_state:"active",authority_mode:"canonical"},
    taxonomyTerm:{term_id:term,term_key:category,taxonomy_version:VER,axis:"category",lifecycle_state:"active"},
    taxonomyAssignment:{product_id:productId,taxonomy_version:VER,category_term_id:term,assignment_state:"canonical"},
    categoryBinding:{
      approvalState:"approved",mappingVersion:"manual-v1",taxonomyVersion:VER,
      categoryTermId:term,tryOnCategoryKey:category,evidenceRefs:[`catalog_taxonomy_review:${category}`]
    },
    variant:{
      productId,variantId,identityState:"resolved",lifecycleState:"active",
      identityVersion:"resolved-test-v1",
      variantAxes:{shade:variantId,market:"KR"},
      identityEvidenceRefs:[`product_fact_subject:${subjectId}`],
      sourceVariantRefs:[`product_fact_subject:${subjectId}`],
      shadeProfile:{
        profileVersion:FACE_LAB_SHADE_PROFILE_VERSION,shadeKey:variantId,
        displayLabel:variantId,attributes,
        evidenceRefsByAttribute:Object.fromEntries(Object.keys(attributes).map(k=>[
          k,[`catalog_attribute_review:${productId}-${k}`]
        ])),
        colorAnchors:[]
      }
    },
    capabilityClaims:[{
      capabilityKey:slot,supportState:"supported",
      proofClass:"governed_catalog_attribute_mapping",
      proofVersion:"manual-v1",
      evidenceRefs:[`catalog_attribute_review:${productId}-${slot}`]
    }],
    slotKey:slot
  };
}
const lip=product();
const lens=product({
  productId:P2,subjectId:S2,variantId:"gray-01",
  category:"color_lens",slot:"iris_appearance",
  attributes:{hueFamily:"gray",undertone:"cool"}
});
const fixtures=[
  {
    assetRef:"catalog_image:lip-product",
    candidateRef:`product_variant:${P1}:coral-01`,
    slotKey:"lip_color",role:"product_image",
    evidenceRef:"catalog_image_review:lip-product",
    imageBuffer:img(21)
  },
  {
    assetRef:"brand_swatch:lip-swatch",
    candidateRef:`product_variant:${P1}:coral-01`,
    slotKey:"lip_color",role:"brand_swatch",
    evidenceRef:"brand_swatch_review:lip-swatch",
    imageBuffer:img(31)
  },
  {
    assetRef:"wearing_reference:lens",
    candidateRef:`product_variant:${P2}:gray-01`,
    slotKey:"iris_appearance",role:"wearing_reference",
    evidenceRef:"applied_reference_review:gray-lens",
    imageBuffer:img(41)
  }
].map((f,i)=>({
  ...f,
  approvalState:"approved",assetStatus:"active",
  usagePermission:"virtual_try_on",storageKind:"governed_blob",
  storageKey:`catalog/tryon/ref-${i+1}.png`,
  mimeType:"image/png",
  byteLength:f.imageBuffer.length,
  sha256:sha(f.imageBuffer)
}));

const withNoBytes=fixtures.map(({imageBuffer,...meta})=>meta);
const bound=bindFaceLabCatalogTryOnReferences({
  sessionId:"catalog-refs-fixture",
  productSelections:[lip,lens],
  catalogAssets:withNoBytes
});
assert.equal(FACE_LAB_CATALOG_REFERENCE_RESOLVER_VERSION,"face-lab-catalog-reference-resolver-v1");
assert.equal(bound.status,"ready",JSON.stringify(bound));
assert.equal(bound.authority.status,"ready");
assert.equal(bound.authority.referenceAssets.length,3);
assert.deepEqual(bound.authority.referenceAssets.map(r=>r.assetRef),[
  "wearing_reference:lens",
  "brand_swatch:lip-swatch",
  "catalog_image:lip-product"
]);
assert.equal(bound.imageModelInvoked,false);
const unreviewed=structuredClone(lip);
unreviewed.subjectVariantBridge.approvalState="pending";
assert.equal(bindFaceLabCatalogTryOnReferences({sessionId:"rejected",productSelections:[unreviewed],catalogAssets:withNoBytes}).reason,
  "subject_variant_mapping_not_approved");
const source=img(1);
const loaded=[];
const prepare=(authority,assets,loader)=>prepareFaceLabCatalogTryOnReferences({
  authority,catalogAssets:assets,
  sourceImageBuffer:source,sourceMimeType:"image/png",
  loadApprovedBlob:loader
});
const loader=async ({assetRef,storageKey})=>{
  loaded.push({assetRef,storageKey});
  return fixtures.find(x=>x.assetRef===assetRef)?.imageBuffer;
};
const prepared=await prepare(bound.authority,withNoBytes,loader);
assert.equal(prepared.status,"ready",JSON.stringify(prepared));
assert.equal(prepared.providerRequest.status,"ready");
assert.deepEqual(prepared.referenceManifest.map(r=>r.providerImageIndex),[2,3,4]);
assert.deepEqual(prepared.referenceManifest.map(r=>r.assetRef),bound.authority.referenceAssets.map(r=>r.assetRef));
assert.deepEqual(loaded.map(r=>r.assetRef),bound.authority.referenceAssets.map(r=>r.assetRef));
assert.ok(prepared.providerRequest.instruction.includes("Image 1 is the source portrait"));
assert.equal(prepared.imageModelInvoked,false);
assert.ok(prepared.resolvedReferenceImages.every(r=>Buffer.isBuffer(r.imageBuffer)));

let blocked=0;
function mustFail(result,reason){
  assert.equal(result.status,"invalid",JSON.stringify(result));
  assert.equal(result.reason,reason);
  assert.equal(result.imageModelInvoked,false);
  blocked++;
}
const bind=(a=withNoBytes,selections=[lip,lens])=>
  bindFaceLabCatalogTryOnReferences({
    sessionId:"bad-fixture",productSelections:selections,catalogAssets:a
  });
mustFail(bind([], [lip]),"catalog_reference_unavailable");
mustFail(bind(withNoBytes,[{...lip,referenceAssets:[{assetRef:"manual:unreviewed"}]}]),
  "unreviewed_reference_descriptors_forbidden");
mustFail(bind(withNoBytes.map((r,i)=>i===0?{...r,usagePermission:"none"}:r)),
  "catalog_reference_not_governed");
mustFail(bind(withNoBytes.map((r,i)=>i===0?{...r,storageKey:"../outside.png"}:r)),
  "catalog_reference_not_governed");
mustFail(bind(withNoBytes.map((r,i)=>i===0?{...r,storageKey:"https://bad.host/ref.png"}:r)),
  "catalog_reference_not_governed");
mustFail(bind(withNoBytes.map((r,i)=>i===0?{...r,approvalState:"pending"}:r)),
  "catalog_reference_not_governed");
const wrongSlot=withNoBytes.map((r,i)=>i===2?{...r,slotKey:"lip_color"}:r);
mustFail(bind(wrongSlot),"catalog_reference_unavailable");

let unsafeLoaderCalls=0;
const never=async()=>{unsafeLoaderCalls++;throw Error("should not read");};
mustFail(await prepare(bound.authority,withNoBytes.slice(1),never),"catalog_reference_count_mismatch");
mustFail(await prepare(bound.authority,withNoBytes.map((r,i)=>i===1?{...r,sha256:"bad"}:r),never),
  "catalog_reference_not_governed");
mustFail(await prepare(bound.authority,withNoBytes.map((r,i)=>i===1?{...r,candidateRef:"product_variant:other"}:r),never),
  "catalog_reference_binding_mismatch");
const oversizedMetadata=withNoBytes.map((r,i)=>({
  ...r,
  byteLength:[20,20,12][i]*1024*1024
}));
mustFail(await prepare(bound.authority,oversizedMetadata,never),
  "catalog_reference_total_bytes_exceeded");
assert.equal(unsafeLoaderCalls,0,"invalid metadata must be rejected before blob loader");

mustFail(await prepare(bound.authority,withNoBytes,async()=>img(91)),"catalog_reference_blob_integrity_failed");
mustFail(await prepare(bound.authority,withNoBytes,async()=>Buffer.from([0,1,2,3])),
  "catalog_reference_blob_integrity_failed");
mustFail(await prepare(bound.authority,withNoBytes,async()=>{throw Error("blob 404")}),
  "catalog_reference_blob_unavailable");

const duplicateAssets=[withNoBytes[0],withNoBytes[0],withNoBytes[2]];
mustFail(await prepare(bound.authority,duplicateAssets,never),
  "catalog_reference_asset_ref_duplicate");
const surplus=[...withNoBytes,withNoBytes[0]];
mustFail(await prepare(bound.authority,surplus,never),"catalog_reference_count_mismatch");
assert.equal(prepared.referenceManifest.some(x=>("imageBuffer" in x)||("storageKey" in x)),false);
console.log(JSON.stringify({
  status:"PASS",
  referenceCount:prepared.referenceManifest.length,
  testsBlocked:blocked,
  realProviderCalls:0,
  deterministicReferenceOrder:true,
  storageGuard:true,
  evidenceBound:true
}));
