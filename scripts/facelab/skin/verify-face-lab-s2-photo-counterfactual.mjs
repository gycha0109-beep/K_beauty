import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { buildSkinPhotoCounterfactual, compareSkinPhotoDecisions } from "./skin-photo-counterfactual-core.mjs";
import { SKIN_AXIS_EVIDENCE_VERSION, SKIN_VISIBLE_AXES } from "./skin-axis-evidence-contract-core.mjs";

register("../../node-next-alias-loader.mjs", import.meta.url);
globalThis.fetch = async () => { throw new Error("SKIN_PHOTO_SHADOW_NETWORK_FORBIDDEN"); };

const { buildSkinMatchDecisionBundle } = await import("../../../lib/skin-match-decision-engine.js");
const { buildRecommendationProductFromSource } = await import("../../../lib/product-source.js");
const productsSource = JSON.parse(readFileSync("fixtures/recommendation-metadata/products-v1.json", "utf8"));
const scenarios = JSON.parse(readFileSync("fixtures/recommendation-metadata/user-scenarios-v1.json", "utf8"));
assert.equal(productsSource.productCount, 164);
assert.equal(scenarios.scenarioCount, 12);
const products = [...productsSource.products]
  .sort((a, b) => String(a.category).localeCompare(String(b.category), "en") ||
    String(a.brand).localeCompare(String(b.brand), "en") ||
    String(a.name).localeCompare(String(b.name), "en") ||
    String(a.id).localeCompare(String(b.id), "en"))
  .map(buildRecommendationProductFromSource);

