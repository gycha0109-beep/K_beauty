#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  R16I_PRICE_SCOPE_REVIEW_VERSION,
  R16I_SCREEN_LIST_PRICE_OBSERVATION_KRW,
  buildR16IPriceScopeReview
} from "../../lib/product-intelligence/r16i-price-scope-review-v1.mjs";
import {
  buildR16IR4D4LiveReview,R16I_PRODUCT_ID
} from "../../lib/product-offer-r16i-r4-d4-live-review.mjs";

const fixture=JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/r16i-d8f-candidate-d4-readonly-prestate-20261013.json",
  "utf8"
));
const view=buildR16IR4D4LiveReview(fixture.snapshot);
assert.equal(view.decision,"REVIEW_REQUIRED");
const nowIso="2026-10-14T04:00:00.000Z";
const evidence=[
  {evidenceId:"00000000-0000-4000-8000-000000000001",sourceKey:"official_single",
   selectedOption:"수분크림 80ml 1개",claimedCheckoutPrice:24500,
   capturedAt:"2026-10-14T00:50:00.000Z"},
  {evidenceId:"00000000-0000-4000-8000-000000000002",sourceKey:"hwahae_bundle",
   selectedOption:"수분크림 80ml×2 + 세럼 10ml",claimedCheckoutPrice:29900,
   capturedAt:"2026-10-14T00:50:00.000Z"}
];
const verdicts=evidence.map(e=>({evidenceId:e.evidenceId,verdict:"VERIFIED"}));
const args={view,evidence,verdicts,nowIso};
const plan=buildR16IPriceScopeReview(args);
assert.equal(plan.version,R16I_PRICE_SCOPE_REVIEW_VERSION);
assert.equal(plan.status,"REVIEW_REQUIRED");
assert.equal(plan.reason,"CANONICAL_PRODUCT_PRICE_AND_CTA_POLICY_UNRESOLVED");
assert.equal(plan.product.id,R16I_PRODUCT_ID);
assert.equal(plan.product.existingCreamVolumeMl,160);
assert.equal(plan.product.singlePresentationCandidateMl,80);
assert.equal(plan.product.canonicalPriceMinKrW,null);
assert.equal(plan.product.canonicalPriceMaxKrW,null);
assert.equal(plan.product.canonicalUnitPricePer10MlKrW,null);
assert.equal(plan.product.canonicalBuyLink,null);
assert.equal(plan.product.productWriteAuthorized,false);
assert.equal(plan.officialScreenListPriceKrW,R16I_SCREEN_LIST_PRICE_OBSERVATION_KRW);
assert.equal(plan.officialScreenListPriceKrW,35000);
assert.equal(plan.officialScreenListPriceProvenance,"USER_SCREENSHOT_DISPLAY_ONLY_NOT_LEDGER_FIELD");
assert.equal(plan.officialDiscountObservedKrW,10500);
assert.equal(plan.offerCandidates.length,2);
assert.deepEqual(plan.offerCandidates.map(x=>x.checkoutAmountKrW),[24500,29900]);
assert.deepEqual(plan.offerCandidates.map(x=>x.creamQuantity),[1,2]);
assert.deepEqual(plan.offerCandidates.map(x=>x.creamAggregateMl),[80,160]);
assert.deepEqual(plan.offerCandidates.map(x=>x.giftSerumMl),[0,10]);
assert(plan.offerCandidates.every(x=>x.offerInsertAuthorized===false&&x.purchaseLinkTrusted===false));
assert.equal(plan.bundleComponentsAuthority,"SELECTED_OPTION_LABEL_ONLY_NOT_INDEPENDENT_SKU");
assert.equal(plan.sourceUrlReattestedInThisModel,false);
assert.equal(plan.canonicalPriceAuthority,false);
assert.equal(plan.ownerPricePolicyApproved,false);
assert.equal(plan.productionWritesAuthorized,false);
assert.equal(plan.executableSql,null);
assert.equal(plan.product.creamSizeCanBeAppliedIndependently,false);

