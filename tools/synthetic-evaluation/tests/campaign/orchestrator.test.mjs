import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_OBSERVATION_PROFILE, SYNTHETIC_OBSERVATION_RUN_SCHEMA_VERSION } from "@bejewely/face-contracts";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  cancelPilotUngeneratedWave,
  closePilotCampaign,
  compileAndStorePilotCampaign,
  getPilotCampaignStatus,
  registerPilotGenerationHandoff,
  resumePilotCampaign,
  reservePilotGenerationRetry
} from "../../src/campaign/orchestrator.js";
import { issuePilotWave, submitPilotCheckpoint } from "../../src/campaign/safe-operations.js";
import { registerPilotStage } from "../../src/campaign/stage-registration.js";
import { readCampaignBundle } from "../../src/campaign/storage.js";
import { verifyPilotWaveCancellationIntegrity } from "../../src/campaign/cancellation.js";
import { sha256Hex, stableStringify } from "../../src/shared/canonical-json.js";
import { DIVERSIFIED_SUBJECT_VARIANTS } from "./helpers.mjs";
import { createCandidateArtifacts } from "../judgment/helpers.mjs";

const PLAN = Object.freeze({
  campaignId: "skin-control-pilot-001",
  campaignVersion: "1.0.0",
  comparisonGroupId: null,
  providerProfileId: "gemini-image-manual-v1",
  authoredBy: "campaign_planner",
  authoredAt: "2026-08-02T10:00:00.000Z"
});

async function newCampaign() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t7-campaign-"));
  const compiled = await compileAndStorePilotCampaign({
    dataRoot,
    planDraft: PLAN,
    runNonce: "run-alpha-001",
    startedBy: "campaign_operator",
    startedAt: "2026-08-02T10:10:00.000Z"
  });
  assert.equal(compiled.ok, true);
  return { dataRoot, compiled };
}

async function newDiversifiedCampaign() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t7-diversified-campaign-"));
  const compiled = await compileAndStorePilotCampaign({
    dataRoot,
    planDraft: { ...PLAN, campaignId: "skin-control-diversified-001", subjectVariants: DIVERSIFIED_SUBJECT_VARIANTS },
    runNonce: "diversified-run-alpha-001",
    startedBy: "campaign_operator",
    startedAt: "2026-08-02T10:10:00.000Z"
  });
  assert.equal(compiled.ok, true);
  return { dataRoot, compiled };
}

async function exhaustTechnicalSlot(dataRoot, runId, slotId) {
  let bundle = await readCampaignBundle(dataRoot, runId);
  let packet = bundle.packets.find((item) => item.slotId === slotId && item.attemptOrdinal === 1);
  let result = await registerPilotGenerationHandoff({
    dataRoot,
    runId,
    slotId,
    packetId: packet.packetId,
    handoffDraft: { localAssetRelativePath: null, outcome: "provider_no_output", operatorId: "operator_alpha", generatedAt: "2026-08-02T11:00:00.000Z" }
  });
  assert.equal(result.ok, true);
  result = await reservePilotGenerationRetry({ dataRoot, runId, slotId });
  assert.equal(result.ok, true);
  packet = result.packet;
  result = await registerPilotGenerationHandoff({
    dataRoot,
    runId,
    slotId,
    packetId: packet.packetId,
    handoffDraft: { localAssetRelativePath: null, outcome: "provider_no_output", operatorId: "operator_alpha", generatedAt: "2026-08-02T11:05:00.000Z" }
  });
  assert.equal(result.ok, true);
  result = await registerPilotStage({ dataRoot, runId, slotId, stage: "terminal", artifacts: { outcome: "generation_failed_no_asset" } });
  assert.equal(result.ok, true);
}

test("compile and Wave 1 issue are idempotent and emit only four primary packets", async () => {
  const { dataRoot, compiled } = await newCampaign();
  const runId = compiled.run.campaignRunId;
  const first = await issuePilotWave({ dataRoot, runId, waveOrdinal: 1 });
  assert.equal(first.ok, true);
  assert.equal(first.packetsIssued, 4);
  assert.equal(first.projection.denominators.issuedPrimarySlots, 4);
  assert.equal(first.projection.budget.generationAttemptsUsed, 4);
  const second = await issuePilotWave({ dataRoot, runId, waveOrdinal: 1 });
  assert.equal(second.ok, true);
  assert.equal(second.packetsIssued, 0);
  const bundle = await readCampaignBundle(dataRoot, runId);
  assert.equal(bundle.packets.length, 4);
  assert.equal(bundle.events.filter((event) => event.eventType === "wave_issued").length, 1);
  assert.equal(bundle.events.filter((event) => event.eventType === "generation_packet_issued").length, 4);
});

