#!/usr/bin/env node
// D8K-9: synthetic/recorded-old-snapshot parent ID diagnostic regressions.
// NO trusted SQL executor, no browser/client access, no production price/CTA.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
 inspectManualOptionCapture, prepareIndependentOptionReview
} from "../../lib/commerce/product-offer-manual-review-intake-v1.mjs";
import {
 reconcileManualOptionParentIdentity,D8K9_PARENT_READ_CONTRACT
} from "../../lib/commerce/product-offer-parent-identity-reconciliation-v1.mjs";

const uid=n=>"00000000-0000-4000-8000-"+n.toString(16).padStart(12,"0");
const now="2026-10-15T06:15:00.000Z";
const observed="2026-10-15T04:30:00.000Z";
const reviewed="2026-10-15T05:30:00.000Z";
const hash="a".repeat(64);
const checks={
 product_listing_scope:"matched",selected_sku:"matched",
 pack_gift_composition:"matched",selected_option_price:"matched",
 shipping_conditions:"matched",capture_origin:"matched",
 product_vs_offer_attribution:"matched"
};
const manifest=(p={})=>({
 productId:uid(1),offerId:uid(2),observationId:uid(3),
 sellerKey:"hwahae",sellerName:"HW (synthetic)",
 listingId:"12345",sourceUrl:"https://www.hwahae.co.kr/goods/12345",
 brand:"Synthetic Brand",productName:"Synthetic Cream",optionKind:"single",
 sellerOptionKey:"selected80",variantId:"sku80",unitSize:80,
 sizeUnit:"ml",quantity:1,gifts:[],
 selectedOptionPriceKrw:25000,shippingPriceKrw:null,
 shippingPriceBasis:"unknown",sourceEvidenceSha256:hash,
 sourceName:"local_capture",sourceRecordId:"capture_one",
 collectorActorKey:"collector_one",observedAt:observed,...p
});
const reviewFields=m=>({
 reviewId:uid(4),observationId:m.observationId,reviewedAt:reviewed,
 reviewerReference:"offline_independent_review",
 reviewerActorKey:"reviewer_two",sourceEvidenceSha256:hash,
 verdict:"verified",checks:{...checks}
});
function packet(m=manifest()){
 const c=inspectManualOptionCapture({
  manifest:m,actualArtifactSha256:hash,nowIso:now,maxAgeMs:86400000
 });
 assert.equal(c.status,"CAPTURE_METADATA_MATCH_ONLY");
 const r=prepareIndependentOptionReview({
  capture:c,review:reviewFields(m),nowIso:now,maxAgeMs:86400000
 });
 assert.equal(r.status,"INDEPENDENT_REVIEW_PACKET_READY_NO_WRITE");
 return {capture:c,review:r};
}
const product=(p={})=>({
 id:uid(1),brand:"Synthetic Brand",name:"Synthetic Cream",
 category:"moisturizer_cream",size_ml:80,...p
});
const parent=(p={})=>({
 offer_id:uid(2),product_id:uid(1),seller_key:"hwahae",
 seller_name:"HW (synthetic)",source_name:"manual",
 listing_id:"12345",listing_url:"https://www.hwahae.co.kr/goods/12345",
 price_amount:25000,currency_code:"KRW",market_code:"KR",
 offer_state:"current",product_scope_state:"product",
 availability_state:"in_stock",link_health_state:"healthy",...p
});
const snapshot=(p={})=>{
 const matched=parent();
 return {
  observedAt:"2026-10-15T06:14:00.000Z",
  queryProductId:uid(1),product:product(),
  offerRead:{
   read_contract_version:D8K9_PARENT_READ_CONTRACT,
   status:"AUTHORITY_RESOLVED",offers:[matched]
  },
  bySellerListing:[matched],bySellerUrl:[matched],
  ...p
 };
};
const run=(args={})=>{
 const p=packet();
 return reconcileManualOptionParentIdentity({
  ...p,snapshot:snapshot(),nowIso:now,maxSnapshotAgeMs:300000,...args
 });
};
let assertions=0;
function eq(a,b,m){assert.deepEqual(a,b,m);assertions++;}
function resultHolds(args,reason){
 const r=run(args);eq(r.status,"HOLD");eq(r.reason,reason);
 eq(r.priceEvidenceProjection,null);eq(r.sellerPriceDisplayAuthorized,false);
 eq(r.directCtaAuthorized,false);eq(r.actualDbSnapshotAuthenticated,false);
 eq(r.writeAuthorized,false);
}
const good=run();
eq(good.status,"PARENT_LISTING_MATCH_DIAGNOSTIC_ONLY");
eq(good.boundProductId,uid(1));
eq(good.boundOfferId,uid(2));
eq(good.matchedListingCount,1);
eq(good.sourceSellerClass,"hwahae");
eq(good.sourceOptionIdentity,"selected80");
for(const field of [
 "actualDbSnapshotAuthenticated","ownerSourceVerified",
 "productFactSubjectProven","recommendationAdmissionProven",
 "authenticatedReviewerProven","optionEvidenceAuthenticated",
 "writeAuthorized","privateServerReadAuthorized",
 "sellerPriceDisplayAuthorized","directCtaAuthorized",
 "productionReleaseAuthorized"
])eq(good[field],false);
for(const secret of ["price_amount","listing_url","selected_option_price_krw",
 "observedPrice","shipping_price_krw","ctaHref","offers","product"]){
 eq(Object.hasOwn(good,secret),false,secret);
}
eq(JSON.stringify(good).includes("25000"),false);
eq(JSON.stringify(good).includes("https://"),false);

