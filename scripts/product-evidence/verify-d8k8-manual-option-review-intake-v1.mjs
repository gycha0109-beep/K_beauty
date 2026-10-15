#!/usr/bin/env node
// D8K-8 synthetic-only verification. Does not fetch any seller page or
// impersonate a real collector/reviewer. Public price and CTA stay OFF.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  inspectManualOptionCapture, prepareIndependentOptionReview,
  D8K8_REVIEW_CHECK_KEYS
} from "../../lib/commerce/product-offer-manual-review-intake-v1.mjs";
const uuid=n=>"00000000-0000-4000-8000-"+n.toString(16).padStart(12,"0");
const now="2026-10-15T06:00:00.000Z";
const observed="2026-10-15T03:30:00.000Z";
const reviewed="2026-10-15T04:30:00.000Z";
const digest="a".repeat(64);
const checkMap=Object.fromEntries(D8K8_REVIEW_CHECK_KEYS.map(k=>[k,"matched"]));
const mk=(extra={})=>({
  productId:uuid(1),offerId:uuid(2),observationId:uuid(3),
  brand:"Synthetic Brand",productName:"Synthetic Toner",
  sellerKey:"hwahae",sellerName:"Hwahae (synthetic)",listingId:"45194",
  sourceUrl:"https://www.hwahae.co.kr/goods/45194",
  sellerOptionKey:"sku80",variantId:"sku80",optionKind:"single",
  unitSize:80,sizeUnit:"ml",quantity:1,gifts:[],
  selectedOptionPriceKrw:24500,
  shippingPriceKrw:null,shippingPriceBasis:"unknown",
  observedAt:observed,sourceName:"manual_source_capture",
  sourceRecordId:"fixture1",collectorActorKey:"collector_one",
  sourceEvidenceSha256:digest,...extra
});
const judge=(more={})=>({
  reviewId:uuid(4),observationId:uuid(3),verdict:"verified",
  reviewerReference:"independent-review-fixture",
  reviewerActorKey:"reviewer_two",sourceEvidenceSha256:digest,
  reviewedAt:reviewed,checks:{...checkMap},...more
});
const inspect=(manifest=mk(),extra={})=>inspectManualOptionCapture({
  manifest,actualArtifactSha256:digest,nowIso:now,
  maxAgeMs:7*86400000,...extra
});
const prepare=(capture=inspect(),review=judge(),extra={})=>
  prepareIndependentOptionReview({
    capture,review,nowIso:now,maxAgeMs:7*86400000,...extra
  });
let assertions=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);assertions++;}
function yes(v,msg){assert.ok(v,msg);assertions++;}
function holdCapture(extra,reason,opts={}){
  const v=inspect(mk(extra),opts);
  eq(v.status,"HOLD");eq(v.reason,reason);
  eq(v.privateObservationCandidate,null);
  eq(v.publicPriceAuthorized,false);eq(v.productionWriteAuthorized,false);
}
function holdReview(extra,reason){
  const v=prepare(inspect(),judge(extra));
  eq(v.status,"HOLD");eq(v.reason,reason);
  eq(v.privateReviewEvent,null);eq(v.publicPriceAuthorized,false);
}
let capture=inspect();
eq(capture.status,"CAPTURE_METADATA_MATCH_ONLY");
eq(capture.privateObservationCandidate.observation_id,uuid(3));
eq(capture.privateObservationCandidate.gifts,[]);
eq(capture.privateObservationCandidate.shipping_price_krw,null);
eq(capture.privateObservationCandidate.source_evidence_sha256,digest);
eq(capture.sourceFileVerified,false); // SHA bytes matching != seller-authentic.
eq(capture.evidenceAuthenticityProven,false);
eq(capture.parentOfferDatabaseVerified,false);
eq(capture.publicPriceAuthorized,false);
eq(capture.directCtaAuthorized,false);
eq(capture.productionWriteAuthorized,false);
eq(Object.hasOwn(capture.privateObservationCandidate,"listing_url"),false);
eq(Object.hasOwn(capture.privateObservationCandidate,"sourceUrl"),false);

