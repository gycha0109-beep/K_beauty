import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  FACE_FEATURE_CUE_STRENGTHS,
  validateDraftGenerationSpec
} from "@bejewely/face-contracts";
import { FACE_LAB_ARCHETYPE_REGISTRY } from "../lib/face-lab-archetype-registry.js";
import { sha256Hex, stableStringify } from "../tools/synthetic-evaluation/src/generation/canonicalize-generation-spec.js";
import { compileGenerationPrompt } from "../tools/synthetic-evaluation/src/generation/compile-prompt.js";
import { resolveProviderProfile } from "../tools/synthetic-evaluation/src/generation/providers/provider-profiles.js";

const SOURCE_PATH = "evidence/facelab/archetype-stress-w1-preflight-v1.json";
const REVIEW_PATH = "evidence/facelab/archetype-stress-w1-generation-signal-review-v1.json";
const PREFLIGHT_PATH = "evidence/facelab/archetype-stress-w1-moderate-diagnostic-preflight-v1.json";
const RAW_ARCHETYPE_TOKEN = /\b(?:wolf|cat|puppy|deer|tofu|potato|dino)\b/i;
const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));
const review = JSON.parse(readFileSync(REVIEW_PATH, "utf8"));
const preflight = JSON.parse(readFileSync(PREFLIGHT_PATH, "utf8"));
const verifyDigest = (object, key) => {
  const semantic = structuredClone(object);
  delete semantic[key];
  assert.equal(sha256Hex(stableStringify(semantic)), object[key], `${key} mismatch`);
};
verifyDigest(source, "preflightDigest");
verifyDigest(review, "reviewDigest");
verifyDigest(preflight, "preflightDigest");

assert.deepEqual(FACE_FEATURE_CUE_STRENGTHS, ["subtle", "moderate"]);
assert.equal(preflight.schemaVersion, "face-lab-archetype-stress-w1-moderate-diagnostic-preflight-v1");
assert.equal(preflight.diagnosticId, "face-eval-cx1g-w1-moderate-strength-v1");
assert.equal(preflight.sourceWaveId, "W1");
assert.equal(preflight.status, "preflight_frozen_not_executed");
assert.equal(preflight.sourceAuthority.sourcePreflightDigest, source.preflightDigest);
assert.equal(preflight.sourceAuthority.sourceReviewDigest, review.reviewDigest);
assert.equal(preflight.sourceAuthority.registryVersion, FACE_LAB_ARCHETYPE_REGISTRY.registryVersion);
assert.equal(preflight.slots.length, 7);
assert.equal(new Set(preflight.slots.map((slot) => slot.diagnosticSlotId)).size, 7);
assert.deepEqual(preflight.budgetState, {
  primarySlotsAuthorized: 7,
  providerCallsUsed: 0,
  generationAttemptsUsed: 0,
  technicalRetryReserveUsed: 0,
  syntheticAssetsWritten: 0,
  authoritativeObservationRunsUsed: 0
});
assert.deepEqual(preflight.executionPolicy, {
  copyPromptExactly: true,
  freeTextAdditionsAllowed: false,
  candidatesPerSlot: 1,
  technicalFailureRetryOnly: true,
  cueMismatchRegenerationAllowed: false,
  fallbackProviderAllowed: false,
  executeSequentially: true
});
const profile = resolveProviderProfile(preflight.sourceAuthority.providerProfileId);
assert.equal(profile?.version, preflight.sourceAuthority.providerProfileVersion);
assert.equal(profile?.status, "active_pilot");
assert.equal(profile?.capabilities.referenceImage, false);

function buildDraft(sourceSlot, strength, diagnosticSlot = null) {
  const t = source.draftTemplate;
  const diagnostic = strength === "moderate";
  return {
    schemaVersion: t.schemaVersion,
    purpose: t.purpose,
    subject: structuredClone(sourceSlot.subject),
    capture: structuredClone(t.capture),
    appearance: structuredClone(t.appearance),
    featureIntent: {
      schemaVersion: t.featureIntentSchemaVersion,
      cueProfileVersion: t.featureCueProfileVersion,
      cues: Object.fromEntries(Object.entries(sourceSlot.requiredCues).map(([axis, value]) => [axis, { value, strength }]))
    },
    archetypeIntent: {
      taxonomyVersion: t.archetypeTaxonomyVersion,
      primary: sourceSlot.targetArchetypeMetadata,
      secondary: null,
      intendedWeightsBps: { [sourceSlot.targetArchetypeMetadata]: 10000 },
      compilationMode: t.archetypeCompilationMode
    },
    skinIntent: structuredClone(t.skinIntent),
    variation: structuredClone(t.variation),
    exclusionPolicyVersion: t.exclusionPolicyVersion,
    provenance: {
      campaignId: diagnostic ? preflight.diagnosticId : source.campaignId,
      authoredBy: t.provenance.authoredBy,
      sourceTemplateId: diagnostic ? diagnosticSlot.sourceTemplateId : sourceSlot.sourceTemplateId,
      sourceTemplateVersion: t.provenance.sourceTemplateVersion,
      createdAt: t.provenance.createdAt,
      notes: null
    }
  };
}
function visualPayload(draft) {
  const copy = structuredClone(draft);
  delete copy.provenance;
  for (const cue of Object.values(copy.featureIntent.cues)) delete cue.strength;
  return copy;
}

