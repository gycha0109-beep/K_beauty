#!/usr/bin/env node
// D8K-4: pure active-slot mapping and source anchors. No seller/DB/browser calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACTIVE_RECOMMENDATION_SURFACES, collectActiveRecommendationOfferSlots
} from "../../lib/commerce/active-recommendation-offer-slots-v1.mjs";
const uuidA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const uuidB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const uuidC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const mock = (id, name = "Fixture") => ({ id, name, brand:"Mock" });
const empty = collectActiveRecommendationOfferSlots();
check(empty.slotKinds, ["F-01","P-01","P-02","P-03","P-04","P-05","S-01","S-02"]);
check(empty.slotKinds, [...ACTIVE_RECOMMENDATION_SURFACES]);
check(empty.rows.length, 0);
check(empty.candidateIdsForLaterPrivateAdmission, []);
check(empty.privateReadAuthorized, false);
check(empty.sellerPriceAuthority, false);
check(empty.selectedOptionAuthority, false);
check(empty.directCtaAuthority, false);
check(empty.publicShareReadAuthorized, false);
check(empty.productionReleaseAuthorized, false);

const input = {
  freeResult:{ topPick: mock(uuidA.toUpperCase()) },
  premiumReport:{ routinePlan:{
    morningSteps:[{product:mock(uuidA)}],
    nightSteps:[{product:mock(uuidA)}, {product:mock("legacy-id")}]
  }, currentProducts:[mock(uuidC)] },
  functionalPlan:{
    planMode:"START",
    productCandidates:[mock(uuidB)],
    secondarySolution:{products:[{product:mock(uuidA)}]},
    budgetAlternatives:[mock(uuidC)]
  },
  publicShare:{topPick:mock(uuidB),categoryPicks:[mock(uuidC)]}
};
const all = collectActiveRecommendationOfferSlots(input);
check(all.rows.map(x=>x.slot),
  ["F-01","P-01","P-02","P-02","P-03","P-04","P-05","S-01","S-02"]);
check(all.candidateIdsForLaterPrivateAdmission,[uuidA,uuidB,uuidC]);
check(all.rows.filter(x=>x.identityState==="CANDIDATE_ID_ONLY").length,6);
check(all.rows.filter(x=>x.identityState==="HOLD_IDENTITY").length,1);
check(all.rows.filter(x=>x.identityState==="HOLD_EXPOSURE_AUTHORITY").length,2);
check(all.rows.filter(x=>x.commerceReadAuthorized || x.comparisonAuthorized || x.directCtaAuthorized).length,0);
check(all.rows[7].reason,"PUBLIC_SHARE_AUTHORITY_REQUIRED");
check(all.rows[3].productId,null);
// Current owned products cannot turn into new commerce product candidates.
check(all.rows.filter(x=>x.productId===uuidC).length,2);
// Even syntactically valid IDs in public share are excluded from private reads.
const shareOnly = collectActiveRecommendationOfferSlots({publicShare:input.publicShare});
check(shareOnly.candidateIdsForLaterPrivateAdmission,[]);
check(shareOnly.rows.length,2);
const shareOverflow = collectActiveRecommendationOfferSlots({publicShare:{
  topPick:mock(uuidA),categoryPicks:Array.from({length:12},(_,i)=>mock(uuidB,i+""))
}});
check(shareOverflow.rows.length,5);
check(shareOverflow.rows.filter(row=>row.slot==="S-02").length,4);
const hold = collectActiveRecommendationOfferSlots({
 functionalPlan:{...input.functionalPlan,planMode:"HOLD"}
});
check(hold.candidateIdsForLaterPrivateAdmission,[]);
check(hold.rows.every(row=>row.identityState==="HOLD_EXPOSURE_AUTHORITY"),true);
const legacy = collectActiveRecommendationOfferSlots({
 freeResult:{topPick:{name:"Same name",brand:"Mock",buy_link:"https://example.com",price_min:24000}},
 functionalPlan:{planMode:"START",productCandidates:[{product:{name:"Same name",brand:"Mock"}}]}
});
check(legacy.candidateIdsForLaterPrivateAdmission,[]);
check(legacy.rows.every(row=>row.identityState==="HOLD_IDENTITY"),true);
check(legacy.rows.every(row=>!("observedPrice" in row || "href" in row)),true);
const budget = collectActiveRecommendationOfferSlots({
 functionalPlan:{planMode:"START",budgetAlternatives:[mock(uuidC),mock(uuidB),mock(uuidA)]}
});
check(budget.rows.map(r=>r.productId),[uuidC,uuidB,uuidA]);
check(budget.rankingChanged,false);

const read = p => readFileSync(p,"utf8");
const free = read("app/result/page.js"), freeCard = read("components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx");
const premium = read("app/result/full-report/page.js");
const routine = read("components/full-report/PremiumRoutineConsultSection.jsx");
const functional = read("components/full-report/PremiumFunctionalDecisionSection.jsx");
const model = read("lib/premium-functional-display-model.js");
const share = read("components/result/ResultShareCard.jsx");
const saved = read("app/api/full-report/route.js");
const freeSteps = free.slice(free.indexOf("const resultSteps = [];"),free.indexOf("const totalResultSteps = resultSteps.length;"));
assert.match(freeSteps, /<FreeResultV2RecommendationGuideStep/);checks++;
assert.match(free, /buildFreeResultV2TopPick\(result\?\.topPick/);checks++;
assert.match(freeCard, /product=\{preview\.product\}/);checks++;
const premiumSteps = premium.slice(premium.indexOf("function SkinMatchStepReport("),
  premium.indexOf("function buildDevelopmentReport("));
assert.match(premiumSteps, /<PremiumRoutineConsultSection/);checks++;
assert.match(premiumSteps, /<PremiumFunctionalDecisionSection/);checks++;
assert.doesNotMatch(premiumSteps, /<TopPickHeroCard|<ProductUsageGuideStep|<BudgetAlternativesStep/);checks++;
assert.match(routine, /plan\?\.morningSteps/);checks++;
assert.match(routine, /plan\?\.nightSteps/);checks++;
assert.match(routine, /<RoutineConsultProductInline product=\{step\.product\}/);checks++;
assert.match(routine, /<CurrentProductSlotNote/);checks++;
assert.match(functional, /productsForTab\(plan, tab\)/);checks++;
assert.match(functional, /resolvePremiumFunctionalDisplayModel/);checks++;
assert.match(model, /source: "legacy_adapter"/);checks++;
assert.match(share, /visibleProducts = \[topPick, \.\.\.categoryPicks\]/);checks++;
assert.match(saved, /loadSavedPremiumReport\(/);checks++;
assert.doesNotMatch(freeCard, /ProductOfferComparison/);checks++;
assert.doesNotMatch(functional, /ProductOfferComparison/);checks++;
assert.doesNotMatch(routine, /ProductOfferComparison/);checks++;
console.log(JSON.stringify({
 status:"PASS",stage:"D8K4_ACTIVE_RECOMMENDATION_OFFER_SLOT_BOUNDARY",
 checks,sourceSlotTypes:ACTIVE_RECOMMENDATION_SURFACES.length,
 productIdsAreOnlyCandidates:true,liveSellerComparisonsMounted:false,
 privateOfferRead:false,sharePriceOrCta:false,rankingChanged:false,
 dbWrites:0,apiFieldsChanged:false,releaseAuthorized:false
}));