let pending=prepare(capture,null);
eq(pending.status,"AWAITING_INDEPENDENT_REVIEW");
eq(pending.privateReviewEvent,null);
eq(pending.productionWriteAuthorized,false);

let reviewedPacket=prepare();
eq(reviewedPacket.status,"INDEPENDENT_REVIEW_PACKET_READY_NO_WRITE");
eq(reviewedPacket.privateReviewEvent.verdict,"verified");
eq(reviewedPacket.privateReviewEvent.observation_id,uuid(3));
eq(reviewedPacket.privateObservationCandidate.selected_option_price_krw,24500);
eq(reviewedPacket.privateObservationCandidate.offer_id,uuid(2));
eq(reviewedPacket.sevenFieldReviewComplete,true);
eq(reviewedPacket.shadowReviewReason,"SERVER_REVIEW_IDENTITY_AND_SOURCE_NOT_PROVEN");
eq(reviewedPacket.reviewerAuthenticated,false);
eq(reviewedPacket.publicPriceAuthorized,false);
eq(reviewedPacket.directCtaAuthorized,false);
eq(reviewedPacket.productionWriteAuthorized,false);
eq(reviewedPacket.releaseAuthorized,false);
eq(JSON.stringify(reviewedPacket).includes("https://www.hwahae.co.kr"),false);

const rejected=prepare(inspect(),judge({verdict:"rejected",checks:{}}));
eq(rejected.status,"REJECTION_PACKET_READY_NO_WRITE");
eq(rejected.privateReviewEvent.verdict,"rejected");
eq(rejected.sevenFieldReviewComplete,false);
eq(rejected.publicPriceAuthorized,false);

// Valid but different selected-option compositions all remain internal.
capture=inspect(mk({
  optionKind:"kit",quantity:2,gifts:[{skuId:"serum10",quantity:1}],
  selectedOptionPriceKrw:29900,shippingPriceKrw:3000,
  shippingPriceBasis:"seller_published_flat"
}));
eq(capture.status,"CAPTURE_METADATA_MATCH_ONLY");
eq(capture.privateObservationCandidate.gifts,[{skuId:"serum10",quantity:1}]);
eq(capture.privateObservationCandidate.shipping_price_krw,3000);
capture=inspect(mk({shippingPriceKrw:0,shippingPriceBasis:"seller_published_flat"}));
eq(capture.status,"CAPTURE_METADATA_MATCH_ONLY");
eq(capture.privateObservationCandidate.shipping_price_krw,0);

for(const [seller,sourceUrl,listingId,brand] of [
 ["oliveyoung","https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000001","A000000001","Synthetic"],
 ["coupang","https://www.coupang.com/vp/products/12345","12345","Synthetic"],
 ["official","https://anua.com/products/heartleaf-serum","heartleaf-serum","Anua"]
]){
 const v=inspect(mk({sellerKey:seller,sourceUrl,listingId,brand}));
 eq(v.status,"CAPTURE_METADATA_MATCH_ONLY");
 eq(v.publicPriceAuthorized,false);
 eq(v.directCtaAuthorized,false);
}
// The direct CTA whitelist is borrowed only as a string identity heuristic.
for(const patch of [
 {sellerKey:"oliveyoung",sourceUrl:"https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=WRONG"},
 {sellerKey:"hwahae",sourceUrl:"https://www.hwahae.co.kr/goods/45194?token=SECRET"},
 {sellerKey:"hwahae",sourceUrl:"https://evil.hwahae.co.kr/goods/45194"},
 {sellerKey:"hwahae",sourceUrl:"http://www.hwahae.co.kr/goods/45194"},
 {sellerKey:"hwahae",sourceUrl:"https://user:pw@www.hwahae.co.kr/goods/45194"},
 {sellerKey:"coupang",sourceUrl:"https://www.coupang.com/vp/products/45194",listingId:"12345"},
 {sellerKey:"coupang",sourceUrl:"https://www.coupang.com/vp/products/12345?itemId=999",listingId:"12345"},
 {sellerKey:"official",sourceUrl:"https://fake-anua.com/products/heartleaf-serum",listingId:"heartleaf-serum",brand:"Anua"},
 {sellerKey:"official",sourceUrl:"https://anua.com/products/heartleaf-serum",listingId:"heartleaf-serum",brand:"Synthetic"},
 {sellerKey:"unknown",sourceUrl:"https://www.hwahae.co.kr/goods/45194"},
 {sourceUrl:"https://www.hwahae.co.kr/goods/45194#cart"},
 {sourceUrl:"https://www.hwahae.co.kr/goods/45194:443"},
 {listingId:"different"}
]){
 holdCapture(patch,"PRODUCT_LISTING_OR_CAPTURE_IDENTITY_UNRESOLVED");
}
holdCapture({sourceEvidenceSha256:"b".repeat(64)},
  "ARCHIVED_SOURCE_BYTES_DIGEST_MISMATCH");
