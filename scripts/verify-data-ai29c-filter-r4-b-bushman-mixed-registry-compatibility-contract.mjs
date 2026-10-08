#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BUSHMAN_MIXED_REGISTRY_COMPATIBILITY_VERSION,
  BUSHMAN_MIXED_REGISTRY_TARGET,
  BUSHMAN_MIXED_REGISTRY_FACT_CONTRACT,
  BUSHMAN_MIXED_REGISTRY_CHECKSUMS,
  evaluateBushmanMixedRegistryCompatibility,
} from "../lib/sunscreen-mixed-registry-admission-compatibility-contract.mjs";
import {
  evaluateSunscreenInitialAdmissionGrant,
} from "../lib/sunscreen-initial-admission-grant-policy.mjs";
import { isExactLegacyRecommendationCorpusMember } from "../lib/recommendation-legacy-corpus-v1.mjs";
import { D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS } from "../lib/sunscreen-d5e-f-authenticated-beta-contract.mjs";

const r4a = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-a-bushman-mixed-registry-admission-compatibility-preflight-v1.json", "utf8"));
const r4b = JSON.parse(fs.readFileSync("evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-b-bushman-mixed-registry-compatibility-contract-v1.json","utf8"));
assert.equal(r4a.decision,"FILTER_R4_A_READ_ONLY_COMPATIBILITY_PREFLIGHT_PASS_ADMISSION_HOLD");
assert.equal(r4b.decision,"FILTER_R4_B_EXACT_MIXED_REGISTRY_COMPATIBILITY_CONTRACT_IMPLEMENTED_NO_ADMISSION");
assert.equal(r4b.baseline.admissionGranted,false);
assert.equal(r4b.version,BUSHMAN_MIXED_REGISTRY_COMPATIBILITY_VERSION);
assert.equal(r4a.target.productId,BUSHMAN_MIXED_REGISTRY_TARGET.productId);
assert.equal(r4a.target.subjectId,BUSHMAN_MIXED_REGISTRY_TARGET.subjectId);
assert.equal(isExactLegacyRecommendationCorpusMember(r4a.target.productId),false);
assert.equal(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.length,4);
assert.equal(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.includes(r4a.target.productId),false);

for(const [key,c] of Object.entries(r4b.factContracts)){
  const v=BUSHMAN_MIXED_REGISTRY_FACT_CONTRACT[key];
  assert.equal(v.registryVersion,c.registry);
  assert.equal(v.propositionSerializerVersion,c.serializer);
  assert.equal(BUSHMAN_MIXED_REGISTRY_CHECKSUMS[c.registry],c.checksum);
  if(v.valueType==="number")assert.equal(v.valueNumber,c.value);
  else assert.equal(v.valueEnum,c.value);
}
const fields=[
  "category_slot","skin_types","concerns","texture","finish","uv_filter_type",
  "sensitivity_safe","irritation_risk","tone_up","white_cast","eye_sting","pilling_risk"
];
function makeUnreviewed(){
 return {
   contractVersion:"sunscreen-recommendation-semantic-bundle-v1",
   productId:r4a.target.productId,subjectId:r4a.target.subjectId,subjectCount:1,
   fields:Object.fromEntries(fields.map(name=>[name,{
    state:"not_reviewed",value:null,confidence:"unknown"
   }]))
 };
}
function makeInput(){
 return {
  product:{id:r4a.target.productId,canonicalProduct:true},
  taxonomy:structuredClone(r4a.frozenProduction.taxonomy),
  subject:structuredClone(r4a.frozenProduction.subject),
  subjectScope:{
    subjectSemanticKey:r4a.target.subjectSemanticKey,
    formulationRevisionKey:r4a.target.formulationRevisionKey,
    market:r4a.target.market
  },
  exactCurrentSubjectCount:r4a.frozenProduction.exactCurrentSubjectCount,
  registrySnapshots:{
   [r4a.frozenProduction.registryV1.registryVersion]:structuredClone(r4a.frozenProduction.registryV1),
   [r4a.frozenProduction.registryV2.registryVersion]:structuredClone(r4a.frozenProduction.registryV2),
  },
  currentFacts:structuredClone(r4a.frozenProduction.facts),
  semanticReviewCount:r4a.frozenProduction.semanticReviewCount,
  semanticBundle:makeUnreviewed()
 };
}
const NOW={now:new Date("2026-10-08T09:00:00Z")};
function check(input){
  const x=evaluateBushmanMixedRegistryCompatibility(input,NOW);
  assert.equal(x.admissionGranted,false);
  assert.equal(x.runtimeWired,false);
  assert.equal(x.productionCandidateAdded,false);
  assert.equal(x.rankingChanged,false);
  assert.equal(x.publicActivation,false);
  assert.equal(x.uvaActivation,false);
  assert.equal(x.waterActivation,false);
  return x;
}
const baseline=check(makeInput());
for(const key of [
  "decision","lineageCompatible","subjectAuthorityReady",
  "semanticEnvelopeReady","prerequisiteShapeReady","admissionGranted"
]) assert.deepEqual(baseline[key],r4b.baseline[key],key);
assert.deepEqual([...baseline.independentGates],r4b.baseline.independentGates);
assert.deepEqual([...baseline.lineageBlockers],[]);

