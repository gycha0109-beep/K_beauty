#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const STAGE="V2.1-8M", AXIS_KEY="exfoliation_load", TARGET_ID="protocol_scoped_final_product_exfoliation_response_change";
export const START_MAIN_SHA="f7b024b81d2ffcae2082fdadda7399c33c8a1ff7";
export const UPSTREAM_8K_RESULT_SHA256="6b79abb7b72292b16a4c6f8b1a5e420da24f2892dd4e09c7a9ca7ec22f58ffcc";
export const UPSTREAM_8L_CONTRACT_SHA256="07aa89c15039b77763a0e2bd411575279e5867468db7ed9ca1ac34b6f61740d8";
export const OUTPUTS=Object.freeze({
 ledger:"evidence/product-decision-axis-anchor-research-v1/exfoliation-load-targeted-numeric-anchor-source-ledger-wave-1-v1.json",
 result:"evidence/product-decision-axis-anchor-research-v1/exfoliation-load-targeted-numeric-anchor-research-wave-1-v1.json",
 replay:"evidence/product-decision-axis-anchor-research-v1/exfoliation-load-targeted-numeric-anchor-research-replay-wave-1-v1.json",
 doc:"docs/evidence/exfoliation-load-targeted-numeric-anchor-evidence-research-wave-1-v1.md"
});
export const EXPECTED_HASHES=Object.freeze({ledger:"3e04ba5360c9a5247b6240d26784cc25ca7dd1538c413a2115281bfe105fbc2b",result:"f09b8f14b1f457bf2d5f1133a2c26119bf72ba120e2c5e2890a2ec5e4ffd4640",replay:"c2b5c1d0cafff9799f89c6a026ca53b3231d34df297f5ef93912fc5073c87644",doc:"ee04af88ed25c02a359064f1d6cb558f8b724c8fb12c74e40a793a8e20d2be99"});
const TERMINALS=new Set(["COMPARABLE_NUMERIC_ANCHOR_SET_FOUND","PARTIAL_NUMERIC_ANCHOR_SOURCE_GAP","NO_NUMERIC_ANCHOR_SOURCE_FOUND","INCOMPATIBLE_PROTOCOL_FAMILIES_ONLY","ORDINAL_ONLY_ANCHOR_FOUND"]);
const VALID_ID=new Set(["exact","equivalent"]), MISSING=new Set([null,"","none","not_stated","not_stated_on_page","not_applicable","not_stated_for_clinical_study"]);
const inv=(x,m)=>{if(!x)throw new Error(m)};
export const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const canonicalJson=v=>`${JSON.stringify(stable(v))}\n`;
export const sha256Text=v=>crypto.createHash("sha256").update(v,"utf8").digest("hex");
const read=f=>JSON.parse(fs.readFileSync(f,"utf8"));
export const sourceDigestBasis=s=>({source_id:s.source_id,url:s.url,identity_status:s.identity.status,normalized_evidence_statement:s.provenance.normalized_evidence_statement,measurement_candidates:s.measurement.candidates,source_disposition:s.source_disposition});
export function evaluateNumericAnchorCandidate(s,c){
 const reasons=[];
 if(c.numeric_present!==true)reasons.push("NUMERIC_VALUE_ABSENT");
 if(c.target_semantics!==TARGET_ID)reasons.push("TARGET_SEMANTICS_MISMATCH");
 if(c.evidence_class!=="measurement")reasons.push("EVIDENCE_CLASS_NOT_MEASUREMENT");
 if(!VALID_ID.has(s.identity.status))reasons.push("IDENTITY_NOT_EXACT_OR_EQUIVALENT");
 if(s.authority.product_specific!==true)reasons.push("NOT_PRODUCT_SPECIFIC");
 if(s.authority.primary_source!==true)reasons.push("NOT_PRIMARY_SOURCE");
 if(s.authority.authority_level!=="product_specific_primary")reasons.push("AUTHORITY_FLOOR_NOT_MET");
 if(c.final_product_measurement!==true)reasons.push("NOT_FINAL_PRODUCT_MEASUREMENT");
 const key={metric:c.metric,unit:c.unit,method_protocol_family:c.method_protocol_family,baseline_or_comparator_semantics:c.baseline_or_comparator,exposure_protocol:c.exposure_protocol,timepoint:c.timepoint,anatomical_site:c.anatomical_site};
 for(const [k,v] of Object.entries(key))if(MISSING.has(v)||v===undefined)reasons.push(`MISSING_${k.toUpperCase()}`);
 return {eligible:reasons.length===0,reasons,comparability_key:reasons.length?null:key};
}
export function deriveTerminal(ps,comparable){
 const np=ps.filter(x=>x.qualifying_numeric_anchor_count>0).length, n=ps.reduce((a,x)=>a+x.qualifying_numeric_anchor_count,0), o=ps.reduce((a,x)=>a+x.qualifying_ordinal_anchor_count,0);
 if(np===3&&comparable)return "COMPARABLE_NUMERIC_ANCHOR_SET_FOUND";
 if(np===3&&n>=3)return "INCOMPATIBLE_PROTOCOL_FAMILIES_ONLY";
 if(np>0)return "PARTIAL_NUMERIC_ANCHOR_SOURCE_GAP";
 if(o>0)return "ORDINAL_ONLY_ANCHOR_FOUND";
 return "NO_NUMERIC_ANCHOR_SOURCE_FOUND";
}
export function buildResult(l){
 inv(l.stage===STAGE&&l.axis_key===AXIS_KEY,"stage/axis drift");
 inv(l.authority.execution_start_main_sha===START_MAIN_SHA,"main drift");
 inv(l.authority.v21_8k_result_sha256===UPSTREAM_8K_RESULT_SHA256,"8K drift");
 inv(l.authority.v21_8l_contract_sha256===UPSTREAM_8L_CONTRACT_SHA256,"8L drift");
 inv(l.target_contract.target_id===TARGET_ID&&l.exact_cohort.length===3,"target/cohort drift");
 inv(new Set(l.exact_cohort.map(x=>x.product_id)).size===3,"duplicate cohort");
 inv(l.research_completeness.all_three_products_searched&&l.research_completeness.minimum_query_families_per_product>=8,"research incomplete");
 const byProduct=new Map(), srcCounts=new Map(), reasonCounts=new Map();
 for(const s of l.sources){
  inv(s.url&&s.publisher&&s.source_title&&s.provenance.normalized_evidence_statement,`provenance ${s.source_id}`);
  inv(s.provenance.normalized_digest_sha256===sha256Text(canonicalJson(sourceDigestBasis(s))),`digest ${s.source_id}`);
  (byProduct.get(s.product_id)||byProduct.set(s.product_id,[]).get(s.product_id)).push(s);
  srcCounts.set(s.source_disposition,(srcCounts.get(s.source_disposition)||0)+1);
 }
 const findings=l.exact_cohort.map(p=>{
  const ss=(byProduct.get(p.product_id)||[]).sort((a,b)=>a.source_id.localeCompare(b.source_id)); inv(ss.length,`source gap ${p.product_id}`);
  const q=[], rejected=[], blockers=new Set();
  for(const s of ss){
   if(s.source_disposition.startsWith("REJECTED_NO_QUALIFYING"))blockers.add("NO_QUALIFYING_EXFOLIATION_RESPONSE_MEASUREMENT");
   for(const b of s.secondary_blockers||[])blockers.add(b);
   for(const c of s.measurement.candidates){
    const e=evaluateNumericAnchorCandidate(s,c);
    if(e.eligible)q.push({source_id:s.source_id,candidate_id:c.candidate_id,comparability_key:e.comparability_key});
    else {for(const r of c.rejection_reasons||[])reasonCounts.set(r,(reasonCounts.get(r)||0)+1);rejected.push({source_id:s.source_id,candidate_id:c.candidate_id,metric:c.metric,value:c.value??null,range:c.range??null,unit:c.unit??null,rejection_reasons:c.rejection_reasons||[]});}
   }
  }
  if(!q.length&&!blockers.size)blockers.add("NO_QUALIFYING_EXFOLIATION_RESPONSE_MEASUREMENT");
  return {product_id:p.product_id,canonical_product_name:p.canonical_product_name,brand:p.brand,category:p.category,subject_id:p.subject_id,cohort_role:p.cohort_role,category_topology_role:p.category_topology_role,identity_status:p.identity_status,source_ids:ss.map(x=>x.source_id),source_count:ss.length,qualifying_numeric_anchor_count:q.length,qualifying_ordinal_anchor_count:0,disposition:q.length?"NUMERIC_ANCHOR_FOUND":"NO_QUALIFYING_ANCHOR_FOUND",qualifying_anchor:q[0]||null,rejected_numeric_candidates:rejected,blocker_reasons:[...blockers].sort()};
 }).sort((a,b)=>a.product_id.localeCompare(b.product_id));
 const admitted=findings.flatMap(x=>x.qualifying_anchor?[x.qualifying_anchor]:[]); let comparable=false,key=null;
 if(admitted.length>=3&&findings.every(x=>x.qualifying_numeric_anchor_count)){const ks=admitted.map(x=>canonicalJson(x.comparability_key));comparable=new Set(ks).size===1;if(comparable)key=admitted[0].comparability_key;}
 const terminal=deriveTerminal(findings,comparable);inv(TERMINALS.has(terminal),"terminal");
 const invariants={hosted_product_fact_writes_v21_8m:0,registry_definition_delta_v21_8m:0,migration_delta_v21_8m:0,hosted_subject_delta_v21_8m:0,hosted_evidence_delta_v21_8m:0,hosted_current_delta_v21_8m:0,numeric_fitting_v21_8m:0,pda_production_calibration_v21_8m:0,decision_axis_production_consumption_v21_8m:0,recommendation_scorer_changed:false,recommendation_activated:false,candidate_policy_changed:false};
 return {version:"exfoliation-load-targeted-numeric-anchor-research-wave-1-v1",stage:STAGE,axis_key:AXIS_KEY,authority:{repository:l.authority.repository,execution_start_main_sha:START_MAIN_SHA,v21_8k_result_sha256:UPSTREAM_8K_RESULT_SHA256,v21_8l_contract_sha256:UPSTREAM_8L_CONTRACT_SHA256,registry_version:l.authority.registry_version,registry_checksum:l.authority.registry_checksum,exact_cohort_product_ids:l.exact_cohort.map(x=>x.product_id)},research_summary:{exact_product_count:findings.length,external_source_count:l.sources.length,official_or_primary_source_count:l.sources.filter(x=>["official_brand","primary_publication"].includes(x.official_or_primary_classification)).length,qualifying_source_count:new Set(admitted.map(x=>x.source_id)).size,rejected_source_count:l.sources.length-new Set(admitted.map(x=>x.source_id)).size,qualifying_numeric_anchor_count:admitted.length,qualifying_ordinal_anchor_count:0,rejected_numeric_candidate_count:findings.reduce((a,x)=>a+x.rejected_numeric_candidates.length,0),rejected_source_reason_breakdown:Object.fromEntries([...srcCounts].sort()),rejected_candidate_reason_breakdown:Object.fromEntries([...reasonCounts].sort()),research_complete:true},per_product_findings:findings,comparability:{required_dimensions:l.target_contract.required_dimensions,admitted_numeric_anchor_count:admitted.length,products_with_admitted_numeric_anchor:findings.filter(x=>x.qualifying_numeric_anchor_count).length,comparable_family_found:comparable,comparable_family_key:key,family_count:comparable?1:0,analysis_status:admitted.length?comparable?"COMPARABLE_FAMILY_FOUND":"NO_SINGLE_COMPARABLE_FAMILY":"NOT_CONSTRUCTIBLE_NO_ADMITTED_TARGET_ANCHORS",blockers:admitted.length?comparable?[]:["PROTOCOL_FAMILY_INCOMPATIBILITY"]:["NO_ADMITTED_FINAL_PRODUCT_EXFOLIATION_RESPONSE_NUMERIC_ANCHOR","NO_THREE_PRODUCT_COMPARABILITY_ANALYSIS_POSSIBLE"],arbitrary_normalization_applied:false,cross_protocol_normalization_applied:false,cross_active_potency_mapping_applied:false},stage_terminal_outcome:terminal,stage_disposition:{all_three_products_terminally_researched:findings.every(x=>x.disposition),all_three_products_have_qualifying_numeric_anchor:findings.every(x=>x.qualifying_numeric_anchor_count>0),authoritative_ordinal_only_set_found:false,numeric_calibration_entry_gate_satisfied:terminal==="COMPARABLE_NUMERIC_ANCHOR_SET_FOUND",calibration_executed:false,registry_definition_published:false,hosted_mutation_performed:false},invariants,next_stage_recommendation:{stage:"Exfoliation Load Calibration Feasibility Reassessment",execute_now:false,reason:"No qualifying product-specific numeric or authoritative ordinal exfoliation-response anchor was found for any exact cohort product."}};
}
export function buildReplay(l,r,lh,rh){return {version:"exfoliation-load-targeted-numeric-anchor-research-replay-wave-1-v1",stage:STAGE,axis_key:AXIS_KEY,input:{source_ledger_path:OUTPUTS.ledger,source_ledger_sha256:lh,upstream_8l_contract_sha256:UPSTREAM_8L_CONTRACT_SHA256},replay:{exact_product_count:r.research_summary.exact_product_count,product_dispositions:r.per_product_findings.map(x=>({product_id:x.product_id,disposition:x.disposition,qualifying_numeric_anchor_count:x.qualifying_numeric_anchor_count,qualifying_ordinal_anchor_count:x.qualifying_ordinal_anchor_count})),external_source_count:r.research_summary.external_source_count,qualifying_source_count:r.research_summary.qualifying_source_count,qualifying_numeric_anchor_count:r.research_summary.qualifying_numeric_anchor_count,qualifying_ordinal_anchor_count:r.research_summary.qualifying_ordinal_anchor_count,comparable_family_found:r.comparability.comparable_family_found,comparable_family_count:r.comparability.family_count,stage_terminal_outcome:r.stage_terminal_outcome},research_result:{path:OUTPUTS.result,sha256:rh},determinism:{canonical_json:"recursive_key_sort_utf8_lf",stable_source_ids:true,stable_cohort_ids:true,stable_sorting:true,live_web_fetch_in_replay:false,build_a_equals_build_b_required:true},invariants:r.invariants,next_stage_recommendation:{stage:r.next_stage_recommendation.stage,execute_now:false}}}
export function buildAll(){const l=read(OUTPUTS.ledger),lt=canonicalJson(l),lh=sha256Text(lt),r=buildResult(l),rt=canonicalJson(r),rh=sha256Text(rt),rp=buildReplay(l,r,lh,rh),rpt=canonicalJson(rp),doc=fs.readFileSync(OUTPUTS.doc,"utf8"),rendered={ledger:lt,result:rt,replay:rpt,doc};for(const [k,h] of Object.entries(EXPECTED_HASHES))inv(sha256Text(rendered[k])===h,`${k} canonical hash drift`);return {ledger:l,result:r,replay:rp,doc,rendered};}
export function writeAll(root=process.env.V21_8M_OUTPUT_ROOT||"."){const b=buildAll();for(const [k,p]of Object.entries(OUTPUTS)){const t=path.join(root,p);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,b.rendered[k],"utf8")}return b;}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);if(isMain){const b=writeAll();console.log(JSON.stringify({status:"PASS",stage:STAGE,axis_key:AXIS_KEY,source_count:b.result.research_summary.external_source_count,qualifying_numeric_anchor_count:b.result.research_summary.qualifying_numeric_anchor_count,primary_outcome:b.result.stage_terminal_outcome,hashes:EXPECTED_HASHES}))}
