import test from "node:test";
import assert from "node:assert/strict";
import { validateSoloWaveAlignmentReport } from "@bejewely/face-contracts";
import {
  createSoloIntentRevealReceipt,
  createSoloScreeningClaim,
  finalizeSoloTargetWithheldScreening,
  prepareSoloWaveArtifacts,
  verifySoloIntentAssessmentIntegrity
} from "../../src/solo-assessment/artifacts.js";
import {
  createSoloCueAlignment,
  createSoloWaveAlignmentReport,
  verifySoloCueAlignmentIntegrity,
  verifySoloWaveAlignmentReportIntegrity
} from "../../src/solo-assessment/alignment-diagnostic.js";
import { deriveSoloWaveShape } from "../../src/solo-assessment/wave-shape.js";
import { DIVERSIFIED_SUBJECT_VARIANTS, makePlan } from "../campaign/helpers.mjs";
import { sha256Hex, stableStringify } from "../../src/shared/canonical-json.js";

const hex = (character) => character.repeat(64);
const conditions = ["A","A","B","B","C","C","D","D"];

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
    candidateId: `cand_${String(index + 1).repeat(24)}`,
    canonicalAsset: { sha256: hex(String(index + 1)), objectRelativePath: `objects/${index + 1}.png` },
    observationDigest: hex(String(index + 1)),
    authoritativeT5Status: "not_started",
    fixtureId: `${conditionId}_fixture`,
    finalizedSpecDigest: hex(String((index + 2) % 10)),
    compiledPromptDigest: hex(String((index + 3) % 10)),
    intendedSkinCue: cue(conditionId)
  }));
}

function draft({ redness = "uncertain", blemishes = "none", countBand = "none" } = {}) {
  return {
    reviewability: { face: "reviewable", skin: "reviewable" },
    capture: {
      singleAdultSyntheticPerson: "confirmed", directFrontalLevelPose: "confirmed", cameraGazeNeutralExpression: "confirmed",
      headShouldersFraming: "confirmed", plainBackground: "confirmed", softEvenLighting: "confirmed", sharpFace: "confirmed",
      hairMakeupAccessoriesControlled: "confirmed"
    },
    skinObservation: { redness: { presence: redness, regions: [] }, blemishes: { presence: blemishes, countBand, regions: [] } },
    artifactFlags: { distortedAnatomy: "absent", duplicatedOrMissingFeature: "absent", visibleTextOrExternalMark: "absent", filterOrRetouchPossible: "absent" },
    reasonCodes: ["solo_screening_reviewable"],
    priorTargetKnowledgeAcknowledged: true
  };
}

function observation(entry, { redness = 0, acne = 0, rednessLevel = null, acneLevel = null } = {}) {
  const observations = [];
  if (rednessLevel) observations.push({ key: "redness", level: rednessLevel });
  if (acneLevel) observations.push({ key: "acne", level: acneLevel });
  return {
    candidateId: entry.candidateId,
    observationDigest: entry.observationDigest,
    bundle: { skin: { status: "available", signals: { redness, acne }, observations } }
  };
}

function buildSources(humanByIndex = {}, t4ByIndex = {}) {
  const plan = makePlan({ subjectVariants: DIVERSIFIED_SUBJECT_VARIANTS });
  const waveShape = deriveSoloWaveShape(plan, 1).waveShape;
  const prepared = prepareSoloWaveArtifacts({
    campaignRunId: `crun_${"a".repeat(24)}`, campaignPlanDigest: plan.planDigest, sourceProjectionDigest: hex("b"), waveOrdinal: 1,
    operatorId: "solo_operator", sourceRows: sourceRows(), waveShape, createdAt: "2026-08-12T00:00:00.000Z"
  });
  assert.equal(prepared.ok, true);
  const alignments = prepared.privateMap.entries.map((entry, index) => {
    const item = prepared.reviewItems.find((value) => value.reviewItemId === entry.reviewItemId);
    const claim = createSoloScreeningClaim({ session: prepared.session, item, claimedAt: "2026-08-12T00:01:00.000Z" }).claim;
    const screening = finalizeSoloTargetWithheldScreening({ session: prepared.session, item, claim, draft: draft(humanByIndex[index]), submittedAt: "2026-08-12T00:02:00.000Z" }).screening;
    const reveal = createSoloIntentRevealReceipt({ session: prepared.session, privateMap: prepared.privateMap, screening, reviewItemId: entry.reviewItemId, revealedAt: "2026-08-12T00:03:00.000Z" }).reveal;
    const result = createSoloCueAlignment({ session: prepared.session, entry, screening, reveal, observationObject: observation(entry, t4ByIndex[index]), derivedAt: "2026-08-12T00:04:00.000Z" });
    assert.equal(result.ok, true);
    assert.equal(verifySoloCueAlignmentIntegrity(result.alignment), true);
    return result.alignment;
  });
  return { prepared, alignments };
}

