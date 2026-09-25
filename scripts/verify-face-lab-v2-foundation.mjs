import assert from "node:assert/strict";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../lib/face-lab-observation-contract.js";
import {
  buildCurrentFaceProfile
} from "../lib/face-lab-v2/current-face-profile.js";
import {
  buildFaceLabV2Canonical
} from "../lib/face-lab-v2/canonical-composer.js";
import {
  isFaceLabV2CanonicalResult
} from "../lib/face-lab-v2/result-contract.js";
import {
  normalizeFaceLabV2PersistencePayload
} from "../lib/face-lab-v2/survey-contract.js";
import {
  TARGET_FINDER_ROUNDS,
  buildTargetFinderResult,
  getTargetFinderRound
} from "../lib/face-lab-v2/target-finder.js";

function buildRawObservation() {
  const observations = {};

  for (const [group, fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    observations[group] = {};

    for (const [key, values] of Object.entries(fields)) {
      const isArray = group === "featureLayout" && key === "focalFeatures";
      observations[group][key] = {
        value: isArray ? [values[0]] : values[0],
        visibility: "clear",
        evidence: [`fixture:${group}.${key}`],
        unavailableReason: null
      };
    }
  }

  // Exercise over-amplification guards with a strongly defined observation.
  observations.eyes.eyeDirection.value = "upturned";
  observations.visualLanguage.contourDefinition.value = "defined";
  observations.visualLanguage.featureContrast.value = "high";
  observations.visualLanguage.straightCurveBalance.value = "straight";

  return {
    quality: {
      faceVisibility: "clear",
      faceScale: "adequate",
      pose: {
        yaw: "frontal",
        pitch: "level",
        roll: "level"
      },
      occlusion: {
        forehead: "none",
        brows: "none",
        eyes: "none",
        cheeks: "none",
        jawline: "none"
      },
      sharpness: "clear",
      exposure: "balanced",
      lightingUniformity: "even",
      whiteBalance: "stable",
      filterOrEditing: "none_detected",
      makeupCoverage: "none_or_light",
      structureSuitability: "suitable",
      colorSuitability: "suitable",
      evidence: ["fixture:quality"]
    },
    observations
  };
}

const analysis = buildFaceLabObservationAnalysis(buildRawObservation(), {
  eligibility: {
    faceLabEligible: true
  },
  provider: "fixture",
  model: "fixture-v1"
});

assert.equal(analysis.status, "available");

const currentProfile = buildCurrentFaceProfile(analysis, { locale: "ko" });
assert.equal(currentProfile.status, "available");
assert.ok(currentProfile.keyFeatures.length >= 3);
assert.equal(currentProfile.structuralProfile.status, "available");
assert.ok(currentProfile.structuralProfile.availableCount >= 5);
assert.ok(currentProfile.structuralProfile.values.faceShape);
assert.ok(currentProfile.structuralProfile.values.jawlineAngularity);
assert.ok(currentProfile.structuralProfile.values.faceLengthBalance);
assert.equal(currentProfile.presentationObservations, null);
assert.ok(!JSON.stringify(currentProfile).includes("hairDirections"));
assert.ok(!JSON.stringify(currentProfile).includes("makeupDirections"));

const survey = {
  schemaVersion: "face-lab-target-style-survey-v1",
  entryMode: "known",
  targetSelections: ["sophisticated", "chic"],
  presentationPreference: "feminine_examples",
  stylingScope: ["hair", "brow_grooming", "makeup"],
  changeTolerance: "moderate",
  contexts: ["daily", "work_school"],
  constraints: {
    makeup: {
      intensity: "light"
    },
    hardExclusions: []
  },
  approvedAt: "2026-09-25T00:00:00.000Z"
};

const canonical = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: survey,
  resultId: "fixture-face-lab-v2"
});

