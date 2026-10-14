#!/usr/bin/env node
// D8K-0: offline source-contract + real pure price formatter checks.
// No API, network, database, checkout, or production data dependency.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatKnownProductPriceLabel, normalizeKnownProductPrice } from
  "../../lib/product-price-read-contract.mjs";

const read = (path) => readFileSync(path, "utf8");
const invalid = [null, undefined, "", "  ", 0, "0", -1, "-1",
  NaN, Infinity, -Infinity, "NaN", "Infinity", false, true, [], {}, [24500]];
const locales = [
  { locale: "ko", pending: "가격 정보 확인 중", suffix: "원" },
  { locale: "en", pending: "Price pending", suffix: " KRW" }
];
let priceAssertions = 0;
for (const { locale, pending, suffix } of locales) {
  for (const value of invalid) {
    assert.equal(normalizeKnownProductPrice(value), null);
    assert.equal(formatKnownProductPriceLabel(value, null, locale), pending);
    assert.equal(formatKnownProductPriceLabel(null, value, locale), pending);
    assert.equal(formatKnownProductPriceLabel(value, value, locale), pending);
    priceAssertions += 4;
  }
  assert.equal(formatKnownProductPriceLabel(24500, null, locale), "24,500" + suffix);
  assert.equal(formatKnownProductPriceLabel(null, 24500, locale), "24,500" + suffix);
  assert.equal(formatKnownProductPriceLabel(24500, 24500, locale), "24,500" + suffix);
  assert.equal(formatKnownProductPriceLabel(24500, 29900, locale), "24,500~29,900" + suffix);
  assert.equal(formatKnownProductPriceLabel("24500", "29900", locale), "24,500~29,900" + suffix);
  assert.equal(formatKnownProductPriceLabel(29900, 24500, locale), pending);
  assert.equal(formatKnownProductPriceLabel(0, 24500, locale), "24,500" + suffix);
  assert.equal(formatKnownProductPriceLabel(24500, 0, locale), "24,500" + suffix);
  priceAssertions += 8;
}

const free = read("app/result/page.js");
const freeCard = read("components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx");
const premium = read("app/result/full-report/page.js");
const functional = read("components/full-report/PremiumFunctionalDecisionSection.jsx");
const model = read("lib/premium-functional-display-model.js");
const routine = read("components/full-report/PremiumRoutineConsultSection.jsx");
const source = read("lib/product-source.js");
const analysis = read("app/api/analyze/route.js");
const savedReport = read("app/api/full-report/route.js");
const shareLoader = read("components/result/SharedResultLoader.jsx");
const shareCard = read("components/result/ResultShareCard.jsx");
const myHistory = read("components/my/SavedReportHistory.jsx");

// This is the mounted free-v2 route; ProductDecisionCard is legacy defined
// but not mounted from current ResultContent resultSteps.
const steps = free.slice(free.indexOf("const resultSteps = [];"),
  free.indexOf("const totalResultSteps = resultSteps.length;"));
assert(steps.length > 1500);
assert.match(steps, /<FreeResultV2RecommendationGuideStep/);
assert.match(steps, /preview=\{freeResultV2TopPick\}/);
assert.doesNotMatch(steps, /<ProductDecisionCard|<RecommendedProductsStep/);
assert.match(free, /buildFreeResultV2TopPick\(result\?\.topPick,/);
assert.match(freeCard, /product=\{preview\.product\}/);
assert.match(freeCard, /\{preview\.product\.name\}/);
assert.doesNotMatch(freeCard, /resolveProductPurchaseLink|buy_link/);

// Current premium route is SkinMatchStepReport. Many old standalone cards
// exist as declarations but are not mounted in the 5-step hub flow.
const skin = premium.slice(premium.indexOf("function SkinMatchStepReport("),
  premium.indexOf("function buildDevelopmentReport("));
assert(skin.length > 4000);
assert.match(skin, /<PremiumRoutineConsultSection/);
assert.match(skin, /<PremiumFunctionalDecisionSection/);
assert.doesNotMatch(skin, /<TopPickHeroCard|<AlternativeBudgetPlanStep|<ProductUsageGuideStep/);
assert.match(premium, /<SkinMatchStepReport/);
assert.match(premium, /sessionStorage\.getItem\("skinTestResult"\)/);
assert.match(premium, /fetch\("\/api\/full-report"/);
assert.match(savedReport, /loadSavedPremiumReport\(/);

// Routine can be canonical or fallback; merely having a step.product is
// not proof that it is a trusted, catalog-ID-bound purchase candidate.
assert.match(routine, /function getCanonicalSteps\(report, activeMode\)/);
assert.match(routine, /plan\?\.morningSteps/);
assert.match(routine, /canonicalSteps \|\| buildSteps\(/);
assert.match(routine, /<RoutineConsultProductInline product=\{step\.product\}/);
assert.match(routine, /<CurrentProductSlotNote/);

// Functional plan can be canonical or legacy adapter. An arbitrary product
// object or fallback name must not be treated as authorized seller identity.
assert.match(model, /report\?\.functionalPlan/);
assert.match(model, /source: "legacy_adapter"/);
assert.match(functional, /resolvePremiumFunctionalDisplayModel/);
assert.match(functional, /productsForTab\(plan, tab\)/);
assert.match(functional, /formatKnownProductPriceLabel\(product\?\.price_min, product\?\.price_max, locale\)/);
assert.doesNotMatch(functional, /Number\(product\?\.price_min\)|Number\(product\?\.price_max\)/);
assert.match(functional, /plan\.planMode === "HOLD"/);

// Existing canonical Product, Analyze and saved Product still have legacy
// single buy_link, not a connected multi-Offer consumer or new API fields.
assert.match(source, /id: String\(product\.id\)/);
assert.match(source, /buy_link: getTrustedDirectPurchaseUrl/);
assert.match(source, /price_range: getKnownProductPriceRange/);
assert.match(analysis, /price_min: normalizeKnownProductPrice\(item\?\.price_min\)/);
assert.match(analysis, /buy_link: getTrustedDirectPurchaseUrl/);

// Share renders recommendations as names only. Do not claim full Offer
// comparison has been mounted there, and never change public share auth.
assert.match(shareLoader, /<ResultShareCard/);
assert.match(shareCard, /topPick\.name/);
assert.match(shareCard, /\.\.\.categoryPicks/);
assert.doesNotMatch(shareCard, /buy_link|click_buy_link/);
assert.match(myHistory, /report\.href/);

console.log(JSON.stringify({
  status: "PASS",
  stage: "D8K0_ACTIVE_SURFACE_NULL_PRICE_BASELINE",
  priceAssertions,
  invalidPriceInputs: invalid.length,
  locales: locales.map(x => x.locale),
  activeFreeSellerComparisons: 0,
  activePremiumSellerComparisons: 0,
  legacyCardsAreNotMountedInActiveFlow: true,
  allRecommendedProductIdsAuthorizedForOfferRead: false,
  shareAndSavedResultsAreNotOfferHydrated: true,
  apiFieldsChanged: false,
  productWrites: 0,
  offerWrites: 0,
  productionReleaseAuthorized: false
}));
