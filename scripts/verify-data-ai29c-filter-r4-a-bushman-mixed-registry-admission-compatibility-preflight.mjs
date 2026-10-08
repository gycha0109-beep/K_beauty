#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  evaluateSunscreenInitialAdmissionGrant,
  SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_REGISTRY,
  SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_PROPOSITION_SERIALIZER,
  SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS,
  SUNSCREEN_INITIAL_ADMISSION_REQUIRED_FACTS,
} from "../lib/sunscreen-initial-admission-grant-policy.mjs";
import {
  evaluateSunscreenSemanticEnvelope,
} from "../lib/sunscreen-recommendation-semantic-projection.mjs";
import {
  isExactLegacyRecommendationCorpusMember,
} from "../lib/recommendation-legacy-corpus-v1.mjs";
import {
  D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS,
  D5E_F_AUTHENTICATED_BETA_TARGET_COUNT,
  D5E_F_AUTHENTICATED_BETA_COMBINED_SUNSCREEN_COUNT,
} from "../lib/sunscreen-d5e-f-authenticated-beta-contract.mjs";

const a = JSON.parse(fs.readFileSync("evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-a-bushman-mixed-registry-admission-compatibility-preflight-v1.json", "utf8"));
const r33 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r3-r3-bushman-governed-source-refresh-confirmation-closeout-v1.json",
  "utf8",
));
assert.equal(a.stage, "DATA-AI29C-FILTER-R4-A");
assert.equal(a.decision, "FILTER_R4_A_READ_ONLY_COMPATIBILITY_PREFLIGHT_PASS_ADMISSION_HOLD");
assert.equal(a.mode, "READ_ONLY_POLICY_REPLAY_NO_ADMISSION_WRITE");
assert.equal(r33.decision, "FILTER_R3_R3_BUSHMAN_GOVERNED_SOURCE_REFRESH_AND_CONFIRMATION_PASS");

assert.equal(a.target.subjectId, r33.target.subjectId);
assert.equal(a.target.productId, r33.target.productId);
assert.equal(a.target.subjectSemanticKey, r33.target.subjectSemanticKey);
assert.equal(a.target.formulationRevisionKey, r33.target.formulationRevisionKey);
assert.equal(a.frozenProduction.exactCurrentSubjectCount, 1);
assert.equal(a.frozenProduction.semanticReviewCount, 0);
assert.equal(a.target.exactLegacyCorpusMember, false);
assert.equal(isExactLegacyRecommendationCorpusMember(a.target.productId), false);
assert.equal(a.frozenProduction.facts.length, 3);
assert.equal(a.frozenProduction.facts.find(x=>x.factKey==="uv_filter_type").factInstanceId,r33.confirmation.factInstanceId);
assert.equal(a.frozenProduction.facts.find(x=>x.factKey==="uv_filter_type").confirmationId,r33.confirmation.confirmationId);
assert.equal(a.frozenProduction.facts.find(x=>x.factKey==="uv_filter_type").valueEnum,"hybrid");

assert.equal(SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_REGISTRY.version,a.frozenProduction.registryV1.registryVersion);
assert.equal(SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_REGISTRY.checksum,a.frozenProduction.registryV1.registryChecksum);
assert.equal(a.frozenProduction.registryV1.identitySerializerVersion,"product-fact-subject-identity-v1");
assert.equal(SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_PROPOSITION_SERIALIZER,a.legacyPolicy.acceptedPropositionSerializer);
assert.deepEqual([...SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS],a.legacyPolicy.acceptedSubjectResolution);
assert.deepEqual([...SUNSCREEN_INITIAL_ADMISSION_REQUIRED_FACTS],a.legacyPolicy.requiredFacts);
assert.equal(a.frozenProduction.registryV2.registryVersion,"product-fact-registry-cross-category-v2");
assert.equal(a.frozenProduction.registryV2.registryChecksum,"923256ca2468b2af31e1b7026655739408035daf62d3ff40a7132eca22afddd7");

assert.equal(D5E_F_AUTHENTICATED_BETA_TARGET_COUNT,4);
assert.equal(D5E_F_AUTHENTICATED_BETA_COMBINED_SUNSCREEN_COUNT,15);
assert.equal(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.length,4);
assert.equal(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.includes(a.target.productId),false);
assert.deepEqual(a.frozenProduction.d5dBetaRuntime,{
  scope:"authenticated_product_query_beta",enabled:true,authorizedPhase:"DATA-AI29C-D5D"
});