assert.equal(isFaceLabV2CanonicalResult(canonical), true);
assert.equal(canonical.targetStyle.status, "available");
assert.equal(canonical.targetStyle.approvedByUser, true);
assert.equal(canonical.styleDelta.status, "available");
assert.ok(canonical.styleDelta.priorities.length > 0);
assert.ok(canonical.routes.routes.length >= 2);
assert.ok(canonical.routes.routes.length <= 3);
assert.ok(canonical.routes.selectedRouteId);
const englishCanonical = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: survey,
  locale: "en",
  resultId: "fixture-face-lab-v2-en"
});
assert.ok(
  englishCanonical.routes.routes.every((route) => !/[가-힣]/.test(route.whyThisRoute)),
  "English route rationale must not leak Korean copy"
);
assert.ok(["available", "not_applicable"].includes(canonical.hair.status));
if (canonical.hair.status === "available") {
  assert.ok(
    canonical.hair.value.avoidOrModerate.length >= 1,
    "hair execution must carry structural moderation when observed structure warrants it"
  );
}
assert.ok(["available", "not_applicable"].includes(canonical.makeup.status));
assert.ok(["available", "not_applicable"].includes(canonical.grooming.status));
assert.ok(["partial", "not_requested"].includes(canonical.productHandoff.status));
assert.equal(canonical.looks.status, "available");
assert.equal(canonical.looks.looks.length, 1);
assert.equal(canonical.looks.looks[0].routeId, canonical.routes.selectedRouteId);
assert.ok(canonical.looks.looks[0].pieces.length >= 1);
const expectedLookDomains = ["hair", "grooming", "makeup", "color", "eyewear", "accessories"]
  .filter((domain) => canonical[domain]?.status === "available");
assert.deepEqual(
  canonical.looks.looks[0].pieces.map((item) => item.domain),
  expectedLookDomains,
  "Look Composer must expose the execution domains it actually composed"
);

const hairRoute = canonical.routes.routes.find((route) => route.strategy === "hair_led");
assert.ok(hairRoute, "fixture must expose a hair-led route for route-selection E2E verification");
const hairRouteCanonical = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: survey,
  selectedRouteId: hairRoute.routeId,
  resultId: "fixture-face-lab-v2-hair-route"
});
assert.equal(hairRouteCanonical.routes.selectedRouteId, hairRoute.routeId);
assert.equal(hairRouteCanonical.looks.looks[0].routeId, hairRoute.routeId);
assert.notDeepEqual(
  {
    hair: canonical.hair?.value,
    grooming: canonical.grooming?.value,
    makeup: canonical.makeup?.value,
    color: canonical.color?.value,
    eyewear: canonical.eyewear?.value,
    accessories: canonical.accessories?.value
  },
  {
    hair: hairRouteCanonical.hair?.value,
    grooming: hairRouteCanonical.grooming?.value,
    makeup: hairRouteCanonical.makeup?.value,
    color: hairRouteCanonical.color?.value,
    eyewear: hairRouteCanonical.eyewear?.value,
    accessories: hairRouteCanonical.accessories?.value
  },
  "changing the selected route must recompute domain execution payloads"
);
assert.notDeepEqual(
  canonical.looks.looks[0].pieces,
  hairRouteCanonical.looks.looks[0].pieces,
  "changing the selected route must recompute the composed look"
);
assert.equal(
  hairRouteCanonical.looks.visualConflicts.some(
    (item) => item.impact === "over_amplification_guard"
  ),
  false,
  "a hair-only route must not surface a makeup-only over-amplification warning"
);
assert.ok(["available", "insufficient_evidence"].includes(canonical.archetypeFun.status));
assert.equal(canonical.archetypeFun.funOnly, true);
assert.equal(canonical.archetypeFun.styleAuthority, false);

const eyePriority = canonical.styleDelta.priorities.find(
  (item) => item.domain === "makeup" && item.reason === "face_modifier_eye_direction_already_upturned"
);
assert.ok(eyePriority, "existing upturned eye direction must activate the over-amplification guard");
assert.equal(eyePriority.parameter, "eyeDefinition");

const noMakeup = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: {
    ...survey,
    targetSelections: ["mature_calm", "minimal"],
    stylingScope: ["hair", "brow_grooming"]
  },
  resultId: "fixture-face-lab-v2-no-makeup"
});

