import { evaluateLiveAutomaticEvidenceSnapshot } from "./automatic-product-evidence-live-adapter-v1.mjs";

export const LIVE_DB_READER_VERSION = "automatic-evidence-db-reader-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireRows(query, label) {
  const { data, error } = await query;
  if (error || !Array.isArray(data))
    throw new Error("AUTOMATIC_EVIDENCE_READ_FAILED:" + label);
  return data;
}
async function requireOne(query, label) {
  const { data, error } = await query;
  if (error || !data)
    throw new Error("AUTOMATIC_EVIDENCE_READ_FAILED:" + label);
  return data;
}

/**
 * Read-only DB connection: no RPC, no INSERT/UPDATE/UPSERT/DELETE.
 * Call from trusted server only with service-role client, never from the browser.
 */
export async function readAutomaticEvidenceSnapshot(client, productId) {
  if (!client || !UUID.test(String(productId)))
    throw new Error("AUTOMATIC_EVIDENCE_INVALID_REQUEST");
  const [product, subjects, taxonomy, sourceBindings] = await Promise.all([
    requireOne(client.from("products")
      .select("id,category,review_signals,hwahae_url")
      .eq("id",productId).single(),"product"),
    requireRows(client.from("product_fact_subjects")
      .select("subject_id,product_id,identity_status,current_state,identity_resolution_version,market_applicability,formulation_revision_key")
      .eq("product_id",productId).limit(30),"subjects"),
    requireRows(client.from("product_catalog_taxonomy_assignments")
      .select("product_id,taxonomy_version,category_term_id,assignment_state,assignment_method")
      .eq("product_id",productId).limit(30),"taxonomy"),
    requireRows(client.from("product_source_bindings")
      .select("binding_id,product_id,source_name,source_url,binding_state,product_scope_state")
      .eq("product_id",productId).limit(100),"source_bindings"),
  ]);
  const current = subjects.filter(x=>x.current_state==="current" &&
    x.product_id===productId);
  if(current.length!==1 || current[0].identity_status!=="resolved")
    throw new Error("AUTOMATIC_EVIDENCE_CURRENT_SUBJECT_NOT_RESOLVED");
  const subjectId = current[0].subject_id;
  const currentFacts = await requireRows(client.from("product_fact_current")
    .select("fact_instance_id,subject_id,confirmation_id")
    .eq("subject_id",subjectId).limit(200),"current_facts");
  const ids = currentFacts.map(x=>x.fact_instance_id);
  const confirmationIds = currentFacts.map(x=>x.confirmation_id);
  const [factInstances, confirmations, definitions, observations] = await Promise.all([
    ids.length ? requireRows(client.from("product_fact_instances")
      .select("fact_instance_id,subject_id,fact_key,value_type,value_enum,value_number,semantic_status,registry_version,authority_ceiling,fused_confidence,valid_to")
      .in("fact_instance_id",ids).limit(200),"fact_instances") : Promise.resolve([]),
    confirmationIds.length ? requireRows(client.from("product_fact_confirmations")
      .select("confirmation_id,result")
      .in("confirmation_id",confirmationIds).limit(200),"confirmations") : Promise.resolve([]),
    requireRows(client.from("product_fact_definition_snapshots")
      .select("registry_version,fact_key,value_type,deprecated")
      .in("fact_key",["spf_value","uva_label","uv_filter_type"]).limit(100),"fact_definitions"),
    requireRows(client.from("trust_source_observations")
      .select("observation_id").eq("subject_id",subjectId).limit(100),
      "source_observations"),
  ]);
  return {
    product,subjects,taxonomy,sourceBindings,
    currentFacts,factInstances,confirmations,definitions,
    sourceObservationCount:observations.length,
  };
}
export async function evaluateAutomaticEvidenceFromLiveDB(client, productId, context = {}, nowDate) {
  const snapshot = await readAutomaticEvidenceSnapshot(client, productId);
  return evaluateLiveAutomaticEvidenceSnapshot(snapshot, productId, context, nowDate);
}
