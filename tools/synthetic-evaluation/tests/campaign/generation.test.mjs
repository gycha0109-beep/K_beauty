import assert from "node:assert/strict";
import test from "node:test";
import {
  finalizeGenerationHandoff,
  issueGenerationWorkPacket,
  verifyGenerationHandoffIntegrity,
  verifyGenerationWorkPacketIntegrity
} from "../../src/campaign/generation.js";
import { clone } from "./helpers.mjs";
import { DIVERSIFIED_SUBJECT_VARIANTS, makePlan, makeRun } from "./helpers.mjs";

test("generation packet is deterministic across issue timestamps", () => {
  const plan = makePlan();
  const { run, slots } = makeRun(plan);
  const one = issueGenerationWorkPacket({ plan, run, slot: slots[0], attemptOrdinal: 1, issuedAt: "2026-08-02T11:00:00.000Z" });
  const two = issueGenerationWorkPacket({ plan, run, slot: slots[0], attemptOrdinal: 1, issuedAt: "2026-08-03T11:00:00.000Z" });
  assert.equal(one.ok, true);
  assert.equal(one.packet.packetId, two.packet.packetId);
  assert.equal(one.packet.packetDigest, two.packet.packetDigest);
  assert.equal(verifyGenerationWorkPacketIntegrity(one.packet), true);
  assert.equal(one.packet.expectedOutput.requiredWidth, 1024);
  assert.equal(one.packet.blindBoundary.judgmentIntentDisclosure, "forbidden");
});

test("provider profile is frozen for every packet in a run", () => {
  const plan = makePlan({ providerProfileId: "gpt-image-manual-v1" });
  const { run, slots } = makeRun(plan);
  for (const slot of slots.slice(0, 4)) {
    const packet = issueGenerationWorkPacket({ plan, run, slot, attemptOrdinal: 1 });
    assert.equal(packet.ok, true);
    assert.equal(packet.packet.providerProfileId, "gpt-image-manual-v1");
  }
});

test("subject variants bind finalized specs, prompts, packets, and distinct digests", () => {
  const plan = makePlan({ providerProfileId: "gpt-image-manual-v1", subjectVariants: DIVERSIFIED_SUBJECT_VARIANTS });
  const { run, slots } = makeRun(plan);
  const results = slots.map((slot) => issueGenerationWorkPacket({ plan, run, slot, attemptOrdinal: 1, issuedAt: "2026-08-02T11:00:00.000Z" }));
  assert.equal(results.every((result) => result.ok), true);
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const variant = DIVERSIFIED_SUBJECT_VARIANTS[index];
    assert.deepEqual(result.finalizedSpec.subject, {
      syntheticPersonOnly: true,
      adultAgeBand: variant.adultAgeBand,
      presentation: variant.presentation,
      regionalAppearanceHint: variant.regionalAppearanceHint,
      personCount: 1
    });
    assert.equal(result.packet.finalizedSpecDigest, result.finalizedSpec.specDigest);
    assert.equal(result.packet.compiledPromptDigest, result.compiledPrompt.promptDigest);
    assert.match(result.compiledPrompt.content.positivePrompt, new RegExp(`in their ${variant.adultAgeBand}`));
    assert.match(result.compiledPrompt.content.positivePrompt, new RegExp(`with ${variant.presentation} presentation`));
    if (variant.regionalAppearanceHint === null) assert.doesNotMatch(result.compiledPrompt.content.positivePrompt, /Korean appearance hint/);
    else assert.match(result.compiledPrompt.content.positivePrompt, /Korean appearance hint/);
  }
  assert.equal(new Set(results.map((result) => result.finalizedSpec.specDigest)).size, 8);
  assert.equal(new Set(results.map((result) => result.compiledPrompt.promptDigest)).size, 8);
});

test("issued packet mutation remains invalid", () => {
  const plan = makePlan({ subjectVariants: DIVERSIFIED_SUBJECT_VARIANTS });
  const { run, slots } = makeRun(plan);
  const packet = issueGenerationWorkPacket({ plan, run, slot: slots[0], attemptOrdinal: 1 }).packet;
  const mutated = clone(packet);
  mutated.compiledPromptDigest = "f".repeat(64);
  assert.equal(verifyGenerationWorkPacketIntegrity(mutated), false);
});

test("manual handoff stores no account, session, response, or absolute path fields", () => {
  const plan = makePlan();
  const { run, slots } = makeRun(plan);
  const packet = issueGenerationWorkPacket({ plan, run, slot: slots[0], attemptOrdinal: 1 }).packet;
  const result = finalizeGenerationHandoff({
    packet,
    localAssetRelativePath: "inbox/pilot/A-01.png",
    outcome: "asset_ready",
    operatorId: "operator_alpha",
    generatedAt: "2026-08-02T11:10:00.000Z"
  });
  assert.equal(result.ok, true);
  assert.equal(verifyGenerationHandoffIntegrity(result.handoff, packet), true);
  const serialized = JSON.stringify(result.handoff);
  for (const token of ["accountId", "sessionToken", "rawResponse", "cookie", "authorization"]) assert.equal(serialized.includes(token), false);
});

test("asset-ready requires a safe relative path and technical no-output requires null path", () => {
  const plan = makePlan();
  const { run, slots } = makeRun(plan);
  const packet = issueGenerationWorkPacket({ plan, run, slot: slots[0], attemptOrdinal: 1 }).packet;
  assert.equal(finalizeGenerationHandoff({ packet, localAssetRelativePath: "C:\\secret.png", outcome: "asset_ready", operatorId: "operator_alpha" }).ok, false);
  assert.equal(finalizeGenerationHandoff({ packet, localAssetRelativePath: "inbox/image.png", outcome: "provider_no_output", operatorId: "operator_alpha" }).ok, false);
  const failure = finalizeGenerationHandoff({ packet, localAssetRelativePath: null, outcome: "provider_no_output", operatorId: "operator_alpha" });
  assert.equal(failure.ok, true);
});

test("visual quality or cue mismatch cannot be declared as generation technical retry outcome", () => {
  const plan = makePlan();
  const { run, slots } = makeRun(plan);
  const packet = issueGenerationWorkPacket({ plan, run, slot: slots[0], attemptOrdinal: 1 }).packet;
  for (const outcome of ["capture_quality_low", "cue_mismatch", "alignment_misaligned", "promotion_rejected"]) {
    const result = finalizeGenerationHandoff({ packet, localAssetRelativePath: null, outcome, operatorId: "operator_alpha" });
    assert.equal(result.ok, false);
  }
});
