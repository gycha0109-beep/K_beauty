import assert from "node:assert/strict";
import { buildFaceLabV2TargetSweepCohort } from "../lib/face-lab-v2/evaluation/target-responsiveness.js";
import { FACE_LAB_OBSERVATION_DEFINITIONS } from "../lib/face-lab-observation-contract.js";
import { buildStyleCheckObservationResearchPreview } from "./build-face-lab-style-check-observation-preview-sc06k.mjs";

const fixture = buildFaceLabV2TargetSweepCohort({ faceCount: 1 })
  .cases.find((item) => item.targetKey === "chic");
assert.ok(fixture, "synthetic fixture exists");

const observed = {};
for (const [group, fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
  for (const field of Object.keys(fields)) {
    const item = fixture.analysis.observations[group][field];
    const available = item.status === "available" &&
      typeof item.value === "string" && field !== "focalFeatures";
    observed[group + "." + field] = available
      ? {
          reviewerDraftChoice: item.value,
          evidenceNote: "synthetic fixture evidence (not a real photograph)",
          held: false
        }
      : {
          reviewerDraftChoice: "uncertain",
          evidenceNote: "",
          held: true
        };
  }
}

const draft = {
  schemaVersion: "face-lab-sc06f-local-observation-draft-v1",
  status: "unsealed_exploratory_local_draft",
  sourceType: "manual_unverified_human_inputs",
  rightsVerified: false,
  observationValidityConfirmed: false,
  simulationAuthorized: false,
  sourcePhotosStored: false,
  providerCalls: 0,
  records: [{
    sampleRef: "P01",
    photoLocallyLoaded: true,
    notes: "",
    observations: observed
  }]
};
const review = {
  sampleRef: "P01",
  sourcePhotoSha256: "a".repeat(64),
  photoPermission: { operatorAttested: true, evidenceRef: "synthetic:permission" },
  photoQuality: { operatorAttested: true, evidenceRef: "synthetic:quality" },
  independentObservation: { operatorAttested: true, evidenceRef: "synthetic:observations" }
};
const quality = {
  ...fixture.analysis.quality.value,
  evidence: ["synthetic fixture quality, not real-photo assessment"]
};
const args = {
  draft,
  sampleRef: "P01",
  review,
  quality,
  surveyAnswers: fixture.surveyAnswers,
  targetKey: "chic"
};

function checkHeld(name, change, code) {
  const modified = structuredClone(args);
  change(modified);
  const result = buildStyleCheckObservationResearchPreview(modified);
  assert.equal(result.status, "held", name);
  assert.equal(result.holdReason, code, name);
  assert.equal(result.providerInvoked, false, name);
  assert.equal(result.productionActive, false, name);
}

checkHeld("missing review", (x) => { x.review = null; },
  "photo_rights_quality_independent_review_attestations_required");
checkHeld("incorrect photo fingerprint", (x) => { x.review.sourcePhotoSha256 = "x"; },
  "photo_rights_quality_independent_review_attestations_required");
checkHeld("missing quality review", (x) => { x.review.photoQuality.operatorAttested = false; },
  "photo_rights_quality_independent_review_attestations_required");
checkHeld("unreviewed quality", (x) => { x.quality = null; },
  "reviewed_photo_quality_required");
checkHeld("wrong target", (x) => { x.targetKey = "natural"; },
  "explicit_user_target_required");
checkHeld("invalid observation", (x) => {
  x.draft.records[0].observations["eyes.eyeOpenness"].reviewerDraftChoice = "not-an-enum";
}, "draft_audit_failed");
checkHeld("missing real observations", (x) => {
  for (const field of Object.values(x.draft.records[0].observations)) {
    field.reviewerDraftChoice = "uncertain";
    field.evidenceNote = "";
    field.held = true;
  }
}, "canonical_observation_coverage_insufficient");
checkHeld("unknown route", (x) => { x.routeId = "nonexistent"; },
  "style_explanation_unavailable");

const valid = buildStyleCheckObservationResearchPreview(args);
assert.equal(valid.status, "research_preview_only");
assert.equal(valid.analysisStatus, "available");
assert.ok(valid.cards.length > 0);
assert.equal(valid.provenanceAudit.status, "pass");
for (const key of [
  "providerInvoked", "productionActive", "simulationAuthorized",
  "recommendationAccuracyValidated", "independentHumanValidationCompleted",
  "sourcePhotoPersisted", "photoRightsIndependentlyVerified"
]) assert.equal(valid[key], false, key);
assert.equal(valid.operatorAttestationsIndependentlyAuthenticated, false);
assert.ok(!JSON.stringify(valid).includes("synthetic:permission"));
assert.ok(!JSON.stringify(valid).includes("synthetic fixture evidence"));

console.log(JSON.stringify({
  passed: 9,
  researchPreview: valid.status,
  explainedActions: valid.cards.length,
  recommendationAccuracyValidated: false,
  photoBytesTransferred: false
}));
