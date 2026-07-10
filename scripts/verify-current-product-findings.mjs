import assert from "node:assert/strict";

import { buildCurrentProductFindings } from "../lib/current-product-findings.js";

function functional(entries) {
  return {
    source: "hwahae_visible_page",
    functional: entries.map(([label, count]) => ({ label, count }))
  };
}

function selected(category, entries, overrides = {}) {
  return {
    category,
    status: "selected",
    productId: overrides.id || `${category}-fixture`,
    productSnapshot: {
      id: overrides.id || `${category}-fixture`,
      brand: "Fixture",
      name: overrides.name || `${category} product`,
      category,
      irritation_risk: "low",
      sensitivity_safe: true,
      ingredient_signals: functional(entries),
      ...overrides.productSnapshot
    }
  };
}

function firstFinding(result) {
  return result.findings[0];
}

const cleanserResult = buildCurrentProductFindings({
  currentProducts: {
    selections: [
      selected("cleanser", [
        ["skin hydration", 12],
        ["skin protection", 3],
        ["exfoliation", 1]
      ])
    ]
  },
  primaryGoal: "pores_texture",
  functionalDirection: "exfoliation"
});
const cleanserFinding = firstFinding(cleanserResult);
assert.equal(cleanserFinding.sourceState, "selected");
assert.equal(cleanserFinding.canEvaluate, true);
assert.notEqual(cleanserFinding.relationToPlan, "supports_goal");
assert.equal(["different_goal", "not_evaluable"].includes(cleanserFinding.relationToPlan), true);
assert.equal(cleanserFinding.reason.includes("rinse-off"), true);
assert.equal(cleanserFinding.profile.cautionTags.includes("rinse_off_limit"), true);

const treatmentResult = buildCurrentProductFindings({
  currentProducts: {
    selections: [
      selected("treatment", [["exfoliation", 8]])
    ]
  },
  primaryGoal: "pores_texture",
  functionalDirection: "exfoliation"
});
const treatmentFinding = firstFinding(treatmentResult);
assert.equal(treatmentFinding.relationToPlan, "supports_goal");
assert.deepEqual(treatmentFinding.matchedAxes, ["exfoliation"]);
assert.equal(treatmentResult.summary.directFunctionalSupportExists, true);

const moisturizerResult = buildCurrentProductFindings({
  currentProducts: {
    selections: [
      selected("moisturizer_cream", [
        ["skin hydration", 9],
        ["moisture evaporation blocking", 4]
      ])
    ]
  },
  primaryGoal: "dehydration",
  functionalDirection: "hydration"
});
const moisturizerFinding = firstFinding(moisturizerResult);
assert.equal(moisturizerFinding.relationToPlan, "supports_goal");
assert.deepEqual(moisturizerFinding.matchedAxes, ["hydration", "moisture_lock"]);

const notInDbResult = buildCurrentProductFindings({
  currentProducts: {
    selections: [{ category: "treatment", status: "not_in_db" }]
  },
  functionalDirection: "exfoliation"
});
assert.equal(firstFinding(notInDbResult).relationToPlan, "not_evaluable");
assert.equal(firstFinding(notInDbResult).profile, null);

const notUsingResult = buildCurrentProductFindings({
  currentProducts: {
    selections: [{ category: "treatment", status: "not_using" }]
  },
  functionalDirection: "exfoliation"
});
assert.equal(firstFinding(notUsingResult).relationToPlan, "empty_slot");

const unansweredResult = buildCurrentProductFindings({
  currentProducts: {
    selections: [{ category: "treatment", status: "unanswered" }]
  },
  functionalDirection: "exfoliation"
});
assert.equal(firstFinding(unansweredResult).sourceState, "unanswered");
assert.equal(firstFinding(unansweredResult).relationToPlan, "unknown_usage");

const duplicateResult = buildCurrentProductFindings({
  currentProducts: {
    selections: [
      selected("treatment", [["exfoliation", 8]], { id: "treatment-a" }),
      selected("treatment", [["exfoliation", 5]], { id: "treatment-b" })
    ]
  },
  primaryGoal: "pores_texture",
  functionalDirection: "exfoliation"
});
assert.equal(duplicateResult.findings.length, 2);
assert.equal(duplicateResult.findings.every((finding) => finding.relationToPlan === "duplicate_axis"), true);
assert.equal(duplicateResult.summary.supportsGoalCount, 2);

console.log("current product findings semantics verified");