const negatives=[];
function reject(name,edit,fragment){
 const input=makeInput();
 edit(input);
 const actual=check(input);
 assert.equal(actual.lineageCompatible,false,name);
 assert.ok(actual.lineageBlockers.some(v=>v.includes(fragment)),name+":"+actual.lineageBlockers);
 negatives.push(name);
}
const v1=r4a.frozenProduction.registryV1.registryVersion;
const v2=r4a.frozenProduction.registryV2.registryVersion;
const uv=x=>x.currentFacts.find(f=>f.factKey==="uv_filter_type");
reject("corrupted_v1_checksum",x=>{x.registrySnapshots[v1].registryChecksum="0".repeat(64)},"REGISTRY_CHECKSUM_OR_SERIALIZER_MISMATCH");
reject("corrupted_v2_checksum",x=>{x.registrySnapshots[v2].registryChecksum="0".repeat(64)},"REGISTRY_CHECKSUM_OR_SERIALIZER_MISMATCH");
reject("extra_registry_snapshot",x=>{x.registrySnapshots["arbitrary-v3"]={registryVersion:"arbitrary-v3"}},"REGISTRY_SNAPSHOT_SET_MISMATCH");
reject("missing_registry_snapshot",x=>{delete x.registrySnapshots[v2]},"REGISTRY_SNAPSHOT_SET_MISMATCH");
reject("spf_migrated_to_v2_without_authority",x=>{x.currentFacts.find(f=>f.factKey==="spf_value").registryVersion=v2},"FACT_REGISTRY_OR_PROPOSITION_SERIALIZER_MISMATCH");
reject("uva_serializer_changed_to_schema_v2",x=>{x.currentFacts.find(f=>f.factKey==="uva_label").propositionSerializerVersion="product-fact-proposition-schema-v2"},"FACT_REGISTRY_OR_PROPOSITION_SERIALIZER_MISMATCH");
reject("uv_filter_downgraded_to_v1",x=>{uv(x).registryVersion=v1},"FACT_REGISTRY_OR_PROPOSITION_SERIALIZER_MISMATCH");
reject("uv_filter_wrong_serializer",x=>{uv(x).propositionSerializerVersion="product-fact-proposition-pilot-v1"},"FACT_REGISTRY_OR_PROPOSITION_SERIALIZER_MISMATCH");
reject("uv_filter_wrong_value",x=>{uv(x).valueEnum="organic"},"FACT_VALUE_MISMATCH");
reject("spf_wrong_value",x=>{x.currentFacts.find(f=>f.factKey==="spf_value").valueNumber=30},"FACT_VALUE_MISMATCH");
reject("missing_uv_fact",x=>{x.currentFacts=x.currentFacts.filter(f=>f.factKey!=="uv_filter_type")},"REQUIRED_CURRENT_FACT_MISSING");
reject("duplicate_uv_fact",x=>{x.currentFacts.push(structuredClone(uv(x)))},"DUPLICATE_CURRENT_FACT");
reject("unlisted_fact",x=>{x.currentFacts.push({...structuredClone(uv(x)),factKey:"water_resistance_duration"})},"UNEXPECTED_CURRENT_FACT");
reject("fact_instance_id_invalid",x=>{uv(x).factInstanceId="not-uuid"},"FACT_AUTHORITY_OR_CURRENT_MISMATCH");
reject("confirmation_id_missing",x=>{uv(x).confirmationId=null},"FACT_AUTHORITY_OR_CURRENT_MISMATCH");
reject("proposition_key_invalid",x=>{uv(x).propositionKey="invalid"},"FACT_AUTHORITY_OR_CURRENT_MISMATCH");
reject("fact_authority_secondary",x=>{uv(x).authorityCeiling="aggregate_secondary"},"FACT_AUTHORITY_OR_CURRENT_MISMATCH");
reject("fact_expired",x=>{uv(x).validTo="2020-01-01"},"FACT_AUTHORITY_OR_CURRENT_MISMATCH");
reject("subject_id_mismatch",x=>{x.subject.subjectId="00000000-0000-4000-8000-000000000001"},"EXACT_CURRENT_SUBJECT_OR_FORMULATION_SCOPE_MISMATCH");
reject("subject_superseded",x=>{x.subject.currentState="superseded"},"EXACT_CURRENT_SUBJECT_OR_FORMULATION_SCOPE_MISMATCH");
reject("subject_market_changed",x=>{x.subjectScope.market="US"},"EXACT_CURRENT_SUBJECT_OR_FORMULATION_SCOPE_MISMATCH");
reject("subject_revision_changed",x=>{x.subjectScope.formulationRevisionKey="unknown"},"EXACT_CURRENT_SUBJECT_OR_FORMULATION_SCOPE_MISMATCH");
reject("taxonomy_not_shadow",x=>{x.taxonomy.assignmentState="active"},"CANONICAL_SUNSCREEN_TAXONOMY_MISMATCH");
reject("other_product_not_bushman",x=>{x.product.id="888eca86-af25-4a12-b9ea-47922d83f520"},"PRODUCT_OUTSIDE_EXACT_NONLEGACY_TARGET");

