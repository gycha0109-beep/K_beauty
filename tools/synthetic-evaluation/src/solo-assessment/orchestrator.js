import { readCampaignBundle } from "../campaign/storage.js";
import { verifyPilotCheckpointApprovalIntegrity } from "../campaign/checkpoint.js";
import {
  createSoloCheckpointLink,
  createSoloIntentRevealReceipt,
  createSoloScreeningClaim,
  createSoloWaveAssessmentRow,
  createSoloWaveAssessmentSet,
  createSoloWaveBrief,
  finalizeSoloIntentAssessment,
  finalizeSoloTargetWithheldScreening,
  prepareSoloWaveArtifacts,
  summarizeSoloWave,
  verifySoloIntentAssessmentIntegrity,
  verifySoloIntentRevealReceiptIntegrity,
  verifySoloScreeningClaimIntegrity,
  verifySoloTargetWithheldScreeningIntegrity,
  verifySoloWaveBriefIntegrity
} from "./artifacts.js";
import { preflightSoloWaveSource } from "./source-preflight.js";
import {
  readSoloArtifact,
  readSoloSessionBundle,
  saveSoloCheckpointLink,
  saveSoloClaim,
  saveSoloIntentAssessment,
  saveSoloPreparation,
  saveSoloReveal,
  saveSoloScreening,
  saveSoloWaveAssessmentSet,
  saveSoloWaveBrief
} from "./storage.js";

function failure(code, path = "$", detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]), writesPerformed: 0 });
}

async function loadSession(dataRoot, sessionRef) {
  if (!sessionRef || !sessionRef.runId || !sessionRef.waveOrdinal || !sessionRef.sessionDigest) return null;
  try {
    return await readSoloSessionBundle({ dataRoot, runId: sessionRef.runId, waveOrdinal: sessionRef.waveOrdinal, sessionDigest: sessionRef.sessionDigest });
  } catch {
    return null;
  }
}

function findItem(bundle, reviewItemId) {
  return bundle.reviewItems.find((item) => item.reviewItemId === reviewItemId) || null;
}

export async function prepareSoloWave({ dataRoot, runId, waveOrdinal, operatorId, confirm = false, now = () => new Date() }) {
  const source = await preflightSoloWaveSource({ dataRoot, runId, waveOrdinal });
  if (!source.ok) return source;
  const prepared = prepareSoloWaveArtifacts({
    campaignRunId: source.run.campaignRunId,
    campaignPlanDigest: source.plan.planDigest,
    sourceProjectionDigest: source.projection.projectionDigest,
    waveOrdinal,
    operatorId,
    sourceRows: source.sourceRows,
    createdAt: now().toISOString()
  });
  if (!prepared.ok) return prepared;
  if (!confirm) return Object.freeze({ ok: true, state: "preflight", policy: prepared.policy, session: prepared.session, reviewItems: prepared.reviewItems, writesPerformed: 0 });
  const saved = await saveSoloPreparation({ dataRoot, ...prepared });
  return Object.freeze({ ok: true, state: saved.createdCount > 0 ? "prepared" : "existing", session: prepared.session, reviewItems: prepared.reviewItems, writesPerformed: saved.createdCount });
}

export async function claimSoloReviewItem({ dataRoot, sessionRef, reviewItemId, confirm = false, now = () => new Date() }) {
  const bundle = await loadSession(dataRoot, sessionRef);
  const item = bundle && findItem(bundle, reviewItemId);
  if (!bundle || !item) return failure("solo_source_not_ready");
  const created = createSoloScreeningClaim({ session: bundle.session, item, claimedAt: now().toISOString() });
  if (!created.ok) return created;
  if (!confirm) return Object.freeze({ ok: true, state: "preflight", claim: created.claim, writesPerformed: 0 });
  const saved = await saveSoloClaim({ dataRoot, session: bundle.session, claim: created.claim });
  return Object.freeze({ ok: true, state: saved.created ? "claimed" : "existing", claim: saved.value, writesPerformed: saved.created ? 1 : 0 });
}