assert.equal(noMakeup.makeup.status, "not_requested");
assert.equal(noMakeup.productHandoff.status, "not_requested");
assert.ok(noMakeup.routes.routes.every((route) => !route.domains.includes("makeup")));

const futureOnlyScope = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: {
    ...survey,
    targetSelections: ["trendy"],
    stylingScope: ["face_adjacent_style"]
  },
  resultId: "fixture-face-lab-v2-future-only-scope"
});

assert.equal(
  futureOnlyScope.styleDelta.priorities.some((item) => item.domain === "face_adjacent_style"),
  false,
  "Style Delta must not expose a domain until a V2 execution engine can fulfill it"
);
assert.equal(
  futureOnlyScope.routes.status,
  "insufficient_evidence",
  "future-only styling scope must not fabricate an executable route"
);
assert.equal(futureOnlyScope.faceAdjacentStyle, null);

const unconfirmed = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: {
    ...survey,
    approvedAt: null
  },
  resultId: "fixture-face-lab-v2-unconfirmed"
});

assert.equal(unconfirmed.targetStyle.status, "needs_confirmation");
assert.equal(unconfirmed.styleDelta, null);
assert.equal(unconfirmed.routes, null);
assert.equal(unconfirmed.hair, null);
assert.equal(unconfirmed.makeup, null);
assert.equal(isFaceLabV2CanonicalResult(unconfirmed), true);

assert.equal(TARGET_FINDER_ROUNDS.length, 5);
const firstFinderRound = getTargetFinderRound(0);
assert.equal(firstFinderRound.roundId, "natural-vs-sophisticated");
assert.ok(firstFinderRound.candidateA.referenceAssetKey);
assert.ok(firstFinderRound.candidateB.referenceAssetKey);
assert.equal(firstFinderRound.candidateA.reference.purpose, "style_preference_reference");
assert.ok(firstFinderRound.candidateA.reference.assetSlot.endsWith("/natural.webp"));
assert.ok(firstFinderRound.candidateA.reference.cues.length >= 3);

const finderResult = buildTargetFinderResult([
  { roundId: "natural-vs-sophisticated", choice: "b" },
  { roundId: "soft-vs-defined", choice: "b" },
  { roundId: "playful-vs-mature", choice: "b" },
  { roundId: "minimal-vs-statement", choice: "a" },
  { roundId: "classic-vs-trendy", choice: "both" }
]);

assert.equal(finderResult.candidateSetVersion, "target-finder-cards-v2");
assert.equal(finderResult.userApproved, false);
assert.ok(finderResult.candidateLabels.length >= 1);
assert.ok(typeof finderResult.estimatedVector.softSharp === "number");
assert.ok(typeof finderResult.estimatedVector.naturalPolished === "number");
assert.ok(typeof finderResult.estimatedVector.playfulMature === "number");
assert.ok(typeof finderResult.estimatedVector.minimalStatement === "number");
assert.ok(typeof finderResult.estimatedVector.classicTrendy === "number");
assert.equal(finderResult.estimatedVector.warmCool, 0.5);

const inconclusiveFinderResult = buildTargetFinderResult(
  TARGET_FINDER_ROUNDS.map((round) => ({
    roundId: round.roundId,
    choice: "neither"
  }))
);
assert.deepEqual(
  inconclusiveFinderResult.candidateLabels,
  [],
  "rejecting both options in every Finder round must not manufacture arbitrary target labels"
);

const finderCanonical = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: {
    ...survey,
    entryMode: "unknown",
    targetSelections: [],
    approvedAt: null
  },
  targetFinderResult: {
    ...finderResult,
    userApproved: true
  },
  resultId: "fixture-face-lab-v2-finder"
});

assert.equal(finderCanonical.targetStyle.status, "available");
assert.equal(finderCanonical.targetStyle.source, "target_finder");
assert.ok(finderCanonical.routes.routes.length >= 1);

const partialClarified = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: {
    ...survey,
    entryMode: "partial",
    targetSelections: ["sophisticated"],
    clarifiers: {
      softSharp: "soft",
      naturalPolished: "polished"
    }
  },
  resultId: "fixture-face-lab-v2-partial"
});

