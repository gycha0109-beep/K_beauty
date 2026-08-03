import {
  SOLO_ASSESSMENT_AUTHORITY,
  SOLO_ASSESSMENT_POLICY_SCHEMA_VERSION,
  SOLO_CHECKPOINT_LINK_SCHEMA_VERSION,
  SOLO_DECISIONS,
  SOLO_EXCLUDED_FIELDS,
  SOLO_INTENT_ASSESSMENT_SCHEMA_VERSION,
  SOLO_INTENT_REVEAL_RECEIPT_SCHEMA_VERSION,
  SOLO_LIMITATIONS,
  SOLO_POLICY_ID,
  SOLO_POLICY_VERSION,
  SOLO_REASON_CODES,
  SOLO_REPORT_AUTHORITY,
  SOLO_SCREENING_CLAIM_SCHEMA_VERSION,
  SOLO_SLOT_READINESS,
  SOLO_TARGET_WITHHELD_SCREENING_SCHEMA_VERSION,
  SOLO_WAVE_ASSESSMENT_ROW_SCHEMA_VERSION,
  SOLO_WAVE_ASSESSMENT_SET_SCHEMA_VERSION,
  SOLO_WAVE_BRIEF_SCHEMA_VERSION,
  SOLO_WAVE_CONDITION_COUNTS,
  SOLO_WAVE_SESSION_SCHEMA_VERSION,
  SOLO_WAVE_SLOT_COUNTS,
  TARGET_WITHHELD_REVIEW_ITEM_SCHEMA_VERSION,
  validateSoloAssessmentPolicy,
  validateSoloCheckpointLink,
  validateSoloIntentAssessment,
  validateSoloIntentRevealReceipt,
  validateSoloScreeningClaim,
  validateSoloTargetWithheldScreening,
  validateSoloWaveAssessmentRow,
  validateSoloWaveAssessmentSet,
  validateSoloWaveBrief,
  validateSoloWaveSession,
  validateTargetWithheldReviewItem
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

const PRIVATE_MAP_SCHEMA_VERSION = "solo-private-review-map-v1";
const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const SLOT_ID = /^slot_[a-f0-9]{24}$/;
const CANDIDATE_ID = /^cand_[a-f0-9]{24}$/;

function failure(code, path = "$", detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function omit(value, keys) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function digestOf(value) {
  return sha256Hex(stableStringify(value));
}

function isIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function uniqueReasons(reasonCodes) {
  if (!Array.isArray(reasonCodes) || reasonCodes.some((code) => !SOLO_REASON_CODES.includes(code))) return null;
  return [...new Set(reasonCodes)].sort();
}

function verifyDigest(value, digestKey, excluded = []) {
  if (!value || !HEX64.test(value[digestKey] || "")) return false;
  return value[digestKey] === digestOf(omit(value, [digestKey, ...excluded]));
}

const policySemantic = Object.freeze({
  schemaVersion: SOLO_ASSESSMENT_POLICY_SCHEMA_VERSION,
  policyId: SOLO_POLICY_ID,
  policyVersion: SOLO_POLICY_VERSION,
  authority: SOLO_ASSESSMENT_AUTHORITY,
  requiredOperatorCount: 1,
  targetWithheldScreeningRequired: true,
  intentRevealAfterScreeningOnly: true,
  sameSlotQualityRegenerationAllowed: false,
  t5ReuseAllowed: false,
  promotionAllowed: false,
  datasetLockAllowed: false
});

export const SOLO_ASSESSMENT_POLICY = deepFreeze({
  ...policySemantic,
  policyDigest: digestOf(policySemantic)
});

export function verifySoloAssessmentPolicyIntegrity(policy) {
  return validateSoloAssessmentPolicy(policy).ok && verifyDigest(policy, "policyDigest");
}

function validateSourceRow(row, waveOrdinal) {
  if (!row || !SLOT_ID.test(row.slotId || "") || !["A","B","C","D"].includes(row.conditionId) || !SOLO_SLOT_READINESS.includes(row.readiness)) return false;
  if (!(row.candidateId === null || CANDIDATE_ID.test(row.candidateId || ""))) return false;
  if (!(row.canonicalAsset === null || (HEX64.test(row.canonicalAsset.sha256 || "") && typeof row.canonicalAsset.objectRelativePath === "string" && row.canonicalAsset.objectRelativePath.length > 0))) return false;
  if (!(row.observationDigest === null || HEX64.test(row.observationDigest || ""))) return false;
  if (!['not_started','incomplete','present_but_not_used'].includes(row.authoritativeT5Status)) return false;
  if (row.authoritativeT5Status === "present_but_not_used") return false;
  if (![1,2,3].includes(waveOrdinal)) return false;
  const assessable = ["assessable_observed","assessable_valid_ineligible","technical_observation_failure"].includes(row.readiness) && row.canonicalAsset !== null;
  if (assessable) {
    if (!HEX64.test(row.finalizedSpecDigest || "") || !HEX64.test(row.compiledPromptDigest || "") || !row.intendedSkinCue) return false;
    const cue = row.intendedSkinCue;
    if (!["none","mild"].includes(cue.redness) || !["none","mild"].includes(cue.blemishes) || !["none","three_to_five"].includes(cue.blemishCountBand)) return false;
  }
  return true;
}

function createPrivateMap({ campaignRunId, sourceProjectionDigest, waveOrdinal, operatorId, sourceRows }) {
  const entries = sourceRows.map((row) => {
    const reviewItemSeed = digestOf({ campaignRunId, sourceProjectionDigest, waveOrdinal, operatorId, policyDigest: SOLO_ASSESSMENT_POLICY.policyDigest, slotId: row.slotId });
    return {
      reviewItemId: `sri_${reviewItemSeed.slice(0, 24)}`,
      slotId: row.slotId,
      conditionId: row.conditionId,
      readiness: row.readiness,
      candidateId: row.candidateId,
      canonicalAsset: row.canonicalAsset,
      observationDigest: row.observationDigest,
      authoritativeT5Status: row.authoritativeT5Status,
      fixtureId: row.fixtureId ?? null,
      finalizedSpecDigest: row.finalizedSpecDigest ?? null,
      compiledPromptDigest: row.compiledPromptDigest ?? null,
      intendedSkinCue: row.intendedSkinCue ?? null
    };
  }).sort((left, right) => left.slotId.localeCompare(right.slotId));
  const semantic = {
    schemaVersion: PRIVATE_MAP_SCHEMA_VERSION,
    campaignRunId,
    sourceProjectionDigest,
    waveOrdinal,
    operatorId,
    policyDigest: SOLO_ASSESSMENT_POLICY.policyDigest,
    entries
  };
  return deepFreeze({ ...semantic, mapDigest: digestOf(semantic) });
}

export function verifySoloPrivateReviewMapIntegrity(map) {
  if (!map || map.schemaVersion !== PRIVATE_MAP_SCHEMA_VERSION || !HEX64.test(map.mapDigest || "") || !Array.isArray(map.entries)) return false;
  if (!verifyDigest(map, "mapDigest")) return false;
  if (map.entries.length !== SOLO_WAVE_SLOT_COUNTS[map.waveOrdinal] || new Set(map.entries.map((entry) => entry.slotId)).size !== map.entries.length || new Set(map.entries.map((entry) => entry.reviewItemId)).size !== map.entries.length) return false;
  return true;
}

function createSession({ campaignRunId, campaignPlanDigest, sourceProjectionDigest, waveOrdinal, operatorId, privateReviewMapDigest, createdAt }) {
  const semantic = {
    schemaVersion: SOLO_WAVE_SESSION_SCHEMA_VERSION,
    campaignRunId,
    campaignPlanDigest,
    sourceProjectionDigest,
    waveOrdinal,
    expectedSlotCount: SOLO_WAVE_SLOT_COUNTS[waveOrdinal],
    operatorId,
    actorCount: 1,
    policyDigest: SOLO_ASSESSMENT_POLICY.policyDigest,
    privateReviewMapDigest
  };
  const sessionDigest = digestOf(semantic);
  const session = deepFreeze({
    ...semantic,
    sessionId: `solo_${sessionDigest.slice(0, 24)}`,
    createdAt,
    sessionDigest
  });
  return validateSoloWaveSession(session).ok ? Object.freeze({ ok: true, session }) : failure("solo_session_invalid");
}

function createReviewItem(entry) {
  const semantic = {
    schemaVersion: TARGET_WITHHELD_REVIEW_ITEM_SCHEMA_VERSION,
    reviewItemId: entry.reviewItemId,
    canonicalAsset: entry.canonicalAsset,
    readiness: entry.readiness,
    priorTargetKnowledgePossible: true,
    excludedFields: [...SOLO_EXCLUDED_FIELDS]
  };
  const item = deepFreeze({ ...semantic, itemDigest: digestOf(semantic) });
  return validateTargetWithheldReviewItem(item).ok ? item : null;
}

export function prepareSoloWaveArtifacts({
  campaignRunId,
  campaignPlanDigest,
  sourceProjectionDigest,
  waveOrdinal,
  operatorId,
  sourceRows,
  createdAt = new Date().toISOString()
}) {
  if (!/^crun_[a-f0-9]{24}$/.test(campaignRunId || "") || !HEX64.test(campaignPlanDigest || "") || !HEX64.test(sourceProjectionDigest || "") || ![1,2,3].includes(waveOrdinal) || !TOKEN.test(operatorId || "") || !isIso(createdAt)) return failure("solo_source_not_ready");
  const expected = SOLO_WAVE_SLOT_COUNTS[waveOrdinal];
  if (!Array.isArray(sourceRows) || sourceRows.length !== expected || sourceRows.some((row) => !validateSourceRow(row, waveOrdinal))) return failure("solo_wave_slot_count_invalid", "sourceRows");
  const uniqueSlots = new Set(sourceRows.map((row) => row.slotId));
  if (uniqueSlots.size !== expected) return failure("solo_wave_slot_count_invalid", "sourceRows.slotId");
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const row of sourceRows) counts[row.conditionId] += 1;
  if (Object.entries(SOLO_WAVE_CONDITION_COUNTS[waveOrdinal]).some(([key, count]) => counts[key] !== count)) return failure("solo_wave_slot_count_invalid", "sourceRows.conditionId");
  const privateMap = createPrivateMap({ campaignRunId, sourceProjectionDigest, waveOrdinal, operatorId, sourceRows });
  const sessionResult = createSession({ campaignRunId, campaignPlanDigest, sourceProjectionDigest, waveOrdinal, operatorId, privateReviewMapDigest: privateMap.mapDigest, createdAt });
  if (!sessionResult.ok) return sessionResult;
  const reviewItems = privateMap.entries.map(createReviewItem);
  if (reviewItems.some((item) => item === null)) return failure("solo_target_withholding_invalid");
  return Object.freeze({ ok: true, policy: SOLO_ASSESSMENT_POLICY, privateMap, session: sessionResult.session, reviewItems: Object.freeze(reviewItems) });
}

export function verifySoloWaveSessionIntegrity(session, privateMap = null) {
  if (!validateSoloWaveSession(session).ok || !verifyDigest(session, "sessionDigest", ["sessionId","createdAt"])) return false;
  if (session.sessionId !== `solo_${session.sessionDigest.slice(0, 24)}`) return false;
  if (privateMap && (!verifySoloPrivateReviewMapIntegrity(privateMap) || privateMap.mapDigest !== session.privateReviewMapDigest || privateMap.campaignRunId !== session.campaignRunId || privateMap.waveOrdinal !== session.waveOrdinal || privateMap.operatorId !== session.operatorId)) return false;
  return true;
}

export function verifyTargetWithheldReviewItemIntegrity(item) {
  return validateTargetWithheldReviewItem(item).ok && verifyDigest(item, "itemDigest");
}

export function createSoloScreeningClaim({ session, item, claimedAt = new Date().toISOString() }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifyTargetWithheldReviewItemIntegrity(item) || !isIso(claimedAt)) return failure("solo_source_not_ready");
  const semantic = {
    schemaVersion: SOLO_SCREENING_CLAIM_SCHEMA_VERSION,
    sessionDigest: session.sessionDigest,
    reviewItemId: item.reviewItemId,
    operatorId: session.operatorId,
    itemDigest: item.itemDigest,
    claimState: "claimed"
  };
  const claim = deepFreeze({ ...semantic, claimedAt, claimDigest: digestOf(semantic) });
  return validateSoloScreeningClaim(claim).ok ? Object.freeze({ ok: true, claim }) : failure("solo_screening_claim_invalid");
}