export async function submitSoloScreening({ dataRoot, sessionRef, reviewItemId, claimDigest, draft, confirm = false, now = () => new Date() }) {
  const bundle = await loadSession(dataRoot, sessionRef);
  const item = bundle && findItem(bundle, reviewItemId);
  if (!bundle || !item) return failure("solo_source_not_ready");
  let claim;
  try {
    claim = await readSoloArtifact({ dataRoot, session: bundle.session, kind: "claim", reviewItemId, digest: claimDigest });
  } catch {
    return failure("solo_screening_claim_invalid");
  }
  if (!verifySoloScreeningClaimIntegrity(claim)) return failure("solo_screening_claim_invalid");
  const finalized = finalizeSoloTargetWithheldScreening({ session: bundle.session, item, claim, draft, submittedAt: now().toISOString() });
  if (!finalized.ok) return finalized;
  if (!confirm) return Object.freeze({ ok: true, state: "preflight", screening: finalized.screening, writesPerformed: 0 });
  const saved = await saveSoloScreening({ dataRoot, session: bundle.session, screening: finalized.screening });
  return Object.freeze({ ok: true, state: saved.created ? "screened" : "existing", screening: saved.value, writesPerformed: saved.created ? 1 : 0 });
}

export async function revealSoloIntent({ dataRoot, sessionRef, reviewItemId, screeningDigest, confirm = false, now = () => new Date() }) {
  const bundle = await loadSession(dataRoot, sessionRef);
  if (!bundle || !findItem(bundle, reviewItemId)) return failure("solo_source_not_ready");
  let screening;
  try {
    screening = await readSoloArtifact({ dataRoot, session: bundle.session, kind: "screening", reviewItemId, digest: screeningDigest });
  } catch {
    return failure("solo_screening_invalid");
  }
  if (!verifySoloTargetWithheldScreeningIntegrity(screening)) return failure("solo_screening_invalid");
  const created = createSoloIntentRevealReceipt({ session: bundle.session, privateMap: bundle.privateMap, screening, reviewItemId, revealedAt: now().toISOString() });
  if (!created.ok) return created;
  if (!confirm) return Object.freeze({ ok: true, state: "preflight", reveal: created.reveal, writesPerformed: 0 });
  const saved = await saveSoloReveal({ dataRoot, session: bundle.session, reveal: created.reveal });
  return Object.freeze({ ok: true, state: saved.created ? "revealed" : "existing", reveal: saved.value, writesPerformed: saved.created ? 1 : 0 });
}

export async function submitSoloIntentAssessment({ dataRoot, sessionRef, reviewItemId, screeningDigest, revealDigest, draft, confirm = false, now = () => new Date() }) {
  const bundle = await loadSession(dataRoot, sessionRef);
  if (!bundle || !findItem(bundle, reviewItemId)) return failure("solo_source_not_ready");
  let screening;
  let reveal;
  try {
    [screening, reveal] = await Promise.all([
      readSoloArtifact({ dataRoot, session: bundle.session, kind: "screening", reviewItemId, digest: screeningDigest }),
      readSoloArtifact({ dataRoot, session: bundle.session, kind: "reveal", reviewItemId, digest: revealDigest })
    ]);
  } catch {
    return failure("solo_intent_source_conflict");
  }
  if (!verifySoloTargetWithheldScreeningIntegrity(screening) || !verifySoloIntentRevealReceiptIntegrity(reveal)) return failure("solo_intent_source_conflict");
  const finalized = finalizeSoloIntentAssessment({ session: bundle.session, screening, reveal, draft, submittedAt: now().toISOString() });
  if (!finalized.ok) return finalized;
  if (!confirm) return Object.freeze({ ok: true, state: "preflight", assessment: finalized.assessment, writesPerformed: 0 });
  const saved = await saveSoloIntentAssessment({ dataRoot, session: bundle.session, assessment: finalized.assessment });
  return Object.freeze({ ok: true, state: saved.created ? "assessed" : "existing", assessment: saved.value, writesPerformed: saved.created ? 1 : 0 });
}

