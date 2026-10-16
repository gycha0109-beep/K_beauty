#!/usr/bin/env node
// D8K-11: source-backed R16I existing archive review preflight tests.
// Synthetic image bytes/actors only; no Supabase calls, PII, prices or writes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  preflightExistingR16IEvidence,R16I_D8K11_PRODUCT_ID,
  R16I_D8K11_SOURCE_IDENTITIES
} from "../../lib/product-intelligence/r16i-d8k11-existing-evidence-preflight.mjs";

const now="2026-10-15T08:00:00.000Z";
const captured="2026-10-14T00:50:00.000Z";
const created="2026-10-14T01:55:00.000Z";
const reviewed="2026-10-15T07:00:00.000Z";
const officialId="97adb21c-3be4-4654-bce7-54b5dabb2423";
const bundleId="e0feb0e9-69f2-4ebf-bd14-0ccb320b3707";
const collector="00000000-0000-4000-8000-000000000011";
const reviewer="00000000-0000-4000-8000-000000000012";
const otherReviewer="00000000-0000-4000-8000-000000000013";
const fakePng=Buffer.concat([
 Buffer.from([137,80,78,71,13,10,26,10]),
 Buffer.from("D8K11_SYNTHETIC_IMAGE_BYTES_NOT_REAL_PNG")
]);
const fakeBundlePng=Buffer.concat([
 Buffer.from([137,80,78,71,13,10,26,10]),
 Buffer.from("D8K11_SYNTHETIC_BUNDLE_BYTES_NOT_REAL_PNG")
]);
const sha=b=>createHash("sha256").update(b).digest("hex");
const checks=Object.freeze({
 product_listing_scope:"matched",selected_sku:"matched",
 pack_gift_composition:"matched",selected_option_price:"matched",
 shipping_conditions:"matched",capture_origin:"matched",
 product_vs_offer_attribution:"matched"
});
const fields=[
 ["official_single",officialId,fakePng,24500],
 ["hwahae_bundle",bundleId,fakeBundlePng,29900]
];
function rows(){
 return fields.map(([source_key,evidence_id,image,checkout_price_krw])=>({
  evidence_id,product_id:R16I_D8K11_PRODUCT_ID,source_key,
  source_url:R16I_D8K11_SOURCE_IDENTITIES[source_key].url,
  selected_option:R16I_D8K11_SOURCE_IDENTITIES[source_key].option,
  checkout_price_krw,captured_at:captured,created_at:created,
  evidence_state:"UNVERIFIED",submitted_by:collector,
  object_path:R16I_D8K11_PRODUCT_ID+"/"+evidence_id+".png",
  file_sha256:sha(image),file_bytes:image.length,mime_type:"image/png"
 }));
}
const bytes=()=>new Map([[officialId,fakePng],[bundleId,fakeBundlePng]]);
const review=id=>({
 evidence_id:id,reviewer_id:reviewer,
 verdict:"VERIFIED",reason:"Independent seven-field metadata check only",
 reviewed_at:reviewed,checks:{...checks}
});
const reviews=()=>new Map([[officialId,review(officialId)],[bundleId,review(bundleId)]]);
let assertions=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);assertions++;}
function matches(value,regex){assert.match(value,regex);assertions++;}
function blocked(options,reason=null){
 const x=preflightExistingR16IEvidence({evidenceRows:rows(),
  archivedBytesByEvidenceId:bytes(),reviewByEvidenceId:reviews(),
  nowIso:now,...options
 });
 eq(x.status,"HOLD");if(reason)eq(x.reason,reason);
 eq(x.pricePublicationAuthorized,false);
 eq(x.directCtaAuthorized,false);
 eq(x.databaseWrites,0);
 eq(x.reviewerAccountAuthenticated,false);
 eq(x.legacySelfReviewProtectionVerified,false);
 return x;
}
const full=preflightExistingR16IEvidence({
 evidenceRows:rows(),archivedBytesByEvidenceId:bytes(),
 reviewByEvidenceId:reviews(),nowIso:now
});
eq(full.status,"TWO_REVIEW_METADATA_PACKETS_READY_NO_WRITE");
eq(full.reason,"AUTHENTICATED_REVIEW_AND_PRODUCT_FACT_AUTHORITY_UNPROVEN");
eq(full.archiveBytesMatchedCount,2);
eq(full.reviewMetadataReadyCount,2);
eq(full.records.length,2);
eq(full.records[0].sourceKey,"official_single");
eq(full.records[0].expectedCreamQuantity,1);
eq(full.records[0].expectedCreamUnitMl,80);
eq(full.records[0].expectedGiftSerumMl,0);
eq(full.records[1].sourceKey,"hwahae_bundle");
eq(full.records[1].expectedCreamQuantity,2);
eq(full.records[1].expectedGiftSerumMl,10);
for(const property of [
 "archivedFileAuthenticityProven","sellerPageCurrentlyAuthentic",
 "reviewerAccountAuthenticated","legacySelfReviewProtectionVerified",
 "existingOwnerVerdictVerified","productFactApproved","parentOfferBound",
 "pricePublicationAuthorized","directCtaAuthorized","releaseAuthorized"
])eq(full[property],false);
eq(full.databaseWrites,0);
for(const sensitive of [sha(fakePng),sha(fakeBundlePng),
 "24500","29900",collector,reviewer,"object_path",
 "source_url","checkout_price_krw"]){
 eq(JSON.stringify(full).includes(sensitive),false);
}
// Metadata alone must never prove archived bytes.
let result=blocked({archivedBytesByEvidenceId:null});
eq(result.archiveBytesMatchedCount,0);
eq(result.reviewMetadataReadyCount,0);
eq(result.records.every(r=>r.reason==="PRIVATE_ARCHIVE_BYTES_REQUIRED"),true);
result=blocked({reviewByEvidenceId:null});
eq(result.archiveBytesMatchedCount,2);
eq(result.reviewMetadataReadyCount,0);
eq(result.records.every(r=>r.reason==="INDEPENDENT_REVIEW_NOT_SUBMITTED"),true);
blocked({nowIso:null},"FRESHNESS_POLICY_INVALID");
blocked({maxAgeMs:null},"FRESHNESS_POLICY_INVALID");
blocked({maxAgeMs:2592000001},"FRESHNESS_POLICY_INVALID");
blocked({evidenceRows:[]},"EXACT_TWO_DISTINCT_EVIDENCE_REQUIRED");
blocked({evidenceRows:[rows()[0]]},"EXACT_TWO_DISTINCT_EVIDENCE_REQUIRED");
blocked({evidenceRows:[...rows(),rows()[0]]},"EXACT_TWO_DISTINCT_EVIDENCE_REQUIRED");
blocked({evidenceRows:[rows()[0],rows()[0]]},"DUPLICATE_OR_WRONG_EVIDENCE_SCOPE");
blocked({evidenceRows:[rows()[1],rows()[1]]},"DUPLICATE_OR_WRONG_EVIDENCE_SCOPE");
blocked({evidenceRows:[rows()[0],{...rows()[1],source_key:"official_single"}]},
 "DUPLICATE_OR_WRONG_EVIDENCE_SCOPE");