// Distinct genuine options may share the SAME parent seller/listing.
const pack=packet(manifest({
 observationId:uid(13),sellerOptionKey:"kit80",variantId:"kit80",
 optionKind:"kit",quantity:2,gifts:[{skuId:"bonus10",quantity:1}],
 shippingPriceKrw:3000,shippingPriceBasis:"seller_published_flat"
}));
const kit=reconcileManualOptionParentIdentity({
 ...pack,snapshot:snapshot(),nowIso:now
});
eq(kit.status,"PARENT_LISTING_MATCH_DIAGNOSTIC_ONLY");
eq(kit.boundOfferId,uid(2));
eq(kit.sourceOptionIdentity,"kit80");
eq(kit.sellerPriceDisplayAuthorized,false);

resultHolds({snapshot:null},"PARENT_SNAPSHOT_MISSING");
resultHolds({snapshot:snapshot({observedAt:"2026-10-14T00:00:00Z"})},
 "PARENT_SNAPSHOT_STALE_OR_TIME_UNKNOWN");
resultHolds({snapshot:snapshot({observedAt:"2026-10-16T00:00:00Z"})},
 "PARENT_SNAPSHOT_STALE_OR_TIME_UNKNOWN");
resultHolds({maxSnapshotAgeMs:null},"PARENT_SNAPSHOT_STALE_OR_TIME_UNKNOWN");
resultHolds({snapshot:snapshot({queryProductId:uid(5)})},
 "SNAPSHOT_PRODUCT_QUERY_NOT_BOUND");
resultHolds({snapshot:snapshot({product:product({id:uid(5)})})},
 "CATALOG_PRODUCT_IDENTITY_MISMATCH");
resultHolds({snapshot:snapshot({product:product({brand:"Other brand"})})},
 "CATALOG_PRODUCT_IDENTITY_MISMATCH");
resultHolds({snapshot:snapshot({product:product({name:"Different Product"})})},
 "CATALOG_PRODUCT_IDENTITY_MISMATCH");
resultHolds({snapshot:snapshot({product:product({size_ml:null})})},
 "CATALOG_PRODUCT_UNIT_SUBJECT_UNRESOLVED");