test("untouched issued diversified wave cancels with immutable packet provenance and remains closeable", async () => {
  const { dataRoot, compiled } = await newDiversifiedCampaign();
  const runId = compiled.run.campaignRunId;
  const issued = await issuePilotWave({ dataRoot, runId, waveOrdinal: 1 });
  assert.equal(issued.ok, true);
  assert.equal(issued.packetsIssued, 8);
  const before = await readCampaignBundle(dataRoot, runId);
  const packetSnapshot = stableStringify(before.packets);
  const cancelled = await cancelPilotUngeneratedWave({
    dataRoot,
    runId,
    waveOrdinal: 1,
    reason: "subject_diversity_contract_reissue",
    cancelledBy: "campaign_operator",
    cancelledAt: "2026-08-02T11:00:00.000Z"
  });
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.projection.waveStatus[0].status, "cancelled");
  assert.equal(cancelled.projection.terminalOutcomeCounts.cancelled_ungenerated_wave, 8);
  assert.equal(cancelled.projection.denominators.terminalSlots, 8);
  assert.equal(verifyPilotWaveCancellationIntegrity(cancelled.cancellation), true);
  const after = await readCampaignBundle(dataRoot, runId);
  assert.equal(after.cancellations.length, 1);
  assert.equal(stableStringify(after.packets), packetSnapshot);
  const closed = await closePilotCampaign({ dataRoot, runId, closedBy: "campaign_operator" });
  assert.equal(closed.ok, true);
  assert.equal(closed.projection.runStatus, "closed");
});

test("wave cancellation fails closed after any handoff", async () => {
  const { dataRoot, compiled } = await newDiversifiedCampaign();
  const runId = compiled.run.campaignRunId;
  await issuePilotWave({ dataRoot, runId, waveOrdinal: 1 });
  const bundle = await readCampaignBundle(dataRoot, runId);
  const packet = bundle.packets[0];
  const handoff = await registerPilotGenerationHandoff({
    dataRoot,
    runId,
    slotId: packet.slotId,
    packetId: packet.packetId,
    handoffDraft: { localAssetRelativePath: "inbox/generated.png", outcome: "asset_ready", operatorId: "operator_alpha", generatedAt: "2026-08-02T10:20:00.000Z" }
  });
  assert.equal(handoff.ok, true);
  const rejected = await cancelPilotUngeneratedWave({ dataRoot, runId, waveOrdinal: 1, reason: "subject_diversity_contract_reissue", cancelledBy: "campaign_operator", cancelledAt: "2026-08-02T11:00:00.000Z" });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].code, "campaign_wave_cancellation_not_allowed");
  const after = await readCampaignBundle(dataRoot, runId);
  assert.equal(after.cancellations.length, 0);
});

