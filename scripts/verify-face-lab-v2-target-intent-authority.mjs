import assert from "node:assert/strict";
import {
  FACE_LAB_RECOMMENDATION_PRIORITY,
  TARGET_INTENT_POLICY_VERSION,
  normalizeFaceLabRecommendationPriority
} from "../lib/face-lab-v2/target-intent.js";
import {
  normalizeFaceLabV2SurveyAnswers
} from "../lib/face-lab-v2/survey-contract.js";
import {
  buildTargetStyleProfile
} from "../lib/face-lab-v2/target-style-mapper.js";
import {
  buildTargetActionPool
} from "../lib/face-lab-v2/target-action-pool.js";
import {
  applyCurrentFaceModifiers
} from "../lib/face-lab-v2/personalization/current-face-modifier.js";
import {
  buildStyleDelta
} from "../lib/face-lab-v2/style-delta.js";

assert.equal(
  TARGET_INTENT_POLICY_VERSION,
  "face-lab-target-intent-policy-v1"
);

assert.equal(
  normalizeFaceLabRecommendationPriority(null),
  FACE_LAB_RECOMMENDATION_PRIORITY.FACE_HARMONY,
  "legacy payloads must default to existing Face Fit behavior"
);
assert.equal(
  normalizeFaceLabRecommendationPriority("target_forward"),
  FACE_LAB_RECOMMENDATION_PRIORITY.TARGET_FORWARD
);
assert.equal(
  normalizeFaceLabRecommendationPriority("unknown"),
  FACE_LAB_RECOMMENDATION_PRIORITY.FACE_HARMONY
);

const baseSurvey = {
  schemaVersion: "face-lab-target-style-survey-v1",
  entryMode: "known",
  targetSelections: ["soft"],
  clarifiers: {
    softSharp: null,
    naturalPolished: null
  },
  presentationPreference: "neutral_examples",
  stylingScope: [
    "hair",
    "brow_grooming",
    "makeup",
    "color",
    "eyewear",
    "accessories",
    "facial_hair"
  ],
  changeTolerance: "moderate",
  contexts: [],
  constraints: {
    hair: { lengthChange: "small", dye: "no" },
    makeup: { intensity: "medium" },
    lifestyle: {
      dailyMinutes: 30,
      budgetBand: "standard",
      maintenanceTolerance: "medium"
    },
    hardExclusions: []
  },
  approvedAt: "2026-09-29T00:00:00.000Z"
};

const legacyNormalized =
  normalizeFaceLabV2SurveyAnswers(baseSurvey);
assert.equal(
  legacyNormalized.recommendationPriority,
  "face_harmony"
);

const forwardNormalized =
  normalizeFaceLabV2SurveyAnswers({
    ...baseSurvey,
    recommendationPriority: "target_forward"
  });
assert.equal(
  forwardNormalized.recommendationPriority,
  "target_forward"
);

const legacyProfile = buildTargetStyleProfile({
  surveyAnswers: baseSurvey
});
const forwardProfile = buildTargetStyleProfile({
  surveyAnswers: {
    ...baseSurvey,
    recommendationPriority: "target_forward"
  }
});

assert.equal(
  legacyProfile.recommendationPriority,
  "face_harmony"
);
assert.equal(
  forwardProfile.recommendationPriority,
  "target_forward"
);
assert.equal(
  legacyProfile.preferenceEvidence.some(
    (item) => item.startsWith("recommendation_priority:")
  ),
  false,
  "legacy evidence must remain unchanged"
);
assert.ok(
  forwardProfile.preferenceEvidence.includes(
    "recommendation_priority:target_forward"
  )
);

const targetStyle = {
  vector: {
    softSharp: 0.2,
    naturalPolished: 0.5,
    playfulMature: 0.5,
    minimalStatement: 0.5,
    warmCool: 0.5,
    classicTrendy: 0.5
  }
};

const rawActions = buildTargetActionPool(targetStyle);
const faceProfile = {
  status: "available",
  profileVersion: "face-lab-current-profile-test-v1",
  confidence: 1,
  evidence: ["test:face"],
  keyFeatures: [
    {
      key: "straightCurveBalance",
      direction: "curved",
      evidence: ["test:curved"]
    }
  ]
};

