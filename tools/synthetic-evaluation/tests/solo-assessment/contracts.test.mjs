import test from "node:test";
import assert from "node:assert/strict";
import {
  createSoloScreeningClaim,
  createSoloIntentRevealReceipt,
  createSoloWaveAssessmentRow,
  createSoloWaveAssessmentSet,
  createSoloWaveBrief,
  finalizeSoloIntentAssessment,
  finalizeSoloTargetWithheldScreening,
  prepareSoloWaveArtifacts,
  summarizeSoloWave,
  verifySoloIntentAssessmentIntegrity,
  verifySoloTargetWithheldScreeningIntegrity,
  verifySoloWaveAssessmentSetIntegrity,
  verifySoloWaveBriefIntegrity,
  verifySoloWaveSessionIntegrity
} from "../../src/solo-assessment/artifacts.js";

const hex = (character) => character.repeat(64);
const runId = `crun_${"1".repeat(24)}`;
const conditions = ["A", "B", "C", "D"];

function cue(conditionId) {
  return {
    redness: ["B","D"].includes(conditionId) ? "mild" : "none",
    blemishes: ["C","D"].includes(conditionId) ? "mild" : "none",
    blemishCountBand: ["C","D"].includes(conditionId) ? "three_to_five" : "none"
  };
}

function sourceRows() {
  return conditions.map((conditionId, index) => ({
    slotId: `slot_${String(index + 1).repeat(24)}`,
    conditionId,
    readiness: "assessable_observed",
    candidateId: `cand_${String(index + 5).repeat(24)}`,
    canonicalAsset: { sha256: hex(String(index + 5)), objectRelativePath: `objects/canonical/${index + 1}.png` },
    observationDigest: hex(String(index + 1)),
    authoritativeT5Status: "not_started",
    fixtureId: `${conditionId}_fixture`,
    finalizedSpecDigest: hex(String(index + 5)),
    compiledPromptDigest: hex(String(index + 6)),
    intendedSkinCue: cue(conditionId)
  }));
}

