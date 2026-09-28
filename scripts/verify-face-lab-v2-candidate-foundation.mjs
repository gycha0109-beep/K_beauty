import assert from "node:assert/strict";
import {
  buildStyleDelta,
  STYLE_DELTA_VERSION
} from "../lib/face-lab-v2/style-delta.js";
import {
  buildCandidateStyleDelta,
  CANDIDATE_STYLE_DELTA_VERSION
} from "../lib/face-lab-v2/candidate-style-delta.js";
import {
  CANDIDATE_FACE_ACTION_RELATIONS,
  CANDIDATE_FACE_ACTION_RELATION_VERSION
} from "../lib/face-lab-v2/personalization/candidate-face-action-relations.js";
import {
  FACE_ACTION_RELATION_AUTHORITY
} from "../lib/face-lab-v2/personalization/face-action-relations.js";
import {
  FACE_FIT_PLANNER_VERSION
} from "../lib/face-lab-v2/personalization/face-fit-planner.js";
import {
  buildStyleRoutes
} from "../lib/face-lab-v2/route-generator.js";

function profile(lineDirection) {
  return {
    status: "available",
    profileVersion: "face-lab-current-face-profile-v1",
    summary: "fixture",
    keyFeatures: [
      {
        key: "jawlineAngularity",
        direction: "moderate",
        evidence: ["fixture:jawline"],
        confidence: 0.9
      },
      {
        key: "faceLengthBalance",
        direction: "balanced",
        evidence: ["fixture:length"],
        confidence: 0.9
      },
      {
        key: "straightCurveBalance",
        direction: lineDirection,
        evidence: ["fixture:line"],
        confidence: 0.9
      }
    ],
    visualLanguage: null,
    structuralProfile: null,
    presentationObservations: null,
    evidence: [
      "fixture:jawline",
      "fixture:length",
      "fixture:line"
    ],
    confidence: 0.9,
    unavailableReason: null
  };
}

function target(
  softSharp,
  {
    stylingScope = ["eyewear"],
    hardExclusions = []
  } = {}
) {
  return {
    status: "available",
    profileVersion: "face-lab-target-style-profile-v1",
    approvedByUser: true,
    vector: {
      softSharp,
      naturalPolished: 0.5,
      playfulMature: 0.5,
      minimalStatement: 0.5,
      warmCool: 0.5,
      classicTrendy: 0.5
    },
    stylingScope,
    changeTolerance: "moderate",
    constraints: {
      hair: {
        lengthChange: "small",
        dye: "no"
      },
      makeup: {
        intensity: "medium"
      },
      lifestyle: {
        dailyMinutes: 30,
        budgetBand: "standard",
        maintenanceTolerance: "medium"
      },
      hardExclusions
    },
    preferenceEvidence: ["fixture:target"]
  };
}

function findPriority(delta, domain, parameter) {
  return delta.priorities.find(
    (item) =>
      item.domain === domain &&
      item.parameter === parameter
  ) || null;
}

function semanticIdentity(item) {
  return {
    rank: item.rank,
    domain: item.domain,
    parameter: item.parameter,
    direction: item.direction,
    constraintState: item.constraintState,
    blockedBy: item.blockedBy
  };
}

assert.equal(
  STYLE_DELTA_VERSION,
  "face-lab-style-delta-v3"
);
assert.equal(
  CANDIDATE_STYLE_DELTA_VERSION,
  "face-lab-style-delta-candidate-v1"
);
assert.equal(
  CANDIDATE_FACE_ACTION_RELATION_VERSION,
  "face-lab-candidate-face-action-relations-v1"
);
assert.equal(
  FACE_FIT_PLANNER_VERSION,
  "face-lab-face-fit-planner-v1"
);

assert.deepEqual(
  CANDIDATE_FACE_ACTION_RELATIONS.map(
    (item) => item.relationId
  ),
  ["FL-CAND-001", "FL-CAND-002"],
  "vCandidate-1 must remain bounded to the two reviewed geometry-alignment hypotheses"
);
assert.ok(
  CANDIDATE_FACE_ACTION_RELATIONS.every(
    (item) =>
      item.authorityClass ===
        FACE_ACTION_RELATION_AUTHORITY.CANDIDATE_HYPOTHESIS &&
      item.sourceFeatureKey === "straightCurveBalance" &&
      item.cueReadiness ===
        "READY_FOR_BLIND_HUMAN_CUE_AUDIT" &&
      item.humanCalibrationRequired === true &&
      item.operation?.type === "strength_cap" &&
      item.operation?.strength === "light"
  ),
  "candidate relations must stay diagnostic-only and bounded to a strength cap on the ready straight/curve cue"
);