const harmony = applyCurrentFaceModifiers(
  rawActions,
  faceProfile,
  { recommendationPriority: "face_harmony" }
);
const forward = applyCurrentFaceModifiers(
  rawActions,
  faceProfile,
  { recommendationPriority: "target_forward" }
);
const legacy = applyCurrentFaceModifiers(
  rawActions,
  faceProfile
);

const rawCurvature = rawActions.find(
  (item) =>
    item.domain === "hair" &&
    item.parameter === "curvature"
);
const harmonyCurvature = harmony.actions.find(
  (item) =>
    item.domain === "hair" &&
    item.parameter === "curvature"
);
const forwardCurvature = forward.actions.find(
  (item) =>
    item.domain === "hair" &&
    item.parameter === "curvature"
);

assert.deepEqual(
  legacy,
  harmony,
  "missing recommendation priority must preserve Production semantics"
);
assert.deepEqual(
  {
    direction: rawCurvature.direction,
    strength: rawCurvature.strength,
    reason: rawCurvature.reason
  },
  {
    direction: "increase",
    strength: "moderate",
    reason: "target_softSharp_low"
  }
);
assert.deepEqual(
  {
    direction: harmonyCurvature.direction,
    strength: harmonyCurvature.strength,
    reason: harmonyCurvature.reason
  },
  {
    direction: "maintain",
    strength: "light",
    reason: "face_modifier_line_already_curved"
  }
);
assert.deepEqual(
  forwardCurvature,
  rawCurvature,
  "Target-forward must preserve the user-authorized Target action"
);
assert.equal(forward.conflicts.length, 0);

const styleBase = {
  status: "available",
  approvedByUser: true,
  profileVersion: "face-lab-target-style-profile-v1",
  vector: targetStyle.vector,
  stylingScope: ["hair"],
  constraints: {
    makeup: { intensity: "medium" },
    lifestyle: {
      dailyMinutes: 30,
      budgetBand: "standard",
      maintenanceTolerance: "medium"
    },
    hardExclusions: []
  },
  preferenceEvidence: [],
  changeTolerance: "moderate"
};

const harmonyDelta = buildStyleDelta({
  currentFaceProfile: faceProfile,
  targetStyle: {
    ...styleBase,
    recommendationPriority: "face_harmony"
  }
});
const forwardDelta = buildStyleDelta({
  currentFaceProfile: faceProfile,
  targetStyle: {
    ...styleBase,
    recommendationPriority: "target_forward"
  }
});

const harmonyDeltaCurvature = harmonyDelta.priorities.find(
  (item) =>
    item.domain === "hair" &&
    item.parameter === "curvature"
);
const forwardDeltaCurvature = forwardDelta.priorities.find(
  (item) =>
    item.domain === "hair" &&
    item.parameter === "curvature"
);

assert.equal(harmonyDeltaCurvature.direction, "maintain");
assert.equal(harmonyDeltaCurvature.strength, "light");
assert.equal(forwardDeltaCurvature.direction, "increase");
assert.equal(forwardDeltaCurvature.strength, "moderate");

const blockedForward = buildStyleDelta({
  currentFaceProfile: faceProfile,
  targetStyle: {
    ...styleBase,
    recommendationPriority: "target_forward",
    stylingScope: ["eyewear"]
  }
});

const blockedHair = blockedForward.priorities.find(
  (item) =>
    item.domain === "hair" &&
    item.parameter === "curvature"
);
assert.equal(
  blockedHair.constraintState,
  "blocked",
  "Target-forward must not bypass Styling Scope"
);
assert.equal(
  blockedHair.blockedBy,
  "domain_not_requested"
);

console.log(JSON.stringify({
  ok: true,
  policyVersion: TARGET_INTENT_POLICY_VERSION,
  legacyDefault: legacyNormalized.recommendationPriority,
  explicitPriority: forwardNormalized.recommendationPriority,
  faceHarmony: {
    direction: harmonyDeltaCurvature.direction,
    strength: harmonyDeltaCurvature.strength
  },
  targetForward: {
    direction: forwardDeltaCurvature.direction,
    strength: forwardDeltaCurvature.strength
  },
  scopeAuthorityPreserved: true
}, null, 2));