async function buildRowsFromRefs({ dataRoot, bundle, itemRefs }) {
  const refsByItem = new Map((itemRefs || []).map((item) => [item.reviewItemId, item]));
  const rows = [];
  const screeningsByDigest = {};
  const assessmentsByDigest = {};
  for (const entry of bundle.privateMap.entries) {
    const refs = refsByItem.get(entry.reviewItemId) || null;
    const canonicalPresent = entry.canonicalAsset !== null;
    if (canonicalPresent && !refs) return failure("solo_source_not_ready", entry.reviewItemId, "assessment_refs_required");
    if (!canonicalPresent && refs) return failure("solo_source_not_ready", entry.reviewItemId, "technical_row_has_assessment_refs");
    let screening = null;
    let reveal = null;
    let assessment = null;
    if (refs) {
      try {
        [screening, reveal, assessment] = await Promise.all([
          readSoloArtifact({ dataRoot, session: bundle.session, kind: "screening", reviewItemId: entry.reviewItemId, digest: refs.screeningDigest }),
          readSoloArtifact({ dataRoot, session: bundle.session, kind: "reveal", reviewItemId: entry.reviewItemId, digest: refs.revealDigest }),
          readSoloArtifact({ dataRoot, session: bundle.session, kind: "assessment", reviewItemId: entry.reviewItemId, digest: refs.intentAssessmentDigest })
        ]);
      } catch {
        return failure("solo_source_not_ready", entry.reviewItemId, "assessment_artifact_missing");
      }
      if (!verifySoloTargetWithheldScreeningIntegrity(screening) || !verifySoloIntentRevealReceiptIntegrity(reveal) || !verifySoloIntentAssessmentIntegrity(assessment)) return failure("solo_source_not_ready", entry.reviewItemId, "assessment_artifact_invalid");
      screeningsByDigest[screening.screeningDigest] = screening;
      assessmentsByDigest[assessment.intentAssessmentDigest] = assessment;
    }
    const rowResult = createSoloWaveAssessmentRow({ entry, session: bundle.session, screening, reveal, assessment });
    if (!rowResult.ok) return rowResult;
    rows.push(rowResult.row);
  }
  return Object.freeze({ ok: true, rows: Object.freeze(rows), screeningsByDigest: Object.freeze(screeningsByDigest), assessmentsByDigest: Object.freeze(assessmentsByDigest) });
}

export async function confirmSoloWaveBrief({ dataRoot, sessionRef, itemRefs, decisionDraft, confirm = false }) {
  const bundle = await loadSession(dataRoot, sessionRef);
  if (!bundle) return failure("solo_source_not_ready");
  const rowResult = await buildRowsFromRefs({ dataRoot, bundle, itemRefs });
  if (!rowResult.ok) return rowResult;
  const setResult = createSoloWaveAssessmentSet({ session: bundle.session, rows: rowResult.rows });
  if (!setResult.ok) return setResult;
  const summaries = summarizeSoloWave({ assessmentSet: setResult.assessmentSet, screeningsByDigest: rowResult.screeningsByDigest, assessmentsByDigest: rowResult.assessmentsByDigest });
  if (!summaries) return failure("solo_wave_brief_invalid");
  const briefResult = createSoloWaveBrief({ session: bundle.session, assessmentSet: setResult.assessmentSet, summaries, decisionDraft });
  if (!briefResult.ok) return briefResult;
  if (!confirm) return Object.freeze({ ok: true, state: "preflight", assessmentSet: setResult.assessmentSet, brief: briefResult.brief, writesPerformed: 0 });
  const [savedSet, savedBrief] = await Promise.all([
    saveSoloWaveAssessmentSet({ dataRoot, session: bundle.session, assessmentSet: setResult.assessmentSet }),
    saveSoloWaveBrief({ dataRoot, session: bundle.session, brief: briefResult.brief })
  ]);
  return Object.freeze({ ok: true, state: savedSet.createdCount + (savedBrief.created ? 1 : 0) > 0 ? "brief_confirmed" : "existing", assessmentSet: setResult.assessmentSet, brief: savedBrief.value, writesPerformed: savedSet.createdCount + (savedBrief.created ? 1 : 0) });
}

export async function linkSoloBriefToCheckpoint({ dataRoot, sessionRef, briefDigest, checkpointApprovalDigest, confirm = false, now = () => new Date() }) {
  const bundle = await loadSession(dataRoot, sessionRef);
  if (!bundle) return failure("solo_source_not_ready");
  let brief;
  try {
    brief = await readSoloArtifact({ dataRoot, session: bundle.session, kind: "brief", digest: briefDigest });
  } catch {
    return failure("solo_wave_brief_invalid");
  }
  if (!verifySoloWaveBriefIntegrity(brief)) return failure("solo_wave_brief_invalid");
  let campaign;
  try {
    campaign = await readCampaignBundle(dataRoot, bundle.session.campaignRunId);
  } catch {
    return failure("solo_t7_projection_invalid");
  }
  const checkpoint = campaign.checkpoints.find((item) => item.approvalDigest === checkpointApprovalDigest);
  if (!checkpoint || !verifyPilotCheckpointApprovalIntegrity(checkpoint)) return failure("solo_source_not_ready", "checkpoint");
  const created = createSoloCheckpointLink({ session: bundle.session, brief, checkpoint, linkedAt: now().toISOString() });
  if (!created.ok) return created;
  if (!confirm) return Object.freeze({ ok: true, state: "preflight", link: created.link, writesPerformed: 0 });
  const saved = await saveSoloCheckpointLink({ dataRoot, session: bundle.session, link: created.link });
  return Object.freeze({ ok: true, state: saved.created ? "linked" : "existing", link: saved.value, writesPerformed: saved.created ? 1 : 0 });
}