resultHolds({snapshot:snapshot({product:product({size_ml:160})})},
 "CATALOG_UNIT_SIZE_VS_SELECTED_OPTION_CONFLICT");
resultHolds({snapshot:snapshot({product:product({size_ml:100})})},
 "CATALOG_UNIT_SIZE_VS_SELECTED_OPTION_CONFLICT");
resultHolds({snapshot:snapshot({offerRead:{...snapshot().offerRead,
  read_contract_version:"product-offer-presentation-authority-read-v1"}})},
 "PRODUCT_OFFER_V2_READ_CONTRACT_UNRESOLVED");
resultHolds({snapshot:snapshot({offerRead:{...snapshot().offerRead,status:"NO_AUTHORITY"}})},
 "PRODUCT_OFFER_V2_READ_CONTRACT_UNRESOLVED");
resultHolds({snapshot:snapshot({offerRead:{...snapshot().offerRead,offers:[]}})},
 "PARENT_OFFER_NOT_FOUND_IN_PRODUCT_SCOPE");
resultHolds({snapshot:snapshot({offerRead:{...snapshot().offerRead,
 offers:[parent({offer_id:uid(20)})]}})},
 "PARENT_OFFER_NOT_FOUND_IN_PRODUCT_SCOPE");
resultHolds({snapshot:snapshot({offerRead:{...snapshot().offerRead,
 offers:[parent({product_id:uid(20)})]}})},
 "PRODUCT_SCOPED_OFFER_ROW_INVALID");
resultHolds({snapshot:snapshot({offerRead:{...snapshot().offerRead,
 offers:[parent(),parent()]}})},
 "PRODUCT_OFFER_ID_OR_LISTING_COLLISION");
resultHolds({snapshot:snapshot({offerRead:{...snapshot().offerRead,
 offers:[parent(),parent({offer_id:uid(20)})]}})},
 "PRODUCT_OFFER_ID_OR_LISTING_COLLISION");
resultHolds({snapshot:snapshot({offerRead:{...snapshot().offerRead,
 offers:[parent(),parent({offer_id:uid(20),listing_id:"54321"})]}})},
 "PRODUCT_OFFER_ID_OR_LISTING_COLLISION");

// Disjoint seller listing URL is allowed as an *extra* candidate, not a
// replacement for the exact parent: no accidental global offer selection.
const disjoint=parent({
 offer_id:uid(33),seller_key:"oliveyoung",seller_name:"OY",
 listing_id:"Z321",listing_url:"https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=Z321"
});
eq(run({snapshot:snapshot({
 offerRead:{...snapshot().offerRead,offers:[disjoint,parent()]}
})}).status,"PARENT_LISTING_MATCH_DIAGNOSTIC_ONLY");

for(const patch of [
 {seller_key:"oliveyoung"},
 {seller_name:"Fake Seller"},
 {listing_id:"45194"},
 {listing_id:null}
])resultHolds({snapshot:snapshot({offerRead:{
 ...snapshot().offerRead,offers:[parent(patch)]
}})},"PARENT_SELLER_OR_LISTING_ID_MISMATCH");
for(const listing_url of [
 "https://www.hwahae.co.kr/goods/45194",
 "https://evil.hwahae.co.kr/goods/12345",
 "http://www.hwahae.co.kr/goods/12345",
 "https://www.hwahae.co.kr/goods/12345?utm_source=tracking"
])resultHolds({snapshot:snapshot({offerRead:{
 ...snapshot().offerRead,offers:[parent({listing_url})]
}})},"PARENT_LISTING_URL_OR_SELECTED_VARIANT_MISMATCH");
for(const patch of [
 {offer_state:"retired"},
 {product_scope_state:"product_subject_unresolved"},
 {currency_code:"USD"},
 {market_code:"US"}
])resultHolds({snapshot:snapshot({offerRead:{
 ...snapshot().offerRead,offers:[parent(patch)]
}})},"PARENT_OFFER_NOT_CURRENT_OR_PRODUCT_SCOPED");
for(const availability_state of ["unknown","out_of_stock","discontinued"])
 resultHolds({snapshot:snapshot({offerRead:{
  ...snapshot().offerRead,offers:[parent({availability_state})]
 }})},"PARENT_OFFER_STOCK_NOT_CONFIRMED");