const limitations = [
  { code: "human_redness_color_discrimination_reliability_limited", affectedAxes: ["redness"] },
  { code: "blemish_visual_cue_not_dermatological_diagnosis", affectedAxes: ["blemishPresence","blemishCount"] },
  { code: "single_operator", affectedAxes: ["redness","blemishPresence","blemishCount"] },
  { code: "prior_target_knowledge_possible", affectedAxes: ["redness","blemishPresence","blemishCount"] },
  { code: "not_independent_consensus", affectedAxes: ["redness","blemishPresence","blemishCount"] },
  { code: "not_gold_evidence", affectedAxes: ["redness","blemishPresence","blemishCount"] },
  { code: "not_population_evidence", affectedAxes: ["redness","blemishPresence","blemishCount"] }
];

test("eight uncertain Human redness rows preserve a zero evaluable denominator", () => {
  const { prepared, alignments } = buildSources();
  const result = createSoloWaveAlignmentReport({ session: prepared.session, alignments, limitations, derivedAt: "2026-08-12T00:05:00.000Z" });
  assert.equal(result.ok, true);
  assert.equal(verifySoloWaveAlignmentReportIntegrity(result.report), true);
  assert.deepEqual(result.report.humanTargetAlignment.redness, { total: 8, evaluable: 0, unverifiable: 8, exactMatch: 0, underTarget: 0, overTarget: 0, contradictory: 0 });
  assert.deepEqual(result.report.t4TargetAlignment.blemishCount, { total: 8, supported: 0, evaluable: 0, unverifiable: 0, notAvailable: 8, exactMatch: 0, underTarget: 0, overTarget: 0, contradictory: 0 });
  assert.deepEqual(result.report.humanT4Agreement.blemishCount, { total: 8, comparable: 0, agree: 0, disagree: 0, unverifiable: 0, notComparable: 8 });
  assert.equal(Object.hasOwn(result.report, "operatorDecision"), false);
});

test("Human exact, under, over, and uncertain blemish relations use separate buckets", () => {
  const human = {
    0: { blemishes: "none", countBand: "none" },
    1: { blemishes: "mild", countBand: "one_to_two" },
    4: { blemishes: "none", countBand: "none" },
    5: { blemishes: "moderate_or_higher", countBand: "six_plus" },
    6: { blemishes: "uncertain", countBand: "uncertain" }
  };
  const { prepared, alignments } = buildSources(human);
  const report = createSoloWaveAlignmentReport({ session: prepared.session, alignments, limitations, derivedAt: "2026-08-12T00:05:00.000Z" }).report;
  assert.ok(report.humanTargetAlignment.blemishPresence.exactMatch >= 1);
  assert.ok(report.humanTargetAlignment.blemishPresence.underTarget >= 1);
  assert.ok(report.humanTargetAlignment.blemishPresence.overTarget >= 1);
  assert.ok(report.humanTargetAlignment.blemishPresence.unverifiable >= 1);
});