const coreOnly=makeInput();
coreOnly.semanticReviewCount=2;
coreOnly.semanticBundle.fields.category_slot={state:"established",value:"sunscreen",confidence:"high"};
coreOnly.semanticBundle.fields.uv_filter_type={state:"established",value:"hybrid",confidence:"high"};
const core=check(coreOnly);
assert.equal(core.lineageCompatible,true);
assert.equal(core.semanticEnvelopeReady,false);
assert.equal(core.admissionGranted,false);
negatives.push("core_only_not_full_semantics");

function fakeFullSemantics(){
 const x=makeInput();
 x.semanticReviewCount=12;
 for(const name of fields)x.semanticBundle.fields[name]={
  state:"reviewed_not_established",value:null,confidence:"unknown"
 };
 x.semanticBundle.fields.category_slot={state:"established",value:"sunscreen",confidence:"high"};
 x.semanticBundle.fields.uv_filter_type={state:"established",value:"hybrid",confidence:"high"};
 return x;
}
const full=check(fakeFullSemantics());
assert.equal(full.lineageCompatible,true);
assert.equal(full.subjectAuthorityReady,false);
assert.equal(full.semanticEnvelopeReady,true);
assert.equal(full.admissionGranted,false);
negatives.push("full_synthetic_semantics_still_not_a_grant");

const fakeReady=fakeFullSemantics();
fakeReady.subject.identityResolutionVersion="trust-phase5-admin-subject-review-v1";
const counterfactual=check(fakeReady);
assert.equal(counterfactual.lineageCompatible,true);
assert.equal(counterfactual.subjectAuthorityReady,true);
assert.equal(counterfactual.semanticEnvelopeReady,true);
assert.equal(counterfactual.prerequisiteShapeReady,true);
assert.equal(counterfactual.admissionGranted,false);
negatives.push("synthetic_governed_subject_and_semantics_still_not_a_grant");

assert.deepEqual(negatives,r4b.negativeTestMatrix);

// Existing v1 policy: all five established D2 baseline products must retain GRANT.
const fixture=JSON.parse(fs.readFileSync("fixtures/data-ai29c-d2-sunscreen-initial-admission-v1.json","utf8"));
const sem=JSON.parse(fs.readFileSync("fixtures/data-ai29c-d1b-sunscreen-semantic-projection-v1.json","utf8"));
const semByProduct=new Map(sem.products.map(s=>[s.productId,s]));
assert.equal(fixture.products.length,5);
for(const row of fixture.products){
  const bundle=structuredClone(semByProduct.get(row.product.id));
  assert.ok(bundle);
  bundle.subjectId=row.subject.subjectId;
  const result=evaluateSunscreenInitialAdmissionGrant({
    product:structuredClone(row.product),
    taxonomy:structuredClone(row.taxonomy),
    subject:structuredClone(row.subject),
    registry:structuredClone(row.registry),
    currentFacts:structuredClone(row.currentFacts),
    semanticBundle:bundle
  });
  assert.equal(result.decision,"SUNSCREEN_INITIAL_ADMISSION_GRANT",row.product.name);
  assert.equal(result.grant,true,row.product.name);
}

for(const [k,v] of Object.entries(r4b.invariants))assert.equal(v,true,k);
assert.equal(r4b.nextGate.status,"NOT_STARTED");
assert.equal(r4b.nextGate.admissionEvaluationNotAuthorized,true);

console.log(JSON.stringify({
  status:"PASS",stage:r4b.stage,decision:r4b.decision,
  baselineLineageCompatible:baseline.lineageCompatible,
  baselineSubjectAuthorityReady:baseline.subjectAuthorityReady,
  baselineSemanticReady:baseline.semanticEnvelopeReady,
  testedNegativeAndNonGrantCases:negatives.length,
  legacyAdmissionRegressionGrants:fixture.products.length,
  productionWrites:0,admissionGranted:false,
  nextGate:r4b.nextGate.stage
},null,2));
