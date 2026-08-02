import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { makePlan, makeRun } from "../campaign/helpers.mjs";
import { buildCampaignEvidenceSnapshot, deriveCampaignMetricSet, deriveCampaignSlotRows } from "../../src/reporting/derive.js";

export function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const CANDIDATE_OUTCOMES = new Set([
  "observation_valid_ineligible",
  "observation_failed",
  "judgment_incomplete",
  "retained_g3_negative_control",
  "promotion_held",
  "promotion_rejected",
  "promoted_g4"
]);
const CONSENSUS_OUTCOMES = new Set([
  "retained_g3_negative_control",
  "promotion_held",
  "promotion_rejected",
  "promoted_g4"
]);
const PROMOTION_OUTCOMES = new Set([
  "retained_g3_negative_control",
  "promotion_held",
  "promotion_rejected",
  "promoted_g4"
]);

export async function makeFakeSource({ dataRoot = null, providerProfileId = "gemini-image-manual-v1", comparisonGroupId = null, runNonce = "report-run-001" } = {}) {
  const plan = makePlan({ providerProfileId, comparisonGroupId });
  const runResult = makeRun(plan, { runNonce });
  const run = runResult.run;
  const slots = runResult.slots;
  const artifactIndex = [];
  const terminalCycle = [
    "cancelled_operator",
    "generation_failed_no_asset",
    "candidate_import_failed",
    "observation_valid_ineligible",
    "observation_failed",
    "judgment_incomplete",
    "retained_g3_negative_control",
    "promotion_held",
    "promotion_rejected",
    "promoted_g4"
  ];
  const slotEvidence = [];
  const slotProjections = [];
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const terminalOutcome = terminalCycle[index % terminalCycle.length];
    const candidatePresent = CANDIDATE_OUTCOMES.has(terminalOutcome);
    let candidateId = null;
    let candidateDigest = null;
    let canonicalSha256 = null;
    let canonicalPath = null;
    if (candidatePresent) {
      candidateId = `cand_${hash(`candidate:${run.campaignRunId}:${slot.slotId}`).slice(0,24)}`;
      candidateDigest = hash(`candidate-digest:${candidateId}`);
      const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: { r: 140 + index, g: 110, b: 100 } } }).png().toBuffer();
      canonicalSha256 = createHash("sha256").update(png).digest("hex");
      canonicalPath = `objects/canonical/sha256/${canonicalSha256.slice(0,2)}/${canonicalSha256}.png`;
      if (dataRoot) {
        const absolute = path.join(dataRoot, ...canonicalPath.split("/"));
        await mkdir(path.dirname(absolute), { recursive: true });
        await writeFile(absolute, png);
      }
      artifactIndex.push({ track: "T3", artifactType: "canonical-image", artifactDigest: canonicalSha256, campaignRunId: run.campaignRunId, slotId: slot.slotId, candidateId, integrityStatus: "verified", relativeObjectPath: canonicalPath });
    }
    const observationRunExists = CANDIDATE_OUTCOMES.has(terminalOutcome);
    const authoritativeObservation = observationRunExists && terminalOutcome !== "observation_failed";
    const hasConsensus = CONSENSUS_OUTCOMES.has(terminalOutcome);
    const hasAlignment = hasConsensus;
    const hasDecision = PROMOTION_OUTCOMES.has(terminalOutcome);
    const promoted = terminalOutcome === "promoted_g4";
    const projection = {
      slotId: slot.slotId,
      conditionId: slot.conditionId,
      conditionOrdinal: slot.conditionOrdinal,
      waveOrdinal: slot.waveOrdinal,
      state: "terminal",
      terminalOutcome,
      checkpointReady: true,
      generationAttempts: terminalOutcome === "cancelled_operator" ? 0 : terminalOutcome === "generation_failed_no_asset" ? 2 : 1,
      generationRetries: terminalOutcome === "generation_failed_no_asset" ? 1 : 0,
      observationRuns: observationRunExists ? 1 : 0,
      authoritativeObservationRuns: authoritativeObservation ? 1 : 0,
      observationRecoveryRuns: 0,
      refs: {
        candidateId,
        candidateDigest,
        canonicalSha256,
        observationRunId: observationRunExists ? `obs_${hash(`obs:${slot.slotId}`).slice(0,24)}` : null,
        observationRunDigest: observationRunExists ? hash(`obs-run:${slot.slotId}`) : null,
        observationObjectDigest: authoritativeObservation ? hash(`obs-object:${slot.slotId}`) : null,
        consensusDigest: hasConsensus ? hash(`consensus:${slot.slotId}`) : null,
        alignmentDigest: hasAlignment ? hash(`alignment:${slot.slotId}`) : null,
        promotionDecisionDigest: hasDecision ? hash(`decision:${slot.slotId}`) : null
      },
      activeG4: promoted ? { slotId: slot.slotId, gradeRecordDigest: hash(`g4:${slot.slotId}`), promotionKey: hash(`promotion-key:${slot.slotId}`), splitCouplingKeysDigest: hash(`coupling:${slot.slotId}`) } : null
    };
    slotProjections.push(projection);
    const sourceDigest = hash(`source:${slot.slotId}`);
    artifactIndex.push({ track: "T7", artifactType: "campaign-event", artifactDigest: sourceDigest, campaignRunId: run.campaignRunId, slotId: slot.slotId, candidateId, integrityStatus: "verified", relativeObjectPath: `campaigns/runs/${run.campaignRunId}/events/${slot.slotId}/${sourceDigest}.json` });
    slotEvidence.push({
      slot,
      projection,
      evidence: {
        assetReady: terminalOutcome !== "cancelled_operator" && terminalOutcome !== "generation_failed_no_asset",
        markHint: candidatePresent ? (index === 3 ? "present" : "absent") : null,
        candidateManifest: candidatePresent ? { candidateId, asset: { canonicalSha256, canonicalObjectRelativePath: canonicalPath } } : null,
        observationObject: authoritativeObservation ? { observationDigest: projection.refs.observationObjectDigest, bundle: { eligibility: { status: terminalOutcome === "observation_valid_ineligible" ? "ineligible" : "eligible" } } } : null,
        consensus: hasConsensus ? { consensusDigest: projection.refs.consensusDigest } : null,
        alignment: hasAlignment ? { alignmentDigest: projection.refs.alignmentDigest } : null,
        promotion: hasDecision ? { decision: { decisionDigest: projection.refs.promotionDecisionDigest }, gradeRecord: promoted ? { gradeRecordDigest: projection.activeG4.gradeRecordDigest } : null } : { decision: null, gradeRecord: null }
      },
      sourceRefDigests: [sourceDigest]
    });
  }
  artifactIndex.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const projection = {
    campaignRunId: run.campaignRunId,
    planDigest: plan.planDigest,
    projectionDigest: hash(`projection:${run.campaignRunId}`),
    runStatus: "closed",
    denominators: { terminalSlots: 20 },
    slotProjections,
    activeG4Refs: slotProjections.map((item) => item.activeG4).filter(Boolean)
  };
  const closeout = { closeoutDigest: hash(`closeout:${run.campaignRunId}`), closedAt: "2026-08-03T00:00:00.000Z" };
  return { plan, run, slots, projection, closeout, slotEvidence, artifactIndex, artifactIndexDigest: hash(JSON.stringify(artifactIndex)) };
}

export async function makeDerivedBundle(options = {}) {
  const source = await makeFakeSource(options);
  const rowResult = deriveCampaignSlotRows(source);
  if (!rowResult.ok) throw new Error(`rows_failed:${JSON.stringify(rowResult.errors)}`);
  const snapshotResult = buildCampaignEvidenceSnapshot({ sources: [source], rows: rowResult.rows, capturedAt: "2026-08-03T00:10:00.000Z" });
  if (!snapshotResult.ok) throw new Error(`snapshot_failed:${JSON.stringify(snapshotResult.errors)}`);
  const metricResult = deriveCampaignMetricSet({ sourceSnapshot: snapshotResult.snapshot, rows: rowResult.rows });
  if (!metricResult.ok) throw new Error(`metrics_failed:${JSON.stringify(metricResult.errors)}`);
  return { source, rows: rowResult.rows, sourceSnapshot: snapshotResult.snapshot, artifactIndex: snapshotResult.artifactIndex, metricSet: metricResult.metricSet };
}