const cue = {
  oiliness: "surface_shine", dehydration: "dry_texture", acne: "active_spots",
  uneven_tone: "tone_variation", pores: "pore_visibility", redness: "red_appearance",
  barrier: "surface_stress"
};
function blankRows() {
  return SKIN_VISIBLE_AXES.map(axis => ({
    axis, state: "not_seen", value: 0, confidence: "medium",
    cue: cue[axis], area: "cheeks", reason: "none"
  }));
}
function withRow(rows, axis, patch) {
  return rows.map(row => row.axis === axis ? { ...row, ...patch } : row);
}
function positive(rows, axis, value, confidence = "high") {
  return withRow(rows, axis, { state: "present", value, confidence });
}
function legacyPhoto(signals = {}, { status = "available", eligible = true } = {}) {
  return {
    signals: Object.fromEntries(
      ["barrier", "dehydration", "oiliness", "redness", "acne", "pores", "uneven_tone", "uv"]
        .map(axis => [axis, signals[axis] || 0])
    ),
    imageEligibility: { skinAnalysisEligible: eligible },
    photoEvidenceState: { status, source: "vision" },
    photoObservations: { signals: [], surveyAlignment: { status: "unknown" } }
  };
}
const manifest = axes => ({ schemaVersion: SKIN_AXIS_EVIDENCE_VERSION, axes });
const clean = blankRows();
const cases = [
  {
    id: "T01_OBSERVED_ZERO_ALL",
    photo: legacyPhoto(),
    evidence: manifest(clean),
    expectedShadowDelta: false
  },
  {
    id: "T02_RELIABLE_REDNESS_AND_OILINESS",
    photo: legacyPhoto({ redness: 5, oiliness: 3 }),
    evidence: manifest(positive(positive(clean, "redness", 5), "oiliness", 3, "medium")),
    expectedShadowDelta: false
  },
  {
    id: "T03_LOW_CONFIDENCE_REDNESS",
    photo: legacyPhoto({ redness: 5 }),
    evidence: manifest(positive(clean, "redness", 5, "low")),
    expectedShadowDelta: true,
    expectedHeldAxis: "redness"
  },
  {
    id: "T04_POSITIVE_WITH_MISSING_PORES",
    photo: legacyPhoto({ pores: 5 }),
    evidence: manifest(clean.filter(row => row.axis !== "pores")),
    expectedShadowDelta: true,
    expectedHeldAxis: "pores"
  },
  {
    id: "T05_DIRECT_UV_EVIDENCE_MISSING",
    photo: legacyPhoto({ uv: 5 }),
    evidence: manifest(clean),
    expectedShadowDelta: true,
    expectedHeldAxis: "uv"
  },
  {
    id: "T06_CONTRADICTORY_SCORE",
    photo: legacyPhoto({ acne: 5 }),
    evidence: manifest(positive(clean, "acne", 2)),
    expectedShadowDelta: true,
    expectedHeldAxis: "acne"
  },
  {
    id: "T07_NO_PHOTO",
    photo: legacyPhoto({}, { status: "not_provided", eligible: false }),
    evidence: manifest(positive(clean, "redness", 5)),
    expectedShadowDelta: false
  },
  {
    id: "T08_PARTIAL_SUPPORTED_AND_UNKNOWN",
    photo: legacyPhoto({ acne: 4, redness: 5 }),
    evidence: manifest(positive(withRow(clean, "redness", {
      state: "unknown", value: null, confidence: "unknown",
      cue: null, area: null, reason: "unsupported"
    }), "acne", 4)),
    expectedShadowDelta: true,
    expectedHeldAxis: "redness"
  },
  {
    id: "T09_DECLARED_UNAVAILABLE_BUT_ELIGIBLE_ADVERSARIAL",
    photo: legacyPhoto({ redness: 5 }, { status: "unavailable", eligible: true }),
    evidence: manifest(positive(clean, "redness", 5)),
    expectedShadowDelta: true,
    expectedHeldAxis: "redness",
    adversarialUnreachableViaNormalRoute: true
  }
];
const results = [];
for (const item of cases) {
  const hypothetical = buildSkinPhotoCounterfactual(item.photo, item.evidence);
  assert.equal(hypothetical.evaluationOnly, true);
  assert.equal(hypothetical.authority.scorerModified, false);
  assert.equal(hypothetical.authority.scoreActivationAuthorized, false);
  assert.equal(hypothetical.candidatePhotoAnalysis.imageEligibility.skinAnalysisEligible,
    item.photo.imageEligibility.skinAnalysisEligible);
  if (item.expectedHeldAxis) {
    assert.equal(hypothetical.candidatePhotoAnalysis.signals[item.expectedHeldAxis], 0);
    assert(hypothetical.findings.some(x => x.axis === item.expectedHeldAxis));
  }
  const result = {
    caseId: item.id,
    scenarios: 0,
    photoDeltaScenarios: 0,
    priorityFlips: 0,
    topPickFlips: 0,
    topThreeFlips: 0,
    rankingChanges: 0,
    photoPointsRemoved: 0,
    affectedAxes: {},
    hypotheticalEvidenceStatus: hypothetical.evidenceStatus,
    adversarialUnreachableViaNormalRoute: Boolean(item.adversarialUnreachableViaNormalRoute)
  };
  for (const scenario of [...scenarios.scenarios].sort((a, b) => a.id.localeCompare(b.id))) {
    // REAL existing recommendation engine called twice, on the same answer and
    // fixed 164-product fixture. Only the synthetic in-memory photo differs.
    const options = { products, includeCandidateSourceDiagnostics: true, locale: "ko" };
    const before = await buildSkinMatchDecisionBundle(scenario.answers, {
      ...options, photoAnalysis: item.photo
    });
    const after = await buildSkinMatchDecisionBundle(scenario.answers, {
      ...options, photoAnalysis: hypothetical.candidatePhotoAnalysis
    });
    const delta = compareSkinPhotoDecisions(before, after);
    assert.equal(delta.candidateCount, 164);
    assert.equal(delta.photoPointReduction > 0, item.expectedShadowDelta,
      item.id + ":" + scenario.id + " measured photo change");
    if (!item.expectedShadowDelta) {
      assert.equal(delta.priorityChanged, false);
      assert.equal(delta.rankingChanged, false);
      assert.equal(delta.topPickChanged, false);
    }
    result.scenarios++;
    result.photoDeltaScenarios += Number(delta.photoPointReduction > 0);
    result.photoPointsRemoved += delta.photoPointReduction;
    result.priorityFlips += Number(delta.priorityChanged);
    result.topPickFlips += Number(delta.topPickChanged);
    result.topThreeFlips += Number(delta.topThreeRankedChanged);
    result.rankingChanges += Number(delta.rankingChanged);
    for (const axis of Object.keys(delta.changedAxes)) {
      result.affectedAxes[axis] = (result.affectedAxes[axis] || 0) + 1;
    }
  }
  results.push(result);
}
assert.equal(results.length, 9);
assert.equal(results.reduce((n, r) => n + r.scenarios, 0), 108);
const summary = {
  version: "skin-photo-counterfactual-frozen-catalog-v1",
  classification: "SYNTHETIC_RISK_CHARACTERIZATION_NOT_PRODUCT_ACCURACY",
  baseline: "actual_unchanged_recommendation_engine",
  catalogSize: products.length,
  scenarioCount: scenarios.scenarioCount,
  photoCaseCount: cases.length,
  comparisonCount: 108,
  scoringChangedInService: false,
  additionalProviderCalls: 0,
  realPhotosAnalyzed: 0,
  productionOrPersistenceWrites: 0,
  totalPriorityFlips: results.reduce((n, r) => n + r.priorityFlips, 0),
  totalTopPickFlips: results.reduce((n, r) => n + r.topPickFlips, 0),
  comparisonCases: results
};
console.log("verify-face-lab-s2-photo-counterfactual: PASS " + JSON.stringify(summary));
