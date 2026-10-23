/**
 * Materialize a product/subject authority attestation only from existing
 * governed TRUST rows. This has no DB, network, or mutation capabilities.
 * Never synthesize an approval from a source URL, review aggregate, or hash.
 */
export const CLEANSER_EXISTING_SUBJECT_ATTESTATION_VERSION =
  "cleanser-existing-subject-attestation-v1";
const SHA256=/^[0-9a-f]{64}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function sameOfficialPage(a,b){
  try{
    const x=new URL(a),y=new URL(b);
    if(x.protocol!=="https:"||y.protocol!=="https:"||x.username||y.username||x.password||y.password||
      x.hash||y.hash||x.hostname.toLowerCase()!==y.hostname.toLowerCase()||
      x.pathname.replace(/\/$/,"")!==y.pathname.replace(/\/$/,""))return false;
    // Identity authority for an exact SKU must not silently merge different
    // query-based variants or mutable shop product IDs.
    return x.searchParams.toString()===y.searchParams.toString();
  }catch{return false}
}
const official=name=>typeof name==="string"&&/^[a-z0-9_]+_official$/.test(name);
const rec=value=>!!value&&typeof value==="object"&&!Array.isArray(value);
export function materializeExistingCleanserSubjectAttestation({
  product,subject,trustIntakes=[],officialBindings=[],observations=[],now=new Date(),
}={}){
  if(product?.category!=="cleanser"||!UUID.test(String(product?.id||""))||
    subject?.product_id!==product.id||!UUID.test(String(subject?.subject_id||""))||
    subject.identity_status!=="resolved"||subject.current_state!=="current"||
    subject.market_applicability!=="KR"||
    !Number.isFinite(now?.getTime?.()))return null;
  const candidates=trustIntakes.filter(row=>
    row?.product_id===product.id&&row.subject_id===subject.subject_id&&
    row.identity_state==="EXACT_SUBJECT_FOUND"&&row.market==="KR"&&
    rec(row.identity_resolution_detail?.identity_authority)&&
    row.identity_resolution_detail.identity_authority.authority_kind==="admin_identity_authority"&&
    row.identity_resolution_detail.identity_authority.market==="KR"&&
    typeof row.identity_resolution_detail.identity_authority.authority_resolution_version==="string"&&
    row.identity_resolution_detail.identity_authority.authority_resolution_version.length>0&&
    SHA256.test(String(row.identity_resolution_detail.identity_authority.source_content_digest||""))
  );
  // Conflicting current administrative identity records must be reviewed.
  if(candidates.length!==1)return null;
  const row=candidates[0];
  const authority=row.identity_resolution_detail.identity_authority;
  const matchingBindings=officialBindings.filter(binding=>
    binding?.product_id===product.id&&binding.binding_state==="resolved"&&
    binding.product_scope_state==="product"&&official(binding.source_name)&&
    sameOfficialPage(binding.source_url,authority.official_source_locator)
  );
  if(matchingBindings.length!==1)return null;
  const binding=matchingBindings[0];
  const matchingObservations=observations.filter(ob=>
    ob?.product_id===product.id&&ob.subject_id===subject.subject_id&&
    ob.source_binding_id===binding.binding_id&&ob.market==="KR"&&
    ob.source_content_digest===authority.source_content_digest&&
    sameOfficialPage(ob.canonical_locator,authority.official_source_locator)&&
    ob.product_identity_observation?.product_id===product.id&&
    ob.product_identity_observation?.subject_id===subject.subject_id&&
    ob.product_identity_observation?.exact_catalog_product_binding===true
  );
  if(matchingObservations.length!==1)return null;
  const observation=matchingObservations[0];
  const fetched=Date.parse(observation.fetched_at);
  if(!Number.isFinite(fetched)||fetched>now.getTime()||
    now.getTime()-fetched>180*86400000)return null;
  return Object.freeze({
    version:CLEANSER_EXISTING_SUBJECT_ATTESTATION_VERSION,
    product_id:product.id,subject_id:subject.subject_id,market:"KR",
    current_state:"current",identity_status:"resolved",
    evidence_digest:authority.source_content_digest,
    authority:"governed_exact_subject_identity",
    authority_resolution_version:authority.authority_resolution_version,
    governed_intake_id:row.id,
    official_binding_id:binding.binding_id,
    official_observation_id:observation.observation_id,
  });
}
