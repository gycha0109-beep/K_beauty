#!/usr/bin/env node
/** Read-only hosted inventory audit. This command never grants admission. */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import {
  CLEANSER_ADMISSION_PREFLIGHT_VERSION,
  evaluateCleanserInitialAdmissionPreflight,
} from "../lib/cleanser-initial-admission-preflight-v1.mjs";
import { buildExistingCleanserTrustBackfillPlan } from "../lib/existing-cleanser-trust-backfill-plan-v1.mjs";
import { collectExistingCleanserOfficialCapture } from "../lib/existing-cleanser-official-capture-v1.mjs";
import { evaluateCleanserGovernedAdmissionShadow } from "../lib/cleanser-governed-admission-shadow-v1.mjs";
import { materializeExistingCleanserSubjectAttestation } from "../lib/cleanser-existing-subject-attestation-v1.mjs";
import { materializeGovernedCleanserHwahaeCapture } from "../lib/cleanser-hwahae-governed-capture-reader-v1.mjs";
import {planExistingCleanserTrustResearchEnrollment,CLEANSER_REGISTRY_VERSION} from "../lib/existing-cleanser-trust-enrollment-plan-v1.mjs";
import { OFFICIAL_RESEARCH_SOURCE_MODE } from "../lib/existing-cleanser-official-capture-v1.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idsArg = process.argv.find((value) => value.startsWith("--ids="))?.slice(6) || "";
const ids = [...new Set(idsArg.split(",").map((item) => item.trim()).filter(Boolean))];
if (!ids.length || ids.length > 25 || ids.some((id) => !UUID.test(id))) {
  throw new Error("EXPLICIT_PRODUCT_IDS_REQUIRED: pass --ids=uuid,uuid (1..25)");
}
dotenv.config({ path: ".env.local", quiet: true });
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SERVER_ONLY_SUPABASE_CREDENTIALS_REQUIRED");
const supabase = createClient(url, key, { auth: { persistSession:false,autoRefreshToken:false } });
async function rows(promise, label) {
  const { data, error } = await promise;
  if (error || !Array.isArray(data)) throw new Error("READ_FAILED:" + label + ":" + (error?.code || "unknown"));
  return data;
}
const products = await rows(supabase.from("products")
  .select("id,category,brand,name,normalized_brand,normalized_name,size_ml,source_url,hwahae_url,skin_types,concerns,review_signals,market_signals,ingredient_signals")
  .in("id", ids).limit(25), "products");
if (products.length !== ids.length || products.some((p) => p.category !== "cleanser")) {
  throw new Error("PRODUCT_SCOPE_MISMATCH_OR_MISSING");
}
const { count, error: countError } = await supabase.from("products").select("id",{count:"exact",head:true}).eq("category","cleanser");
if (countError || !Number.isInteger(count) || count > 1000) throw new Error("CATALOG_CARDINALITY_UNVERIFIED");
const catalogProducts = await rows(supabase.from("products")
  .select("id,normalized_brand,normalized_name").eq("category","cleanser").limit(1000), "catalog_products");
if (catalogProducts.length !== count) throw new Error("CATALOG_DUPLICATE_SCOPE_INCOMPLETE");
const subjects = await rows(supabase.from("product_fact_subjects")
  .select("subject_id,product_id,identity_status,current_state,market_applicability,formulation_revision_key")
  .in("product_id",ids).limit(100), "subjects");
const bindings = await rows(supabase.from("product_source_bindings")
  .select("binding_id,product_id,source_name,source_url,binding_state,product_scope_state")
  .in("product_id",ids).limit(200), "source_bindings");
const observations = await rows(supabase.from("trust_source_observations")
  .select("observation_id,product_id,subject_id,source_binding_id,canonical_locator,market,source_kind,source_content_digest,fetched_at,product_identity_observation")
  .in("product_id",ids).limit(500), "source_observations");
const intakes = await rows(supabase.from("catalog_trust_intake")
  .select("id,product_id,subject_id,identity_state,market,identity_resolution_detail")
  .in("product_id",ids).limit(150),"catalog_trust_intake");
if (intakes.length >= 150) throw new Error("TRUST_INTAKE_SCOPE_LIMIT_REACHED");
const trustResearchTasks = await rows(supabase.from("product_fact_research_tasks")
  .select("id,product_id,subject_id,fact_key,registry_version,research_policy_version,state,blocker_code")
  .in("product_id",ids).limit(150),"trust_research_tasks");