const names = [
  "category_slot","skin_types","concerns","texture","finish","uv_filter_type",
  "sensitivity_safe","irritation_risk","tone_up","white_cast","eye_sting","pilling_risk"
];
function syntheticUnreviewed() {
  return {
    contractVersion:"sunscreen-recommendation-semantic-bundle-v1",
    productId:a.target.productId,subjectId:a.target.subjectId,subjectCount:1,
    fields:Object.fromEntries(names.map(name=>[name,{
      state:"not_reviewed",value:null,confidence:"unknown"
    }]))
  };
}
function makeInput() {
 return {
  product:{id:a.target.productId,canonicalProduct:a.target.canonicalProduct},
  taxonomy:structuredClone(a.frozenProduction.taxonomy),
  subject:structuredClone(a.frozenProduction.subject),
  registry:structuredClone(a.frozenProduction.registryV1),
  currentFacts:structuredClone(a.frozenProduction.facts),
  semanticBundle:syntheticUnreviewed()
 };
}
function expectNoGrant(key,input) {
  const actual=evaluateSunscreenInitialAdmissionGrant(input);
  assert.equal(actual.grant,false,key);
  assert.equal(actual.decision,a.replayExpected[key].decision,key);
  assert.deepEqual([...actual.reasons],a.replayExpected[key].reasons,key);
}
const baseline=makeInput();
expectNoGrant("baseline",baseline);

const subjectOnly=makeInput();
subjectOnly.subject.identityResolutionVersion=a.legacyPolicy.acceptedSubjectResolution[0];
expectNoGrant("authorityLineageOnly",subjectOnly);

const switchedRegistry=structuredClone(subjectOnly);
switchedRegistry.registry=structuredClone(a.frozenProduction.registryV2);
expectNoGrant("authorityLineagePlusRegistryV2",switchedRegistry);

const uvRegistryOnly=structuredClone(subjectOnly);
uvRegistryOnly.currentFacts.find(f=>f.factKey==="uv_filter_type").registryVersion=
  a.frozenProduction.registryV1.registryVersion;
expectNoGrant("authorityLineagePlusUvRegistryRewriteOnly",uvRegistryOnly);

const forgedUvV1=structuredClone(uvRegistryOnly);
forgedUvV1.currentFacts.find(f=>f.factKey==="uv_filter_type").propositionSerializerVersion=
  a.legacyPolicy.acceptedPropositionSerializer;
expectNoGrant("authorityLineagePlusForgedUvV1Pilot",forgedUvV1);

const coreOnly=structuredClone(forgedUvV1);
coreOnly.semanticBundle.fields.category_slot={state:"established",value:"sunscreen",confidence:"high"};
coreOnly.semanticBundle.fields.uv_filter_type={state:"established",value:"hybrid",confidence:"high"};
expectNoGrant("authorityLineagePlusForgedUvV1PilotAndCoreOnly",coreOnly);
assert.equal(evaluateSunscreenSemanticEnvelope(coreOnly.semanticBundle).envelopeReady,false);
assert.equal(evaluateSunscreenSemanticEnvelope(baseline.semanticBundle).envelopeReady,false);

const rawFacts=a.frozenProduction.facts;
assert.deepEqual(rawFacts.map(f=>f.factKey).sort(),["spf_value","uv_filter_type","uva_label"]);
for(const f of rawFacts){
 assert.equal(f.isCurrent,true);
 assert.equal(f.semanticStatus,"supported");
 assert.equal(f.authorityCeiling,"product_specific_primary");
 assert.equal(f.fusedConfidence,"high");
 assert.equal(f.subjectId,a.target.subjectId);
}
assert.equal(rawFacts.find(f=>f.factKey==="spf_value").registryVersion,a.frozenProduction.registryV1.registryVersion);
assert.equal(rawFacts.find(f=>f.factKey==="uva_label").registryVersion,a.frozenProduction.registryV1.registryVersion);
assert.equal(rawFacts.find(f=>f.factKey==="uv_filter_type").registryVersion,a.frozenProduction.registryV2.registryVersion);

for(const [key,value] of Object.entries(a.writeBoundary)){
 if(typeof value==="number") assert.equal(value,0,key);
 else if(typeof value==="boolean") assert.equal(value,false,key);
}
assert.equal(a.nextGate.executionState,"NOT_STARTED");
assert.equal(a.nextGate.automaticActivation,false);
console.log(JSON.stringify({
 status:"PASS",stage:a.stage,decision:a.decision,
 replayCount:Object.keys(a.replayExpected).length,
 actualAdmission:"NO_GRANT",
 causes:["subject_identity_lineage","uv_fact_registry_v2","uv_fact_serializer_schema_v2","semantic_review_0_of_12"],
 productionWrites:0,nextGate:a.nextGate.name
},null,2));