const badBytes=inspect(mk(),{actualArtifactSha256:"b".repeat(64)});
eq(badBytes.reason,"ARCHIVED_SOURCE_BYTES_DIGEST_MISMATCH");
for(const price of [null,0,-1,2.5,Infinity,"24500",1000000001]){
 holdCapture({selectedOptionPriceKrw:price},"SELECTED_OPTION_PRICE_INVALID");
}
for(const patch of [
 {shippingPriceKrw:0,shippingPriceBasis:"unknown"},
 {shippingPriceKrw:null,shippingPriceBasis:"seller_published_flat"},
 {shippingPriceKrw:"0",shippingPriceBasis:"seller_published_flat"},
 {shippingPriceKrw:-1,shippingPriceBasis:"seller_published_flat"},
 {shippingPriceKrw:3000,shippingPriceBasis:"seller_estimate"}
]) holdCapture(patch,"SHIPPING_BASIS_UNATTESTED");
for(const patch of [
 {optionKind:"single",quantity:2},
 {optionKind:"multipack",quantity:1},
 {optionKind:"kit",gifts:[]},
 {optionKind:"kit",gifts:[{skuId:"gift10",quantity:0}]},
 {optionKind:"kit",gifts:[{skuId:"gift10",quantity:1},{skuId:"gift10",quantity:2}]},
 {optionKind:"single",gifts:[{skuId:"gift10",quantity:1}]},
 {unitSize:0},{sizeUnit:"oz"},{quantity:2.5},{gifts:{}},
 {optionKind:"unknown"}
]) holdCapture(patch,"SELECTED_SKU_PACK_COMPOSITION_INVALID");
for(const patch of [{observedAt:"2026-10-20T00:00:00Z"},
                    {observedAt:"2026-09-01T00:00:00Z"},
                    {observedAt:"tomorrow"}]){
 holdCapture(patch,"CAPTURE_STALE_OR_FUTURE");
}
eq(inspect(mk(),{maxAgeMs:null}).reason,"FRESHNESS_POLICY_MISSING");
eq(inspect(mk(),{nowIso:null}).reason,"FRESHNESS_POLICY_MISSING");
eq(inspect(mk(),{maxAgeMs:2592000001}).reason,"FRESHNESS_POLICY_MISSING");
for(const patch of [
 {offerId:"bad-id"},{productId:"bad-id"},{observationId:"bad-id"},
 {variantId:"bad id"},{sellerOptionKey:"bad space"},
 {collectorActorKey:"user name"},{sourceRecordId:""},
 {sellerName:""},{brand:""},{sourceName:"A BAD SOURCE"},
 {sourceEvidenceSha256:"g".repeat(64)}
])holdCapture(patch,"PRODUCT_LISTING_OR_CAPTURE_IDENTITY_UNRESOLVED");

