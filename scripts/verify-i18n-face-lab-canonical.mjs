import assert from "node:assert/strict";
import { buildFaceLabV2Canonical } from "../lib/face-lab-v2/canonical-composer.js";
import { isFaceLabObservationAnalysis } from "../lib/face-lab-analysis-bundle.js";

const observed = (value) => ({
  status: "available",
  source: "vision",
  value,
  confidence: 0.84,
  evidence: ["synthetic-fixture"],
  unavailableReason: null
});
const unavailable = () => ({
  status: "unavailable",
  source: null,
  value: null,
  confidence: null,
  evidence: [],
  unavailableReason: "quality_insufficient"
});

const analysis = {
  schemaVersion: "face-lab-observation-v1",
  status: "available",
  failureReason: null,
  model: { provider: "fixture", name: "fixture", promptVersion: "face-lab-observation-prompt-v1" },
  quality: unavailable(),
  observations: {
    outline: { faceShape: observed("oval"), jawlineAngularity: observed("soft") },
    vertical: { faceLengthBalance: observed("balanced") },
    eyes: { eyeDirection: observed("level") },
    featureLayout: { featureConcentration: observed("balanced") },
    visualLanguage: {
      straightCurveBalance: observed("balanced"),
      contourDefinition: observed("moderate"),
      featureContrast: observed("medium")
    }
  },
  coverage: {
    availableGroups: ["outline", "vertical", "eyes", "featureLayout", "visualLanguage"],
    partialGroups: [],
    unavailableGroups: [],
    availableFieldCount: 8,
    totalCoreFieldCount: 8
  },
  warnings: [],
  privacy: { sourceImagePersisted: false }
};
assert.equal(isFaceLabObservationAnalysis(analysis), true, "must use an actual valid analysis contract");
const survey = {
  schemaVersion: "face-lab-target-style-survey-v1",
  entryMode: "known",
  targetSelections: ["natural"],
  approvedAt: "2026-10-21T00:00:00Z",
  presentationPreference: "neutral_examples",
  stylingScope: ["hair"],
  changeTolerance: "light",
  recommendationPriority: "face_harmony",
  constraints: {
    makeup: { intensity: "light" },
    lifestyle: { dailyMinutes: 15, budgetBand: "standard", maintenanceTolerance: "medium" },
    hardExclusions: []
  }
};
const options = { analysis, surveyAnswers: survey, resultId: "i18n-fixture" };
const ko = buildFaceLabV2Canonical({ ...options, locale: "ko" });
const en = buildFaceLabV2Canonical({ ...options, locale: "en" });
const compare = (label, choose) => {
  assert.deepEqual(choose(ko), choose(en), `KO/EN should preserve ${label}`);
};
compare("overall status", x => x.status);
compare("result schema version", x => x.schemaVersion);
compare("target status", x => x.targetStyle?.status);
compare("target source and labels", x => ({
  source: x.targetStyle?.source,
  targetLabels: x.targetStyle?.targetLabels,
  approvedByUser: x.targetStyle?.approvedByUser
}));
compare("current structural observations", x => x.currentFaceProfile?.structuralProfile);
compare("face visibility and quality warnings", x => x.quality);
compare("selected route and selection policy", x => ({
  id: x.routes?.selectedRouteId,
  state: x.routes?.selectionState,
  status: x.routes?.status
}));
compare("route identifiers/order", x => (x.routes?.routes || []).map(r => r.routeId));
compare("domain status", x => ({
  hair: x.hair?.status,
  makeup: x.makeup?.status,
  color: x.color?.status,
  grooming: x.grooming?.status,
  eyewear: x.eyewear?.status,
  accessories: x.accessories?.status,
  looks: x.looks?.status
}));
compare("failure reason", x => x.failureReason);
compare("product handoff identity", x => (x.productHandoff?.specifications || []).map(p => p.id));

const noConfirmation = { ...survey, approvedAt: null };
const holdKo = buildFaceLabV2Canonical({ ...options, surveyAnswers: noConfirmation, locale: "ko" });
const holdEn = buildFaceLabV2Canonical({ ...options, surveyAnswers: noConfirmation, locale: "en" });
assert.equal(holdKo.targetStyle?.status, holdEn.targetStyle?.status);
assert.equal(holdKo.failureReason, holdEn.failureReason);

console.log("I18N_KO_EN_FACE_LAB_CANONICAL=PASS");