test("diagnostic flags distinguish observation miss, ambiguous cue, and generation weakness", () => {
  const human = {
    0: { blemishes: "mild", countBand: "one_to_two" },
    1: { blemishes: "uncertain", countBand: "uncertain" },
    4: { blemishes: "none", countBand: "none" }
  };
  const t4 = { 0: { acne: 1, acneLevel: "low" }, 1: { acne: 1, acneLevel: "low" } };
  const { alignments } = buildSources(human, t4);
  const byCondition = alignments;
  assert.ok(byCondition[0].diagnosticFlags.some((item) => item.code === "observation_side_miss_possible" && item.axis === "blemishPresence"));
  assert.ok(byCondition[1].diagnosticFlags.some((item) => item.code === "ambiguous_visual_cue" && item.axis === "blemishPresence"));
  assert.equal(byCondition[1].diagnosticFlags.some((item) => item.code === "observation_side_miss_possible"), false);
  assert.ok(byCondition[4].diagnosticFlags.some((item) => item.code === "generation_side_signal_weak_possible" && item.axis === "blemishPresence"));
});

test("explicit T4 levels derive target relation without fabricated count bands", () => {
  const { alignments } = buildSources({}, { 2: { redness: 2, rednessLevel: "mild" }, 4: { acne: 3, acneLevel: "moderate" } });
  assert.equal(alignments[2].t4TargetRelation.redness, "exact_match");
  assert.equal(alignments[4].t4TargetRelation.blemishPresence, "over_target");
  assert.equal(alignments[4].t4TargetRelation.blemishCount, "not_available");
  assert.equal(alignments[4].humanT4Relation.blemishCount, "not_comparable");
});

test("denominator arithmetic, duplicate rows, and foreign bindings fail closed", () => {
  const { prepared, alignments } = buildSources();
  const valid = createSoloWaveAlignmentReport({ session: prepared.session, alignments, limitations, derivedAt: "2026-08-12T00:05:00.000Z" }).report;
  const badArithmetic = structuredClone(valid);
  badArithmetic.humanTargetAlignment.redness.evaluable = 1;
  assert.equal(validateSoloWaveAlignmentReport(badArithmetic).ok, false);
  const duplicate = structuredClone(valid);
  duplicate.alignmentRows[1] = duplicate.alignmentRows[0];
  assert.equal(validateSoloWaveAlignmentReport(duplicate).ok, false);
  const missingRequiredLimitation = structuredClone(valid);
  missingRequiredLimitation.limitations = missingRequiredLimitation.limitations.filter((item) => item.code !== "not_gold_evidence");
  assert.equal(validateSoloWaveAlignmentReport(missingRequiredLimitation).ok, false);

  const recomputedRelation = structuredClone(alignments[0]);
  recomputedRelation.humanTargetRelation.redness = "exact_match";
  const { derivedAt: _derivedAt, alignmentDigest: _alignmentDigest, ...semantic } = recomputedRelation;
  recomputedRelation.alignmentDigest = sha256Hex(stableStringify(semantic));
  assert.equal(verifySoloCueAlignmentIntegrity(recomputedRelation), false);

  const entry = prepared.privateMap.entries[0];
  const item = prepared.reviewItems.find((value) => value.reviewItemId === entry.reviewItemId);
  const claim = createSoloScreeningClaim({ session: prepared.session, item, claimedAt: "2026-08-12T00:01:00.000Z" }).claim;
  const screening = finalizeSoloTargetWithheldScreening({ session: prepared.session, item, claim, draft: draft(), submittedAt: "2026-08-12T00:02:00.000Z" }).screening;
  const reveal = createSoloIntentRevealReceipt({ session: prepared.session, privateMap: prepared.privateMap, screening, reviewItemId: entry.reviewItemId, revealedAt: "2026-08-12T00:03:00.000Z" }).reveal;
  assert.equal(createSoloCueAlignment({ session: prepared.session, entry, screening, reveal: { ...reveal, sessionDigest: hex("f") }, observationObject: observation(entry) }).ok, false);
  assert.equal(createSoloCueAlignment({ session: prepared.session, entry, screening, reveal, observationObject: { ...observation(entry), observationDigest: hex("f") } }).ok, false);
});

test("legacy operator intent assessment verifier remains available and unchanged", () => {
  assert.equal(typeof verifySoloIntentAssessmentIntegrity, "function");
});
