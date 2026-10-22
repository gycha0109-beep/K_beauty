#!/usr/bin/env node
/** Read-only hosted inventory audit. This command never grants admission. */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  CLEANSER_ADMISSION_PREFLIGHT_VERSION,
  evaluateCleanserInitialAdmissionPreflight,
} from "../lib/cleanser-initial-admission-preflight-v1.mjs";
import { buildExistingCleanserTrustBackfillPlan } from "../lib/existing-cleanser-trust-backfill-plan-v1.mjs";
import { collectExistingCleanserOfficialCapture } from "../lib/existing-cleanser-official-capture-v1.mjs";
import { evaluateCleanserGovernedAdmissionShadow } from "../lib/cleanser-governed-admission-shadow-v1.mjs";

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
  .select("product_id,subject_id,source_binding_id,canonical_locator,market,source_kind,source_content_digest,fetched_at,product_identity_observation")
  .in("product_id",ids).limit(500), "source_observations");
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
    // The current DB has no governed source-bound Hwahae envelope or KR
    // Subject attestation materializer. Missing is NEVER synthesized as proof.
    hwahaeCaptureEnvelope:null,
    subjectScopeAttestation:null,
  };
  const result = evaluateCleanserInitialAdmissionPreflight(snapshot);
  const admissionShadow = evaluateCleanserGovernedAdmissionShadow(snapshot);
  const backfill = buildExistingCleanserTrustBackfillPlan(product, result);
  return { brand:product.brand,name:product.name,...result,admissionShadow,backfill };
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
const officialResearch=[];
if(requestCapture){
  const scoped=products.filter(product=>{
    const plan=results.find(result=>result.productId===product.id)?.backfill;
    if(plan?.sourceUrlClassification!=="OFFICIAL_SOURCE_CANDIDATE_UNVERIFIED")return false;
    try{return allowlistedHosts.includes(new URL(product.source_url).hostname.toLowerCase())}
    catch{return false}
  }).slice(0,captureLimit);
  for(const product of scoped){
    try{
      const candidate=await collectExistingCleanserOfficialCapture({
        product,approvedBrandHosts:allowlistedHosts,siteUseAuthorized:true
      });
      officialResearch.push({productId:product.id,...candidate});
    }catch(error){
      // Do not leak DNS, auth or fetched content from a provider error.
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
  officialResearchExecuted:requestCapture,officialResearch,
  shadowEligibleCount:results.filter(x=>x.admissionShadow.shadowEligible).length,
  productionWrites:0,admissionGranted:0,results
},null,2));