holdReview({observationId:uuid(5)},"REVIEW_IDENTITY_DIGEST_OR_TIME_MISMATCH");
holdReview({sourceEvidenceSha256:"b".repeat(64)},"REVIEW_IDENTITY_DIGEST_OR_TIME_MISMATCH");
holdReview({reviewId:"bad"},"REVIEW_IDENTITY_DIGEST_OR_TIME_MISMATCH");
holdReview({reviewerReference:""},"REVIEW_IDENTITY_DIGEST_OR_TIME_MISMATCH");
holdReview({reviewerActorKey:"invalid actor"},"REVIEW_IDENTITY_DIGEST_OR_TIME_MISMATCH");
holdReview({reviewedAt:"2026-10-20T00:00:00Z"},"REVIEW_IDENTITY_DIGEST_OR_TIME_MISMATCH");
holdReview({reviewedAt:"2026-10-14T00:00:00Z"},"REVIEW_IDENTITY_DIGEST_OR_TIME_MISMATCH");
holdReview({verdict:"APPROVED"},"REVIEW_IDENTITY_DIGEST_OR_TIME_MISMATCH");
holdReview({reviewerActorKey:"collector_one"},"COLLECTOR_CANNOT_SELF_REVIEW");
for(const patch of [
 {checks:{}},
 {checks:{...checkMap,capture_origin:"uncertain"}},
 {checks:{...checkMap,unexpected:"matched"}},
 {checks:null},
 {checks:{...checkMap,shipping_conditions:"unknown_disclosed"}}
])holdReview(patch,"REVIEW_7_FIELD_ATTESTATION_INCOMPLETE");
eq(prepare(inspect(mk({sourceEvidenceSha256:"b".repeat(64)})),judge()).reason,
  "CAPTURE_NOT_READY_FOR_REVIEW");

// Existing R16I review workbench's seven prompts are reference/checklist
// patterns only; it is product-specific and does not authorize the new data.
const cli=readFileSync(
  "scripts/product-evidence/prepare-d8k8-local-option-review-v1.mjs","utf8");
const workbench=readFileSync(
  "app/admin/products/r16i-correction-review/R16ICorrectionEvidenceWorkbench.js","utf8");
const sql=readFileSync(
  "docs/taxonomy-ai/sql/d8k5-selected-option-evidence-schema-review-only.sql","utf8");
const scriptSource=readFileSync(
  "lib/commerce/product-offer-manual-review-intake-v1.mjs","utf8");
for(const [s,re] of [
  [cli,/createHash\("sha256"\)/],
  [cli,/localFile\(args\["--source"\],CAPTURE_LIMIT,true\)/],
  [cli,/lstatSync/],
  [cli,/stat\.isSymbolicLink\(\)/],
  [cli,/LOCAL_FILE_CHANGED_DURING_READ/],
  [cli,/privateDataLogged:false/],
  [cli,/sourceFilePersistedByTool:false/],
  [cli,/dbWrites:0/],
  [cli,/productionReleaseAuthorized:false/],
  [scriptSource,/selectLatestOptionReviewHistoryShadow/],
  [scriptSource,/resolveProductPurchaseLink/],
  [sql,/collector_actor_key text not null/],
  [sql,/reviewer_actor_key text not null/],
  [sql,/source_evidence_sha256 text not null/],
  [workbench,/brand_option/],
  [workbench,/brand_checkout/],
  [workbench,/seller_option/],
  [workbench,/seller_checkout/],
  [workbench,/serum_sku/],
  [workbench,/review_scope/],
  [workbench,/capture_origin/]
]){assert.match(s,re);assertions++;}
for(const re of [/fetch\(/,/createSupabaseAdminClient/,/\.rpc\(/,/process\.env/]){
 assert.doesNotMatch(scriptSource,re);assertions++;
}
console.log(JSON.stringify({
 status:"PASS",stage:"D8K8_MANUAL_REAL_SOURCE_INTAKE_SHADOW",
 assertions,syntheticOnly:true,externalCaptureReceived:false,
 realSellerPageFetched:false,sourceVisualContentExamined:false,
 reviewerIdentityAuthenticated:false,verifiedPricesPublished:0,
 databaseWrites:0,apiFieldsChanged:false,ctaAllowed:false
}));