export function verifySoloScreeningClaimIntegrity(claim) {
  return validateSoloScreeningClaim(claim).ok && verifyDigest(claim, "claimDigest", ["claimedAt"]);
}

export function finalizeSoloTargetWithheldScreening({ session, item, claim, draft, submittedAt = new Date().toISOString() }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifyTargetWithheldReviewItemIntegrity(item) || !verifySoloScreeningClaimIntegrity(claim) || !isIso(submittedAt)) return failure("solo_source_not_ready");
  if (claim.sessionDigest !== session.sessionDigest || claim.reviewItemId !== item.reviewItemId || claim.operatorId !== session.operatorId || claim.itemDigest !== item.itemDigest) return failure("solo_target_withholding_invalid");
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return failure("solo_screening_invalid");
  const forbidden = SOLO_EXCLUDED_FIELDS.filter((key) => Object.hasOwn(draft, key));
  if (forbidden.length > 0) return failure("solo_target_withholding_invalid", "draft", forbidden);
  const reasons = uniqueReasons(draft.reasonCodes || []);
  if (!reasons) return failure("solo_screening_invalid", "reasonCodes");
  const semantic = {
    schemaVersion: SOLO_TARGET_WITHHELD_SCREENING_SCHEMA_VERSION,
    sessionDigest: session.sessionDigest,
    reviewItemId: item.reviewItemId,
    operatorId: session.operatorId,
    claimDigest: claim.claimDigest,
    reviewability: draft.reviewability,
    capture: draft.capture,
    skinObservation: draft.skinObservation,
    artifactFlags: draft.artifactFlags,
    reasonCodes: reasons,
    priorTargetKnowledgeAcknowledged: draft.priorTargetKnowledgeAcknowledged === true
  };
  const screening = deepFreeze({ ...semantic, submittedAt, screeningDigest: digestOf(semantic) });
  return validateSoloTargetWithheldScreening(screening).ok ? Object.freeze({ ok: true, screening }) : failure("solo_screening_invalid");
}