const result = [];
for (let index = 0; index < source.slots.length; index += 1) {
  const sourceSlot = source.slots[index];
  const slot = preflight.slots[index];
  const ordinal = String(index + 1).padStart(2, "0");
  assert.equal(slot.ordinal, ordinal);
  assert.equal(slot.sourceSlotId, sourceSlot.slotId);
  assert.equal(slot.targetArchetypeMetadata, sourceSlot.targetArchetypeMetadata);
  assert.deepEqual(slot.subject, sourceSlot.subject);
  assert.deepEqual(slot.requiredCues, sourceSlot.requiredCues);
  assert.equal(slot.sourceExpectedSpecDigest, sourceSlot.expectedSpecDigest);
  assert.equal(slot.sourceExpectedPromptDigest, sourceSlot.expectedPromptDigest);
  assert.equal(slot.cueStrength, "moderate");

  const subtleDraft = buildDraft(sourceSlot, "subtle");
  const moderateDraft = buildDraft(sourceSlot, "moderate", slot);
  assert.deepEqual(validateDraftGenerationSpec(subtleDraft), { ok: true, errors: [] });
  assert.deepEqual(validateDraftGenerationSpec(moderateDraft), { ok: true, errors: [] });
  assert.deepEqual(visualPayload(moderateDraft), visualPayload(subtleDraft), `visual contract drift:${ordinal}`);
  for (const axis of Object.keys(sourceSlot.requiredCues)) {
    assert.equal(subtleDraft.featureIntent.cues[axis].strength, "subtle");
    assert.equal(moderateDraft.featureIntent.cues[axis].strength, "moderate");
    assert.equal(moderateDraft.featureIntent.cues[axis].value, subtleDraft.featureIntent.cues[axis].value);
  }

  const subtle = compileGenerationPrompt({ draftSpec: subtleDraft, providerProfileId: source.sourceAuthority.providerProfileId });
  const moderate = compileGenerationPrompt({ draftSpec: moderateDraft, providerProfileId: preflight.sourceAuthority.providerProfileId });
  assert.equal(subtle.ok, true);
  assert.equal(moderate.ok, true);
  assert.equal(subtle.canonicalSpec.specDigest, sourceSlot.expectedSpecDigest);
  assert.equal(subtle.compiledPrompt.promptDigest, sourceSlot.expectedPromptDigest);
  assert.equal(moderate.canonicalSpec.finalizedSpec.specId, slot.expectedSpecId);
  assert.equal(moderate.canonicalSpec.specDigest, slot.expectedSpecDigest);
  assert.equal(moderate.compiledPrompt.promptDigest, slot.expectedPromptDigest);
  assert.notEqual(slot.expectedSpecDigest, sourceSlot.expectedSpecDigest);
  assert.notEqual(slot.expectedPromptDigest, sourceSlot.expectedPromptDigest);
  assert.doesNotMatch(moderate.compiledPrompt.content.positivePrompt, /at subtle strength/i);
  assert.doesNotMatch(moderate.compiledPrompt.content.positivePrompt, RAW_ARCHETYPE_TOKEN);
  assert.equal(Object.values(moderate.canonicalSpec.finalizedSpec.featureIntent.cues).every((cue) => cue.strength === "moderate"), true);
  result.push({ ordinal, specId: slot.expectedSpecId, specDigest: slot.expectedSpecDigest, promptDigest: slot.expectedPromptDigest });
}

execFileSync("git", ["merge-base", "--is-ancestor", preflight.sourceAuthority.sourceMainSha, "HEAD"], { stdio: "ignore" });
console.log(JSON.stringify({ status: "PASS", diagnosticId: preflight.diagnosticId, reviewDigest: review.reviewDigest, preflightDigest: preflight.preflightDigest, slots: result, providerCalls: 0, hostedWrites: 0, syntheticWrites: 0 }, null, 2));
