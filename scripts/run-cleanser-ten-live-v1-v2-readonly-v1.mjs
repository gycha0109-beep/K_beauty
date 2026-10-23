#!/usr/bin/env node
/**
 * Complete v1 scoped DB audit, v2 authority HOLD projection.
 *
 * Safety:
 *  - Explicit exact ten UUIDs from an authorized server only.
 *  - No dotenv, no browser, no site crawling, no site-use assumption.
 *  - A separate transport permits only GET to an explicit PostgREST allowlist.
 *  - No raw URL/ingredient/review/customer payload is printed or persisted.
 *  - R4 same-formula proof is NOT inferred from volume/name/site links.
 *
 * Authorized server usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/run-cleanser-ten-live-v1-v2-readonly-v1.mjs --ids=<ten comma-separated UUIDs>
 */
import {createClient} from "@supabase/supabase-js";
import {compareExistingTenCleanserPreflightsV1}
  from "../lib/cleanser-ten-preflight-v1-v2-diff-v1.mjs";
import {evaluateCleanserInitialAdmissionPreflight}
  from "../lib/cleanser-initial-admission-preflight-v1.mjs";
import {createCleanserSelectOnlyFetchV1}
  from "../lib/trust/cleanser-hosted-select-only-transport-v1.mjs";

const VERSION="cleanser-ten-live-v1-v2-readonly-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if(process.argv.length!==3||!process.argv[2].startsWith("--ids="))
  throw new Error("EXPLICIT_EXACT_TEN_PRODUCT_UUIDS_REQUIRED");
const ids=process.argv[2].slice(6).split(",").map(x=>x.trim());
if(ids.length!==10||ids.some(x=>!UUID.test(x))||new Set(ids).size!==10)
  throw new Error("TEN_DISTINCT_UUIDS_REQUIRED");
const baseUrl=process.env.SUPABASE_URL;
const serverKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!baseUrl||!serverKey)throw new Error("AUTHORIZED_SERVER_CREDENTIALS_REQUIRED");
const supabase=createClient(baseUrl,serverKey,{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:createCleanserSelectOnlyFetchV1({baseUrl,fetchImpl:fetch})}
});
async function read(builder,label,cap){
  const {data,error}=await builder.limit(cap);
  if(error||!Array.isArray(data))throw new Error("SELECT_FAILED:"+label+":"+(error?.code||"UNKNOWN"));
  if(data.length>=cap)throw new Error("SELECT_CAP_REACHED:"+label);
  return data;
}
const products=await read(supabase.from("products").select(
  "id,category,brand,name,normalized_brand,normalized_name,size_ml,source_url,hwahae_url,skin_types,concerns,review_signals,market_signals,ingredient_signals"
).in("id",ids),"products",11);
if(products.length!==10||products.some(p=>p.category!=="cleanser"))
  throw new Error("EXACT_TEN_EXISTING_CLEANSERS_REQUIRED");
const cohortIds=new Set(ids);
const {count,error:countError}=await supabase.from("products")
  .select("id",{head:true,count:"exact"}).eq("category","cleanser");
if(countError||!Number.isSafeInteger(count)||count<10||count>=1000)
  throw new Error("FULL_CLEANSER_CATALOG_SCOPE_REQUIRED");
const catalogProducts=await read(supabase.from("products")
  .select("id,normalized_brand,normalized_name").eq("category","cleanser"),
  "catalog_products",1000);
if(catalogProducts.length!==count)throw new Error("INCOMPLETE_DUPLICATE_CATALOG_SCOPE");
const intakes=await read(supabase.from("catalog_trust_intake")
  .select("id,product_id,created_at,subject_id,identity_state,trust_state")
  .in("product_id",ids),"intakes",101);
if(intakes.length!==10||intakes.some(x=>!cohortIds.has(x.product_id))||
   products.some(p=>intakes.filter(x=>x.product_id===p.id).length!==1))
  throw new Error("EXISTING_TEN_INTAKE_SCOPE_DRIFT");
const tasks=await read(supabase.from("product_fact_research_tasks")
  .select("id,product_id,fact_key,state,blocker_code")
  .in("product_id",ids),"research_tasks",101);
if(tasks.length!==20||products.some(p=>{
  const scoped=tasks.filter(t=>t.product_id===p.id);
  return scoped.length!==2||
    scoped.map(t=>t.fact_key).sort().join("|")!=="deep_cleansing|low_ph";
}))throw new Error("EXISTING_TWENTY_RESEARCH_TASK_SCOPE_DRIFT");
const subjects=await read(supabase.from("product_fact_subjects")
  .select("subject_id,product_id,identity_status,current_state,market_applicability,formulation_revision_key")
  .in("product_id",ids),"subjects",101);