export function verifySoloTargetWithheldScreeningIntegrity(screening) {
  return validateSoloTargetWithheldScreening(screening).ok && verifyDigest(screening, "screeningDigest", ["submittedAt"]);
}

export function createSoloIntentRevealReceipt({ session, privateMap, screening, reviewItemId, revealedAt = new Date().toISOString() }) {
  if (!verifySoloWaveSessionIntegrity(session, privateMap) || !verifySoloTargetWithheldScreeningIntegrity(screening) || !isIso(revealedAt)) return failure("solo_source_not_ready");
  if (screening.sessionDigest !== session.sessionDigest || screening.reviewItemId !== reviewItemId) return failure("solo_target_withholding_invalid");
  const entry = privateMap.entries.find((item) => item.reviewItemId === reviewItemId);
  if (!entry || !entry.finalizedSpecDigest || !entry.compiledPromptDigest || !entry.intendedSkinCue || !entry.fixtureId) return failure("solo_intent_source_conflict");
  const semantic = {
    schemaVersion: SOLO_INTENT_REVEAL_RECEIPT_SCHEMA_VERSION,
    sessionDigest: session.sessionDigest,
    reviewItemId,
    screeningDigest: screening.screeningDigest,
    slotId: entry.slotId,
    conditionId: entry.conditionId,
    fixtureId: entry.fixtureId,
    finalizedSpecDigest: entry.finalizedSpecDigest,
    compiledPromptDigest: entry.compiledPromptDigest,
    intendedSkinCue: entry.intendedSkinCue
  };
  const reveal = deepFreeze({ ...semantic, revealedAt, revealDigest: digestOf(semantic) });
  return validateSoloIntentRevealReceipt(reveal).ok ? Object.freeze({ ok: true, reveal }) : failure("solo_reveal_invalid");
}

