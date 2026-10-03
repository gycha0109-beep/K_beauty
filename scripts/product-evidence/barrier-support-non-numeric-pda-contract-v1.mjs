#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const VERSION="barrier-support-non-numeric-pda-contract-v1";
export const STAGE="V2.1-8H-R3";
export const AXIS_KEY="barrier_support";
export const CONTRACT_MODE="STRUCTURED_CATEGORICAL";
export const PRIMARY_TERMINAL_OUTCOME="NON_NUMERIC_BARRIER_SUPPORT_PDA_CONTRACT_FROZEN";
export const APPLICABLE_CATEGORIES=Object.freeze([
  "moisturizer_balm","moisturizer_cream","moisturizer_gel","moisturizer_lotion_emulsion"
]);
export const SIGNAL_STATES=Object.freeze([
  "GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE",
  "GOVERNED_BARRIER_CLAIM_ESTABLISHED_FALSE",
  "GOVERNED_BARRIER_CLAIM_UNKNOWN",
  "GOVERNED_BARRIER_CLAIM_BLOCKED",
  "NOT_APPLICABLE"
]);
export const OUTPUTS=Object.freeze({
  contract:"evidence/product-decision-axis-non-numeric-contract-v2/barrier-support-non-numeric-pda-contract-v1.json",
  examples:"evidence/product-decision-axis-non-numeric-contract-v2/barrier-support-non-numeric-pda-examples-v1.json",
  replay:"evidence/product-decision-axis-non-numeric-contract-v2/barrier-support-non-numeric-pda-replay-v1.json",
  doc:"docs/evidence/v21-8h-r3-barrier-support-non-numeric-pda-contract-closeout-v1.md"
});

function invariant(condition,message){if(!condition) throw new Error(message);}
export function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==="object") return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
export function canonicalJson(value){return `${JSON.stringify(stable(value))}\n`;}
export function sha256(text){return crypto.createHash("sha256").update(text,"utf8").digest("hex");}

