import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFaceLabV2Canonical } from "../lib/face-lab-v2/canonical-composer.js";
import {
  FACE_LAB_ROUTE_CHOICE_EVIDENCE_VERSION,
  buildFaceLabRouteChoiceEvidence,
  normalizeFaceLabRouteChoiceEvidence
} from "../lib/face-lab-v2/route-choice-evidence.js";
import {
  buildFaceLabV2TargetSweepCohort
} from "../lib/face-lab-v2/evaluation/target-responsiveness.js";

const capturedAt = "2026-09-29T02:10:00.000Z";
const cohort = buildFaceLabV2TargetSweepCohort();
const caseDef = cohort.cases[0];

const previewCanonical = buildFaceLabV2Canonical({
  analysis: caseDef.analysis,
  surveyAnswers: caseDef.surveyAnswers,
  resultId: "choice-evidence-preview"
});

assert.equal(previewCanonical.routes.selectionState, "default_preview");
assert.equal(
  buildFaceLabRouteChoiceEvidence(previewCanonical, { capturedAt }),
  null,
  "an uncommitted default preview must never create preference evidence"
);

const chosenRouteId = previewCanonical.routes.routes[0].routeId;
const chosenCanonical = buildFaceLabV2Canonical({
  analysis: caseDef.analysis,
  surveyAnswers: caseDef.surveyAnswers,
  selectedRouteId: chosenRouteId,
  resultId: "choice-evidence-user"
});

const chosenRoute = chosenCanonical.routes.routes.find(
  (route) => route.routeId === chosenRouteId
);
const explicitEvidence = buildFaceLabRouteChoiceEvidence(
  chosenCanonical,
  { capturedAt }
);

assert.equal(
  explicitEvidence.schemaVersion,
  FACE_LAB_ROUTE_CHOICE_EVIDENCE_VERSION
);
assert.equal(explicitEvidence.selectionState, "user_selected");
assert.equal(explicitEvidence.choiceType, "explicit_user");
assert.equal(explicitEvidence.preferenceEligible, true);
assert.equal(explicitEvidence.routeId, chosenRouteId);
assert.equal(explicitEvidence.strategy, chosenRoute.strategy);
assert.equal(
  explicitEvidence.routeGeneratorVersion,
  chosenCanonical.lineage.routeGeneratorVersion
);
assert.equal(
  explicitEvidence.recommendationPriority,
  chosenCanonical.targetStyle.recommendationPriority
);
assert.deepEqual(explicitEvidence.targetLabels, chosenCanonical.targetStyle.targetLabels);
assert.deepEqual(explicitEvidence.domains, chosenRoute.domains);
assert.equal(explicitEvidence.changeTolerance, chosenCanonical.targetStyle.changeTolerance);
assert.equal(explicitEvidence.changeMagnitude, chosenRoute.changeMagnitude);
assert.equal(explicitEvidence.dailyEffort, chosenRoute.dailyEffort);
assert.equal(explicitEvidence.maintenance, chosenRoute.maintenance);
assert.equal(explicitEvidence.costBand, chosenRoute.costBand);
assert.equal(explicitEvidence.reversibility, chosenRoute.reversibility);
assert.equal(explicitEvidence.capturedAt, capturedAt);
assert.deepEqual(
  explicitEvidence.actions,
  chosenRoute.actions.map((action) => ({
    domain: action.domain,
    parameter: action.parameter,
    direction: action.direction,
    strength: action.strength || null
  }))
);

const serializedEvidence = JSON.stringify(explicitEvidence);
for (const forbidden of [
  "face_feature:",
  "explanation",
  "expectedEffect",
  "currentFaceProfile",
  "photo",
  "analysis"
]) {
  assert.equal(
    serializedEvidence.includes(forbidden),
    false,
    "choice evidence must not persist raw face/photo/explanation data: " + forbidden
  );
}

const autoEvidence = buildFaceLabRouteChoiceEvidence({
  routes: {
    selectionState: "single_route_auto",
    selectedRouteId: "only",
    version: "route-test-v1",
    routes: [
      {
        routeId: "only",
        strategy: "low_effort",
        domains: ["hair"],
        changeMagnitude: "low",
        dailyEffort: "low",
        maintenance: "low",
        costBand: "low",
        reversibility: "easy",
        actions: [
          {
            domain: "hair",
            parameter: "curvature",
            direction: "maintain",
            strength: "light",
            explanation: "must not be persisted"
          }
        ]
      }
    ]
  },
  targetStyle: {
    targetLabels: ["soft"],
    recommendationPriority: "face_harmony",
    changeTolerance: "minimal"
  },
  lineage: {
    routeGeneratorVersion: "route-test-v1"
  }
}, { capturedAt });

assert.equal(autoEvidence.selectionState, "single_route_auto");
assert.equal(autoEvidence.choiceType, "single_option_auto");
assert.equal(
  autoEvidence.preferenceEligible,
  false,
  "a forced single option is not evidence of user preference"
);

const forged = normalizeFaceLabRouteChoiceEvidence({
  ...explicitEvidence,
  choiceType: "single_option_auto",
  preferenceEligible: false
});
assert.equal(forged.choiceType, "explicit_user");
assert.equal(forged.preferenceEligible, true);
assert.equal(
  normalizeFaceLabRouteChoiceEvidence({
    ...explicitEvidence,
    schemaVersion: "unknown"
  }),
  null
);

const apiSource = readFileSync(
  "app/api/premium/face-lab-v2/route.js",
  "utf8"
);
const clientSource = readFileSync(
  "components/full-report/PremiumFaceLabSection.jsx",
  "utf8"
);

for (const required of [
  "buildFaceLabRouteChoiceEvidence",
  "normalizeFaceLabRouteChoiceEvidence",
  "routeChoiceEvidence",
  "saved.routeChoiceEvidence?.routeId === rehydratedRouteId"
]) {
  assert.ok(apiSource.includes(required), "server route missing: " + required);
}

assert.equal(
  apiSource.includes("body?.routeChoiceEvidence"),
  false,
  "route choice evidence must not be accepted directly from the client"
);
assert.equal(
  clientSource.includes("routeChoiceEvidence"),
  false,
  "the browser must not manufacture canonical route-choice evidence"
);

console.log(JSON.stringify({
  ok: true,
  version: FACE_LAB_ROUTE_CHOICE_EVIDENCE_VERSION,
  previewEvidence: null,
  explicit: {
    routeId: explicitEvidence.routeId,
    strategy: explicitEvidence.strategy,
    preferenceEligible: explicitEvidence.preferenceEligible,
    domainCount: explicitEvidence.domains.length,
    actionCount: explicitEvidence.actions.length
  },
  singleRouteAuto: {
    routeId: autoEvidence.routeId,
    preferenceEligible: autoEvidence.preferenceEligible
  },
  serverDerivedOnly: true
}, null, 2));