export function verifySoloIntentRevealReceiptIntegrity(reveal) {
  return validateSoloIntentRevealReceipt(reveal).ok && verifyDigest(reveal, "revealDigest", ["revealedAt"]);
}

function presenceRelation(target, observed) {
  if (observed === "uncertain") return "unverifiable";
  if (target === "none") return observed === "none" ? "exact_match" : "over_target";
  if (target === "mild") {
    if (observed === "none") return "under_target";
    if (observed === "mild") return "exact_match";
    if (observed === "moderate_or_higher") return "over_target";
  }
  return "contradictory";
}

function countRelation(target, observed) {
  if (observed === "uncertain") return "unverifiable";
  if (target === "none") return observed === "none" ? "exact_match" : "over_target";
  if (target === "three_to_five") {
    if (["none","one_to_two"].includes(observed)) return "under_target";
    if (observed === "three_to_five") return "exact_match";
    if (observed === "six_plus") return "over_target";
  }
  return "contradictory";
}

export function deriveSoloTargetRelation(screening, reveal) {
  if (!verifySoloTargetWithheldScreeningIntegrity(screening) || !verifySoloIntentRevealReceiptIntegrity(reveal) || screening.screeningDigest !== reveal.screeningDigest || screening.reviewItemId !== reveal.reviewItemId) return null;
  return deepFreeze({
    redness: presenceRelation(reveal.intendedSkinCue.redness, screening.skinObservation.redness.presence),
    blemishPresence: presenceRelation(reveal.intendedSkinCue.blemishes, screening.skinObservation.blemishes.presence),
    blemishCount: countRelation(reveal.intendedSkinCue.blemishCountBand, screening.skinObservation.blemishes.countBand)
  });
}