function scopeOf(fact){
  const scope=fact?.scope||{};
  return {
    market:scope.market??null,
    region:scope.region??null,
    locale:scope.locale??null,
    valid_from:scope.valid_from??null,
    valid_to:scope.valid_to??null
  };
}
function scopeDimensionDisjoint(a,b,key){
  return a[key]!=null&&b[key]!=null&&a[key]!==b[key];
}
function scopesDisjoint(a,b){
  return ["market","region","locale"].some(key=>scopeDimensionDisjoint(a,b,key));
}
function compactProvenance(fact,role){
  return {
    subject_id:fact.subject_id??null,
    fact_instance_id:fact.fact_instance_id??null,
    confirmation_id:fact.confirmation_id??null,
    proposition_key:fact.proposition_key??null,
    fact_key:fact.fact_key,
    semantic_status:fact.semantic_status??null,
    typed_value:fact.semantic_status==="supported" ? fact.typed_value : null,
    authority_ceiling:fact.authority_ceiling??"none",
    fused_confidence:fact.fused_confidence??"unknown",
    fusion_input_digest:fact.fusion_input_digest??null,
    scope:scopeOf(fact),
    mapper_input_role:role
  };
}
function supportedFacts(facts){return facts.filter(x=>x?.presence==="current"&&x.semantic_status==="supported");}
function statusReasons(facts){
  const statuses=new Set(facts.filter(x=>x?.presence==="current").map(x=>x.semantic_status));
  const reasons=[];
  if(statuses.has("reviewed_not_established")) reasons.push("REVIEWED_NOT_ESTABLISHED");
  if(statuses.has("not_reviewed")) reasons.push("NOT_REVIEWED");
  if(statuses.has("evidence_insufficient")) reasons.push("EVIDENCE_INSUFFICIENT");
  return reasons;
}
function mapRoleContext(roleFacts){
  const current=(roleFacts||[]).filter(x=>x?.presence==="current");
  if(current.some(x=>x.semantic_status==="evidence_conflict")){
    return {state:"BLOCKED",items:[],reasons:["PRIMARY_USE_ROLE_UNRESOLVED"]};
  }
  const supported=supportedFacts(current);
  if(!supported.length){
    return {state:current.length?"UNKNOWN":"MISSING",items:[],reasons:["PRIMARY_USE_ROLE_MISSING"]};
  }
  const items=supported.map(f=>{
    invariant(f.fact_key==="primary_use_role","primary_use_role context fact_key mismatch");
    invariant(typeof f.typed_value==="string"&&f.typed_value.length>0,"supported primary_use_role requires enum value");
    return {value:f.typed_value,provenance:compactProvenance(f,"CONTEXT")};
  }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {state:"ESTABLISHED",items,reasons:[]};
}
function baseOutput(input){
  return {
    axis_key:AXIS_KEY,
    contract_version:VERSION,
    contract_mode:CONTRACT_MODE,
    product_id:input.product_id??null,
    category:input.category??null,
    subject_scope:input.subject_scope??null,
    signal:{state:null,value:null,authority_ceiling:"none"},
    context:{primary_use_role:{state:"MISSING",items:[]}},
    coverage:{state:null},
    numeric_estimate:null,
    ordinal_magnitude:null,
    effect_strength:null,
    uncertainty:{reasons:[]},
    evidence_provenance:[],
    scope_resolution:{state:"NO_SIGNAL",fact_scopes:[]},
    legacy_numeric_contribution:"PROHIBITED",
    production_consumption:"NO"
  };
}
export function mapBarrierSupportNonNumericPda(input){
  invariant(input&&typeof input==="object","input required");
  invariant(typeof input.product_id==="string"&&input.product_id.length>0,"product_id required");
  const out=baseOutput(input);
  const category=input.category??null;
  if(category==null){
    out.signal.state="GOVERNED_BARRIER_CLAIM_UNKNOWN";
    out.coverage.state="category_unknown";
    out.uncertainty.reasons=["CATEGORY_UNKNOWN"];
    return out;
  }
  if(!APPLICABLE_CATEGORIES.includes(category)){
    out.signal.state="NOT_APPLICABLE";
    out.coverage.state="not_applicable";
    out.scope_resolution.state="NOT_APPLICABLE";
    return out;
  }
  if(input.identity_status!=="resolved"||input.subject_current_state!=="current"){
    out.signal.state="GOVERNED_BARRIER_CLAIM_BLOCKED";
    out.coverage.state="identity_blocked";
    out.uncertainty.reasons=["IDENTITY_BLOCKED"];
    out.scope_resolution.state="CONFLICT_BLOCKED";
    return out;
  }

  const claimFacts=(input.claim_facts||[]).filter(Boolean);
  const role=mapRoleContext(input.primary_use_role_facts||[]);
  out.context.primary_use_role={state:role.state,items:role.items};
  const roleProv=role.items.map(x=>x.provenance);

  const conflicts=claimFacts.filter(x=>x.presence==="current"&&x.semantic_status==="evidence_conflict");
  if(conflicts.length){
    out.signal.state="GOVERNED_BARRIER_CLAIM_BLOCKED";
    out.coverage.state="conflict_blocked";
    out.uncertainty.reasons=["CONFLICTING_GOVERNED_FACT",...role.reasons];
    out.evidence_provenance=[
      ...conflicts.map(f=>compactProvenance(f,"SIGNAL")),
      ...roleProv
    ];
    out.scope_resolution={
      state:"CONFLICT_BLOCKED",
      fact_scopes:conflicts.map(scopeOf)
    };
    return out;
  }

  const supported=supportedFacts(claimFacts);
  for(const f of supported){
    invariant(f.fact_key==="barrier_support_claim","barrier signal fact_key mismatch");
    invariant(f.value_type==="boolean","barrier supported claim must be boolean");
    invariant(typeof f.typed_value==="boolean","barrier supported claim requires boolean typed_value");
  }
  if(supported.length){
    const prov=supported.map(f=>compactProvenance(f,"SIGNAL"));
    out.evidence_provenance=[...prov,...roleProv];
    out.scope_resolution.fact_scopes=supported.map(scopeOf);
    if(supported.some(f=>f.authority_ceiling!=="product_specific_primary")){
      out.signal.state="GOVERNED_BARRIER_CLAIM_UNKNOWN";
      out.coverage.state="insufficient_fact";
      out.uncertainty.reasons=["AUTHORITY_BELOW_PRODUCT_SPECIFIC_PRIMARY",...role.reasons];
      out.scope_resolution.state="NO_SIGNAL";
      return out;
    }
    const values=[...new Set(supported.map(f=>f.typed_value))];
    if(values.length>1){
      const oppositePairs=[];
      for(let i=0;i<supported.length;i++) for(let j=i+1;j<supported.length;j++){
        if(supported[i].typed_value!==supported[j].typed_value) oppositePairs.push([supported[i],supported[j]]);
      }
      const allDisjoint=oppositePairs.length>0&&oppositePairs.every(([a,b])=>scopesDisjoint(scopeOf(a),scopeOf(b)));
      if(allDisjoint){
        out.signal.state="GOVERNED_BARRIER_CLAIM_UNKNOWN";
        out.coverage.state="scope_context_required";
        out.uncertainty.reasons=["SCOPE_CONTEXT_REQUIRED",...role.reasons];
        out.scope_resolution.state="CONTEXT_REQUIRED";
        return out;
      }
      out.signal.state="GOVERNED_BARRIER_CLAIM_BLOCKED";
      out.coverage.state="conflict_blocked";
      out.uncertainty.reasons=["CONFLICTING_GOVERNED_FACT",...role.reasons];
      out.scope_resolution.state="CONFLICT_BLOCKED";
      return out;
    }
    const value=values[0];
    out.signal.state=value
      ?"GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE"
      :"GOVERNED_BARRIER_CLAIM_ESTABLISHED_FALSE";
    out.signal.value=value;
    out.signal.authority_ceiling="product_specific_primary";
    out.coverage.state=value
      ?(role.state==="ESTABLISHED"?"claim_with_usage_role_context":"claim_only")
      :(role.state==="ESTABLISHED"?"explicit_negative_with_usage_role_context":"explicit_negative_claim_only");
    out.uncertainty.reasons=[...role.reasons];
    out.scope_resolution.state="SINGLE_VALUE";
    return out;
  }

  out.signal.state="GOVERNED_BARRIER_CLAIM_UNKNOWN";
  out.signal.value=null;
  const reasons=statusReasons(claimFacts);
  if(!claimFacts.length||claimFacts.every(x=>x.presence==="missing_current")){
    reasons.unshift("SOURCE_BLOCKED_OR_MISSING_CURRENT");
    out.coverage.state="missing_fact";
  }else{
    out.coverage.state="insufficient_fact";
  }
  out.uncertainty.reasons=[...new Set([...reasons,...role.reasons])];
  out.evidence_provenance=[
    ...claimFacts.filter(x=>x.presence==="current").map(f=>compactProvenance(f,"SIGNAL")),
    ...roleProv
  ];
  out.scope_resolution={
    state:"NO_SIGNAL",
    fact_scopes:claimFacts.filter(x=>x.presence==="current").map(scopeOf)
  };
  return out;
}

export function buildAll(){
  const rendered={};
  for(const [key,rel] of Object.entries(OUTPUTS)){
    const raw=fs.readFileSync(rel,"utf8");
    rendered[key]=key==="doc"?raw:canonicalJson(JSON.parse(raw));
  }
  return {
    contract:JSON.parse(rendered.contract),
    examples:JSON.parse(rendered.examples),
    replay:JSON.parse(rendered.replay),
    doc:rendered.doc,
    rendered,
    hashes:Object.fromEntries(Object.entries(rendered).map(([k,v])=>[k,sha256(v)]))
  };
}
export function writeAll(root=process.env.V21_8H_R3_OUTPUT_ROOT||"."){
  const built=buildAll();
  for(const [key,rel] of Object.entries(OUTPUTS)){
    const target=path.join(root,rel);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,built.rendered[key],"utf8");
  }
  return built;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const built=writeAll();
  console.log(JSON.stringify({status:"PASS",stage:STAGE,axis_key:AXIS_KEY,primary_terminal_outcome:PRIMARY_TERMINAL_OUTCOME,hashes:built.hashes}));
}
