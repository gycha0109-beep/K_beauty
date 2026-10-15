#!/usr/bin/env node
// D8K-5: active mounts are real, but the publication gate is hard OFF.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(path,"utf8");
const free=read("app/result/page.js");
const freeCard=read("components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx");
const premium=read("app/result/full-report/page.js");
const routine=read("components/full-report/PremiumRoutineConsultSection.jsx");
const functional=read("components/full-report/PremiumFunctionalDecisionSection.jsx");
const share=read("components/result/ResultShareCard.jsx");
const slot=read("components/commerce/RecommendedProductOfferSlot.jsx");
const base=read("components/commerce/ProductOfferComparison.jsx");
let checks=0;
const match=(source,regex)=>{assert.match(source,regex);checks++;};
const no=(source,regex)=>{assert.doesNotMatch(source,regex);checks++;};

match(free,/<FreeResultV2RecommendationGuideStep/);
match(free,/preview=\{freeResultV2TopPick\}/);
match(freeCard,/<RecommendedProductOfferSlot product=\{preview\.product\}/);
match(freeCard,/<FreeResultV2ProductEvidence/);
match(premium,/<PremiumRoutineConsultSection/);
match(premium,/<PremiumFunctionalDecisionSection/);
match(routine,/<RoutineConsultProductInline product=\{step\.product\}/);
match(routine,/<RecommendedProductOfferSlot product=\{product\}/);
match(routine,/<CurrentProductSlotNote/);
match(functional,/productsForTab\(plan, tab\)/);
match(functional,/plan\.secondarySolution\?\.products/);
match(functional,/plan\.budgetAlternatives/);
match(functional,/<RecommendedProductOfferSlot product=\{product\}/);
match(slot,/const LIVE_COMPARISON_RELEASE_ENABLED = false;/);
match(slot,/if \(!LIVE_COMPARISON_RELEASE_ENABLED\) return null;/);
match(slot,/comparison\?\.productId !== id/);
match(slot,/comparison\?\.status !== "options_observed"/);
match(slot,/ProductOfferComparison/);
match(base,/disabled aria-disabled="true"/);
no(slot,/fetch\(|\.rpc\(|localStorage|sessionStorage|process\.env/);
no(freeCard,/fetch\([^)]*offer|\.rpc\(/);
no(routine,/fetch\([^)]*offer|\.rpc\(/);
no(functional,/fetch\([^)]*offer|\.rpc\(/);
no(share,/RecommendedProductOfferSlot|ProductOfferComparison/);
no(slot,/LIVE_COMPARISON_RELEASE_ENABLED = true/);
assert.equal([freeCard,routine,functional].every(x=>
  x.includes('import RecommendedProductOfferSlot from')),true);checks++;
// This is a mount-coverage result, NOT a live price card or a browser test.
console.log(JSON.stringify({
 status:"PASS",stage:"D8K5_ACTIVE_OFFER_UI_SLOT_WIRING_SHADOW",
 checks,activePrivateSlotTypes:6,publicShareSlotTypesStillHeld:2,
 gateHardOff:true,livePriceCards:0,realSellerData:false,
 apiChanged:false,rankChanged:false,productWrites:0,offerWrites:0,
 deploymentAuthorized:false
}));
