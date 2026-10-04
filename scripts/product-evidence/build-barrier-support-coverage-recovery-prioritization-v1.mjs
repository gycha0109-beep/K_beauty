#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STAGE="V2.1-8H-R8";
export const TERMINAL="BARRIER_SUPPORT_COVERAGE_RECOVERY_PRIORITIZATION_FROZEN";
export const INPUT="evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-coverage-recovery-priority-input-v1.json";
export const OUT={
  queue:"evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-coverage-recovery-priority-queue-v1.json",
  summary:"evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-coverage-recovery-prioritization-summary-v1.json"
};
export const BAND_ORDER=["P0_PRIMARY_FULL_CONTEXT_READY","P1_FULL_CONTEXT_BOUND_SOURCE","P2_FULL_CONTEXT_SOURCE_HINT","P3_FULL_CONTEXT_SOURCE_GAP","P3_PARTIAL_CONTEXT_SOURCE_READY","P4_LOWER_PRIORITY"];

function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
export function canonical(v){return `${JSON.stringify(stable(v))}\n`;}
function rowsToObjects(schema,rows){return rows.map(r=>Object.fromEntries(schema.map((k,i)=>[k,r[i]])));}
const SCENARIOS=[{"id":"U2","axes":["dehydration"]},{"id":"U3","axes":["dehydration"]},{"id":"U4","axes":["barrier","dehydration"]},{"id":"U5","axes":["barrier"]},{"id":"U6","axes":["barrier"]},{"id":"U7","axes":["dehydration"]},{"id":"U9","axes":["dehydration"]},{"id":"U10","axes":["barrier","dehydration"]},{"id":"U11","axes":["barrier","dehydration"]}];
function reach(x){const c=new Set(x.concerns||[]);return SCENARIOS.filter(s=>s.axes.some(a=>c.has(a))).length;}
function sourceClass(x){
  if(x.binding_url_count>0||x.source_url_present===true) return "BOUND_URL";
  if(x.binding_count>0||x.hwahae_url_present===true||String(x.external_source||"").trim()) return "SOURCE_HINT";
  return "NO_SOURCE_HINT";
}
function attention(n){return n>=10000?"VERY_HIGH":n>=1000?"HIGH":n>=100?"MEDIUM":"LOW";}
function band(x){
  const r=reach(x),s=sourceClass(x),p=x.is_primary_moisturizer===true;
  if(r===9&&p&&s!=="NO_SOURCE_HINT") return "P0_PRIMARY_FULL_CONTEXT_READY";
  if(r===9&&s==="BOUND_URL") return "P1_FULL_CONTEXT_BOUND_SOURCE";
  if(r===9&&s==="SOURCE_HINT") return "P2_FULL_CONTEXT_SOURCE_HINT";
  if(r===9&&s==="NO_SOURCE_HINT") return "P3_FULL_CONTEXT_SOURCE_GAP";
  if(r===7&&s!=="NO_SOURCE_HINT") return "P3_PARTIAL_CONTEXT_SOURCE_READY";
  return "P4_LOWER_PRIORITY";
}

export function build(){
  const input=JSON.parse(fs.readFileSync(INPUT,"utf8"));
  const holds=new Map((input.historical_hold_guards||[]).map(x=>[x.product_id,x]));
  const rows=rowsToObjects(input.row_schema,input.rows);
  const queue=rows.map(x=>{
    const h=holds.get(x.product_id)||null;
    return {
      product_id:x.product_id,brand:x.brand,name:x.name,category:x.category,
      priority_band:band(x),context_reach_scenarios:reach(x),
      explicit_primary_moisturizer:x.is_primary_moisturizer===true,
      source_research_readiness:sourceClass(x),
      market_attention_band:attention(x.market_review_count),
      market_review_count:x.market_review_count,
      recommendation_tier_trace:x.recommendation_tier,
      concerns:x.concerns||[],balm_usage_scope:x.balm_usage_scope,
      balm_research_confidence:x.balm_research_confidence,
      historical_hold:h?{decision:h.decision,reason_code:h.reason_code}:null,
      subject_registration_authorized:false,product_fact_write_authorized:false,research_only:true
    };
  }).sort((a,b)=>BAND_ORDER.indexOf(a.priority_band)-BAND_ORDER.indexOf(b.priority_band)||b.market_review_count-a.market_review_count||a.product_id.localeCompare(b.product_id))
    .map((x,i)=>({...x,research_order:i+1}));

  const count=k=>queue.reduce((o,x)=>{const v=k(x);o[v]=(o[v]||0)+1;return o;},{});
  const p0=queue.filter(x=>x.priority_band==="P0_PRIMARY_FULL_CONTEXT_READY");
  const queueArtifact={
    stage:STAGE,version:"barrier-support-coverage-recovery-priority-queue-v1",
    ordering_contract:{
      type:"LEXICOGRAPHIC_RESEARCH_PRIORITY_ONLY",
      keys:["priority_band_fixed_order","market_review_count_desc_within_band","product_id_asc"],
      numeric_product_fact_calibration:false,recommendation_ranking_authority:false,product_fact_truth_authority:false
    },
    priority_band_order:BAND_ORDER,queue
  };
  const summary={
    stage:STAGE,version:"barrier-support-coverage-recovery-prioritization-summary-v1",
    primary_terminal_outcome:TERMINAL,
    source_r7_terminal:"BARRIER_SUPPORT_SHADOW_CONSUMPTION_EVALUATION_VALIDATED",
    blocked_candidates:queue.length,
    context_reach_distribution:count(x=>String(x.context_reach_scenarios)),
    source_research_readiness_distribution:count(x=>x.source_research_readiness),
    priority_band_distribution:count(x=>x.priority_band),
    explicit_primary_moisturizer_count:queue.filter(x=>x.explicit_primary_moisturizer).length,
    historical_hold_guard_count:(input.historical_hold_guards||[]).length,
    historical_hold_product_ids:(input.historical_hold_guards||[]).map(x=>x.product_id),
    p0_wave:{
      count:p0.length,product_ids:p0.map(x=>x.product_id),
      products:p0.map(x=>({product_id:x.product_id,brand:x.brand,name:x.name,market_review_count:x.market_review_count,source_research_readiness:x.source_research_readiness}))
    },
    authority_boundary:{
      research_queue_only:true,source_locator_is_not_official_fact_authority:true,
      market_attention_is_not_fact_truth:true,recommendation_tier_not_used_for_ordering:true,
      historical_hold_not_auto_released:true,subject_registration_authorized:false,
      product_fact_write_authorized:false,recommendation_behavior_change_authorized:false,public_activation:false
    },
    production_invariance:{
      score_delta:0,ranking_delta:0,eligibility_delta:0,candidate_policy_delta:0,
      public_response_delta:0,persistence_delta:0,pda_production_consumption:"NO",recommendation_activation:"NO"
    },
    hosted_invariance:{subject_writes:0,product_fact_writes:0,registry_definition_delta:0,migration_delta:0},
    next_gate:{stage:"V2.1-8H-R9_BARRIER_SUPPORT_P0_OFFICIAL_IDENTITY_AUTHORITY_RESEARCH",status:"RECOMMENDED_NOT_EXECUTED",product_count:p0.length}
  };
  return {queue:queueArtifact,summary};
}
export function writeAll(root="."){const b=build();for(const [k,p] of Object.entries(OUT)){const t=path.join(root,p);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,canonical(b[k]),"utf8");}return b;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const b=writeAll();console.log(JSON.stringify({status:"PASS",stage:STAGE,terminal:TERMINAL,p0:b.summary.p0_wave.count,blocked:b.summary.blocked_candidates}));}
