import test from "node:test";
import assert from "node:assert/strict";
import {
  createSoloScreeningClaim,
  createSoloIntentRevealReceipt,
  finalizeSoloIntentAssessment,
  finalizeSoloTargetWithheldScreening,
  prepareSoloWaveArtifacts,
  verifySoloIntentAssessmentIntegrity
} from "../../src/solo-assessment/artifacts.js";

const hex = (character) => character.repeat(64);
const conditions = ["A","B","C","D"];

function rows(overrides = {}) {
  return conditions.map((conditionId, index) => ({
    slotId: `slot_${String(index + 1).repeat(24)}`,
    conditionId,
    readiness: "assessable_observed",
    candidateId: `cand_${String(index + 5).repeat(24)}`,
    canonicalAsset: { sha256: hex(String(index + 5)), objectRelativePath: `objects/${index}.png` },
    observationDigest: hex(String(index + 1)),
    authoritativeT5Status: overrides.authoritativeT5Status || "not_started",
    fixtureId: `${conditionId}_fixture`,
    finalizedSpecDigest: hex(String(index + 5)),
    compiledPromptDigest: hex(String(index + 6)),
    intendedSkinCue: {
      redness: ["B","D"].includes(conditionId) ? "mild" : "none",
      blemishes: ["C","D"].includes(conditionId) ? "mild" : "none",
      blemishCountBand: ["C","D"].includes(conditionId) ? "three_to_five" : "none"
    }
  }));
}

function prepare(sourceRows = rows()) {
  return prepareSoloWaveArtifacts({
    campaignRunId: `crun_${"1".repeat(24)}`,
    campaignPlanDigest: hex("a"),
    sourceProjectionDigest: hex("b"),
    waveOrdinal: 1,
    operatorId: "solo_operator",
    sourceRows,
    createdAt: "2026-08-03T00:00:00.000Z"
  });
}

function validScreeningDraft() {
  return {
    reviewability: { face: "reviewable", skin: "reviewable" },
    capture: {
      singleAdultSyntheticPerson: "confirmed",
      directFrontalLevelPose: "confirmed",
      cameraGazeNeutralExpression: "confirmed",
      headShouldersFraming: "confirmed",
      plainBackground: "confirmed",
      softEvenLighting: "confirmed",
      sharpFace: "confirmed",
      hairMakeupAccessoriesControlled: "confirmed"
    },
    skinObservation: {
      redness: { presence: "none", regions: [] },
      blemishes: { presence: "none", countBand: "none", regions: [] }
    },
    artifactFlags: {
      distortedAnatomy: "absent",
      duplicatedOrMissingFeature: "absent",
      visibleTextOrExternalMark: "absent",
      filterOrRetouchPossible: "absent"
    },
    reasonCodes: ["solo_screening_reviewable"],
    priorTargetKnowledgeAcknowledged: true
  };
}

test("sealed T5 consensus blocks creation of a weaker solo session", () => {
  const result = prepare(rows({ authoritativeT5Status: "present_but_not_used" }));
  assert.equal(result.ok, false);
});

test("target fields cannot be smuggled into target-withheld screening", () => {
  const prepared = prepare();
  assert.equal(prepared.ok, true);
  const entry = prepared.privateMap.entries[0];
  const item = prepared.reviewItems.find((candidate) => candidate.reviewItemId === entry.reviewItemId);
  const claim = createSoloScreeningClaim({ session: prepared.session, item, claimedAt: "2026-08-03T00:01:00.000Z" });
  const draft = { ...validScreeningDraft(), conditionId: "A" };
  const result = finalizeSoloTargetWithheldScreening({ session: prepared.session, item, claim: claim.claim, draft, submittedAt: "2026-08-03T00:02:00.000Z" });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "solo_target_withholding_invalid");
});

test("intent assessment derives target relation and cannot enable quality retry", () => {
  const prepared = prepare();
  const entry = prepared.privateMap.entries[0];
  const item = prepared.reviewItems.find((candidate) => candidate.reviewItemId === entry.reviewItemId);
  const claim = createSoloScreeningClaim({ session: prepared.session, item, claimedAt: "2026-08-03T00:01:00.000Z" });
  const screening = finalizeSoloTargetWithheldScreening({ session: prepared.session, item, claim: claim.claim, draft: validScreeningDraft(), submittedAt: "2026-08-03T00:02:00.000Z" });
  const reveal = createSoloIntentRevealReceipt({ session: prepared.session, privateMap: prepared.privateMap, screening: screening.screening, reviewItemId: entry.reviewItemId, revealedAt: "2026-08-03T00:03:00.000Z" });
  const result = finalizeSoloIntentAssessment({
    session: prepared.session,
    screening: screening.screening,
    reveal: reveal.reveal,
    draft: {
      faceLabInputUsability: "usable",
      operationalDisposition: "retain_exploratory",
      nextWaveRecommendation: "continue",
      sameSlotQualityRegenerationAllowed: true,
      derivedTargetRelation: { redness: "over_target", blemishPresence: "over_target", blemishCount: "over_target" },
      reasonCodes: ["solo_target_exact_match","solo_no_same_slot_quality_retry"]
    },
    submittedAt: "2026-08-03T00:04:00.000Z"
  });
  assert.equal(result.ok, true);
  assert.equal(result.assessment.sameSlotQualityRegenerationAllowed, false);
  assert.deepEqual(result.assessment.derivedTargetRelation, { redness: "exact_match", blemishPresence: "exact_match", blemishCount: "exact_match" });
  assert.equal(verifySoloIntentAssessmentIntegrity(result.assessment), true);
  const forged = { ...result.assessment, promotionEligible: true };
  assert.equal(verifySoloIntentAssessmentIntegrity(forged), false);
});
