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
import {
  deriveSoloWaveShape,
  verifySoloWaveSlotShape
} from "../../src/solo-assessment/wave-shape.js";
import { DIVERSIFIED_SUBJECT_VARIANTS, clone, makePlan } from "../campaign/helpers.mjs";
import { sha256Hex, stableStringify } from "../../src/shared/canonical-json.js";

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

function sourceRowsForCounts(conditionCounts) {
  const rows = [];
  let index = 1;
  for (const conditionId of conditions) {
    for (let ordinal = 1; ordinal <= conditionCounts[conditionId]; ordinal += 1) {
      const character = (index % 9) + 1;
      rows.push({
        slotId: `slot_${String(character).repeat(24)}`,
        conditionId,
        readiness: "assessable_observed",
        candidateId: `cand_${String((character + 4) % 10).repeat(24)}`,
        canonicalAsset: { sha256: hex(String(character)), objectRelativePath: `objects/canonical/${conditionId}-${ordinal}.png` },
        observationDigest: hex(String((character + 1) % 10)),
        authoritativeT5Status: "not_started",
        fixtureId: `${conditionId}_fixture`,
        finalizedSpecDigest: hex(String((character + 2) % 10)),
        compiledPromptDigest: hex(String((character + 3) % 10)),
        intendedSkinCue: cue(conditionId)
      });
      index += 1;
    }
  }
  return rows;
}

function slotsForShape(waveShape) {
  let index = 1;
  const slots = [];
  for (const conditionId of conditions) {
    for (let conditionOrdinal = 1; conditionOrdinal <= waveShape.conditionCounts[conditionId]; conditionOrdinal += 1) {
      slots.push({
        slotId: `slot_${String(index).repeat(24)}`,
        waveOrdinal: waveShape.waveOrdinal,
        conditionId,
        conditionOrdinal
      });
      index += 1;
    }
  }
  return slots;
}

function redigestRow(row) {
  const { rowDigest: _rowDigest, ...semantic } = row;
  return { ...semantic, rowDigest: sha256Hex(stableStringify(semantic)) };
}