assert.equal(partialClarified.targetStyle.status, "available");
assert.ok(
  partialClarified.targetStyle.preferenceEvidence.includes("clarifier:softSharp=soft")
);
assert.ok(
  partialClarified.targetStyle.preferenceEvidence.includes("clarifier:naturalPolished=polished")
);

const sophisticatedOnly = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: {
    ...survey,
    entryMode: "known",
    targetSelections: ["sophisticated"]
  },
  resultId: "fixture-face-lab-v2-sophisticated-only"
});

assert.notEqual(
  partialClarified.targetStyle.vector.softSharp,
  sophisticatedOnly.targetStyle.vector.softSharp,
  "partial clarifier must alter the target vector"
);

const lowEffort = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: {
    ...survey,
    targetSelections: ["sophisticated", "chic"],
    stylingScope: ["hair", "brow_grooming", "eyewear"],
    changeTolerance: "minimal",
    constraints: {
      hair: { lengthChange: "small", dye: "no" },
      makeup: { intensity: "light" },
      lifestyle: {
        dailyMinutes: 5,
        budgetBand: "low",
        maintenanceTolerance: "low"
      },
      hardExclusions: []
    }
  },
  resultId: "fixture-face-lab-v2-low-effort"
});

assert.ok(lowEffort.routes.routes.some((route) => route.strategy === "low_effort"));
assert.equal(lowEffort.routes.defaultRouteId, "low_effort");
assert.ok(lowEffort.routes.routes[0].constraintFit.score > 0);
assert.equal(lowEffort.makeup.status, "not_requested");
assert.ok(["available", "not_applicable"].includes(lowEffort.eyewear.status));

const masculine = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: {
    ...survey,
    presentationPreference: "masculine_examples",
    targetSelections: ["mature_calm", "minimal"],
    stylingScope: ["hair", "brow_grooming", "eyewear", "facial_hair"],
    constraints: {
      hair: { lengthChange: "small", dye: "no" },
      makeup: { intensity: "none" },
      lifestyle: { dailyMinutes: 15 },
      hardExclusions: []
    }
  },
  resultId: "fixture-face-lab-v2-masculine"
});

assert.equal(masculine.makeup.status, "not_requested");
assert.ok(masculine.routes.routes.length >= 2);
assert.ok(
  masculine.styleDelta.priorities.some(
    (item) => item.domain === "eyewear" && item.constraintState === "allowed"
  ),
  "masculine/non-makeup scope must retain actionable eyewear guidance"
);

const hairBlocked = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: {
    ...survey,
    stylingScope: ["hair", "makeup"],
    constraints: {
      makeup: { intensity: "light" },
      hardExclusions: ["hair_disabled"]
    }
  },
  resultId: "fixture-face-lab-v2-hair-blocked"
});

assert.ok(
  hairBlocked.styleDelta.priorities
    .filter((item) => item.domain === "hair")
    .every((item) => item.constraintState === "blocked")
);
assert.ok(hairBlocked.routes.routes.every((route) => !route.domains.includes("hair")));

const normalizedPersistence = normalizeFaceLabV2PersistencePayload({
  surveyAnswers: {
    ...survey,
    stylingScope: ["hair", "makeup", "invalid_domain"],
    constraints: {
      hair: { lengthChange: "large", dye: "yes" },
      makeup: { intensity: "medium" },
      lifestyle: {
        dailyMinutes: 30,
        budgetBand: "low",
        maintenanceTolerance: "low"
      },
      hardExclusions: ["hair_dye", "unknown_exclusion"]
    }
  },
  selectedRouteId: "balanced"
});

assert.deepEqual(normalizedPersistence.surveyAnswers.stylingScope, ["hair", "makeup"]);
assert.deepEqual(normalizedPersistence.surveyAnswers.constraints.hardExclusions, ["hair_dye"]);
assert.equal(normalizedPersistence.surveyAnswers.constraints.lifestyle.budgetBand, "low");
assert.equal(normalizedPersistence.surveyAnswers.constraints.lifestyle.maintenanceTolerance, "low");
assert.equal(normalizedPersistence.selectedRouteId, "balanced");

