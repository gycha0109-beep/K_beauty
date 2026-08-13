import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256Hex, stableStringify } from "../tools/synthetic-evaluation/src/generation/canonicalize-generation-spec.js";
import { compileGenerationPrompt } from "../tools/synthetic-evaluation/src/generation/compile-prompt.js";

const preflight = JSON.parse(readFileSync("evidence/facelab/archetype-stress-w1-preflight-v1.json", "utf8"));
const checkpoint = JSON.parse(readFileSync("evidence/facelab/archetype-stress-w1-operator-checkpoint-v1.json", "utf8"));

const checkpointPayload = structuredClone(checkpoint);
delete checkpointPayload.checkpointDigest;
assert.equal(sha256Hex(stableStringify(checkpointPayload)), checkpoint.checkpointDigest);
assert.equal(checkpoint.status, "authorized");
assert.equal(checkpoint.campaignId, preflight.campaignId);
assert.equal(checkpoint.waveId, preflight.waveId);
assert.equal(checkpoint.authority.preflightDigest, preflight.preflightDigest);
assert.equal(checkpoint.authorization.authorizedScope, "W1_required_axis_positive_only");
assert.equal(checkpoint.authorization.providerProfileId, preflight.sourceAuthority.providerProfileId);
assert.equal(checkpoint.authorization.providerProfileVersion, preflight.sourceAuthority.providerProfileVersion);
assert.deepEqual(checkpoint.preExecutionCounters, {
  providerCalls: 0,
  generationAttempts: 0,
  syntheticAssetsWritten: 0,
  authoritativeObservationRuns: 0
});
execFileSync("git", ["merge-base", "--is-ancestor", checkpoint.authority.sourceMainSha, "HEAD"], { stdio: "ignore" });

function buildDraft(slot) {
  const template = preflight.draftTemplate;
  return {
    schemaVersion: template.schemaVersion,
    purpose: template.purpose,
    subject: structuredClone(slot.subject),
    capture: structuredClone(template.capture),
    appearance: structuredClone(template.appearance),
    featureIntent: {
      schemaVersion: template.featureIntentSchemaVersion,
      cueProfileVersion: template.featureCueProfileVersion,
      cues: Object.fromEntries(
        Object.entries(slot.requiredCues).map(([axis, value]) => [axis, { value, strength: "subtle" }])
      )
    },
    archetypeIntent: {
      taxonomyVersion: template.archetypeTaxonomyVersion,
      primary: slot.targetArchetypeMetadata,
      secondary: null,
      intendedWeightsBps: { [slot.targetArchetypeMetadata]: 10000 },
      compilationMode: template.archetypeCompilationMode
    },
    skinIntent: structuredClone(template.skinIntent),
    variation: structuredClone(template.variation),
    exclusionPolicyVersion: template.exclusionPolicyVersion,
    provenance: {
      campaignId: preflight.campaignId,
      authoredBy: template.provenance.authoredBy,
      sourceTemplateId: slot.sourceTemplateId,
      sourceTemplateVersion: template.provenance.sourceTemplateVersion,
      createdAt: template.provenance.createdAt,
      notes: template.provenance.notes
    }
  };
}

const slots = preflight.slots.map((slot) => {
  const compiled = compileGenerationPrompt({
    draftSpec: buildDraft(slot),
    providerProfileId: preflight.sourceAuthority.providerProfileId
  });
  assert.equal(compiled.ok, true);
  assert.equal(compiled.canonicalSpec.finalizedSpec.specId, slot.expectedSpecId);
  assert.equal(compiled.canonicalSpec.specDigest, slot.expectedSpecDigest);
  assert.equal(compiled.compiledPrompt.promptDigest, slot.expectedPromptDigest);
  return {
    slotId: slot.slotId,
    specId: slot.expectedSpecId,
    specDigest: slot.expectedSpecDigest,
    promptDigest: slot.expectedPromptDigest,
    providerProfile: compiled.compiledPrompt.providerProfile,
    positivePrompt: compiled.compiledPrompt.content.positivePrompt,
    negativePrompt: compiled.compiledPrompt.content.negativePrompt,
    operatorInstructions: compiled.compiledPrompt.content.operatorInstructions,
    suggestedOutputFilename: `${slot.slotId}.png`
  };
});

const packet = {
  schemaVersion: "face-lab-archetype-stress-w1-manual-execution-packet-v1",
  campaignId: preflight.campaignId,
  waveId: preflight.waveId,
  checkpointDigest: checkpoint.checkpointDigest,
  preflightDigest: preflight.preflightDigest,
  executionPolicy: {
    copyPromptExactly: true,
    freeTextAdditionsAllowed: false,
    candidatesPerSlot: 1,
    technicalFailureRetryOnly: true,
    cueMismatchRegenerationAllowed: false,
    fallbackProviderAllowed: false,
    executeSequentially: true
  },
  slots
};
const packetDigest = sha256Hex(stableStringify(packet));
console.log(JSON.stringify({ ...packet, packetDigest }, null, 2));