for (const relation of CANDIDATE_FACE_ACTION_RELATIONS) {
  assert.equal(
    relation.actionMatch.domain,
    "eyewear",
    "vCandidate-1 must not expand into unrelated execution domains"
  );
  assert.ok(
    ["curvature", "angularity"].includes(
      relation.actionMatch.parameter
    )
  );
  assert.equal(
    relation.actionMatch.direction,
    "increase",
    "vCandidate-1 must not reverse target direction"
  );
  assert.ok(
    ["target_softSharp_low", "target_softSharp_high"].includes(
      relation.actionMatch.reason
    )
  );
}

for (const forbidden of [
  "featureContrast",
  "contourDefinition",
  "eyeLength",
  "faceShape",
  "faceLengthBalance",
  "featureConcentration"
]) {
  assert.ok(
    !CANDIDATE_FACE_ACTION_RELATIONS.some(
      (item) => item.sourceFeatureKey === forbidden
    ),
    "candidate foundation must not activate unreviewed cue expansion: " +
      forbidden
  );
}

const curvedTarget = target(0.2);
const curvedCurrent = buildStyleDelta({
  currentFaceProfile: profile("curved"),
  targetStyle: curvedTarget
});
const curvedCandidate = buildCandidateStyleDelta({
  currentFaceProfile: profile("curved"),
  targetStyle: curvedTarget
});

const currentCurvature = findPriority(
  curvedCurrent,
  "eyewear",
  "curvature"
);
const candidateCurvature = findPriority(
  curvedCandidate,
  "eyewear",
  "curvature"
);

assert.equal(currentCurvature?.strength, "moderate");
assert.equal(
  currentCurvature?.reason,
  "target_softSharp_low"
);
assert.equal(candidateCurvature?.strength, "light");
assert.equal(
  candidateCurvature?.direction,
  currentCurvature?.direction
);
assert.equal(
  candidateCurvature?.parameter,
  currentCurvature?.parameter
);
assert.equal(
  candidateCurvature?.reason,
  "candidate_face_fit_curve_alignment"
);
assert.deepEqual(
  candidateCurvature?.evidence,
  [
    "target_axis:softSharp",
    "face_feature:straightCurveBalance=curved",
    "candidate_relation:FL-CAND-001"
  ]
);
assert.equal(
  candidateCurvature?.candidatePersonalization?.baseReason,
  "target_softSharp_low"
);
assert.equal(
  curvedCandidate.personalizationLedger.length,
  1
);
assert.equal(
  curvedCandidate.personalizationLedger[0]?.relationId,
  "FL-CAND-001"
);

const straightTarget = target(0.8);
const straightCurrent = buildStyleDelta({
  currentFaceProfile: profile("straight"),
  targetStyle: straightTarget
});
const straightCandidate = buildCandidateStyleDelta({
  currentFaceProfile: profile("straight"),
  targetStyle: straightTarget
});

const currentAngularity = findPriority(
  straightCurrent,
  "eyewear",
  "angularity"
);
const candidateAngularity = findPriority(
  straightCandidate,
  "eyewear",
  "angularity"
);

assert.equal(currentAngularity?.strength, "moderate");
assert.equal(candidateAngularity?.strength, "light");
assert.equal(
  candidateAngularity?.direction,
  currentAngularity?.direction
);
assert.equal(
  candidateAngularity?.parameter,
  currentAngularity?.parameter
);
assert.equal(
  candidateAngularity?.reason,
  "candidate_face_fit_straight_alignment"
);
assert.deepEqual(
  candidateAngularity?.evidence,
  [
    "target_axis:softSharp",
    "face_feature:straightCurveBalance=straight",
    "candidate_relation:FL-CAND-002"
  ]
);
assert.equal(
  straightCandidate.personalizationLedger[0]?.relationId,
  "FL-CAND-002"
);

const balancedCurrent = buildStyleDelta({
  currentFaceProfile: profile("balanced"),
  targetStyle: curvedTarget
});
const balancedCandidate = buildCandidateStyleDelta({
  currentFaceProfile: profile("balanced"),
  targetStyle: curvedTarget
});

assert.deepEqual(
  balancedCandidate.priorities,
  balancedCurrent.priorities,
  "a non-matching face cue must preserve current action semantics exactly"
);
assert.deepEqual(
  balancedCandidate.personalizationLedger,
  []
);

const blockedTarget = target(0.2, {
  stylingScope: ["hair"]
});
const blockedCurrent = buildStyleDelta({
  currentFaceProfile: profile("curved"),
  targetStyle: blockedTarget
});
const blockedCandidate = buildCandidateStyleDelta({
  currentFaceProfile: profile("curved"),
  targetStyle: blockedTarget
});
const blockedCurrentEyewear = findPriority(
  blockedCurrent,
  "eyewear",
  "curvature"
);
const blockedCandidateEyewear = findPriority(
  blockedCandidate,
  "eyewear",
  "curvature"
);

