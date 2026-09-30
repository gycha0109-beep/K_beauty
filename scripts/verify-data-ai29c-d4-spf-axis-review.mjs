#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_SPF_AXIS_ACTIVATION_REVIEW_VERSION,
  evaluateSpfAxisActivationReview,
} from "../lib/sunscreen-spf-axis-activation-review.mjs";

const legacy = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d3r2-legacy-sunscreen-runtime-v1.json",
    "utf8",
  ),
);
const d2 = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d2-sunscreen-initial-admission-v1.json",
    "utf8",
  ),
);
const d1b = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d1b-sunscreen-semantic-projection-v1.json",
    "utf8",
  ),
);
const recovery = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d3r3-semantic-authority-recovery-v1.json",
    "utf8",
  ),
);
const protection = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-c6g-prospective-protection-shadow-input-v1.json",
    "utf8",
  ),
);

const result = evaluateSpfAxisActivationReview({
  legacyProducts: legacy.products,
  authorityRows: d2.products,
  semanticBundles: d1b.products,
  recoveryFixture: recovery,
  protectionRecords: protection.records,
});

assert.equal(
  SUNSCREEN_SPF_AXIS_ACTIVATION_REVIEW_VERSION,
  "data-ai29c-d4-spf-axis-activation-review-v1",
);

// D4-SPF-1: the review is constrained to the D3R3 authority-complete mixed
// corpus. No extra candidate admission is created here.
assert.equal(result.comparableCorpusCount, 14);
assert.equal(result.legacyCount, 11);
assert.equal(result.newComparableCount, 3);
assert.equal(result.heldNewCount, 2);

// D4-SPF-2: SPF authority is complete for every comparable candidate.
assert.deepEqual(result.coverage, {
  eligibleCount: 14,
  totalCount: 14,
  complete: true,
  missingProductIds: [],
});

// D4-SPF-3: explicit outdoor intent is mandatory. The exact same 14 baseline
// rows receive zero protection delta when outdoorExposure is false.
assert.equal(result.nonOutdoor.length, 14);
assert.ok(
  result.nonOutdoor.every(
    (row) =>
      row.appliedTotal === 0 &&
      row.shadowScore === row.baselineScore &&
      row.enabledAxes.length === 0 &&
      row.blockedAxes.includes("spf:not_outdoor"),
  ),
);

// D4-SPF-4: outdoor mode enables SPF only. UVA and water stay disabled.
assert.equal(result.outdoorAxisControl.length, 14);
assert.ok(
  result.outdoorAxisControl.every(
    (row) =>
      row.enabledAxes.length === 1 &&
      row.enabledAxes[0] === "spf" &&
      row.blockedAxes.includes("uva:not_ranking_useful") &&
      row.blockedAxes.includes(
        "waterResistance:water_resistance_intent_not_available",
      ),
  ),
);

// D4-SPF-5: every frozen legacy sunscreen has SPF50+ authority and therefore
// receives the same +6. Adding a constant cannot change relative legacy order.
assert.deepEqual(result.distinctLegacyDeltas, [6]);
assert.equal(result.legacyDeltas.length, 11);
assert.ok(result.legacyDeltas.every((value) => value === 6));
assert.equal(result.gates.legacyRelativeOrderInvariant, true);

// D4-SPF-6: current baseline top-set is preserved after SPF-only overlay.
assert.deepEqual(result.spfTopSet, result.baselineTopSet);
assert.equal(result.gates.baselineTopSetPreserved, true);

// D4-SPF-7: the three new comparable products get governed, non-equal deltas.
// The rank shifts are recorded as evidence rather than hidden behind a pass/fail
// threshold that has not been authorized.
const shifts = new Map(
  result.newRankShifts.map((row) => [row.productId, row]),
);
assert.equal(
  shifts.get("a6994fcd-302f-4e63-acbe-91a3f17a5a65")?.spfDelta,
  2,
);
assert.equal(
  shifts.get("b90bf992-07ae-4f49-a3a4-d90ea6d4a858")?.spfDelta,
  4,
);
assert.equal(
  shifts.get("7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17")?.spfDelta,
  4,
);
assert.ok(
  result.newRankShifts.every(
    (row) =>
      Number.isInteger(row.baselineRank) &&
      Number.isInteger(row.shadowRank) &&
      Number.isInteger(row.rankShift),
  ),
);

// D4-SPF-8: unresolved/held new products never enter the SPF shadow.
assert.deepEqual(result.heldLeakedIntoShadow, []);
assert.equal(result.gates.hardRejectAndSemanticHoldsExcluded, true);

// D4-SPF-9: all review gates pass, but this is only an approval candidate for
// D5. D4 itself must not implement a runtime flag or activate Production.
assert.deepEqual(result.gates, {
  authorityCoverageComplete: true,
  explicitOutdoorOnly: true,
  spfOnlyOutdoor: true,
  baselineTopSetPreserved: true,
  legacyRelativeOrderInvariant: true,
  hardRejectAndSemanticHoldsExcluded: true,
  waterDisabled: true,
  productionStillFrozen: true,
});
assert.equal(result.reviewPass, true);
assert.equal(
  result.decision,
  "SPF_AXIS_D4_REVIEW_PASS_D5_MANUAL_APPROVAL_REQUIRED",
);
assert.deepEqual(result.d5Proposal, {
  axis: "spf",
  defaultEnabled: false,
  requiredFlag: "SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED",
  trigger: "outdoorExposure === true",
  comparableSubsetOnly: true,
  rollback: "set SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED=false",
  uvaIncluded: false,
  waterResistanceIncluded: false,
  manualApprovalRequired: true,
});
assert.deepEqual(result.limits, {
  runtimeFlagImplemented: false,
  productionCandidateAdmissionWired: false,
  productionRankingChanged: false,
  productionCutoverAuthorized: false,
  outdoorRankableSignalAuthorized: false,
  publicActivation: false,
  uvaActivated: false,
  waterResistanceApplied: false,
  persistence: false,
});

// D4-SPF-10: architecture remains scorer -> eligible mixed baseline -> SPF
// overlay. Protection is not allowed to create/admit/resurrect candidates.
const d3r3Source = fs.readFileSync(
  "lib/sunscreen-authority-complete-subset-shadow.mjs",
  "utf8",
);
const filterIndex = d3r3Source.indexOf("filterSunscreenCandidates");
const baselineIndex = d3r3Source.indexOf("const mixedBaseline");
const spfIndex = d3r3Source.indexOf("const spfShadow = applyAxisShadow");
assert.ok(filterIndex >= 0);
assert.ok(baselineIndex > filterIndex);
assert.ok(spfIndex > baselineIndex);

const productSource = fs.readFileSync("lib/product-source.js", "utf8");
const admissionCore = fs.readFileSync(
  "lib/recommendation-candidate-admission-core.mjs",
  "utf8",
);
assert.equal(
  productSource.includes("sunscreen-spf-axis-activation-review"),
  false,
);
assert.equal(
  admissionCore.includes("SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED"),
  false,
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D4-SPF",
    comparableCorpusCount: result.comparableCorpusCount,
    legacyUniformDelta: result.distinctLegacyDeltas,
    baselineTopSet: result.baselineTopSet,
    spfTopSet: result.spfTopSet,
    newRankShifts: result.newRankShifts,
    maxAbsoluteNewRankShift: result.maxAbsoluteNewRankShift,
    decision: result.decision,
  }),
);
