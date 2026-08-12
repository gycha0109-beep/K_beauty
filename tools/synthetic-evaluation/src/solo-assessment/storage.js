import path from "node:path";
import { readFile } from "node:fs/promises";
import { nativePath, writeImmutableJson } from "../campaign/storage.js";
import {
  verifySoloAssessmentPolicyIntegrity,
  verifySoloCheckpointLinkIntegrity,
  verifySoloIntentAssessmentIntegrity,
  verifySoloIntentRevealReceiptIntegrity,
  verifySoloPrivateReviewMapIntegrity,
  verifySoloScreeningClaimIntegrity,
  verifySoloTargetWithheldScreeningIntegrity,
  verifySoloWaveAssessmentRowIntegrity,
  verifySoloWaveAssessmentSetIntegrity,
  verifySoloWaveBriefIntegrity,
  verifySoloWaveSessionIntegrity,
  verifyTargetWithheldReviewItemIntegrity
} from "./artifacts.js";
import { verifySoloCueAlignmentIntegrity, verifySoloWaveAlignmentReportIntegrity } from "./alignment-diagnostic.js";

function root(runId, waveOrdinal, sessionDigest) {
  return path.posix.join("solo-assessment", "runs", runId, `wave-${waveOrdinal}`, "sessions", sessionDigest);
}

export function soloStorageLayout(session) {
  const base = root(session.campaignRunId, session.waveOrdinal, session.sessionDigest);
  return Object.freeze({
    root: base,
    policy: path.posix.join(base, "policy.json"),
    session: path.posix.join(base, "session.json"),
    privateMap: path.posix.join(base, "private", "review-map.json"),
    reviewItem: (reviewItemId) => path.posix.join(base, "review-items", `${reviewItemId}.json`),
    claim: (reviewItemId, digest) => path.posix.join(base, "claims", reviewItemId, `${digest}.json`),
    screening: (reviewItemId, digest) => path.posix.join(base, "screenings", reviewItemId, `${digest}.json`),
    reveal: (reviewItemId, digest) => path.posix.join(base, "reveals", reviewItemId, `${digest}.json`),
    assessment: (reviewItemId, digest) => path.posix.join(base, "intent-assessments", reviewItemId, `${digest}.json`),
    row: (slotId, digest) => path.posix.join(base, "rows", slotId, `${digest}.json`),
    assessmentSet: (digest) => path.posix.join(base, "sets", `${digest}.json`),
    brief: (digest) => path.posix.join(base, "briefs", `${digest}.json`),
    checkpointLink: (digest) => path.posix.join(base, "checkpoint-links", `${digest}.json`),
    alignment: (reviewItemId, digest) => path.posix.join(base, "alignment-diagnostics", "rows", reviewItemId, `${digest}.json`),
    alignmentReport: (digest) => path.posix.join(base, "alignment-diagnostics", "reports", `${digest}.json`)
  });
}

async function readJson(dataRoot, relativePath) {
  return JSON.parse(await readFile(nativePath(dataRoot, relativePath), "utf8"));
}

export async function saveSoloPreparation({ dataRoot, policy, privateMap, session, reviewItems }) {
  if (!verifySoloAssessmentPolicyIntegrity(policy) || !verifySoloWaveSessionIntegrity(session, privateMap) || !Array.isArray(reviewItems) || reviewItems.length !== session.expectedSlotCount || !reviewItems.every(verifyTargetWithheldReviewItemIntegrity)) throw Object.assign(new Error("solo_preparation_invalid"), { code: "solo_preparation_invalid" });
  const layout = soloStorageLayout(session);
  const writes = [];
  writes.push(await writeImmutableJson(nativePath(dataRoot, layout.policy), policy, (existing) => verifySoloAssessmentPolicyIntegrity(existing) && existing.policyDigest === policy.policyDigest));
  writes.push(await writeImmutableJson(nativePath(dataRoot, layout.privateMap), privateMap, (existing) => verifySoloPrivateReviewMapIntegrity(existing) && existing.mapDigest === privateMap.mapDigest));
  writes.push(await writeImmutableJson(nativePath(dataRoot, layout.session), session, (existing) => verifySoloWaveSessionIntegrity(existing, privateMap) && existing.sessionDigest === session.sessionDigest));
  for (const item of reviewItems) writes.push(await writeImmutableJson(nativePath(dataRoot, layout.reviewItem(item.reviewItemId)), item, (existing) => verifyTargetWithheldReviewItemIntegrity(existing) && existing.itemDigest === item.itemDigest));
  return Object.freeze({ createdCount: writes.filter((write) => write.created).length, layout });
}