blocked({evidenceRows:[{...rows()[0],source_key:"oliveyoung"},rows()[1]]},
 "DUPLICATE_OR_WRONG_EVIDENCE_SCOPE");
// Order does not confer any price/subject authority.
const reordered=preflightExistingR16IEvidence({
 evidenceRows:rows().reverse(),archivedBytesByEvidenceId:bytes(),
 reviewByEvidenceId:reviews(),nowIso:now
});
eq(reordered.status,"TWO_REVIEW_METADATA_PACKETS_READY_NO_WRITE");
eq(reordered.records[0].sourceKey,"official_single");
for(const [patch,reason] of [
 [{product_id:"00000000-0000-4000-8000-000000000099"},
  "EVIDENCE_PRODUCT_OR_SOURCE_IDENTITY_UNRESOLVED"],
 [{source_url:"https://www.hwahae.co.kr/goods/45194"},
  "SOURCE_OPTION_OR_REVIEW_STATE_MISMATCH"],
 [{selected_option:"수분크림 80ml×2 + 세럼 10ml"},
  "SOURCE_OPTION_OR_REVIEW_STATE_MISMATCH"],
 [{evidence_state:"VERIFIED"},"SOURCE_OPTION_OR_REVIEW_STATE_MISMATCH"],
 [{evidence_state:"REJECTED"},"SOURCE_OPTION_OR_REVIEW_STATE_MISMATCH"],
 [{checkout_price_krw:null},"CAPTURE_PRICE_OR_COLLECTOR_ID_MISSING"],
 [{checkout_price_krw:0},"CAPTURE_PRICE_OR_COLLECTOR_ID_MISSING"],
 [{checkout_price_krw:"24500"},"CAPTURE_PRICE_OR_COLLECTOR_ID_MISSING"],
 [{submitted_by:null},"CAPTURE_PRICE_OR_COLLECTOR_ID_MISSING"],
 [{captured_at:"2025-01-01T00:00:00.000Z"},"CAPTURE_STALE_OR_TIME_MISMATCH"],
 [{captured_at:"2030-01-01T00:00:00.000Z"},"CAPTURE_STALE_OR_TIME_MISMATCH"],
 [{created_at:"2026-10-13T00:00:00.000Z"},"CAPTURE_STALE_OR_TIME_MISMATCH"],
 [{created_at:"2026-10-16T00:00:00.000Z"},"CAPTURE_STALE_OR_TIME_MISMATCH"],
 [{file_sha256:"z".repeat(64)},"ARCHIVE_METADATA_INCOMPLETE"],
 [{file_sha256:"".padEnd(64,"0")},"ARCHIVE_BYTES_MAGIC_SIZE_OR_SHA_MISMATCH"],
 [{file_bytes:0},"ARCHIVE_METADATA_INCOMPLETE"],
 [{file_bytes:4194305},"ARCHIVE_METADATA_INCOMPLETE"],
 [{object_path:"../../.env.local"},"ARCHIVE_METADATA_INCOMPLETE"],
 [{object_path:"some-other-product/capture.png"},"ARCHIVE_METADATA_INCOMPLETE"],
 [{object_path:R16I_D8K11_PRODUCT_ID+"/not-a-uuid.png"},"ARCHIVE_METADATA_INCOMPLETE"],
 [{object_path:R16I_D8K11_PRODUCT_ID+"/"+officialId+".jpg"},"ARCHIVE_METADATA_INCOMPLETE"],
 [{mime_type:"application/pdf"},"ARCHIVE_METADATA_INCOMPLETE"],
 [{mime_type:"image/webp"},"ARCHIVE_METADATA_INCOMPLETE"],
 [{mime_type:"image/webp",object_path:R16I_D8K11_PRODUCT_ID+"/"+officialId+".webp"},"ARCHIVE_BYTES_MAGIC_SIZE_OR_SHA_MISMATCH"],
 [{file_bytes:fakePng.length+1},"ARCHIVE_BYTES_MAGIC_SIZE_OR_SHA_MISMATCH"]
]){
 const x=blocked({evidenceRows:[{...rows()[0],...patch},rows()[1]]});
 eq(x.records[0].reason,reason);
 eq(x.reviewMetadataReadyCount,1);
}
const tampered=new Map(bytes());
tampered.set(officialId,Buffer.concat([fakePng,Buffer.from("changed")]));
result=blocked({archivedBytesByEvidenceId:tampered});
eq(result.records[0].reason,"ARCHIVE_BYTES_MAGIC_SIZE_OR_SHA_MISMATCH");
const spoof=new Map(bytes());
spoof.set(officialId,Buffer.alloc(fakePng.length,65));
result=blocked({archivedBytesByEvidenceId:spoof});
eq(result.records[0].reason,"ARCHIVE_BYTES_MAGIC_SIZE_OR_SHA_MISMATCH");
for(const patch of [
 {reviewer_id:collector},
 {reviewer_id:null},
 {evidence_id:bundleId}
]){
 const xs=reviews();xs.set(officialId,{...review(officialId),...patch});
 result=blocked({reviewByEvidenceId:xs});
 eq(result.records[0].reason,"INDEPENDENT_REVIEWER_IDENTITY_NOT_SEPARATED");
}
for(const patch of [
 {verdict:"REJECTED"},
 {verdict:"HOLD"},
 {reviewed_at:"2026-10-13T00:00:00.000Z"},
 {reviewed_at:"2026-10-14T01:00:00.000Z"},
 {reviewed_at:"2026-10-16T00:00:00.000Z"},
 {reason:""},
 {reason:"approved"}
]){
 const xs=reviews();xs.set(officialId,{...review(officialId),...patch});
 result=blocked({reviewByEvidenceId:xs});
 eq(result.records[0].reason,"REVIEW_VERDICT_REASON_OR_TIME_MISSING");
}
for(const checksPatch of [
 {},{...checks,capture_origin:"unchecked"},
 {...checks,wrong:"matched"},
 {...checks,shipping_conditions:"unknown"}
]){
 const xs=reviews();xs.set(officialId,{...review(officialId),checks:checksPatch});
 result=blocked({reviewByEvidenceId:xs});
 eq(result.records[0].reason,"SEVEN_SOURCE_CHECKS_NOT_INDEPENDENTLY_ATTESTED");
}
const swappedBytes=new Map([[officialId,fakeBundlePng],[bundleId,fakePng]]);
result=blocked({archivedBytesByEvidenceId:swappedBytes});
eq(result.archiveBytesMatchedCount,0);
eq(result.reviewMetadataReadyCount,0);
// Actor UUID metadata is still NOT server authentication. Even different
// caller-provided UUIDs and all "matched" checks remain no-write.
const second=new Map(reviews());
second.set(bundleId,{...review(bundleId),reviewer_id:otherReviewer});
const declared=preflightExistingR16IEvidence({
 evidenceRows:rows(),archivedBytesByEvidenceId:bytes(),
 reviewByEvidenceId:second,nowIso:now
});
eq(declared.status,"TWO_REVIEW_METADATA_PACKETS_READY_NO_WRITE");
eq(declared.reviewerAccountAuthenticated,false);