test("wave cancellation fails closed after candidate registration or observation-stage progress", async () => {
  const { dataRoot, compiled } = await newCampaign();
  const runId = compiled.run.campaignRunId;
  await issuePilotWave({ dataRoot, runId, waveOrdinal: 1 });
  const slot = compiled.slots.find((item) => item.waveOrdinal === 1 && item.conditionId === "A");
  let bundle = await readCampaignBundle(dataRoot, runId);
  const packet = bundle.packets.find((item) => item.slotId === slot.slotId);
  await registerPilotGenerationHandoff({
    dataRoot,
    runId,
    slotId: slot.slotId,
    packetId: packet.packetId,
    handoffDraft: { localAssetRelativePath: "inbox/candidate.png", outcome: "asset_ready", operatorId: "operator_alpha", generatedAt: "2026-08-02T10:20:00.000Z" }
  });
  const artifacts = createCandidateArtifacts({ fixture: "A" });
  const candidate = await registerPilotStage({ dataRoot, runId, slotId: slot.slotId, stage: "candidate", artifacts });
  assert.equal(candidate.ok, true);
  let rejected = await cancelPilotUngeneratedWave({ dataRoot, runId, waveOrdinal: 1, reason: "subject_diversity_contract_reissue", cancelledBy: "campaign_operator", cancelledAt: "2026-08-02T11:00:00.000Z" });
  assert.equal(rejected.ok, false);
  const authorization = await registerPilotStage({
    dataRoot,
    runId,
    slotId: slot.slotId,
    stage: "observation_authorization",
    artifacts: { authorizationDigest: "b".repeat(64), explicitProviderAuthorization: true, apiKeyEnvName: "OPENAI_API_KEY", recovery: false }
  });
  assert.equal(authorization.ok, true);
  rejected = await cancelPilotUngeneratedWave({ dataRoot, runId, waveOrdinal: 1, reason: "subject_diversity_contract_reissue", cancelledBy: "campaign_operator", cancelledAt: "2026-08-02T11:05:00.000Z" });
  assert.equal(rejected.ok, false);
  const observationSemantic = {
    schemaVersion: SYNTHETIC_OBSERVATION_RUN_SCHEMA_VERSION,
    runId: `obs_${"c".repeat(24)}`,
    runDigest: "a".repeat(64),
    candidate: { candidateId: artifacts.candidateManifest.candidateId, canonicalSha256: artifacts.candidateManifest.asset.canonicalSha256, canonicalTransformPolicyVersion: artifacts.candidateManifest.asset.canonicalTransformPolicyVersion },
    adapter: { profileId: CANONICAL_OBSERVATION_PROFILE.id, profileVersion: CANONICAL_OBSERVATION_PROFILE.version, contractSnapshotId: "snapshot", contractSnapshotDigest: "b".repeat(64) },
    execution: { mode: "provider_bounded", provider: "openai", model: "gpt-4.1-mini", replicateOrdinal: 1, imageProviderAttemptCount: 1, inputTokens: null, outputTokens: null, startedAt: "2026-08-02T10:30:00.000Z", completedAt: "2026-08-02T10:31:00.000Z" },
    authority: "observed_image",
    outcome: "provider_failure",
    observation: null,
    failure: { code: "provider_transport_failure", category: "transport" },
    retention: { observationProcessCreatedImageCopy: false, rawProviderResponsePersisted: false },
    registeredAt: "2026-08-02T10:31:00.000Z"
  };
  const observationRun = { ...observationSemantic, manifestDigest: sha256Hex(stableStringify(observationSemantic)) };
  const observation = await registerPilotStage({ dataRoot, runId, slotId: slot.slotId, stage: "observation", artifacts: { run: observationRun, observationObject: null, candidateManifest: artifacts.candidateManifest } });
  assert.equal(observation.ok, true);
  rejected = await cancelPilotUngeneratedWave({ dataRoot, runId, waveOrdinal: 1, reason: "subject_diversity_contract_reissue", cancelledBy: "campaign_operator", cancelledAt: "2026-08-02T11:10:00.000Z" });
  assert.equal(rejected.ok, false);
  bundle = await readCampaignBundle(dataRoot, runId);
  assert.equal(bundle.cancellations.length, 0);
});