if (trustResearchTasks.length >= 150) throw new Error("TRUST_TASK_SCOPE_LIMIT_REACHED");
// These are READ-ONLY governed RPC lookups. No intake, Fact, or grant writes.
const requiredFacts=await rows(supabase.rpc("catalog_required_product_facts_v1",
  {p_category:"cleanser"}),"cleanser_required_facts");
const registryDefinitions=await rows(supabase.from("product_fact_definition_snapshots")
  .select("fact_key,registry_version,deprecated,definition")
  .eq("registry_version",CLEANSER_REGISTRY_VERSION)
  .in("fact_key",requiredFacts.map(row=>row.fact_key)).limit(20),
  "cleanser_registry_definitions");
const definitionsReady=requiredFacts.length===2&&registryDefinitions.length===2&&
  requiredFacts.every(row=>registryDefinitions.some(def=>def.fact_key===row.fact_key &&
    def.deprecated===false && Array.isArray(def.definition?.domain_scope) &&
    def.definition.domain_scope.includes("cleanser")));
const registryReviews=[];
for(const fact of requiredFacts){
  if(typeof fact.fact_key!=="string")throw new Error("INVALID_REGISTRY_FACT_KEY");
  const {data,error}=await supabase.rpc("product_fact_controlled_registry_write_admissibility_v2",{
    p_registry_version:CLEANSER_REGISTRY_VERSION,p_fact_key:fact.fact_key,p_lineage_kind:"new"
  });
  if(error||!data||typeof data!=="object")throw new Error("REGISTRY_GOVERNANCE_READ_FAILED");
  registryReviews.push({fact_key:fact.fact_key,allowed:data.allowed===true,
    registryVersion:data.registry_version,reason:data.reason});
}
const intakeEnrollmentPolicy={
  registryVersion:CLEANSER_REGISTRY_VERSION,
  requiredFactKeys:requiredFacts.map(row=>row.fact_key),
  allNewLineageAllowed:definitionsReady && registryReviews.length===2 &&
    registryReviews.every(row=>row.allowed===true &&
      row.registryVersion===CLEANSER_REGISTRY_VERSION),
};
const subjectIds = subjects.map((row) => row.subject_id);
const currentFactRows = subjectIds.length ? await rows(supabase.from("product_fact_current")
  .select("subject_id,confirmation_id,fact_instance_id,proposition_key").in("subject_id",subjectIds).limit(500),"current_facts") : [];
if (currentFactRows.length >= 500) throw new Error("CURRENT_FACT_SCOPE_LIMIT_REACHED");
const factIds = [...new Set(currentFactRows.map((row)=>row.fact_instance_id))];
const confirmationIds = [...new Set(currentFactRows.map((row)=>row.confirmation_id))];
const factInstances = factIds.length ? await rows(supabase.from("product_fact_instances")
  .select("subject_id,fact_instance_id,fact_key,proposition_key,semantic_status,authority_ceiling,fused_confidence,registry_version,valid_from,valid_to")
  .in("fact_instance_id",factIds).limit(500),"fact_instances") : [];
const confirmations = confirmationIds.length ? await rows(supabase.from("product_fact_confirmations")
  .select("confirmation_id,result").in("confirmation_id",confirmationIds).limit(500),"fact_confirmations") : [];
if (factInstances.length !== factIds.length || confirmations.length !== confirmationIds.length) {
  throw new Error("CURRENT_FACT_AUTHORITY_JOIN_INCOMPLETE");
}
const instancesById = new Map(factInstances.map((row)=>[row.fact_instance_id,row]));
const confirmationsById = new Map(confirmations.map((row)=>[row.confirmation_id,row.result]));
const confirmedFacts = currentFactRows.map((row)=>{
  const instance = instancesById.get(row.fact_instance_id);
  if (!instance || instance.subject_id !== row.subject_id ||
      instance.proposition_key !== row.proposition_key) {
    throw new Error("CURRENT_FACT_SUBJECT_OR_PROPOSITION_MISMATCH");
  }
  return { ...instance, confirmation_id:row.confirmation_id, confirmation:confirmationsById.get(row.confirmation_id) };
});

const metadataReviews = await rows(supabase.from("product_metadata_field_reviews")
  .select("product_id,field_name,field_value,review_state,confidence,evidence_refs,evidence_records,evidence_digest,reviewed_by,reviewed_at")
  .in("product_id",ids).in("field_name",["skin_types","concerns"]).limit(200),"metadata_reviews");
if (metadataReviews.length >= 200) throw new Error("METADATA_REVIEW_SCOPE_LIMIT_REACHED");