export function finalizeSoloIntentAssessment({ session, screening, reveal, draft, submittedAt = new Date().toISOString() }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloTargetWithheldScreeningIntegrity(screening) || !verifySoloIntentRevealReceiptIntegrity(reveal) || !isIso(submittedAt)) return failure("solo_source_not_ready");
  if (screening.sessionDigest !== session.sessionDigest || reveal.sessionDigest !== session.sessionDigest || screening.reviewItemId !== reveal.reviewItemId) return failure("solo_intent_source_conflict");
  const relation = deriveSoloTargetRelation(screening, reveal);
  if (!relation) return failure("solo_intent_source_conflict");
  const reasons = uniqueReasons(draft?.reasonCodes || []);
  if (!reasons) return failure("solo_intent_assessment_invalid", "reasonCodes");
  const semantic = {
    schemaVersion: SOLO_INTENT_ASSESSMENT_SCHEMA_VERSION,
    sessionDigest: session.sessionDigest,
    reviewItemId: screening.reviewItemId,
    operatorId: session.operatorId,
    screeningDigest: screening.screeningDigest,
    revealDigest: reveal.revealDigest,
    derivedTargetRelation: relation,
    faceLabInputUsability: draft?.faceLabInputUsability,
    operationalDisposition: draft?.operationalDisposition,
    nextWaveRecommendation: draft?.nextWaveRecommendation,
    sameSlotQualityRegenerationAllowed: false,
    reasonCodes: reasons
  };
  const assessment = deepFreeze({ ...semantic, submittedAt, intentAssessmentDigest: digestOf(semantic) });
  return validateSoloIntentAssessment(assessment).ok ? Object.freeze({ ok: true, assessment }) : failure("solo_intent_assessment_invalid");
}

export function verifySoloIntentAssessmentIntegrity(assessment) {
  return validateSoloIntentAssessment(assessment).ok && verifyDigest(assessment, "intentAssessmentDigest", ["submittedAt"]);
}

