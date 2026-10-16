import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FACE_LAB_OBSERVATION_DEFINITIONS } from "../../../lib/face-lab-observation-contract.js";
import {
  inspectSkinVisionTrial,
  summarizeSkinVisionTrials
} from "./skin-vision-v2-provider-evidence-gate.mjs";
import { SKIN_VISIBLE_AXES } from "./skin-axis-evidence-contract-core.mjs";

const clone = x => structuredClone(x);
const cues = {
  oiliness: "surface_shine", dehydration: "dry_texture", acne: "active_spots",
  uneven_tone: "tone_variation", pores: "pore_visibility",
  redness: "red_appearance", barrier: "surface_stress"
};
const eligibility = {
  status: "eligible", source: "vision",
  imageType: "photorealistic_human", humanFaceCount: 1,
  faceLabEligible: true, skinAnalysisEligible: true,
  faceLabFailureReason: null, skinFailureReason: null,
  confidence: 0.9, evidence: ["synthetic:eligibility"]
};
function fixtureFace() {
  const observations = {};
  for (const [group, fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    observations[group] = {};
    for (const [name, values] of Object.entries(fields)) {
      observations[group][name] = {
        value: group === "featureLayout" && name === "focalFeatures" ? [values[0]] : values[0],
        visibility: "clear", evidence: ["synthetic:" + group + "." + name],
        unavailableReason: null
      };
    }
  }
  return {
    quality: {
      faceVisibility: "clear", faceScale: "adequate",
      pose: { yaw: "frontal", pitch: "level", roll: "level" },
      occlusion: {
        forehead: "none", brows: "none", eyes: "none", cheeks: "none", jawline: "none"
      },
      sharpness: "clear", exposure: "balanced",
      lightingUniformity: "even", whiteBalance: "stable",
      filterOrEditing: "none_detected", makeupCoverage: "none_or_light",
      structureSuitability: "suitable", colorSuitability: "suitable",
      evidence: ["synthetic:face"]
    },
    observations
  };
}
const rows = SKIN_VISIBLE_AXES.map(axis => ({
  axis, state: "not_seen", value: 0, confidence: "medium",
  cue: cues[axis], area: "cheeks", reason: "none"
}));
const v1 = {
  schemaVersion: "vision-observation-v1",
  eligibility: clone(eligibility),
  skin: { signals: Object.fromEntries([...SKIN_VISIBLE_AXES, "uv"].map(x => [x, 0])), observations: [] },
  face: fixtureFace()
};
const v2 = {
  schemaVersion: "vision-observation-v2",
  eligibility: clone(eligibility),
  skin: { axisEvidence: rows },
  face: fixtureFace()
};
function envelope(json, { finish = "stop", outputTokens = 1300, promptTokens = 500 } = {}) {
  return {
    choices: [{ finish_reason: finish, message: { content: typeof json === "string" ? json : JSON.stringify(json) } }],
    usage: { completion_tokens: outputTokens, prompt_tokens: promptTokens }
  };
}
const trial = (id, variant, json, options = {}) => inspectSkinVisionTrial({
  caseId: id, variant, providerEnvelope: envelope(json, options)
});
const a = trial("C01", "v1", v1);
const b = trial("C01", "v2", v2, { outputTokens: 1440 });
assert.equal(a.result, "STRUCTURALLY_VALID");
assert.equal(b.result, "STRUCTURALLY_VALID");
assert.equal(a.faceStatus, "available");
assert.equal(b.faceStatus, "available");
assert.equal(a.faceAvailableFieldCount, b.faceAvailableFieldCount);
assert.equal(b.skinStatus, "ready");
assert.equal(b.skinAxisStates.not_seen, 7);
assert.equal(b.skinAxisStates.unknown, 0);
assert.equal(b.expectedIneligibleAbstention,false);
// The 2026-10-16 real-photo metadata showed all raw not_seen rows
// landing in validated unknown. Preserve the strict cue/area contract:
// missing scoped inspected cue MUST NOT silently become a valid negative.
const invalidNegatives=clone(v2);
for (const row of invalidNegatives.skin.axisEvidence) {
  row.cue=null;
  row.area=null;
}
const invalidNegativeTrial=trial("NEG_CUE", "v2", invalidNegatives);
assert.equal(invalidNegativeTrial.skinStatus,"partial");
assert.equal(invalidNegativeTrial.skinAxisStates.unknown,7);
assert.equal(invalidNegativeTrial.skinAxisStates.not_seen,0);
assert.equal(invalidNegativeTrial.expectedIneligibleAbstention,false);
// Distinguish legitimately ineligible Skin + empty array from missing rows
// on an otherwise Skin-eligible person. Both remain non-acceptance.
const ineligible=clone(v2);
ineligible.eligibility={
  ...ineligible.eligibility,status:"ineligible",imageType:"other",
  humanFaceCount:0,faceLabEligible:false,skinAnalysisEligible:false,
  faceLabFailureReason:"face_not_detected",
  skinFailureReason:"face_not_detected",
  confidence:0.99,evidence:["synthetic nonhuman square"]
};
ineligible.skin.axisEvidence=[];
ineligible.face={};
const abstention=trial("ABSTAIN", "v2", ineligible);
assert.equal(abstention.expectedIneligibleAbstention,true);
assert.equal(abstention.result,"INVALID_OR_INCOMPLETE");
assert.equal(abstention.skinStatus,"blocked");
const failedSummarized=summarizeSkinVisionTrials([
  trial("ABSTAIN","v1",{...v1,eligibility:ineligible.eligibility,face:{}}),
  abstention
]);
assert.equal(failedSummarized.v2Invalid,1);
assert.equal(failedSummarized.v2ExpectedIneligibleAbstentions,1);
assert.equal(failedSummarized.v2EligibleStructuralFailures,0);
assert.equal(failedSummarized.v2OtherStructuralFailures,0);
assert.equal(failedSummarized.structuralCandidatePass,false);
assert.equal(failedSummarized.scoringActivationAuthorized,false);
const eligibleNonempty=trial("ELIGIBLE_MISS","v2",invalidNegatives);
const eligibleLoss=summarizeSkinVisionTrials([
  trial("ELIGIBLE_MISS","v1",v1),eligibleNonempty
]);
assert.equal(eligibleLoss.v2ExpectedIneligibleAbstentions,0);
assert.equal(eligibleLoss.v2EligibleStructuralFailures,1);
assert.equal(eligibleLoss.v2OtherStructuralFailures,0);
const malformedAbstention=clone(ineligible);
malformedAbstention.unexpected="synthetic";
const rejected=trial("BAD_INELIGIBLE","v2",malformedAbstention);
assert.equal(rejected.expectedIneligibleAbstention,false);
const malformedPair=summarizeSkinVisionTrials([
  trial("BAD_INELIGIBLE","v1",{...v1,eligibility:ineligible.eligibility,face:{}}),
  rejected
]);
assert.equal(malformedPair.v2ExpectedIneligibleAbstentions,0);
assert.equal(malformedPair.v2EligibleStructuralFailures,0);
assert.equal(malformedPair.v2OtherStructuralFailures,1);
assert.equal(b.responseComplete, true);
assert.equal(b.sensitiveSourcePersisted, false);
assert.equal(b.realPhotoTruthVerified, false);
assert.equal(b.outputTokens, 1440);
const ok = summarizeSkinVisionTrials([a, b]);
assert.equal(ok.verdict, "STRUCTURAL_PREFLIGHT_PASSED_ONLY");
assert.equal(ok.structuralCandidatePass, true);
assert.equal(ok.matchedPairs, 1);
assert.equal(ok.productReady, false);
assert.equal(ok.releaseReady, false);
assert.equal(ok.scoringActivationAuthorized, false);
assert.equal(ok.externallyVerifiedPhotoCohort, false);

// Finish=length MUST invalidate even parseable JSON; cap is a hard stop.
const truncated = trial("C01", "v2", v2, { finish: "length", outputTokens: 2199 });
assert.equal(truncated.responseComplete, false);
assert.equal(truncated.result, "INVALID_OR_INCOMPLETE");
assert(truncated.problems.includes("finish_reason_length"));
assert.equal(summarizeSkinVisionTrials([a, truncated]).v2Truncated, 1);
const cap = trial("C01", "v2", v2, { outputTokens: 2200 });
assert.equal(cap.result, "INVALID_OR_INCOMPLETE");
assert(cap.problems.includes("completion_at_cap"));
const exceeded = trial("C01", "v2", v2, { outputTokens: 2201 });
assert(exceeded.problems.includes("completion_usage_exceeds_cap"));
const headroom = trial("C01", "v2", v2, { outputTokens: 2000 });
assert.equal(headroom.nearTokenCap, true);
assert(headroom.problems.includes("near_cap_review"));
assert.equal(summarizeSkinVisionTrials([a, headroom]).structuralCandidatePass, false);

// Token count missing, non-stop finish, malformed JSON or wrong version: HOLD.
const missing = inspectSkinVisionTrial({
  caseId: "C01", variant: "v2",
  providerEnvelope: { choices: [{ finish_reason: "stop", message: { content: JSON.stringify(v2) } }] }
});
assert.equal(missing.result, "INVALID_OR_INCOMPLETE");
assert(missing.problems.includes("completion_usage_missing"));
const badJson = trial("C01", "v2", "{ bad JSON", { finish: "stop" });
assert.equal(badJson.result, "INVALID_OR_INCOMPLETE");
assert(badJson.problems.includes("response_json_invalid"));
const versionBad = trial("C01", "v2", v1);
assert.equal(versionBad.result, "INVALID_OR_INCOMPLETE");
assert(versionBad.problems.includes("schema_version_mismatch"));
assert.equal(trial("C01", "v2", v2, { finish: "content_filter" }).result, "INVALID_OR_INCOMPLETE");

// Axis omission/duplicate: preserve Face but block the candidate.
const omit = clone(v2);
omit.skin.axisEvidence = omit.skin.axisEvidence.filter(x => x.axis !== "pores");
const omitted = trial("C01", "v2", omit);
assert.equal(omitted.skinStatus, "partial");
assert.equal(omitted.faceStatus, "available");
assert.equal(omitted.result, "INVALID_OR_INCOMPLETE");
assert(omitted.problems.includes("skin_axis_evidence_incomplete"));
const repeat = clone(v2);
repeat.skin.axisEvidence.push(clone(repeat.skin.axisEvidence[0]));
const duplicated = trial("C01", "v2", repeat);
assert.equal(duplicated.result, "INVALID_OR_INCOMPLETE");
assert.equal(duplicated.faceStatus, "available");

// Skin eligible while Face quality degraded: detect reduced coverage.
const poor = clone(v2);
poor.face.observations.eyes.eyeDirection.visibility = "uncertain";
poor.face.observations.eyes.eyeDirection.value = null;
poor.face.observations.eyes.eyeDirection.evidence = [];
poor.face.observations.eyes.eyeDirection.unavailableReason = "ambiguous";
const degradedFace = trial("C01", "v2", poor);
assert.equal(degradedFace.result, "STRUCTURALLY_VALID"); // Skin contract still valid.
const faceLoss = summarizeSkinVisionTrials([a, degradedFace]);
assert.equal(faceLoss.faceCoverageDegraded, 1);
assert.equal(faceLoss.structuralCandidatePass, false);
assert.equal(faceLoss.productReady, false);
const noBaseline = clone(v1);
noBaseline.face.quality.evidence = [];
const emptyBaseline = trial("C01", "v1", noBaseline);
const unavailablePair = summarizeSkinVisionTrials([emptyBaseline, b]);
assert.equal(unavailablePair.faceBaselineUnassessable, 1);
assert.equal(unavailablePair.structuralCandidatePass, false);
assert.equal(unavailablePair.verdict, "BLOCKED_OR_INCOMPLETE");

// Other cases: incomplete pairs, duplicates, fake/unsafe identifiers rejected.
assert.equal(summarizeSkinVisionTrials([a]).unmatchedCases, 1);
assert.equal(summarizeSkinVisionTrials([a]).verdict, "BLOCKED_OR_INCOMPLETE");
assert.throws(() => summarizeSkinVisionTrials([a, a]), /duplicate_variant_for_case/);
assert.throws(() => trial("person@example.com", "v2", v2), /unsafe_case_id/);
assert.throws(() => inspectSkinVisionTrial({ caseId: "C01", variant: "v2",
  providerEnvelope: envelope(v2), maxCompletionTokens: 4000 }), /unapproved_token_limit/);
assert.throws(() => summarizeSkinVisionTrials([a, b], { evidenceOrigin: "real_photo_verified" }), /evidence_origin_invalid/);
const pending = summarizeSkinVisionTrials([a, b], { evidenceOrigin: "operator_review_pending" });
assert.equal(pending.productReady, false);
assert.equal(pending.externallyVerifiedPhotoCohort, false);

// Deliberate secret embedded in input must never reach returned gate report.
const secret = "SENSITIVE_PICTURE_FILENAME_SHOULD_NOT_LEAK";
const filled = clone(v2);
filled.face.quality.evidence = [secret];
const safeOutput = trial("C01", "v2", filled);
assert(!JSON.stringify(safeOutput).includes(secret));
assert(!JSON.stringify(summarizeSkinVisionTrials([a, safeOutput])).includes(secret));

// No test subject/photo/raw Provider response persist, and no production module may import this gate.
for (const file of [
  "lib/server/vision-observation-service.js",
  "app/api/analyze/route.js",
  "app/api/face-reading/route.js",
  "lib/vision-observation-normalizer.js",
  "lib/skin-match-decision-engine-core.js"
]) {
  assert(!readFileSync(file, "utf8").includes("skin-vision-v2-provider-evidence-gate"),
    "Evaluation module must remain disconnected: " + file);
}
console.log("verify-face-lab-s1b-provider-evidence-gate: PASS " + JSON.stringify({
  classification: "SYNTHETIC_ENVELOPE_ONLY",
  pairedCases: 1, tokenLimit: 2200,
  handlesFinishReasonLength: true,
  blockedNearCap: true,
  faceDegradationDetected: true,
  sensitiveSourcePersisted: false,
  liveProviderCalls: 0,
  productReady: false
}));
