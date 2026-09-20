#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PREMIUM_INTAKE_VERSION,
  sanitizePremiumIntake
} from "../lib/premium-intake.js";

const page = await readFile(
  new URL("../app/result/full-report/page.js", import.meta.url),
  "utf8"
);
const route = await readFile(
  new URL("../app/api/full-report/route.js", import.meta.url),
  "utf8"
);
const sharedContext = await readFile(
  new URL("../lib/shared-skin-decision-context.js", import.meta.url),
  "utf8"
);
const selector = await readFile(
  new URL("../components/current-products/CurrentProductsSelector.jsx", import.meta.url),
  "utf8"
);
const currentProducts = await readFile(
  new URL("../lib/current-products.js", import.meta.url),
  "utf8"
);

assert.equal(PREMIUM_INTAKE_VERSION, "premium-intake-v1");

const normalized = sanitizePremiumIntake({
  stepStates: {
    currentProducts: "answered",
    usage: "skipped",
    recentContext: "answered",
    decisionFocus: "answered"
  },
  answers: {
    recentlyChangedProduct: "yes",
    productReaction: "no"
  },
  decisionFocus: "functional_addition"
});

assert.deepEqual(normalized, {
  version: "premium-intake-v1",
  stepStates: {
    currentProducts: "answered",
    usage: "skipped",
    recentContext: "answered",
    decisionFocus: "answered"
  },
  answers: {
    recentlyChangedProduct: "yes",
    productReaction: "no"
  },
  decisionFocus: "functional_addition"
});

const invalid = sanitizePremiumIntake({
  stepStates: {
    currentProducts: "invalid"
  },
  answers: {
    recentlyChangedProduct: "invalid",
    productReaction: true
  },
  decisionFocus: "invented"
});

assert.equal(invalid.stepStates.currentProducts, "unknown");
assert.equal(invalid.stepStates.usage, "unknown");
assert.equal(invalid.answers.recentlyChangedProduct, "unknown");
assert.equal(invalid.answers.productReaction, "unknown");
assert.equal(invalid.decisionFocus, "unknown");

for (const key of ["currentProducts", "usage", "recentContext", "decisionFocus"]) {
  assert.match(page, new RegExp(`key: ["']${key}["']`), `missing premium intake step: ${key}`);
}

assert.match(page, /premiumIntake:\s*premiumIntake \|\| undefined/);
assert.match(page, /setPremiumIntake\(intake\)/);
assert.match(page, /TodayStartPlanStep/); // Intake focus and response states are presented in the new report sectors.
assert.match(page, /recentlyChangedProduct/);
assert.match(page, /productReaction/);
assert.match(page, /functional_addition/);
assert.match(page, /condition_response/);

assert.match(route, /function applyPremiumIntakeToReport/);
assert.match(route, /enrichPremiumReportWithIntake/);
assert.match(route, /premiumIntakeResult\.changed/);
assert.match(
  route,
  /const premiumIntakeResult = applyPremiumIntakeToReport[\s\S]*?const currentProductsResult = await applyCurrentProductsToReport/,
  "premium intake must be applied before current-product enrichment so the final deterministic rebuild sees both"
);

assert.match(sharedContext, /report\?\.premiumIntake\?\.answers/);
assert.match(
  sharedContext,
  /return \{[\s\S]*?\.\.\.baseAnswers,[\s\S]*?\.\.\.premiumAnswers[\s\S]*?\};/,
  "premium intake answers must overlay free survey answers without mutating the free result"
);

assert.match(selector, /existingUseTime/);
assert.match(selector, /existingUseFrequency/);
assert.match(selector, /existingSatisfaction/);
assert.match(selector, /status === "not_in_db" && existingUseTime/);
assert.match(selector, /status === "not_in_db" && existingUseFrequency/);

assert.match(page, /useFrequencyLabel/);
assert.match(page, /useFrequency/);
assert.match(page, /few_times_week/);
assert.match(currentProducts, /CURRENT_PRODUCT_USE_FREQUENCIES/);
assert.match(
  currentProducts,
  /CURRENT_PRODUCT_USE_FREQUENCIES\.includes\(item\.useFrequency\)/
);

console.log("Premium intake v1: PASS");
