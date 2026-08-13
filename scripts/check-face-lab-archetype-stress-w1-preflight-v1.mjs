import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  ARCHETYPE_STRESS_FEATURE_CUE_PROFILE_VERSION,
  ARCHETYPE_STRESS_TAXONOMY_VERSION,
  validateDraftGenerationSpec
} from "@bejewely/face-contracts";
import { FACE_LAB_ARCHETYPE_REGISTRY } from "../lib/face-lab-archetype-registry.js";
import {
  sha256Hex,
  stableStringify
} from "../tools/synthetic-evaluation/src/generation/canonicalize-generation-spec.js";
import { compileGenerationPrompt } from "../tools/synthetic-evaluation/src/generation/compile-prompt.js";
import { resolveProviderProfile } from "../tools/synthetic-evaluation/src/generation/providers/provider-profiles.js";

const PREFLIGHT_PATH = "evidence/facelab/archetype-stress-w1-preflight-v1.json";
const FREEZE_PATH = "evidence/facelab/archetype-stress-scenario-freeze-v1.json";
const EXPECTED_SCHEMA = "face-lab-archetype-stress-w1-preflight-v1";
const EXPECTED_CAMPAIGN = "face-eval-c-archetype-stress-pilot-v1";
const EXPECTED_ARCHETYPES = ["wolf", "cat", "puppy", "deer", "tofu", "potato", "dino"];
const RAW_ARCHETYPE_TOKEN = /\b(?:wolf|cat|puppy|deer|tofu|potato|dino)\b/i;

const preflight = JSON.parse(readFileSync(PREFLIGHT_PATH, "utf8"));
const freeze = JSON.parse(readFileSync(FREEZE_PATH, "utf8"));
const payload = structuredClone(preflight);
delete payload.preflightDigest;

assert.equal(preflight.schemaVersion, EXPECTED_SCHEMA);
assert.equal(preflight.campaignId, EXPECTED_CAMPAIGN);
assert.equal(preflight.waveId, "W1");
assert.equal(preflight.status, "preflight_frozen_not_executed");
assert.equal(
  sha256Hex(stableStringify(payload)),
  preflight.preflightDigest,
  "W1 preflight semantic digest mismatch"
);

const source = preflight.sourceAuthority;
assert.match(source.sourceMainSha, /^[a-f0-9]{40}$/);
assert.equal(source.scenarioFreezeSchemaVersion, freeze.schemaVersion);
assert.equal(source.scenarioFreezeDigest, freeze.freezeDigest);
assert.equal(source.archetypeRegistryVersion, FACE_LAB_ARCHETYPE_REGISTRY.registryVersion);
assert.equal(source.generationSpecSchemaVersion, "generation-spec-v1");
assert.equal(source.featureCueProfileVersion, ARCHETYPE_STRESS_FEATURE_CUE_PROFILE_VERSION);
assert.equal(source.archetypeTaxonomyVersion, ARCHETYPE_STRESS_TAXONOMY_VERSION);
assert.equal(source.compiledPromptSchemaVersion, "compiled-prompt-v1");
assert.equal(source.promptCompilerVersion, "prompt-compiler-v1");
assert.equal(source.providerProfileId, freeze.providerPolicy.primaryProviderProfileId);
assert.equal(source.providerProfileVersion, freeze.sourceAuthority.providerProfileVersion);

const expectedBase = process.env.FACE_EVAL_CX1_EXPECTED_BASE_SHA || null;
if (expectedBase) {
  assert.equal(source.sourceMainSha, expectedBase, "preflight source main must equal PR base");
}
execFileSync("git", ["merge-base", "--is-ancestor", source.sourceMainSha, "HEAD"], { stdio: "ignore" });

const provider = resolveProviderProfile(source.providerProfileId);
assert.ok(provider, "provider profile missing");
assert.equal(provider.version, source.providerProfileVersion);
assert.equal(provider.status, freeze.providerPolicy.requiredProfileStatus);
assert.equal(freeze.providerPolicy.fallbackProviderAllowed, false);

assert.deepEqual(preflight.budgetState, {
  primarySlotsAuthorized: 7,
  providerCallsUsed: 0,
  generationAttemptsUsed: 0,
  technicalRetryReserveUsed: 0,
  syntheticAssetsWritten: 0,
  authoritativeObservationRunsUsed: 0
});
assert.deepEqual(preflight.operatorCheckpoint, {
  requiredBeforeProviderExecution: true,
  status: "not_started"
});

assert.equal(preflight.slots.length, 7);
assert.deepEqual(
  preflight.slots.map((slot) => slot.targetArchetypeMetadata),
  EXPECTED_ARCHETYPES
);
assert.equal(new Set(preflight.slots.map((slot) => slot.slotId)).size, 7);

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

for (const slot of preflight.slots) {
  assert.equal(slot.stressKind, "required_axis_positive");
  const draft = buildDraft(slot);
  const expectedCuePlan = freeze.requiredPositivePlan[slot.targetArchetypeMetadata];
  assert.deepEqual(slot.requiredCues, expectedCuePlan);

  const validation = validateDraftGenerationSpec(draft);
  assert.deepEqual(validation, { ok: true, errors: [] });

  const compiled = compileGenerationPrompt({
    draftSpec: draft,
    providerProfileId: source.providerProfileId
  });
  assert.equal(compiled.ok, true, `compile failed: ${slot.slotId}`);
  assert.equal(compiled.canonicalSpec.finalizedSpec.specId, slot.expectedSpecId);
  assert.equal(compiled.canonicalSpec.specDigest, slot.expectedSpecDigest);
  assert.equal(compiled.compiledPrompt.promptDigest, slot.expectedPromptDigest);
  assert.equal(compiled.compiledPrompt.schemaVersion, source.compiledPromptSchemaVersion);
  assert.equal(compiled.compiledPrompt.compilerVersion, source.promptCompilerVersion);
  assert.equal(compiled.compiledPrompt.providerProfile.id, source.providerProfileId);
  assert.equal(compiled.compiledPrompt.providerProfile.version, source.providerProfileVersion);
  assert.doesNotMatch(compiled.compiledPrompt.content.positivePrompt, RAW_ARCHETYPE_TOKEN);
  assert.doesNotMatch(compiled.compiledPrompt.content.positivePrompt, /\barchetype\b/i);
}

console.log(JSON.stringify({
  status: "PASS",
  contract: EXPECTED_SCHEMA,
  campaignId: preflight.campaignId,
  waveId: preflight.waveId,
  preflightDigest: preflight.preflightDigest,
  sourceMainSha: source.sourceMainSha,
  providerProfile: `${source.providerProfileId}@${source.providerProfileVersion}`,
  slots: preflight.slots.map((slot) => ({
    slotId: slot.slotId,
    specId: slot.expectedSpecId,
    specDigest: slot.expectedSpecDigest,
    promptDigest: slot.expectedPromptDigest
  })),
  budgetState: preflight.budgetState,
  operatorCheckpoint: preflight.operatorCheckpoint,
  providerCalls: 0,
  hostedWrites: 0,
  syntheticWrites: 0
}, null, 2));