function redigestSet(set) {
  const { assessmentSetDigest: _assessmentSetDigest, ...semantic } = set;
  return { ...semantic, assessmentSetDigest: sha256Hex(stableStringify(semantic)) };
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
  assert.equal(prepared.privateMap.mapDigest, "6301587549c30ecbef100991450e708927b706fc925d3cf0bcf8afc4a7ad80cd");
  assert.equal(prepared.session.sessionDigest, "4b931bafadb1500bf25be84b484eda82665b8f251987d5b8f3b2a731268264bb");
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
  assert.equal(set.assessmentSet.assessmentSetDigest, "4762078706f45de050d6aaffe24b5c2eb18231a9c3ec3b93e6a6c2d3662eef2f");
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

test("Solo wave shape derives legacy Wave 1, 2, and 3 cardinality from the campaign plan", () => {
  const plan = makePlan();
  const expected = [
    { expectedSlotCount: 4, conditionCounts: { A: 1, B: 1, C: 1, D: 1 } },
    { expectedSlotCount: 8, conditionCounts: { A: 2, B: 2, C: 2, D: 2 } },
    { expectedSlotCount: 8, conditionCounts: { A: 2, B: 2, C: 2, D: 2 } }
  ];
  expected.forEach((shape, index) => {
    const result = deriveSoloWaveShape(plan, index + 1);
    assert.equal(result.ok, true);
    assert.equal(result.waveShape.expectedSlotCount, shape.expectedSlotCount);
    assert.deepEqual(result.waveShape.conditionCounts, shape.conditionCounts);
    assert.equal(verifySoloWaveSlotShape(result.waveShape, slotsForShape(result.waveShape)), true);
  });
});

test("diversified Wave 1 uses a shape-bound v2 session and exact eight-row assessment set", () => {
  const plan = makePlan({ subjectVariants: DIVERSIFIED_SUBJECT_VARIANTS });
  const derived = deriveSoloWaveShape(plan, 1);
  assert.equal(derived.ok, true);
  assert.deepEqual(derived.waveShape.conditionCounts, { A: 2, B: 2, C: 2, D: 2 });
  assert.equal(derived.waveShape.expectedSlotCount, 8);

  const prepared = prepareSoloWaveArtifacts({
    campaignRunId: runId,
    campaignPlanDigest: plan.planDigest,
    sourceProjectionDigest: hex("b"),
    waveOrdinal: 1,
    operatorId: "solo_operator",
    sourceRows: sourceRowsForCounts(derived.waveShape.conditionCounts),
    waveShape: derived.waveShape,
    createdAt: "2026-08-03T00:00:00.000Z"
  });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.session.schemaVersion, "solo-wave-session-v2");
  assert.equal(prepared.privateMap.schemaVersion, "solo-private-review-map-v2");
  assert.equal(prepared.reviewItems.length, 8);
  assert.equal(verifySoloWaveSessionIntegrity(prepared.session, prepared.privateMap), true);
  for (const item of prepared.reviewItems) {
    for (const forbidden of ["slotId","conditionId","fixtureId","generationSpec","compiledPrompt","intendedSkinCue","providerGenerationMetadata","adultAgeBand","presentation","regionalAppearanceHint"]) {
      assert.equal(Object.hasOwn(item, forbidden), false);
    }
  }

  const rows = prepared.privateMap.entries.map((entry) => createSoloWaveAssessmentRow({ entry, session: prepared.session }).row);
  const created = createSoloWaveAssessmentSet({ session: prepared.session, rows });
  assert.equal(created.ok, true);
  assert.equal(created.assessmentSet.schemaVersion, "solo-wave-assessment-set-v2");
  assert.equal(created.assessmentSet.waveShape.shapeDigest, derived.waveShape.shapeDigest);
  assert.deepEqual(created.assessmentSet.conditionCounts, { A: 2, B: 2, C: 2, D: 2 });
  assert.equal(verifySoloWaveAssessmentSetIntegrity(created.assessmentSet), true);

  const wrongDistributionRows = created.assessmentSet.rows.map((row) => ({ ...row }));
  const bIndex = wrongDistributionRows.findIndex((row) => row.conditionId === "B");
  wrongDistributionRows[bIndex] = redigestRow({ ...wrongDistributionRows[bIndex], conditionId: "A" });
  const wrongDistribution = redigestSet({
    ...created.assessmentSet,
    rows: wrongDistributionRows,
    conditionCounts: { A: 3, B: 1, C: 2, D: 2 }
  });
  assert.equal(verifySoloWaveAssessmentSetIntegrity(wrongDistribution), false);
  assert.equal(createSoloWaveAssessmentSet({ session: prepared.session, rows: rows.slice(0, 7) }).ok, false);
  assert.equal(createSoloWaveAssessmentSet({ session: prepared.session, rows: [...rows, rows[0]] }).ok, false);
  const foreignSlotRows = rows.map((row, index) => index === 0 ? redigestRow({ ...row, slotId: `slot_${"f".repeat(24)}` }) : row);
  assert.equal(createSoloWaveAssessmentSet({ session: prepared.session, rows: foreignSlotRows }).ok, false);
});

test("plan and slot shape mismatches fail closed", () => {
  const plan = makePlan({ subjectVariants: DIVERSIFIED_SUBJECT_VARIANTS });
  const derived = deriveSoloWaveShape(plan, 1);
  const validSlots = slotsForShape(derived.waveShape);
  assert.equal(verifySoloWaveSlotShape(derived.waveShape, validSlots.slice(0, 7)), false);
  assert.equal(verifySoloWaveSlotShape(derived.waveShape, [...validSlots, validSlots[0]]), false);
  assert.equal(verifySoloWaveSlotShape(derived.waveShape, validSlots.map((slot, index) => index === 0 ? { ...slot, waveOrdinal: 2 } : slot)), false);
  assert.equal(verifySoloWaveSlotShape(derived.waveShape, validSlots.map((slot, index) => index === 0 ? { ...slot, conditionOrdinal: 2 } : slot)), false);
  const wrongDistribution = validSlots.map((slot, index) => index === 2 ? { ...slot, conditionId: "A", conditionOrdinal: 3 } : slot);
  assert.equal(verifySoloWaveSlotShape(derived.waveShape, wrongDistribution), false);

  const inconsistentPlan = clone(plan);
  inconsistentPlan.matrix[0].waveAllocation[0] = 1;
  assert.equal(deriveSoloWaveShape(inconsistentPlan, 1).ok, false);
});