for(const link_health_state of ["unchecked","unknown","suspect","broken"])
 resultHolds({snapshot:snapshot({offerRead:{
  ...snapshot().offerRead,offers:[parent({link_health_state})]
 }})},"PARENT_OFFER_LINK_HEALTH_NOT_CONFIRMED");
resultHolds({snapshot:snapshot({bySellerListing:[]})},
 "GLOBAL_SELLER_LISTING_COLLISION_NOT_EXCLUDED");
resultHolds({snapshot:snapshot({bySellerUrl:[]})},
 "GLOBAL_SELLER_LISTING_COLLISION_NOT_EXCLUDED");
resultHolds({snapshot:snapshot({bySellerListing:[parent(),parent()]})},
 "GLOBAL_SELLER_LISTING_COLLISION_NOT_EXCLUDED");
resultHolds({snapshot:snapshot({bySellerListing:[parent({product_id:uid(50)})]})},
 "GLOBAL_LISTING_OR_URL_ROW_DIVERGENCE");
resultHolds({snapshot:snapshot({bySellerUrl:[parent({offer_id:uid(50)})]})},
 "GLOBAL_LISTING_OR_URL_ROW_DIVERGENCE");
resultHolds({snapshot:snapshot({bySellerUrl:[parent({listing_url:"https://www.hwahae.co.kr/goods/45194"})]})},
 "GLOBAL_LISTING_OR_URL_ROW_DIVERGENCE");

// A different seller/listing cannot be substituted into the D8K-8 capture,
// even if Product/Offer IDs and observation hash remain the same.
let swapped=packet(manifest({listingId:"98765",sourceUrl:"https://www.hwahae.co.kr/goods/98765"}));
resultHolds({...swapped},"PARENT_SELLER_OR_LISTING_ID_MISMATCH");
const editedCapture={...packet().capture,
 sourceLocator:{...packet().capture.sourceLocator,listingUrl:"https://www.hwahae.co.kr/goods/45194"}};
resultHolds({capture:editedCapture},"PARENT_LISTING_URL_OR_SELECTED_VARIANT_MISMATCH");
resultHolds({review:{...packet().review,
 privateObservationCandidate:{...packet().review.privateObservationCandidate,
 selected_option_price_krw:100}}},"CAPTURE_REVIEW_IDENTITY_INCONSISTENT");
resultHolds({review:{...packet().review,status:"REJECTION_PACKET_READY_NO_WRITE"}},
 "CAPTURE_REVIEW_IDENTITY_INCONSISTENT");
resultHolds({capture:{...packet().capture,sourceLocator:null}},
 "CAPTURE_REVIEW_IDENTITY_INCONSISTENT");
resultHolds({capture:{...packet().capture,productId:uid(40)}},
 "CAPTURE_REVIEW_IDENTITY_INCONSISTENT");

// Coupang: bare parent listing URL can map to a SELECTED item+vendor URL,
// but a DIFFERENT selected query must not be treated as that same option.
const coupang=packet(manifest({
 sellerKey:"coupang",sellerName:"Coupang (synthetic)",
 listingId:"8393759227",
 sourceUrl:"https://www.coupang.com/vp/products/8393759227?itemId=16093987610&vendorItemId=89624202743",
 sellerOptionKey:"item_16093987610_vendor_89624202743"
}));
const bareParent=parent({
 seller_key:"coupang",seller_name:"Coupang (synthetic)",
 listing_id:"8393759227",
 listing_url:"https://www.coupang.com/vp/products/8393759227"
});
const snapC=snapshot({
 offerRead:{...snapshot().offerRead,offers:[bareParent]},
 bySellerListing:[bareParent],bySellerUrl:[bareParent]
});
const cRes=reconcileManualOptionParentIdentity({...coupang,snapshot:snapC,nowIso:now});
eq(cRes.status,"PARENT_LISTING_MATCH_DIAGNOSTIC_ONLY");
eq(cRes.directCtaAuthorized,false);
const variantParent={...bareParent,listing_url:
 "https://www.coupang.com/vp/products/8393759227?itemId=999&vendorItemId=89624202743"};
