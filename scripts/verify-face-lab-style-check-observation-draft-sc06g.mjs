import assert from "node:assert/strict";
import {auditStyleCheckObservationDraft} from "./audit-face-lab-style-check-observation-draft-sc06g.mjs";
const base={schemaVersion:"face-lab-sc06f-local-observation-draft-v1",status:"unsealed_exploratory_local_draft",sourceType:"manual_unverified_human_inputs",rightsVerified:false,observationValidityConfirmed:false,simulationAuthorized:false,sourcePhotosStored:false,providerCalls:0,records:[{sampleRef:"P01",photoLocallyLoaded:true,notes:"",observations:{"outline.jawlineAngularity":{reviewerDraftChoice:"soft",evidenceNote:"visible contour",held:false},"eyes.eyeOpenness":{reviewerDraftChoice:"uncertain",evidenceNote:"",held:true}}}]};
const run=x=>auditStyleCheckObservationDraft(x);
assert.equal(run(base).status,"held");assert.equal(run(base).issues.length,0);assert.equal(run(base).records[0].selectedFieldCount,2);
assert.equal(run(base).canonicalAnalysisProduced,false);assert.equal(run(base).simulationAuthorized,false);
for(const [change,expected] of [[x=>x.rightsVerified=true,"draft_contract_invalid"],[x=>x.records[0].observations["eyes.eyeOpenness"].held=false,"hold_flag_mismatch"],[x=>x.records[0].observations["outline.jawlineAngularity"].evidenceNote="","observed_value_missing_evidence"],[x=>x.records[0].observations["featureLayout.focalFeatures"]={reviewerDraftChoice:"eyes",evidenceNote:"eyes",held:false},"multiselect_field_requires_canonical_array_review"],[x=>x.records[0].observations["outline.jawlineAngularity"].reviewerDraftChoice="bogus","observation_choice_invalid"],[x=>x.records[0].observations["unknown.field"]={reviewerDraftChoice:"soft",evidenceNote:"x",held:false},"unknown_observation_field"]]){
 const x=structuredClone(base);change(x);assert.ok(run(x).issues.some(y=>y.code===expected),expected);
}
console.log(JSON.stringify({ok:true,tests:8,status:"held",productionActive:false,providerCalls:0}));