export async function readSoloSessionBundle({ dataRoot, runId, waveOrdinal, sessionDigest }) {
  const shell = { campaignRunId: runId, waveOrdinal, sessionDigest };
  const layout = soloStorageLayout(shell);
  const [policy, privateMap, session] = await Promise.all([
    readJson(dataRoot, layout.policy),
    readJson(dataRoot, layout.privateMap),
    readJson(dataRoot, layout.session)
  ]);
  if (!verifySoloAssessmentPolicyIntegrity(policy) || !verifySoloWaveSessionIntegrity(session, privateMap) || session.sessionDigest !== sessionDigest || session.campaignRunId !== runId || session.waveOrdinal !== waveOrdinal) throw Object.assign(new Error("solo_session_integrity_invalid"), { code: "solo_session_integrity_invalid" });
  const reviewItems = [];
  for (const entry of privateMap.entries) {
    const item = await readJson(dataRoot, layout.reviewItem(entry.reviewItemId));
    if (!verifyTargetWithheldReviewItemIntegrity(item)) throw Object.assign(new Error("solo_review_item_integrity_invalid"), { code: "solo_review_item_integrity_invalid" });
    reviewItems.push(item);
  }
  return Object.freeze({ policy, privateMap, session, reviewItems: Object.freeze(reviewItems), layout });
}

export async function saveSoloClaim({ dataRoot, session, claim }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloScreeningClaimIntegrity(claim) || claim.sessionDigest !== session.sessionDigest) throw Object.assign(new Error("solo_screening_claim_invalid"), { code: "solo_screening_claim_invalid" });
  const target = soloStorageLayout(session).claim(claim.reviewItemId, claim.claimDigest);
  return writeImmutableJson(nativePath(dataRoot, target), claim, (existing) => verifySoloScreeningClaimIntegrity(existing) && existing.claimDigest === claim.claimDigest);
}

export async function saveSoloScreening({ dataRoot, session, screening }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloTargetWithheldScreeningIntegrity(screening) || screening.sessionDigest !== session.sessionDigest) throw Object.assign(new Error("solo_screening_invalid"), { code: "solo_screening_invalid" });
  const target = soloStorageLayout(session).screening(screening.reviewItemId, screening.screeningDigest);
  return writeImmutableJson(nativePath(dataRoot, target), screening, (existing) => verifySoloTargetWithheldScreeningIntegrity(existing) && existing.screeningDigest === screening.screeningDigest);
}

export async function saveSoloReveal({ dataRoot, session, reveal }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloIntentRevealReceiptIntegrity(reveal) || reveal.sessionDigest !== session.sessionDigest) throw Object.assign(new Error("solo_reveal_invalid"), { code: "solo_reveal_invalid" });
  const target = soloStorageLayout(session).reveal(reveal.reviewItemId, reveal.revealDigest);
  return writeImmutableJson(nativePath(dataRoot, target), reveal, (existing) => verifySoloIntentRevealReceiptIntegrity(existing) && existing.revealDigest === reveal.revealDigest);
}

export async function saveSoloIntentAssessment({ dataRoot, session, assessment }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloIntentAssessmentIntegrity(assessment) || assessment.sessionDigest !== session.sessionDigest) throw Object.assign(new Error("solo_intent_assessment_invalid"), { code: "solo_intent_assessment_invalid" });
  const target = soloStorageLayout(session).assessment(assessment.reviewItemId, assessment.intentAssessmentDigest);
  return writeImmutableJson(nativePath(dataRoot, target), assessment, (existing) => verifySoloIntentAssessmentIntegrity(existing) && existing.intentAssessmentDigest === assessment.intentAssessmentDigest);
}