assert.equal(
  blockedCurrentEyewear?.constraintState,
  "blocked"
);
assert.equal(
  blockedCurrentEyewear?.blockedBy,
  "domain_not_requested"
);
assert.deepEqual(
  blockedCandidateEyewear,
  blockedCurrentEyewear,
  "candidate policy must not rewrite blocked actions"
);
assert.deepEqual(
  blockedCandidate.personalizationLedger,
  []
);

const excludedTarget = target(0.8, {
  stylingScope: ["eyewear"],
  hardExclusions: ["eyewear_disabled"]
});
const excludedCandidate = buildCandidateStyleDelta({
  currentFaceProfile: profile("straight"),
  targetStyle: excludedTarget
});
const excludedEyewear = findPriority(
  excludedCandidate,
  "eyewear",
  "angularity"
);
assert.equal(excludedEyewear?.constraintState, "blocked");
assert.equal(excludedEyewear?.blockedBy, "eyewear_disabled");
assert.deepEqual(
  excludedCandidate.personalizationLedger,
  []
);

for (const [currentDelta, candidateDelta] of [
  [curvedCurrent, curvedCandidate],
  [straightCurrent, straightCandidate],
  [balancedCurrent, balancedCandidate],
  [blockedCurrent, blockedCandidate]
]) {
  assert.equal(
    currentDelta.priorities.length,
    candidateDelta.priorities.length,
    "candidate policy must not create or delete Target actions"
  );

  currentDelta.priorities.forEach((item, index) => {
    assert.deepEqual(
      semanticIdentity(candidateDelta.priorities[index]),
      semanticIdentity(item),
      "candidate policy must preserve action identity, direction, rank, and constraint authority"
    );
  });
}

assert.equal(
  curvedCandidate.candidatePolicy.productionActive,
  false
);
assert.equal(
  curvedCandidate.candidatePolicy.currentStyleDeltaVersion,
  STYLE_DELTA_VERSION
);
assert.equal(
  curvedCandidate.candidatePolicy.faceFitPlannerVersion,
  FACE_FIT_PLANNER_VERSION
);

const curvedRoutes = buildStyleRoutes(
  curvedCandidate,
  {
    targetStyle: curvedTarget,
    locale: "ko"
  }
);
const routedCurvature = curvedRoutes.routes
  .flatMap((route) => route.actions)
  .find(
    (item) =>
      item.domain === "eyewear" &&
      item.parameter === "curvature"
  );

assert.ok(
  routedCurvature,
  "candidate Style Delta must remain executable by the existing route generator"
);
assert.equal(routedCurvature.strength, "light");
assert.ok(
  routedCurvature.evidence.includes(
    "candidate_relation:FL-CAND-001"
  )
);

const unavailableCurrent = buildStyleDelta({
  currentFaceProfile: null,
  targetStyle: curvedTarget
});
const unavailableCandidate = buildCandidateStyleDelta({
  currentFaceProfile: null,
  targetStyle: curvedTarget
});
assert.equal(
  unavailableCandidate.status,
  unavailableCurrent.status
);
assert.equal(
  unavailableCandidate.unavailableReason,
  unavailableCurrent.unavailableReason
);
assert.deepEqual(
  unavailableCandidate.personalizationLedger,
  []
);

const unconfirmedTarget = {
  ...curvedTarget,
  approvedByUser: false
};
const unconfirmedCurrent = buildStyleDelta({
  currentFaceProfile: profile("curved"),
  targetStyle: unconfirmedTarget
});
const unconfirmedCandidate = buildCandidateStyleDelta({
  currentFaceProfile: profile("curved"),
  targetStyle: unconfirmedTarget
});
assert.equal(
  unconfirmedCandidate.status,
  unconfirmedCurrent.status
);
assert.equal(
  unconfirmedCandidate.unavailableReason,
  unconfirmedCurrent.unavailableReason
);
assert.deepEqual(
  unconfirmedCandidate.personalizationLedger,
  []
);

console.log(JSON.stringify({
  ok: true,
  candidateStyleDeltaVersion:
    CANDIDATE_STYLE_DELTA_VERSION,
  plannerVersion: FACE_FIT_PLANNER_VERSION,
  candidateRelationCount:
    CANDIDATE_FACE_ACTION_RELATIONS.length,
  candidateRelationIds:
    CANDIDATE_FACE_ACTION_RELATIONS.map(
      (item) => item.relationId
    ),
  productionActive:
    curvedCandidate.candidatePolicy.productionActive,
  curvedCase: {
    currentStrength: currentCurvature.strength,
    candidateStrength: candidateCurvature.strength,
    relationId:
      curvedCandidate.personalizationLedger[0].relationId
  },
  straightCase: {
    currentStrength: currentAngularity.strength,
    candidateStrength: candidateAngularity.strength,
    relationId:
      straightCandidate.personalizationLedger[0].relationId
  }
}, null, 2));