const hwahaeEvidenceSources = await rows(supabase.from("product_evidence_sources")
  .select("source_id,publisher,source_kind,market,canonical_locator,content_digest,observed_at,external_snapshot_reference,source_metadata")
  .eq("publisher","hwahae").eq("source_kind","product_review_aggregate").limit(200),
  "governed_hwahae_sources");
if(hwahaeEvidenceSources.length>=200)throw new Error("HWAHAE_CAPTURE_SOURCE_SCOPE_LIMIT_REACHED");
const hwahaeSourceIds=hwahaeEvidenceSources.map(row=>row.source_id);
const hwahaeSourceBindings=hwahaeSourceIds.length ? await rows(
  supabase.from("product_evidence_source_subject_bindings")
    .select("source_id,product_id,subject_id,binding_state,scope_relation")
    .in("product_id",ids).in("source_id",hwahaeSourceIds).limit(200),
  "governed_hwahae_subject_bindings") : [];
if(hwahaeSourceBindings.length>=200)throw new Error("HWAHAE_CAPTURE_BINDING_SCOPE_LIMIT_REACHED");

const results = products.map((product) => {
  const matchedSubjects = subjects.filter((row) => row.product_id === product.id && row.current_state === "current");
  const subject = matchedSubjects.length === 1 ? matchedSubjects[0] : null;
  const snapshot = {
    product,subject,
    officialBindings:bindings.filter((row)=>row.product_id===product.id),
    observations:observations.filter((row)=>row.product_id===product.id),
    confirmedFacts:confirmedFacts.filter((row)=>row.subject_id===subject?.subject_id),
    catalogProducts,
    metadataReviews:metadataReviews.filter((row)=>row.product_id===product.id),
    // Only an existing governed publisher source + exact subject binding may
    // provide a capture. Product review_signals alone never create an envelope.
    hwahaeCaptureEnvelope:materializeGovernedCleanserHwahaeCapture({
      product,subject,
      evidenceSources:hwahaeEvidenceSources,
      sourceSubjectBindings:hwahaeSourceBindings.filter(row=>row.product_id===product.id),
    }),
    subjectScopeAttestation:materializeExistingCleanserSubjectAttestation({
      product,subject,
      trustIntakes:intakes.filter(row=>row.product_id===product.id),
      officialBindings:bindings.filter(row=>row.product_id===product.id),
      observations:observations.filter(row=>row.product_id===product.id),
    }),
  };
  const result = evaluateCleanserInitialAdmissionPreflight(snapshot);
  const admissionShadow = evaluateCleanserGovernedAdmissionShadow(snapshot);
  const backfill = buildExistingCleanserTrustBackfillPlan(product, result);
  const trustEnrollment = planExistingCleanserTrustResearchEnrollment({
    product,catalogProducts,existingIntakes:intakes,policy:intakeEnrollmentPolicy
  });
  const trustQueue = {
    intakeCount:intakes.filter(row=>row.product_id===product.id).length,
    identityStates:[...new Set(intakes.filter(row=>row.product_id===product.id)
      .map(row=>row.identity_state))].sort(),
    researchTasks:trustResearchTasks.filter(row=>row.product_id===product.id)
      .map(({id,subject_id,fact_key,registry_version,research_policy_version,state,blocker_code})=>({
        id,subject_id,fact_key,registry_version,research_policy_version,state,blocker_code,
      })),
  };
  return { brand:product.brand,name:product.name,...result,admissionShadow,backfill,trustEnrollment,trustQueue };
});
// No external fetch by default. Explicit site-use authorization plus a
// pre-reviewed origin allowlist are both mandatory for optional bounded intake.
const officialArg=process.argv.find(arg=>arg.startsWith("--official-hosts="))?.slice("--official-hosts=".length)||"";
const allowlistedHosts=[...new Set(officialArg.split(",").map(x=>x.trim().toLowerCase()).filter(Boolean))];
const siteUseAuthorized=process.argv.includes("--site-use-authorized=true");
const requestCapture=allowlistedHosts.length>0;
if ((requestCapture&&!siteUseAuthorized) || (!requestCapture&&siteUseAuthorized)) {
  throw new Error("EXPLICIT_HOST_AND_SITE_USE_AUTHORIZATION_REQUIRED");
}
const limitArg=process.argv.find(arg=>arg.startsWith("--official-capture-limit="))?.split("=")[1];
const captureLimit=limitArg==null?3:Number(limitArg);
if (!Number.isInteger(captureLimit)||captureLimit<1||captureLimit>10) {
  throw new Error("INVALID_OFFICIAL_CAPTURE_LIMIT");
}
const leadsFile=process.argv.find(x=>x.startsWith("--official-source-leads-file="))
  ?.slice("--official-source-leads-file=".length).trim()||null;
