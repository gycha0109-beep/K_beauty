import {FACE_LAB_OBSERVATION_DEFINITIONS} from "../lib/face-lab-observation-contract.js";
import {LOCAL_OBSERVATION_REVIEW_VERSION} from "./build-face-lab-style-check-observation-review-sc06f.mjs";
export const SC06G_AUDIT_VERSION="face-lab-sc06g-observation-draft-audit-v1";
const names=new Map(Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS).flatMap(([g,fields])=>Object.entries(fields).map(([f,values])=>[g+"."+f,{values,multi:f==="focalFeatures"}])));
const isObj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
export function auditStyleCheckObservationDraft(input){
 const issues=[],records=[];const flag=(code,sampleRef=null,field=null)=>issues.push({code,...sampleRef?{sampleRef}:{},...field?{field}:{}});
 if(!isObj(input)||input.schemaVersion!==LOCAL_OBSERVATION_REVIEW_VERSION||input.status!=="unsealed_exploratory_local_draft"||input.sourceType!=="manual_unverified_human_inputs"||input.rightsVerified!==false||input.observationValidityConfirmed!==false||input.simulationAuthorized!==false||input.sourcePhotosStored!==false||input.providerCalls!==0||!Array.isArray(input.records)) flag("draft_contract_invalid");
 if(issues.length)return {version:SC06G_AUDIT_VERSION,status:"held",issues,records:[],productionActive:false,simulationAuthorized:false};
 const seen=new Set();
 for(const r of input.records){
  const ref=typeof r?.sampleRef==="string"&&/^P[0-9]{2,4}$/.test(r.sampleRef)?r.sampleRef:null;
  if(!ref||seen.has(ref))flag("sample_ref_invalid_or_duplicate",ref);
  if(ref)seen.add(ref);
  if(!isObj(r)||r.photoLocallyLoaded!==true||!isObj(r.observations)||typeof r.notes!=="string"||r.notes.length>700) {flag("record_invalid",ref);continue;}
  let selected=0,held=0;
  for(const [key,v] of Object.entries(r.observations)){
   const def=names.get(key);
   if(!def){flag("unknown_observation_field",ref,key);continue;}
   if(!isObj(v)||typeof v.reviewerDraftChoice!=="string"||typeof v.evidenceNote!=="string"||v.evidenceNote.length>240||typeof v.held!=="boolean"){flag("observation_entry_invalid",ref,key);continue;}
   const choice=v.reviewerDraftChoice, isHold=choice==="uncertain"||choice==="not_assessable";
   if(v.held!==isHold){flag("hold_flag_mismatch",ref,key);continue;}
   if(!isHold&&!def.values.includes(choice)){flag("observation_choice_invalid",ref,key);continue;}
   if(!isHold&&!v.evidenceNote.trim())flag("observed_value_missing_evidence",ref,key);
   if(def.multi&&!isHold)flag("multiselect_field_requires_canonical_array_review",ref,key);
   selected++;if(isHold)held++;
  }
  if(!selected)flag("no_observation_choices",ref);
  records.push({sampleRef:ref,selectedFieldCount:selected,heldFieldCount:held,unreviewedFieldCount:22-selected});
 }
 return {version:SC06G_AUDIT_VERSION,status:"held",issues,records,reviewerConsensusVerified:false,photoRightsVerified:false,photoQualityVerified:false,observationValidityVerified:false,canonicalAnalysisProduced:false,productionActive:false,simulationAuthorized:false};
}