export function createSoloWaveAssessmentRow({ entry, session, screening = null, reveal = null, assessment = null }) {
  if (!verifySoloWaveSessionIntegrity(session) || !entry || entry.authoritativeT5Status === "present_but_not_used") return failure("solo_source_not_ready");
  const assessable = Boolean(screening && reveal && assessment);
  if (assessable && (!verifySoloTargetWithheldScreeningIntegrity(screening) || !verifySoloIntentRevealReceiptIntegrity(reveal) || !verifySoloIntentAssessmentIntegrity(assessment))) return failure("solo_source_not_ready");
  if (!assessable && [screening,reveal,assessment].some(Boolean)) return failure("solo_source_not_ready");
  const semantic = {
    schemaVersion: SOLO_WAVE_ASSESSMENT_ROW_SCHEMA_VERSION,
    campaignRunId: session.campaignRunId,
    waveOrdinal: session.waveOrdinal,
    slotId: entry.slotId,
    conditionId: entry.conditionId,
    readiness: entry.readiness,
    candidateId: entry.candidateId,
    canonicalSha256: entry.canonicalAsset?.sha256 ?? null,
    observationDigest: entry.observationDigest,
    screeningDigest: screening?.screeningDigest ?? null,
    revealDigest: reveal?.revealDigest ?? null,
    intentAssessmentDigest: assessment?.intentAssessmentDigest ?? null,
    authoritativeT5Status: entry.authoritativeT5Status,
    soloAuthority: assessable ? SOLO_ASSESSMENT_AUTHORITY : "technical_source_only"
  };
  const row = deepFreeze({ ...semantic, rowDigest: digestOf(semantic) });
  return validateSoloWaveAssessmentRow(row).ok ? Object.freeze({ ok: true, row }) : failure("solo_wave_row_invalid");
}

export function verifySoloWaveAssessmentRowIntegrity(row) {
  return validateSoloWaveAssessmentRow(row).ok && verifyDigest(row, "rowDigest");
}

export function createSoloWaveAssessmentSet({ session, rows }) {
  if (!verifySoloWaveSessionIntegrity(session) || !Array.isArray(rows) || rows.length !== session.expectedSlotCount || rows.some((row) => !verifySoloWaveAssessmentRowIntegrity(row))) return failure("solo_wave_slot_count_invalid");
  const sorted = [...rows].sort((left, right) => left.slotId.localeCompare(right.slotId));
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const row of sorted) counts[row.conditionId] += 1;
  const semantic = {
    schemaVersion: SOLO_WAVE_ASSESSMENT_SET_SCHEMA_VERSION,
    sessionDigest: session.sessionDigest,
    campaignRunId: session.campaignRunId,
    waveOrdinal: session.waveOrdinal,
    expectedSlotCount: session.expectedSlotCount,
    rows: sorted,
    conditionCounts: counts,
    exactDenominatorVerified: true
  };
  const set = deepFreeze({ ...semantic, assessmentSetDigest: digestOf(semantic) });
  return validateSoloWaveAssessmentSet(set).ok ? Object.freeze({ ok: true, assessmentSet: set }) : failure("solo_wave_set_invalid");
}

export function verifySoloWaveAssessmentSetIntegrity(set) {
  return validateSoloWaveAssessmentSet(set).ok && verifyDigest(set, "assessmentSetDigest");
}