const denied=[
 ["UNVERIFIED_OFFICIAL",{...args,verdicts:[{...verdicts[0],verdict:"REJECTED"},verdicts[1]]},"OWNER_VERDICT_REQUIRED"],
 ["MISSING_OFFICIAL",{...args,evidence:evidence.slice(1)},"MISSING_OR_DUPLICATED_SELLER_EVIDENCE"],
 ["DUPLICATE_HWAHAE",{...args,evidence:[...evidence,evidence[1]]},"MISSING_OR_DUPLICATED_SELLER_EVIDENCE"],
 ["WRONG_OPTION",{...args,evidence:[{...evidence[0],selectedOption:"80ml×2"},evidence[1]]},"CHECKOUT_OPTION_PRICE_OR_FRESHNESS_INVALID"],
 ["WRONG_SELLER_KEY",{...args,evidence:[{...evidence[0],sourceKey:"hwahae_bundle"},evidence[1]]},"MISSING_OR_DUPLICATED_SELLER_EVIDENCE"],
 ["BLANK_CHECKOUT",{...args,evidence:[{...evidence[0],claimedCheckoutPrice:null},evidence[1]]},"CHECKOUT_OPTION_PRICE_OR_FRESHNESS_INVALID"],
 ["ZERO_CHECKOUT",{...args,evidence:[{...evidence[0],claimedCheckoutPrice:0},evidence[1]]},"CHECKOUT_OPTION_PRICE_OR_FRESHNESS_INVALID"],
 ["FRACTIONAL_CHECKOUT",{...args,evidence:[{...evidence[0],claimedCheckoutPrice:24500.1},evidence[1]]},"CHECKOUT_OPTION_PRICE_OR_FRESHNESS_INVALID"],
 ["STALE_CAPTURE",{...args,evidence:[{...evidence[0],capturedAt:"2026-01-01T00:00:00.000Z"},evidence[1]]},"CHECKOUT_OPTION_PRICE_OR_FRESHNESS_INVALID"],
 ["FUTURE_CAPTURE",{...args,evidence:[{...evidence[0],capturedAt:"2026-10-15T00:50:00.000Z"},evidence[1]]},"CHECKOUT_OPTION_PRICE_OR_FRESHNESS_INVALID"],
 ["MISSING_VERDICT",{...args,verdicts:verdicts.slice(1)},"OWNER_VERDICT_REQUIRED"],
 ["DUPLICATE_VERDICT",{...args,verdicts:[...verdicts,verdicts[0]]},"OWNER_VERDICT_REQUIRED"],
 ["STALE_PRODUCT_REVISION",{...args,view:{...view,revision_matches:false}},"GUARDED_VIEW_OR_TIME_MISSING"],
 ["INVALID_VIEW",{...args,view:{...view,decision:"BLOCKED"}},"GUARDED_VIEW_OR_TIME_MISSING"],
 ["PRODUCT_PRICE_DRIFT",{...args,view:{...view,reviewed_fields:view.reviewed_fields.map(r=>
   r.entity==="products"&&r.field==="price_min"?{...r,before:24500}:r)}},"PRODUCT_PRESTATE_OR_SCOPE_DRIFT"],
 ["PRODUCT_SIZE_DRIFT",{...args,view:{...view,reviewed_fields:view.reviewed_fields.map(r=>
   r.entity==="products"&&r.field==="size_ml"?{...r,before:80}:r)}},"PRODUCT_PRESTATE_OR_SCOPE_DRIFT"],
 ["TIME_UNDEFINED",{...args,nowIso:null},"GUARDED_VIEW_OR_TIME_MISSING"]
];
for(const [name,scenario,reason] of denied){
 const output=buildR16IPriceScopeReview(scenario);
 assert.equal(output.status,"BLOCKED",name);
 assert.equal(output.reason,reason,name);
 assert.equal(output.canonicalPriceAuthority,false,name);
 assert.equal(output.productionWritesAuthorized,false,name);
 assert.equal(output.executableSql,null,name);
}
const migration=readFileSync("supabase/migrations/20261012181320_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql","utf8");
const ui=readFileSync("app/admin/products/r16i-correction-review/R16IR4D8CorrectionApproval.js","utf8");
assert.match(migration,/intended_min<>official\.checkout_price_krw/);
assert.match(migration,/intended_max<>official\.checkout_price_krw/);
assert.match(migration,/INSERT INTO public\.product_offers\(/);
assert.match(ui,/buildR16IPriceScopeReview/);
assert.match(ui,/정상가 관측\/결제금액 분리/);
assert.match(ui,/대표가격 자동 확정 금지/);
assert.doesNotMatch(ui,/자동 승인.*D8D/);
console.log(JSON.stringify({
 status:"PASS",stage:"R16I_PRICE_SCOPE_REVIEW_SHADOW",
 testCases:denied.length+1,
 officialListKrW:plan.officialScreenListPriceKrW,
 officialSelectedCheckoutKrW:plan.offerCandidates[0].checkoutAmountKrW,
 hwahaeKitCheckoutKrW:plan.offerCandidates[1].checkoutAmountKrW,
 canonicalProductPriceApproved:false,offerInserts:0,
 productWrites:0,releaseAuthorized:false
}));
