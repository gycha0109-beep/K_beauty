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
      .select("fact_instance_id,subject_id,fact_key,proposition_key,value_type,value_enum,value_number,semantic_status,registry_version,authority_ceiling,fused_confidence,valid_to")
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
  // Evidence IDs reference product_evidence_records, never source IDs directly.
  // Resolve the exact Fact -> Evidence -> Source/Subject binding -> Source chain.
  const factEvidenceLinks = ids.length ? await requireRows(client.from("product_fact_evidence_links")
    .select("fact_instance_id,evidence_id,subject_id,proposition_key,link_role")
    .in("fact_instance_id",ids).eq("subject_id",subjectId).limit(500),"fact_evidence_links") : [];
  const evidenceIds = [...new Set(factEvidenceLinks.map(x=>x.evidence_id))];
  const evidenceRecords = evidenceIds.length ? await requireRows(client.from("product_evidence_records")
    .select("evidence_id,source_id,binding_id,binding_state,subject_id,registry_version,fact_key,proposition_key,evidence_authority,support_direction,market,valid_to")
    .in("evidence_id",evidenceIds).limit(500),"evidence_records") : [];
  const bindingIds = [...new Set(evidenceRecords.map(x=>x.binding_id))];
  const sourceIds = [...new Set(evidenceRecords.map(x=>x.source_id))];
  const [evidenceBindings,evidenceSources] = await Promise.all([
    bindingIds.length ? requireRows(client.from("product_evidence_source_subject_bindings")
      .select("binding_id,source_id,product_id,subject_id,binding_state,scope_relation")
      .in("binding_id",bindingIds).eq("subject_id",subjectId).limit(500),"evidence_bindings") : Promise.resolve([]),
    sourceIds.length ? requireRows(client.from("product_evidence_sources")
      .select("source_id,canonical_locator,content_digest,source_kind,market")
      .in("source_id",sourceIds).limit(500),"evidence_sources") : Promise.resolve([]),
  ]);
  return {
    product,subjects,taxonomy,sourceBindings,
    currentFacts,factInstances,confirmations,definitions,
    factEvidenceLinks,evidenceRecords,evidenceBindings,evidenceSources,
    sourceObservationCount:observations.length,
  };
}
export async function evaluateAutomaticEvidenceFromLiveDB(client, productId, context = {}, nowDate) {
  const snapshot = await readAutomaticEvidenceSnapshot(client, productId);
  return evaluateLiveAutomaticEvidenceSnapshot(snapshot, productId, context, nowDate);
}