const persistedRoundTrip = normalizeFaceLabV2PersistencePayload({
  surveyAnswers: survey,
  targetFinderResult: null,
  selectedRouteId: canonical.routes.selectedRouteId
});
const revisitedCanonical = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: persistedRoundTrip.surveyAnswers,
  targetFinderResult: persistedRoundTrip.targetFinderResult,
  selectedRouteId: persistedRoundTrip.selectedRouteId,
  resultId: "fixture-face-lab-v2-revisit"
});

assert.equal(
  revisitedCanonical.routes.selectedRouteId,
  canonical.routes.selectedRouteId,
  "saved route selection must survive normalized revisit rehydration"
);
for (const domain of ["hair", "grooming", "makeup", "color", "eyewear", "accessories"]) {
  assert.deepEqual(
    revisitedCanonical[domain]?.value ?? null,
    canonical[domain]?.value ?? null,
    `revisit must reproduce selected-route execution for ${domain}`
  );
}
assert.deepEqual(
  revisitedCanonical.looks.looks[0]?.pieces || [],
  canonical.looks.looks[0]?.pieces || [],
  "revisit must reproduce the same composed look pieces"
);
assert.deepEqual(
  revisitedCanonical.productHandoff.specifications,
  canonical.productHandoff.specifications,
  "revisit must reproduce the same product specification handoff"
);

const staleRoutePersistence = normalizeFaceLabV2PersistencePayload({
  surveyAnswers: survey,
  selectedRouteId: "retired-route-v1"
});
const staleRouteRevisit = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: staleRoutePersistence.surveyAnswers,
  selectedRouteId: staleRoutePersistence.selectedRouteId,
  resultId: "fixture-face-lab-v2-stale-route"
});
assert.notEqual(
  staleRouteRevisit.routes.selectedRouteId,
  "retired-route-v1",
  "a route removed by a newer engine version must never survive rehydration as selected"
);
assert.equal(
  staleRouteRevisit.routes.selectedRouteId,
  staleRouteRevisit.routes.defaultRouteId,
  "stale route ids must fall back to the current canonical default route"
);

const normalizedFinderPersistence = normalizeFaceLabV2PersistencePayload({
  surveyAnswers: survey,
  targetFinderResult: {
    ...finderResult,
    estimatedVector: {
      softSharp: 0,
      naturalPolished: 0,
      playfulMature: 0,
      minimalStatement: 0,
      warmCool: 0,
      classicTrendy: 0
    },
    userApproved: true
  }
});

assert.deepEqual(
  normalizedFinderPersistence.targetFinderResult.estimatedVector,
  finderResult.estimatedVector,
  "persisted finder vector must be recomputed from recorded round choices"
);
assert.equal(
  normalizedFinderPersistence.targetFinderResult.candidateSetVersion,
  "target-finder-cards-v2"
);

const editedTarget = buildFaceLabV2Canonical({
  analysis,
  surveyAnswers: {
    ...survey,
    targetSelections: ["natural", "soft"]
  },
  resultId: "fixture-face-lab-v2-edited"
});

assert.notDeepEqual(
  editedTarget.targetStyle.vector,
  canonical.targetStyle.vector,
  "target edits must recompute downstream target state from the same photo analysis"
);
assert.equal(
  editedTarget.currentFaceProfile.profileVersion,
  canonical.currentFaceProfile.profileVersion,
  "target edits must not require a different face analysis/profile version"
);

console.log(JSON.stringify({
  ok: true,
  schemaVersion: canonical.schemaVersion,
  currentFaceProfile: currentProfile.status,
  routeCount: canonical.routes.routes.length,
  selectedRouteId: canonical.routes.selectedRouteId,
  makeupProductSpecCount: canonical.productHandoff.specifications.length,
  lookCount: canonical.looks.looks.length,
  archetypeFunStatus: canonical.archetypeFun.status
}, null, 2));