function emptyCounts(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

export function summarizeSoloWave({ assessmentSet, screeningsByDigest = {}, assessmentsByDigest = {} }) {
  if (!verifySoloWaveAssessmentSetIntegrity(assessmentSet)) return null;
  const readinessCounts = emptyCounts(SOLO_SLOT_READINESS);
  const reviewabilityCounts = emptyCounts(["reviewable","unreviewable","uncertain","technical_or_unavailable"]);
  const usabilityCounts = emptyCounts(["usable","usable_with_caution","unusable","not_assessable","technical_or_unavailable"]);
  const targetRelationCounts = emptyCounts(["exact_match","under_target","over_target","contradictory","unverifiable"]);
  const artifactFlagCounts = emptyCounts(["absent","present","uncertain","technical_or_unavailable"]);
  const technicalOutcomeCounts = emptyCounts(["technical_no_asset","technical_import_failure","technical_observation_failure","cancelled","none"]);
  for (const row of assessmentSet.rows) {
    readinessCounts[row.readiness] += 1;
    if (row.soloAuthority === "technical_source_only") {
      reviewabilityCounts.technical_or_unavailable += 1;
      usabilityCounts.technical_or_unavailable += 1;
      artifactFlagCounts.technical_or_unavailable += 1;
      technicalOutcomeCounts[Object.hasOwn(technicalOutcomeCounts, row.readiness) ? row.readiness : "none"] += 1;
      continue;
    }
    const screening = screeningsByDigest[row.screeningDigest];
    const assessment = assessmentsByDigest[row.intentAssessmentDigest];
    if (!verifySoloTargetWithheldScreeningIntegrity(screening) || !verifySoloIntentAssessmentIntegrity(assessment)) return null;
    reviewabilityCounts[screening.reviewability.face] += 1;
    usabilityCounts[assessment.faceLabInputUsability] += 1;
    for (const relation of Object.values(assessment.derivedTargetRelation)) targetRelationCounts[relation] += 1;
    for (const state of Object.values(screening.artifactFlags)) artifactFlagCounts[state] += 1;
    technicalOutcomeCounts.none += 1;
  }
  return deepFreeze({ readinessCounts, reviewabilityCounts, usabilityCounts, targetRelationCounts, artifactFlagCounts, technicalOutcomeCounts });
}

export function createSoloWaveBrief({ session, assessmentSet, summaries, decisionDraft }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloWaveAssessmentSetIntegrity(assessmentSet) || assessmentSet.sessionDigest !== session.sessionDigest || !summaries) return failure("solo_wave_set_invalid");
  const reasons = uniqueReasons(decisionDraft?.reasonCodes || []);
  if (!reasons || !SOLO_DECISIONS.includes(decisionDraft?.decision)) return failure("solo_wave_brief_invalid");
  if (decisionDraft.decision === "continue" && assessmentSet.rows.some((row) => row.readiness === "not_ready")) return failure("solo_source_not_ready");
  const semantic = {
    schemaVersion: SOLO_WAVE_BRIEF_SCHEMA_VERSION,
    authority: SOLO_REPORT_AUTHORITY,
    authoritativeCampaignReport: false,
    singleOperator: true,
    sessionDigest: session.sessionDigest,
    assessmentSetDigest: assessmentSet.assessmentSetDigest,
    sourceProjectionDigest: session.sourceProjectionDigest,
    summaries,
    operatorDecision: {
      decision: decisionDraft.decision,
      reasonCodes: reasons,
      confirmedSingleOperatorLimitation: decisionDraft.confirmedSingleOperatorLimitation === true,
      confirmedNoT5ConsensusClaim: decisionDraft.confirmedNoT5ConsensusClaim === true,
      confirmedNoG3G4G5Claim: decisionDraft.confirmedNoG3G4G5Claim === true,
      confirmedNoSameSlotQualityRetry: decisionDraft.confirmedNoSameSlotQualityRetry === true,
      decidedBy: session.operatorId
    },
    limitations: [...SOLO_LIMITATIONS]
  };
  const brief = deepFreeze({ ...semantic, briefDigest: digestOf(semantic) });
  return validateSoloWaveBrief(brief).ok ? Object.freeze({ ok: true, brief }) : failure("solo_wave_brief_invalid");
}

export function verifySoloWaveBriefIntegrity(brief) {
  return validateSoloWaveBrief(brief).ok && verifyDigest(brief, "briefDigest");
}

export function createSoloCheckpointLink({ session, brief, checkpoint, linkedAt = new Date().toISOString() }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloWaveBriefIntegrity(brief) || !checkpoint || !HEX64.test(checkpoint.approvalDigest || "") || !SOLO_DECISIONS.includes(checkpoint.decision) || !isIso(linkedAt)) return failure("solo_source_not_ready");
  if (session.waveOrdinal > 2 || checkpoint.campaignRunId !== session.campaignRunId || checkpoint.completedWaveOrdinal !== session.waveOrdinal || brief.operatorDecision.decision !== checkpoint.decision) return failure("solo_checkpoint_decision_mismatch");
  const semantic = {
    schemaVersion: SOLO_CHECKPOINT_LINK_SCHEMA_VERSION,
    campaignRunId: session.campaignRunId,
    waveOrdinal: session.waveOrdinal,
    soloWaveBriefDigest: brief.briefDigest,
    t7CheckpointApprovalDigest: checkpoint.approvalDigest,
    soloDecision: brief.operatorDecision.decision,
    t7Decision: checkpoint.decision,
    decisionMatch: true
  };
  const link = deepFreeze({ ...semantic, linkedAt, linkDigest: digestOf(semantic) });
  return validateSoloCheckpointLink(link).ok ? Object.freeze({ ok: true, link }) : failure("solo_checkpoint_link_invalid");
}

export function verifySoloCheckpointLinkIntegrity(link) {
  return validateSoloCheckpointLink(link).ok && verifyDigest(link, "linkDigest", ["linkedAt"]);
}
