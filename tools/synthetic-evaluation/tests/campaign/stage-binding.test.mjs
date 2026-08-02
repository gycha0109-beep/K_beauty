import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  compileAndStorePilotCampaign,
  issuePilotWave,
  registerPilotGenerationHandoff
} from "../../src/campaign/orchestrator.js";
import { registerPilotStage } from "../../src/campaign/stage-registration.js";
import { readCampaignBundle } from "../../src/campaign/storage.js";
import { createCandidateArtifacts } from "../judgment/helpers.mjs";

const PLAN = Object.freeze({
  campaignId: "stage-binding-pilot-001",
  campaignVersion: "1.0.0",
  comparisonGroupId: null,
  providerProfileId: "gemini-image-manual-v1",
  authoredBy: "campaign_planner",
  authoredAt: "2026-08-02T10:00:00.000Z"
});

async function readyASlot() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t7-stage-binding-"));
  const compiled = await compileAndStorePilotCampaign({
    dataRoot,
    planDraft: PLAN,
    runNonce: "stage-binding-run-001",
    startedBy: "campaign_operator",
    startedAt: "2026-08-02T10:10:00.000Z"
  });
  assert.equal(compiled.ok, true);
  const runId = compiled.run.campaignRunId;
  const wave = await issuePilotWave({ dataRoot, runId, waveOrdinal: 1 });
  assert.equal(wave.ok, true);
  const slot = compiled.slots.find((item) => item.waveOrdinal === 1 && item.conditionId === "A");
  const bundle = await readCampaignBundle(dataRoot, runId);
  const packet = bundle.packets.find((item) => item.slotId === slot.slotId);
  const handoff = await registerPilotGenerationHandoff({
    dataRoot,
    runId,
    slotId: slot.slotId,
    packetId: packet.packetId,
    handoffDraft: {
      localAssetRelativePath: "inbox/stage-binding-A.png",
      outcome: "asset_ready",
      operatorId: "operator_alpha",
      generatedAt: "2026-08-02T10:20:00.000Z"
    }
  });
  assert.equal(handoff.ok, true);
  return { dataRoot, runId, slot, packet };
}

test("T3 candidate registration must match the slot condition and exact T7 packet", async () => {
  const { dataRoot, runId, slot } = await readyASlot();
  const wrongCondition = createCandidateArtifacts({ fixture: "B" });
  const rejected = await registerPilotStage({
    dataRoot,
    runId,
    slotId: slot.slotId,
    stage: "candidate",
    artifacts: wrongCondition
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].detail, "slot_packet_binding_mismatch");

  const correct = createCandidateArtifacts({ fixture: "A" });
  const accepted = await registerPilotStage({
    dataRoot,
    runId,
    slotId: slot.slotId,
    stage: "candidate",
    artifacts: correct
  });
  assert.equal(accepted.ok, true);
  const projectedSlot = accepted.projection.slotProjections.find((item) => item.slotId === slot.slotId);
  assert.equal(projectedSlot.refs.candidateId, correct.candidateManifest.candidateId);
  assert.equal(projectedSlot.refs.candidateDigest, correct.candidateManifest.candidateDigest);
  assert.equal(projectedSlot.refs.canonicalSha256, correct.candidateManifest.asset.canonicalSha256);
});

test("candidate registration rejects a valid artifact compiled for another provider profile", async () => {
  const { dataRoot, runId, slot } = await readyASlot();
  const otherProvider = createCandidateArtifacts({ fixture: "A" });
  const mutated = JSON.parse(JSON.stringify(otherProvider));
  mutated.candidateManifest.generation.providerProfileId = "gpt-image-manual-v1";
  const rejected = await registerPilotStage({
    dataRoot,
    runId,
    slotId: slot.slotId,
    stage: "candidate",
    artifacts: mutated
  });
  assert.equal(rejected.ok, false);
});

test("observation authorization requires explicit provider permission and a named key env", async () => {
  const { dataRoot, runId, slot } = await readyASlot();
  const correct = createCandidateArtifacts({ fixture: "A" });
  const candidate = await registerPilotStage({ dataRoot, runId, slotId: slot.slotId, stage: "candidate", artifacts: correct });
  assert.equal(candidate.ok, true);

  const weak = await registerPilotStage({
    dataRoot,
    runId,
    slotId: slot.slotId,
    stage: "observation_authorization",
    artifacts: {
      authorizationDigest: "a".repeat(64),
      explicitProviderAuthorization: false,
      apiKeyEnvName: "OPENAI_API_KEY",
      recovery: false
    }
  });
  assert.equal(weak.ok, false);

  const accepted = await registerPilotStage({
    dataRoot,
    runId,
    slotId: slot.slotId,
    stage: "observation_authorization",
    artifacts: {
      authorizationDigest: "b".repeat(64),
      explicitProviderAuthorization: true,
      apiKeyEnvName: "OPENAI_API_KEY",
      recovery: false
    }
  });
  assert.equal(accepted.ok, true);
});