if(leadsFile&&!requestCapture)throw new Error("OFFICIAL_LEADS_REQUIRE_AUTHORIZED_HOSTS");
const leadMap=new Map();
if(leadsFile){
  const input=JSON.parse(await readFile(leadsFile,"utf8"));
  if(input?.version!=="cleanser-official-research-leads-v1" ||
    !Array.isArray(input.items) || input.items.length>25){
    throw new Error("OFFICIAL_LEADS_FILE_INVALID");
  }
  for(const row of input.items){
    if(!UUID.test(String(row?.productId||"")) ||
      !ids.includes(row.productId) || typeof row.officialUrl!=="string" ||
      row.officialUrl.length>2048 || leadMap.has(row.productId)){
      throw new Error("OFFICIAL_LEAD_SCOPE_OR_DUPLICATE");
    }
    const parsed=new URL(row.officialUrl);
    if(parsed.protocol!=="https:" || parsed.username || parsed.password || parsed.hash ||
      !allowlistedHosts.includes(parsed.hostname.toLowerCase())){
      throw new Error("OFFICIAL_LEAD_HOST_OR_URL_NOT_APPROVED");
    }
    leadMap.set(row.productId,parsed.toString());
  }
}
const officialResearch=[];
if(requestCapture){
  const scoped=products.filter(product=>{
    const lead=leadMap.get(product.id);
    if(lead)return true;
    const plan=results.find(result=>result.productId===product.id)?.backfill;
    if(plan?.sourceUrlClassification!=="OFFICIAL_SOURCE_CANDIDATE_UNVERIFIED")return false;
    try{return allowlistedHosts.includes(new URL(product.source_url).hostname.toLowerCase())}
    catch{return false}
  }).slice(0,captureLimit);
  for(const product of scoped){
    try{
      const alternate=leadMap.get(product.id);
      const candidate=await collectExistingCleanserOfficialCapture({
        product,officialUrl:alternate||product.source_url,
        researchSourceMode:alternate?OFFICIAL_RESEARCH_SOURCE_MODE.ALTERNATE:
          OFFICIAL_RESEARCH_SOURCE_MODE.CATALOG_ONLY,
        approvedBrandHosts:allowlistedHosts,siteUseAuthorized:true,
      });
      officialResearch.push({productId:product.id,...candidate});
    }catch(error){
      officialResearch.push({productId:product.id,state:"HOLD",
        reasons:["OFFICIAL_FETCH_FAILED_OR_SOURCE_BLOCKED"],
        grantIssued:false,productionWrites:0});
    }
  }
}
const summary = Object.fromEntries([...new Set(results.map((result) => result.state))]
  .sort().map((state) => [state, results.filter((result)=>result.state===state).length]));
const workItems = Object.fromEntries(
  [...new Set(results.flatMap((result)=>result.backfill.tasks.map((item)=>item.code)))]
    .sort().map((code)=>[code,results.filter((result)=>result.backfill.tasks.some((item)=>item.code===code)).length])
);
const sourceKinds = Object.fromEntries(
  [...new Set(results.map((result)=>result.backfill.sourceUrlClassification))]
    .sort().map((kind)=>[kind,results.filter((result)=>result.backfill.sourceUrlClassification===kind).length])
);
console.log(JSON.stringify({
  version:CLEANSER_ADMISSION_PREFLIGHT_VERSION,total:results.length,summary,
  workItems,sourceKinds,
  officialResearchExecuted:requestCapture,
  officialLeadCount:leadMap.size,officialResearch,
  shadowEligibleCount:results.filter(x=>x.admissionShadow.shadowEligible).length,
  governedRegistryReadiness:intakeEnrollmentPolicy,
  proposedResearchIntakeCount:results.filter(x=>x.trustEnrollment.proposal!==null).length,
  existingResearchIntakeCount:results.reduce((sum,x)=>sum+x.trustQueue.intakeCount,0),
  existingResearchTaskCount:results.reduce((sum,x)=>sum+x.trustQueue.researchTasks.length,0),
  proposedResearchIntakes:results.map(x=>x.trustEnrollment.proposal).filter(Boolean),
  productionWrites:0,admissionGranted:0,results
},null,2));