test("Wave 2 cannot issue before exact Wave 1 checkpoint approval", async () => {
  const { dataRoot, compiled } = await newCampaign();
  const runId = compiled.run.campaignRunId;
  await issuePilotWave({ dataRoot, runId, waveOrdinal: 1 });
  const blocked = await issuePilotWave({ dataRoot, runId, waveOrdinal: 2 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errors[0].code, "campaign_checkpoint_required");
});

test("technical retries consume reserve and checkpoint allows Wave 2 without T5 or T6 completion", async () => {
  const { dataRoot, compiled } = await newCampaign();
  const runId = compiled.run.campaignRunId;
  await issuePilotWave({ dataRoot, runId, waveOrdinal: 1 });
  for (const slot of compiled.slots.filter((item) => item.waveOrdinal === 1)) await exhaustTechnicalSlot(dataRoot, runId, slot.slotId);
  const status = await getPilotCampaignStatus({ dataRoot, runId });
  assert.equal(status.ok, true);
  assert.equal(status.projection.waveStatus.find((item) => item.waveOrdinal === 1).status, "complete");
  assert.equal(status.projection.budget.generationAttemptsUsed, 8);
  assert.equal(status.projection.budget.generationRetryReserveUsed, 4);
  assert.equal(status.projection.denominators.sealedConsensus, 0);
  assert.equal(status.projection.denominators.promotionDecisions, 0);

  const checkpoint = await submitPilotCheckpoint({
    dataRoot,
    runId,
    checkpointDraft: {
      completedWaveOrdinal: 1,
      checklist: {
        sourceFreezeStillValid: true,
        providerProfileStillAllowed: true,
        noRealPersonReferenceEvidence: true,
        noSystemicExternalMarkIssue: true,
        noCandidateReplacementOccurred: true,
        allRegisteredOutcomesRetained: true,
        unresolvedCriticalIntegrityFailureCount: 0
      },
      decision: "continue",
      reasonCodes: ["checkpoint_continue"],
      approvedBy: "checkpoint_reviewer",
      approvedAt: "2026-08-02T12:00:00.000Z"
    }
  });
  assert.equal(checkpoint.ok, true);
  const wave2 = await issuePilotWave({ dataRoot, runId, waveOrdinal: 2 });
  assert.equal(wave2.ok, true);
  assert.equal(wave2.packetsIssued, 8);
  assert.equal(wave2.projection.denominators.issuedPrimarySlots, 12);
});

test("pause and resume lifecycle remains unchanged", async () => {
  const { dataRoot, compiled } = await newCampaign();
  const runId = compiled.run.campaignRunId;
  await issuePilotWave({ dataRoot, runId, waveOrdinal: 1 });
  for (const slot of compiled.slots.filter((item) => item.waveOrdinal === 1)) await exhaustTechnicalSlot(dataRoot, runId, slot.slotId);
  const paused = await submitPilotCheckpoint({
    dataRoot,
    runId,
    checkpointDraft: {
      completedWaveOrdinal: 1,
      checklist: {
        sourceFreezeStillValid: true,
        providerProfileStillAllowed: true,
        noRealPersonReferenceEvidence: true,
        noSystemicExternalMarkIssue: true,
        noCandidateReplacementOccurred: true,
        allRegisteredOutcomesRetained: true,
        unresolvedCriticalIntegrityFailureCount: 0
      },
      decision: "pause",
      reasonCodes: ["checkpoint_pause"],
      approvedBy: "checkpoint_reviewer",
      approvedAt: "2026-08-02T12:00:00.000Z"
    }
  });
  assert.equal(paused.ok, true);
  assert.equal(paused.projection.runStatus, "paused");
  const resumed = await resumePilotCampaign({ dataRoot, runId, actorId: "campaign_operator" });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.projection.runStatus, "active");
});

test("stop checkpoint explicitly terminates every unissued future slot and permits closeout", async () => {
  const { dataRoot, compiled } = await newCampaign();
  const runId = compiled.run.campaignRunId;
  await issuePilotWave({ dataRoot, runId, waveOrdinal: 1 });
  for (const slot of compiled.slots.filter((item) => item.waveOrdinal === 1)) await exhaustTechnicalSlot(dataRoot, runId, slot.slotId);
  const checkpoint = await submitPilotCheckpoint({
    dataRoot,
    runId,
    checkpointDraft: {
      completedWaveOrdinal: 1,
      checklist: {
        sourceFreezeStillValid: true,
        providerProfileStillAllowed: false,
        noRealPersonReferenceEvidence: true,
        noSystemicExternalMarkIssue: true,
        noCandidateReplacementOccurred: true,
        allRegisteredOutcomesRetained: true,
        unresolvedCriticalIntegrityFailureCount: 1
      },
      decision: "stop",
      reasonCodes: ["checkpoint_stop"],
      approvedBy: "checkpoint_reviewer",
      approvedAt: "2026-08-02T12:00:00.000Z"
    }
  });
  assert.equal(checkpoint.ok, true);
  assert.equal(checkpoint.projection.runStatus, "stopped");
  assert.equal(checkpoint.projection.denominators.terminalSlots, 20);
  assert.equal(checkpoint.projection.terminalOutcomeCounts.cancelled_campaign_stop, 16);
  const closed = await closePilotCampaign({ dataRoot, runId, closedBy: "campaign_operator" });
  assert.equal(closed.ok, true);
  assert.equal(closed.projection.runStatus, "closed");
  assert.equal(closed.closeout.slotEventHeadDigests.length, 20);
});
