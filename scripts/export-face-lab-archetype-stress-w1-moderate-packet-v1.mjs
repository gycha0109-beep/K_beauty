import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256Hex, stableStringify } from "../tools/synthetic-evaluation/src/generation/canonicalize-generation-spec.js";
import { compileGenerationPrompt } from "../tools/synthetic-evaluation/src/generation/compile-prompt.js";

const source = JSON.parse(readFileSync("evidence/facelab/archetype-stress-w1-preflight-v1.json", "utf8"));
const review = JSON.parse(readFileSync("evidence/facelab/archetype-stress-w1-generation-signal-review-v1.json", "utf8"));
const preflight = JSON.parse(readFileSync("evidence/facelab/archetype-stress-w1-moderate-diagnostic-preflight-v1.json", "utf8"));
const verifyDigest = (object, key) => { const x=structuredClone(object); delete x[key]; assert.equal(sha256Hex(stableStringify(x)),object[key]); };
verifyDigest(review,"reviewDigest");
verifyDigest(preflight,"preflightDigest");

function buildDraft(sourceSlot, slot) {
  const t=source.draftTemplate;
  return {
    schemaVersion:t.schemaVersion,purpose:t.purpose,subject:structuredClone(sourceSlot.subject),capture:structuredClone(t.capture),appearance:structuredClone(t.appearance),
    featureIntent:{schemaVersion:t.featureIntentSchemaVersion,cueProfileVersion:t.featureCueProfileVersion,cues:Object.fromEntries(Object.entries(sourceSlot.requiredCues).map(([axis,value])=>[axis,{value,strength:"moderate"}]))},
    archetypeIntent:{taxonomyVersion:t.archetypeTaxonomyVersion,primary:sourceSlot.targetArchetypeMetadata,secondary:null,intendedWeightsBps:{[sourceSlot.targetArchetypeMetadata]:10000},compilationMode:t.archetypeCompilationMode},
    skinIntent:structuredClone(t.skinIntent),variation:structuredClone(t.variation),exclusionPolicyVersion:t.exclusionPolicyVersion,
    provenance:{campaignId:preflight.diagnosticId,authoredBy:t.provenance.authoredBy,sourceTemplateId:slot.sourceTemplateId,sourceTemplateVersion:t.provenance.sourceTemplateVersion,createdAt:t.provenance.createdAt,notes:null}
  };
}
const slots=preflight.slots.map((slot,index)=>{
  const compiled=compileGenerationPrompt({draftSpec:buildDraft(source.slots[index],slot),providerProfileId:preflight.sourceAuthority.providerProfileId});
  assert.equal(compiled.ok,true);
  assert.equal(compiled.canonicalSpec.finalizedSpec.specId,slot.expectedSpecId);
  assert.equal(compiled.canonicalSpec.specDigest,slot.expectedSpecDigest);
  assert.equal(compiled.compiledPrompt.promptDigest,slot.expectedPromptDigest);
  assert.doesNotMatch(compiled.compiledPrompt.content.positivePrompt,/at subtle strength/i);
  assert.doesNotMatch(compiled.compiledPrompt.content.positivePrompt,/\b(?:wolf|cat|puppy|deer|tofu|potato|dino)\b/i);
  return {ordinal:slot.ordinal,diagnosticSlotId:slot.diagnosticSlotId,specId:slot.expectedSpecId,specDigest:slot.expectedSpecDigest,promptDigest:slot.expectedPromptDigest,providerProfile:compiled.compiledPrompt.providerProfile,positivePrompt:compiled.compiledPrompt.content.positivePrompt,negativePrompt:compiled.compiledPrompt.content.negativePrompt,operatorInstructions:compiled.compiledPrompt.content.operatorInstructions,suggestedOutputFilename:`W1M-${slot.ordinal}.png`};
});
const packet={schemaVersion:"face-lab-archetype-stress-w1-moderate-manual-execution-packet-v1",diagnosticId:preflight.diagnosticId,sourceWaveId:preflight.sourceWaveId,sourceReviewDigest:review.reviewDigest,executionPolicy:preflight.executionPolicy,slots};
console.log(JSON.stringify({...packet,packetDigest:sha256Hex(stableStringify(packet))},null,2));