export async function saveSoloWaveAssessmentSet({ dataRoot, session, assessmentSet }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloWaveAssessmentSetIntegrity(assessmentSet) || assessmentSet.sessionDigest !== session.sessionDigest) throw Object.assign(new Error("solo_wave_set_invalid"), { code: "solo_wave_set_invalid" });
  if ((session.waveShape?.shapeDigest ?? null) !== (assessmentSet.waveShape?.shapeDigest ?? null)) throw Object.assign(new Error("solo_wave_set_invalid"), { code: "solo_wave_set_invalid" });
  if ((session.slotSetDigest ?? null) !== (assessmentSet.slotSetDigest ?? null)) throw Object.assign(new Error("solo_wave_set_invalid"), { code: "solo_wave_set_invalid" });
  const layout = soloStorageLayout(session);
  const writes = [];
  for (const row of assessmentSet.rows) {
    if (!verifySoloWaveAssessmentRowIntegrity(row)) throw Object.assign(new Error("solo_wave_row_invalid"), { code: "solo_wave_row_invalid" });
    writes.push(await writeImmutableJson(nativePath(dataRoot, layout.row(row.slotId, row.rowDigest)), row, (existing) => verifySoloWaveAssessmentRowIntegrity(existing) && existing.rowDigest === row.rowDigest));
  }
  writes.push(await writeImmutableJson(nativePath(dataRoot, layout.assessmentSet(assessmentSet.assessmentSetDigest)), assessmentSet, (existing) => verifySoloWaveAssessmentSetIntegrity(existing) && existing.assessmentSetDigest === assessmentSet.assessmentSetDigest));
  return Object.freeze({ createdCount: writes.filter((write) => write.created).length });
}

export async function saveSoloWaveBrief({ dataRoot, session, brief }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloWaveBriefIntegrity(brief) || brief.sessionDigest !== session.sessionDigest) throw Object.assign(new Error("solo_wave_brief_invalid"), { code: "solo_wave_brief_invalid" });
  const target = soloStorageLayout(session).brief(brief.briefDigest);
  return writeImmutableJson(nativePath(dataRoot, target), brief, (existing) => verifySoloWaveBriefIntegrity(existing) && existing.briefDigest === brief.briefDigest);
}

export async function saveSoloCheckpointLink({ dataRoot, session, link }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloCheckpointLinkIntegrity(link) || link.campaignRunId !== session.campaignRunId || link.waveOrdinal !== session.waveOrdinal) throw Object.assign(new Error("solo_checkpoint_link_invalid"), { code: "solo_checkpoint_link_invalid" });
  const target = soloStorageLayout(session).checkpointLink(link.linkDigest);
  return writeImmutableJson(nativePath(dataRoot, target), link, (existing) => verifySoloCheckpointLinkIntegrity(existing) && existing.linkDigest === link.linkDigest);
}

export async function saveSoloAlignmentReport({ dataRoot, session, alignments, report }) {
  if (!verifySoloWaveSessionIntegrity(session) || !Array.isArray(alignments) || alignments.length !== session.expectedSlotCount ||
      alignments.some((item) => !verifySoloCueAlignmentIntegrity(item) || item.sessionDigest !== session.sessionDigest) ||
      !verifySoloWaveAlignmentReportIntegrity(report, alignments) || report.sessionDigest !== session.sessionDigest ||
      report.alignmentRows.some((ref) => !alignments.some((item) => item.alignmentDigest === ref.alignmentDigest && item.reviewItemId === ref.reviewItemId && item.slotId === ref.slotId))) {
    throw Object.assign(new Error("solo_alignment_report_invalid"), { code: "solo_alignment_report_invalid" });
  }
  const layout = soloStorageLayout(session);
  const writes = [];
  for (const alignment of alignments) writes.push(await writeImmutableJson(nativePath(dataRoot, layout.alignment(alignment.reviewItemId, alignment.alignmentDigest)), alignment, (existing) => verifySoloCueAlignmentIntegrity(existing) && existing.alignmentDigest === alignment.alignmentDigest));
  writes.push(await writeImmutableJson(nativePath(dataRoot, layout.alignmentReport(report.reportDigest)), report, (existing) => verifySoloWaveAlignmentReportIntegrity(existing) && existing.reportDigest === report.reportDigest));
  return Object.freeze({ createdCount: writes.filter((write) => write.created).length });
}

export async function readSoloArtifact({ dataRoot, session, kind, reviewItemId = null, digest }) {
  const layout = soloStorageLayout(session);
  const relativePath = kind === "claim" ? layout.claim(reviewItemId, digest)
    : kind === "screening" ? layout.screening(reviewItemId, digest)
      : kind === "reveal" ? layout.reveal(reviewItemId, digest)
        : kind === "assessment" ? layout.assessment(reviewItemId, digest)
          : kind === "set" ? layout.assessmentSet(digest)
            : kind === "brief" ? layout.brief(digest)
              : kind === "checkpoint-link" ? layout.checkpointLink(digest)
                : kind === "alignment" ? layout.alignment(reviewItemId, digest)
                  : kind === "alignment-report" ? layout.alignmentReport(digest)
                : null;
  if (!relativePath) throw Object.assign(new Error("solo_artifact_kind_invalid"), { code: "solo_artifact_kind_invalid" });
  return readJson(dataRoot, relativePath);
}