const official_bindings=await read(supabase.from("product_source_bindings")
  .select("binding_id,product_id,source_name,source_url,binding_state,product_scope_state")
  .in("product_id",ids),"official_bindings",201);
const observations=await read(supabase.from("trust_source_observations")
  .select("observation_id,product_id,subject_id,source_binding_id,canonical_locator,market,source_kind,source_content_digest,fetched_at,product_identity_observation")
  .in("product_id",ids),"observations",501);

// Mirror the *original* governed Fact materialization, never synthesize a Fact
// from product copy, price or a market signal.
const subjectIds=[...new Set(subjects.map(x=>x.subject_id))];
let confirmed_facts=[];
if(subjectIds.length){
  const rows=await read(supabase.from("product_fact_current")
    .select("subject_id,confirmation_id,fact_instance_id,proposition_key")
    .in("subject_id",subjectIds),"current_facts",501);
  const factIds=[...new Set(rows.map(x=>x.fact_instance_id))];
  const confirmIds=[...new Set(rows.map(x=>x.confirmation_id))];
  const instances=factIds.length?await read(supabase.from("product_fact_instances")
    .select("subject_id,fact_instance_id,fact_key,proposition_key,semantic_status,authority_ceiling,fused_confidence,registry_version,valid_from,valid_to")
    .in("fact_instance_id",factIds),"fact_instances",501):[];
  const confirmations=confirmIds.length?await read(supabase.from("product_fact_confirmations")
    .select("confirmation_id,result").in("confirmation_id",confirmIds),"confirmations",501):[];
  if(instances.length!==factIds.length||confirmations.length!==confirmIds.length)
    throw new Error("INCOMPLETE_GOVERNED_FACT_AUTHORITY_JOIN");
  const byInstance=new Map(instances.map(x=>[x.fact_instance_id,x]));
  const byConfirm=new Map(confirmations.map(x=>[x.confirmation_id,x.result]));
  confirmed_facts=rows.map(row=>{
    const f=byInstance.get(row.fact_instance_id);
    if(!f||f.subject_id!==row.subject_id||
       f.proposition_key!==row.proposition_key||!byConfirm.has(row.confirmation_id))
      throw new Error("INVALID_GOVERNED_CURRENT_FACT_LINEAGE");
    return {...f,confirmation_id:row.confirmation_id,
      confirmation:byConfirm.get(row.confirmation_id)};
  });
}
const cohort={
  expected_product_ids:ids,products,catalog_products:catalogProducts,subjects,
  official_bindings,observations,confirmed_facts,
  // Explicitly no guessed cross-size/SKU official attestation:
  governed_formula_pairs:[]
};
const v=await compareExistingTenCleanserPreflightsV1({
  cohort,evaluateV1:evaluateCleanserInitialAdmissionPreflight
});
const indexed=new Map(products.map(x=>[x.id,x]));
const report={
  version:VERSION,read_only:true,scope:"EXISTING_TEN_CLEANSERS",
  raw_sources_exported:false,external_manufacturer_pages_fetched:false,
  governance:{
    subjects:subjects.length,official_bindings:official_bindings.filter(x=>x.binding_state==="resolved").length,
    observations:observations.length,confirmed_facts:confirmed_facts.length,
    preexisting_intakes:intakes.length,preexisting_research_tasks:tasks.length
  },
  v1_results_from_original_evaluator:true,
  v2_formula_pair_comparison:"NOT_EVALUATED_NO_INDEPENDENT_EXACT_SKU_PAIR_READER",
  result:{
    total:v.total,needs_review:v.v2_review_required_count,
    formula_scope_reconciled:v.v2_capacity_scope_reconciled_count,
    grants:v.admission_grants,writes:v.production_writes
  },
  products:v.results.map(r=>{
    const p=indexed.get(r.product_id);
    return {
      product_id:r.product_id,product_name:p.brand+" "+p.name,
      v1_state:r.v1_state,v1_blockers:r.v1_blockers,
      v1_conflicts:r.v1_conflicts,
      v2_state:r.v2_state,v2_blockers:r.v2_remaining_blockers,
      formula_decision:r.formula_decision,
      fact_reuse_approved:false,admission_granted:false
    };
  })
};
if(report.products.length!==10||report.products.some(x=>x.admission_granted))
  throw new Error("READONLY_REPORT_SCOPE_INVALID");
process.stdout.write(JSON.stringify(report,null,2)+"\n");
