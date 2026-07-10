import assert from "node:assert/strict";

import {
  PRODUCT_FUNCTIONAL_LABEL_AXIS_MAP,
  resolveProductFunctionalProfile
} from "../lib/product-functional-profile.js";

function product(overrides = {}) {
  return {
    id: "fixture-product",
    brand: "Fixture",
    name: "Functional Signal Fixture",
    category: "treatment",
    concerns: [],
    irritation_risk: "low",
    sensitivity_safe: true,
    ingredient_signals: {
      source: "hwahae_visible_page",
      functional: []
    },
    ...overrides
  };
}

function functional(entries) {
  return {
    source: "hwahae_visible_page",
    functional: entries.map(([label, count]) => ({ label, count }))
  };
}

function axis(profile, axisName) {
  return profile.functionalAxes.find((item) => item.axis === axisName) || null;
}

assert.equal(PRODUCT_FUNCTIONAL_LABEL_AXIS_MAP["skin hydration"], "hydration");
assert.equal(PRODUCT_FUNCTIONAL_LABEL_AXIS_MAP["uv protection"], "sunscreen_protection");

const cleanserProfile = resolveProductFunctionalProfile(product({
  id: "cleanser-fixture",
  category: "cleanser",
  ingredient_signals: functional([
    ["skin hydration", 12],
    ["skin protection", 3],
    ["exfoliation", 1]
  ])
}));

assert.equal(cleanserProfile.categoryRole, "cleansing");
assert.equal(axis(cleanserProfile, "hydration") != null, true);
assert.equal(axis(cleanserProfile, "hydration").strength, "low");
assert.equal(axis(cleanserProfile, "hydration").confidence, "low");
assert.equal(axis(cleanserProfile, "exfoliation").strength, "low");
assert.equal(axis(cleanserProfile, "exfoliation").confidence, "low");
assert.equal(cleanserProfile.cautionTags.includes("rinse_off_limit"), true);
assert.equal(cleanserProfile.categoryAdjustment.includes("rinse-off category adjustment applied"), true);

const treatmentProfile = resolveProductFunctionalProfile(product({
  id: "treatment-fixture",
  category: "treatment",
  ingredient_signals: functional([
    ["exfoliation", 8],
    ["whitening", 4]
  ])
}));

assert.equal(treatmentProfile.categoryRole, "functional_leave_on");
assert.equal(axis(treatmentProfile, "exfoliation").strength, "high");
assert.equal(axis(treatmentProfile, "exfoliation").confidence, "high");
assert.equal(axis(treatmentProfile, "tone_care").strength, "medium");
assert.equal(axis(treatmentProfile, "tone_care").confidence, "high");
assert.equal(treatmentProfile.cautionTags.includes("exfoliation_overlap_watch"), true);
assert.equal(
  treatmentProfile.evidenceSummary.includes("retinol") ||
    treatmentProfile.evidenceSummary.includes("vitamin") ||
    treatmentProfile.evidenceSummary.includes("bha"),
  false
);

const sunscreenProfile = resolveProductFunctionalProfile(product({
  id: "sunscreen-fixture",
  category: "sunscreen",
  spf_value: 50,
  uva_label: "PA++++",
  uv_filter_type: "organic",
  ingredient_signals: functional([
    ["uv protection", 6]
  ])
}));

assert.equal(sunscreenProfile.categoryRole, "protection");
assert.equal(axis(sunscreenProfile, "sunscreen_protection").strength, "medium");
assert.equal(axis(sunscreenProfile, "sunscreen_protection").confidence, "high");
assert.equal(sunscreenProfile.cautionTags.includes("sunscreen_metadata_incomplete"), false);

const missingProfile = resolveProductFunctionalProfile(product({
  id: "missing-functional-fixture",
  category: "moisturizer_cream",
  ingredient_signals: null
}));

assert.equal(missingProfile.categoryRole, "support");
assert.equal(missingProfile.evaluable, false);
assert.deepEqual(missingProfile.functionalAxes, []);
assert.equal(missingProfile.cautionTags.includes("low_evidence"), true);
assert.equal(missingProfile.evidenceSummary, "functional signals unavailable");

const unknownProfile = resolveProductFunctionalProfile(product({
  id: "unknown-functional-fixture",
  category: "treatment",
  ingredient_signals: functional([
    ["new unknown hwahae label", 5]
  ])
}));

assert.equal(unknownProfile.evaluable, false);
assert.deepEqual(unknownProfile.unknownFunctionalLabels, ["new unknown hwahae label"]);
assert.equal(unknownProfile.cautionTags.includes("unknown_functional_signal"), true);

console.log("product functional profile resolver semantics verified");