eq(reconcileManualOptionParentIdentity({...coupang,snapshot:snapshot({
 offerRead:{...snapshot().offerRead,offers:[variantParent]},
 bySellerListing:[variantParent],bySellerUrl:[variantParent]
}),nowIso:now}).reason,"PARENT_LISTING_URL_OR_SELECTED_VARIANT_MISMATCH");

// Current R16I recorded snapshot: 160ml legacy Product, no parent offers,
// and product_fact_subjects=[] -> must remain HOLD, never invent offer_id.
const r16i=JSON.parse(readFileSync(
 "fixtures/recommendation-metadata/r16i-d8f-candidate-d4-readonly-prestate-20261013.json","utf8"));
const old=r16i.snapshot;
const historical=manifest({
 productId:old.product.id,brand:old.product.brand,productName:old.product.name,
 listingId:"45194",sourceUrl:"https://www.hwahae.co.kr/goods/45194",
 sellerName:"화해",offerId:uid(44)
});
const oldPack=packet(historical);
const oldSnapshot=snapshot({
 product:old.product,queryProductId:old.product.id,
 offerRead:{...snapshot().offerRead,offers:old.offers_by_product},
 bySellerListing:old.offers_by_listing,bySellerUrl:old.offers_by_url
});
eq(reconcileManualOptionParentIdentity({
 ...oldPack,snapshot:oldSnapshot,nowIso:now
}).reason,"CATALOG_UNIT_SIZE_VS_SELECTED_OPTION_CONFLICT");
eq(reconcileManualOptionParentIdentity({
 ...oldPack,snapshot:{...oldSnapshot,product:{...old.product,size_ml:80}},
 nowIso:now
}).reason,"PARENT_OFFER_NOT_FOUND_IN_PRODUCT_SCOPE");
eq(old.subjects.length,0);
eq(old.offers_by_product.length,0);

// Static safety; exact real Offer/RPC source should not silently drift.
for(const [path,re] of [
 ["supabase/migrations/20260910103000_product_offers_shadow_v1.sql",
  /unique index if not exists product_offers_seller_listing_id_key/],
 ["supabase/migrations/20260925121815_product_offers_health_presentation_read_v2.sql",
  /product-offer-presentation-authority-read-v2/],
 ["lib/commerce/product-offer-manual-review-intake-v1.mjs",
  /sourceLocator:Object.freeze/],
 ["lib/commerce/product-offer-parent-identity-reconciliation-v1.mjs",
  /sellerPriceDisplayAuthorized:false/]
]){
 assert.match(readFileSync(path,"utf8"),re);assertions++;
}
const source=readFileSync("lib/commerce/product-offer-parent-identity-reconciliation-v1.mjs","utf8");
for(const re of [/fetch\(/,/createClient\(/,/\.rpc\(/,/process\.env/,/supabase\.from\(/]){
 assert.doesNotMatch(source,re);assertions++;
}
console.log(JSON.stringify({
 status:"PASS",stage:"D8K9_CANONICAL_PRODUCT_PARENT_OFFER_COLLISION_BINDING_SHADOW",
 assertions,offlineSyntheticOnly:true,legacyR16iBlocked:true,
 independentGlobalListingProbesRequired:true,
 nativeDatabaseRpcInvoked:false,realSellerCaptureVerified:false,
 actualProductFactSubjectAttested:false,productionWriteAuthorized:false,
 pricePublished:false,directCtaAuthorized:false
}));