function screeningDraft(conditionId) {
  const intended = cue(conditionId);
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
      redness: { presence: intended.redness, regions: intended.redness === "mild" ? ["left_cheek","right_cheek","sides_of_nose"] : [] },
      blemishes: { presence: intended.blemishes, countBand: intended.blemishCountBand, regions: intended.blemishes === "mild" ? ["left_cheek","right_cheek","chin"] : [] }
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

function assessmentDraft() {
  return {
    faceLabInputUsability: "usable",
    operationalDisposition: "retain_exploratory",
    nextWaveRecommendation: "continue",
    reasonCodes: ["solo_target_exact_match","solo_retain_exploratory","solo_no_same_slot_quality_retry"]
  };
}

test("T11 creates immutable target-withheld artifacts and a four-row exploratory brief", () => {
  const prepared = prepareSoloWaveArtifacts({
    campaignRunId: runId,
    campaignPlanDigest: hex("a"),
    sourceProjectionDigest: hex("b"),
    waveOrdinal: 1,
    operatorId: "solo_operator",
    sourceRows: sourceRows(),
    createdAt: "2026-08-03T00:00:00.000Z"
  });
  assert.equal(prepared.ok, true);
  assert.equal(verifySoloWaveSessionIntegrity(prepared.session, prepared.privateMap), true);
  assert.equal(prepared.reviewItems.length, 4);
  for (const item of prepared.reviewItems) {
    assert.equal(Object.hasOwn(item, "slotId"), false);
    assert.equal(Object.hasOwn(item, "conditionId"), false);
    assert.deepEqual(item.excludedFields, ["slotId","conditionId","fixtureId","generationSpec","compiledPrompt","intendedSkinCue","providerGenerationMetadata"]);
  }

  const rows = [];
  const screenings = {};
  const assessments = {};
  for (const entry of prepared.privateMap.entries) {
    const item = prepared.reviewItems.find((candidate) => candidate.reviewItemId === entry.reviewItemId);
    const claim = createSoloScreeningClaim({ session: prepared.session, item, claimedAt: "2026-08-03T00:01:00.000Z" });
    assert.equal(claim.ok, true);
    const screening = finalizeSoloTargetWithheldScreening({ session: prepared.session, item, claim: claim.claim, draft: screeningDraft(entry.conditionId), submittedAt: "2026-08-03T00:02:00.000Z" });
    assert.equal(screening.ok, true);
    assert.equal(verifySoloTargetWithheldScreeningIntegrity(screening.screening), true);
    const reveal = createSoloIntentRevealReceipt({ session: prepared.session, privateMap: prepared.privateMap, screening: screening.screening, reviewItemId: entry.reviewItemId, revealedAt: "2026-08-03T00:03:00.000Z" });
    assert.equal(reveal.ok, true);
    const assessment = finalizeSoloIntentAssessment({ session: prepared.session, screening: screening.screening, reveal: reveal.reveal, draft: assessmentDraft(), submittedAt: "2026-08-03T00:04:00.000Z" });
    assert.equal(assessment.ok, true);
    assert.equal(verifySoloIntentAssessmentIntegrity(assessment.assessment), true);
    assert.deepEqual(assessment.assessment.derivedTargetRelation, { redness: "exact_match", blemishPresence: "exact_match", blemishCount: "exact_match" });
    const row = createSoloWaveAssessmentRow({ entry, session: prepared.session, screening: screening.screening, reveal: reveal.reveal, assessment: assessment.assessment });
    assert.equal(row.ok, true);
    rows.push(row.row);
    screenings[screening.screening.screeningDigest] = screening.screening;
    assessments[assessment.assessment.intentAssessmentDigest] = assessment.assessment;
  }

  const set = createSoloWaveAssessmentSet({ session: prepared.session, rows });
  assert.equal(set.ok, true);
  assert.equal(verifySoloWaveAssessmentSetIntegrity(set.assessmentSet), true);
  assert.deepEqual(set.assessmentSet.conditionCounts, { A: 1, B: 1, C: 1, D: 1 });
  const summaries = summarizeSoloWave({ assessmentSet: set.assessmentSet, screeningsByDigest: screenings, assessmentsByDigest: assessments });
  assert.equal(summaries.usabilityCounts.usable, 4);
  assert.equal(summaries.targetRelationCounts.exact_match, 12);
  const brief = createSoloWaveBrief({
    session: prepared.session,
    assessmentSet: set.assessmentSet,
    summaries,
    decisionDraft: {
      decision: "continue",
      reasonCodes: ["solo_wave_continue","solo_single_operator_acknowledged","solo_no_consensus_claim_acknowledged","solo_no_gold_claim_acknowledged","solo_no_same_slot_quality_retry"],
      confirmedSingleOperatorLimitation: true,
      confirmedNoT5ConsensusClaim: true,
      confirmedNoG3G4G5Claim: true,
      confirmedNoSameSlotQualityRetry: true
    }
  });
  assert.equal(brief.ok, true);
  assert.equal(verifySoloWaveBriefIntegrity(brief.brief), true);
  assert.equal(brief.brief.authoritativeCampaignReport, false);
  assert.equal(brief.brief.singleOperator, true);
  assert.equal(JSON.stringify(brief.brief).includes("G4_SYNTHETIC_GOLD"), false);
});

test("semantic tampering invalidates sealed artifacts", () => {
  const prepared = prepareSoloWaveArtifacts({ campaignRunId: runId, campaignPlanDigest: hex("a"), sourceProjectionDigest: hex("b"), waveOrdinal: 1, operatorId: "solo_operator", sourceRows: sourceRows(), createdAt: "2026-08-03T00:00:00.000Z" });
  const tampered = { ...prepared.session, operatorId: "fake_second_operator" };
  assert.equal(verifySoloWaveSessionIntegrity(tampered, prepared.privateMap), false);
});
