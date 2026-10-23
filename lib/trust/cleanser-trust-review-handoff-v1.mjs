/**
 * R3/C3: governed cleanser TRUST review-packet shadow.
 * Existing catalog/Intake/Task/Subject/Source owners are authoritative;
 * this pure reader proposes only a handoff for an independent human review.
 * Even REVIEW_PACKET_READY cannot create/approve Subject, Binding, Fact or G2.
 */
export const CLEANSER_TRUST_REVIEW_HANDOFF_VERSION="cleanser-trust-review-handoff-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64=/^[a-f0-9]{64}$/i;
const FACT_KEYS=["deep_cleansing","low_ph"];
const uuid=x=>UUID.test(String(x||""));
const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const has=x=>typeof x==="string"&&x.trim().length>0;
const safeUrl=x=>{
  try{
    const u=new URL(x);
    return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash&&u.hostname.length>0;
  }catch{return false;}
};
const sameUrl=(a,b)=>safeUrl(a)&&safeUrl(b)&&new URL(a).href===new URL(b).href;
function requireRows(value,max,name) {
  if(!Array.isArray(value)||value.length>max||value.some(x=>!isRecord(x)))
    throw new TypeError("INVALID_"+name+"_ROWS");
  return value;
}
const unique=x=>Object.freeze([...new Set(x)].sort());
export function projectCleanserTrustReviewHandoffV1({
  product,intakes=[],research_tasks=[],subjects=[],official_source_bindings=[],
  source_subject_bindings=[],evidence_sources=[]
}={}){
  if(!isRecord(product)||!uuid(product.id)||product.category!=="cleanser")
    throw new TypeError("EXISTING_CLEANSER_PRODUCT_REQUIRED");
  const id=product.id;
  requireRows(intakes,20,"INTAKE");
  requireRows(research_tasks,60,"TASK");
  requireRows(subjects,30,"SUBJECT");
  requireRows(official_source_bindings,30,"OFFICIAL_BINDING");
  requireRows(source_subject_bindings,60,"SOURCE_SUBJECT_BINDING");
  requireRows(evidence_sources,60,"EVIDENCE_SOURCE");
  const scoped=[intakes,research_tasks,subjects,official_source_bindings,source_subject_bindings];
  if(scoped.some(rows=>rows.some(row=>row.product_id!==id)))
    throw new TypeError("CROSS_PRODUCT_REVIEW_PACKET_FORBIDDEN");
  const reasons=[];
  const intake=intakes.length===1?intakes[0]:null;
  if(!intake||!uuid(intake.id)) reasons.push("EXISTING_TRUST_INTAKE_REQUIRED");
  const tasks=research_tasks.map(t=>({
    id:t.id,fact_key:t.fact_key,subject_id:t.subject_id??null,
    state:t.state,blocker_code:t.blocker_code??null
  })).sort((a,b)=>String(a.fact_key).localeCompare(String(b.fact_key),"en"));
  const taskIds=tasks.map(t=>t.id);
  if(tasks.length!==2||new Set(taskIds).size!==2||
    tasks.some(t=>!uuid(t.id)||!FACT_KEYS.includes(t.fact_key))||
    tasks.map(t=>t.fact_key).sort().join("|")!==FACT_KEYS.join("|"))
    reasons.push("EXISTING_TWO_FACT_RESEARCH_TASKS_REQUIRED");
  // Record existing task identifiers only. No second research queue is created.
  const live=subjects.filter(s=>s.identity_status==="resolved"&&s.current_state==="current"&&
    s.market_applicability==="KR"&&uuid(s.subject_id)&&has(s.formulation_revision_key));
  if(live.length!==1||subjects.length!==1)reasons.push("ONE_REVIEWED_CURRENT_KR_SUBJECT_REQUIRED");
  const subject=live.length===1&&subjects.length===1?live[0]:null;
  if(!intake||intake.identity_state!=="EXACT_SUBJECT_FOUND"||
    !subject||intake.subject_id!==subject.subject_id||
    intake.market!=="KR") reasons.push("EXACT_SUBJECT_INTAKE_REVIEW_REQUIRED");
  if(!subject||tasks.some(t=>t.subject_id!==subject.subject_id))
    reasons.push("TASK_SUBJECT_SCOPE_NOT_ESTABLISHED");
  const official=official_source_bindings.filter(b=>b.binding_state==="resolved"&&
    b.product_scope_state==="product"&&
    /^[a-z0-9_]+_official$/.test(String(b.source_name||""))&&
    uuid(b.binding_id)&&safeUrl(b.source_url));
  if(official.length!==1)reasons.push("UNIQUE_RESOLVED_OFFICIAL_SOURCE_REQUIRED");
  const sources=evidence_sources.filter(s=>uuid(s.source_id)&&safeUrl(s.canonical_locator)&&
    ["official_product_page","brand_official_product_page","manufacturer_official_document"].includes(s.source_kind)&&
    s.market==="KR"&&HEX64.test(String(s.content_digest||""))&&
    has(s.external_snapshot_reference));
  const reviewedLinks=source_subject_bindings.filter(b=>
    subject&&b.subject_id===subject.subject_id&&
    ["exact_subject_match","equivalent_presentation_match"].includes(b.binding_state)&&
    b.scope_relation==="equivalent"&&uuid(b.reviewed_by)&&
    Number.isFinite(Date.parse(b.reviewed_at||""))&&
    sources.some(s=>s.source_id===b.source_id&&official.some(o=>sameUrl(o.source_url,s.canonical_locator)))&&
    isRecord(b.presentation_metadata)&&
    b.presentation_metadata.exact_sku_reviewed===true&&
    has(b.presentation_metadata.verified_sku)&&
    has(b.presentation_metadata.verified_presentation_key)&&
    b.presentation_metadata.verified_market==="KR"&&
    sources.some(s=>s.source_id===b.source_id&&
      sameUrl(s.canonical_locator,b.presentation_metadata.exact_source_locator))
  );
  if(reviewedLinks.length!==1)reasons.push("REVIEWED_EXACT_SOURCE_SUBJECT_SKU_LINK_REQUIRED");
  // Validation distinguishes 'packet ready for review' from research state.
  // No Current Fact is fabricated from an intake or an empty research claim.
  const reviewPacketReady=reasons.length===0;
  return Object.freeze({
    version:CLEANSER_TRUST_REVIEW_HANDOFF_VERSION,
    product_id:id,intake_id:intake?.id??null,
    existing_task_ids:Object.freeze(tasks.map(t=>t.id)),
    existing_task_fact_keys:Object.freeze(tasks.map(t=>t.fact_key)),
    existing_task_states:Object.freeze(tasks.map(t=>t.state)),
    current_subject_id:subject?.subject_id??null,
    verified_source_subject_binding_id:reviewPacketReady?reviewedLinks[0].binding_id:null,
    decision:reviewPacketReady?"REVIEW_PACKET_READY":"REVIEW_REQUIRED",
    reasons:unique(reasons),
    current_fact_confirmation:"NOT_PERFORMED",
    intake_created:0,research_tasks_created:0,subject_created:0,
    source_bindings_approved:0,facts_confirmed:0,production_writes:0,
    recommendation_admission_granted:false,review_approval_granted:false
  });
}