// D8K-11 originally found that only owner role (not independent review)
// was checked. D8K-12 repairs the server write path through an atomic DB
// function that rejects an authenticated owner's own submitted capture.
// The protected migration is code-only and NOT installed in hosted DB yet.
const legacyLedger=readFileSync(
 "lib/product-intelligence/r16i-correction-approval-ledger.mjs","utf8");
const reviewRegion=legacyLedger.split(
 "export async function reviewR16IEvidence(client,input,actorId) {")[1]?.split(
 "export async function createR16IProposal(")[0];
assert.ok(reviewRegion);assertions++;
matches(reviewRegion,/review_r16i_evidence_v2/);
assert.doesNotMatch(reviewRegion,/from\(VERDICTS\)\.insert\(/);assertions++;
const d8k12Schema=readFileSync(
 "supabase/migrations/20261015185000_taxonomy_ai_r16i_d8k12_owner_review_revocation_v1.sql","utf8");
matches(d8k12Schema,/e\.submitted_by=p_actor_id/);
matches(d8k12Schema,/D8K12_REVIEWER_CANNOT_APPROVE_OWN_CAPTURE/);
matches(d8k12Schema,/D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION/);
const existingRoute=readFileSync(
 "app/api/admin/products/r16i-correction-review/approval/route.js","utf8");
matches(existingRoute,/ownerOnly&&a\.access\.role!==ADMIN_ROLES\.OWNER/);
const existingUI=readFileSync(
 "app/admin/products/r16i-correction-review/R16IR4D8PrivateEvidence.js","utf8");
matches(existingUI,/expiresInSeconds!==60/);
const actual=JSON.parse(readFileSync(
 "fixtures/recommendation-metadata/r16i-d8k10-live-select-only-snapshot-20261015.json","utf8"));
eq(actual.existingR16IEvidence.capturedRecords,2);
eq(actual.existingR16IEvidence.verifiedRecords,0);
eq(actual.existingR16IEvidence.unverifiedRecords,2);
eq(actual.parentOffers.byProduct,0);
eq(actual.selectedOptionStorage.observationTableExists,false);
eq(actual.correctionWorkflow.releaseGateEnabled,false);
const implementation=readFileSync(
 "lib/product-intelligence/r16i-d8k11-existing-evidence-preflight.mjs","utf8");
for(const forbidden of [/fetch\(/,/\.rpc\(/,/createSignedUrl\(/,/\.storage\.from\(/,
 /supabase\.from\(/,/process\.env/]){
 assert.doesNotMatch(implementation,forbidden);assertions++;
}
console.log(JSON.stringify({
 status:"PASS",stage:"D8K11_EXISTING_ARCHIVE_SOURCE_AND_REVIEWER_GUARD_SHADOW",
 assertions,existingEvidenceRows:2,legacyOwnerSelfReviewGuard:"REPAIRED_IN_D8K12_CODE_HOSTED_DB_NOT_MIGRATED",
 privateSourceBytesAccessed:false,
 allFileBytesInTestsSynthetic:true,
 verifiedMerchantSource:false,reviewerAccountAuthenticated:false,
 originalArchiveBytesVerified:false,
 productFactApproved:false,parentOfferAvailable:false,
 productionDbWrites:0,pricePublished:false,ctaAuthorized:false
}));
