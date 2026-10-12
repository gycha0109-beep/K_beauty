import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  classifyTrustIntakeIdentityReadiness,
  summarizeTrustIntakeReadiness,
} from "@/lib/trust/intake-identity-readiness-v1.mjs";

import { planTrustBrandOfficialFrontier } from "@/lib/trust/brand-official-frontier-v1.mjs";

const MAX_INTAKES=500;
export class TrustIntakeReadinessError extends Error {
  constructor(code){super(code);this.name="TrustIntakeReadinessError";this.code=code;}
}
async function checked(query,label) {
  const {data,error}=await query;
  if(error || !Array.isArray(data))
    throw new TrustIntakeReadinessError("READINESS_"+label+"_READ_FAILED");
  return data;
}

/**
 * Read-only operational inventory. No RPC, writes, promotions or
 * Subject registration; missing official/formulation proofs remain blocked.
 */
export async function loadTrustIntakeReadiness() {
  const client=createSupabaseAdminClient();
  if(!client) throw new TrustIntakeReadinessError("READINESS_CONNECTION_UNAVAILABLE");
  const intakes=await checked(client.from("catalog_trust_intake")
    .select("id,product_id,source_candidate_id,market,subject_id,identity_state,trust_state,identity_resolution_detail")
    .eq("identity_state","SUBJECT_CREATION_REQUIRED")
    .eq("trust_state","REVIEW_REQUIRED")
    .order("id",{ascending:true}).limit(MAX_INTAKES+1),"INTAKE");
  if(intakes.length>MAX_INTAKES)
    throw new TrustIntakeReadinessError("READINESS_INTAKE_LIMIT_EXCEEDED");
  if(intakes.length===0) return {
    summary:summarizeTrustIntakeReadiness([]),
    frontier:{total:0,withSeeds:0,withoutSeeds:0,aiApiCalls:0,
      mutationPolicy:"DISCOVERY_ONLY_NO_DB_WRITE"},items:[],
  };
  const products=intakes.map(i=>i.product_id);
  if(new Set(products).size!==products.length)
    throw new TrustIntakeReadinessError("READINESS_MULTIPLE_INTAKES_PER_PRODUCT");
  const [tasks,bindings,subjects,productRows,governedBindings]=await Promise.all([
    checked(client.from("product_fact_research_tasks")
      .select("product_id,intake_id,id,state,blocker_code")
      .in("intake_id",intakes.map(i=>i.id))
      .eq("state","REVIEW_REQUIRED")
      .eq("blocker_code","SUBJECT_CREATION_REQUIRED")
      .limit(2001),"TASK"),
    checked(client.from("product_source_bindings")
      .select("product_id,binding_state,source_name")
      .in("product_id",products).limit(2001),"BINDING"),
    checked(client.from("product_fact_subjects")
      .select("product_id,subject_id,identity_status,current_state")
      .in("product_id",products).limit(2001),"SUBJECT"),
    checked(client.from("products")
      .select("id,brand,name,name_en,normalized_name,normalized_brand")
      .limit(MAX_INTAKES+1),"PRODUCT"),
    checked(client.from("product_evidence_source_subject_bindings")
      .select("binding_id,product_id,subject_id,source_id,binding_state,scope_relation")
      .limit(MAX_INTAKES+1),"OFFICIAL_BINDING"),
  ]);
  if(tasks.length>=2001||bindings.length>=2001||subjects.length>=2001||
    productRows.length>MAX_INTAKES)
    throw new TrustIntakeReadinessError("READINESS_CHILD_LIMIT_EXCEEDED");
  const sourceIds=[...new Set(governedBindings.map(b=>b.source_id))];
  const governedSources=sourceIds.length?
    await checked(client.from("product_evidence_sources")
      .select("source_id,canonical_locator,source_kind")
      .in("source_id",sourceIds).limit(MAX_INTAKES+1),"OFFICIAL_SOURCE"):[];
  const frontier=planTrustBrandOfficialFrontier({
    backlog:intakes,products:productRows,
    bindings:governedBindings,sources:governedSources,
  });
  const frontierByIntake=new Map(frontier.items.map(x=>[x.intakeId,x]));
  const candidateIds=intakes.map(i=>i.source_candidate_id).filter(Boolean);
  const candidates=candidateIds.length ?
    await checked(client.from("product_candidates")
      .select("id,matched_product_id,review_status,identity_resolution_state,identity_resolution_evidence")
      .in("id",candidateIds).limit(MAX_INTAKES+1),"CANDIDATE"):[];
  const cand=new Map(candidates.map(x=>[x.id,x]));
  const names=new Map(productRows.map(x=>[x.id,x]));
  const taskCounts=new Map(),bindingRows=new Map(),subjectRows=new Map();
  for(const task of tasks){
    taskCounts.set(task.intake_id,(taskCounts.get(task.intake_id)??0)+1);
  }
  for(const binding of bindings){
    if(!bindingRows.has(binding.product_id))bindingRows.set(binding.product_id,[]);
    bindingRows.get(binding.product_id).push(binding);
  }
  for(const subject of subjects){
    if(!subjectRows.has(subject.product_id))subjectRows.set(subject.product_id,[]);
    subjectRows.get(subject.product_id).push(subject);
  }
  const items=intakes.map(intake=>{
    if(!names.has(intake.product_id))
      throw new TrustIntakeReadinessError("READINESS_PRODUCT_MISSING");
    const taskCount=taskCounts.get(intake.id)??0;
    if(!taskCount) throw new TrustIntakeReadinessError("READINESS_TASK_MISSING");
    const readiness=classifyTrustIntakeIdentityReadiness({
      intake,taskCount,
      candidate:cand.get(intake.source_candidate_id)??null,
      subjects:subjectRows.get(intake.product_id)??[],
      sourceBindings:bindingRows.get(intake.product_id)??[],
      // These proofs do not exist in the current canonical intake snapshot.
      // Never infer official proof from a third-party product URL.
      qualifiedOfficialEvidence:false,
      formulationAttested:false,
    });
    const product=names.get(intake.product_id);
    return {...readiness,brand:product.brand,name:product.name,
      discoveryFrontier:frontierByIntake.get(intake.id)};
  });
  return {summary:summarizeTrustIntakeReadiness(items),frontier:{
    total:frontier.total,withSeeds:frontier.withSeeds,
    withoutSeeds:frontier.withoutSeeds,aiApiCalls:frontier.aiApiCalls,
    mutationPolicy:frontier.mutationPolicy,
  },items};
}
