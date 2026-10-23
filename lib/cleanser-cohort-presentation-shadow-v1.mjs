/**
 * C1/C2: deterministic, pure audit of the TEN already-promoted cleanser products.
 * Catalog size/name and research leads are hints, NEVER verified SKU/presentation.
 * Does not call websites, a database, other services, or write persistent state.
 */
export const CLEANSER_COHORT_PRESENTATION_SHADOW_VERSION="cleanser-cohort-presentation-shadow-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FACT_KEYS=["deep_cleansing","low_ph"];
const isUUID=x=>UUID.test(String(x||""));
const text=x=>typeof x==="string"&&x.trim().length>0;
const sort=x=>[...new Set(x)].sort();
function hintFromName(name){
  if(!text(name))return null;
  const tokens=[...name.normalize("NFKC").matchAll(/(\d+(?:\.\d+)?)\s*(ml|mℓ|g|그램|매|장)(?![\p{L}\p{N}])/giu)];
  if(tokens.length!==1)return null;
  const amount=Number(tokens[0][1]),raw=tokens[0][2].toLowerCase();
  const unit=raw==="그램"?"g":raw==="매"||raw==="장"?"sheet":raw==="mℓ"?"ml":raw;
  return Number.isFinite(amount)&&amount>0?{amount,unit}:null;
}
function catalogSizeHint(v) {
  if(v===null||v===undefined||v==="")return null;
  if(typeof v!=="string"&&typeof v!=="number")return null;
  if(!/^\d+(?:\.\d+)?$/.test(String(v)))return null;
  const n=Number(v);
  return Number.isFinite(n)&&n>0?{amount:n,unit:"ml"}:null;
}
function checkedRows(rows,label,max=100){
  if(!Array.isArray(rows)||rows.length>max||rows.some(r=>!r||typeof r!=="object"||Array.isArray(r))) {
    throw new TypeError("INVALID_"+label);
  }
  return rows;
}
function buildCohort({products,intakes,tasks,subjects,source_bindings,offers,claims,expected_product_ids}){
  checkedRows(products,"PRODUCTS",10);
  checkedRows(intakes,"INTAKES",30);
  checkedRows(tasks,"TASKS",60);
  checkedRows(subjects,"SUBJECTS",100);
  checkedRows(source_bindings,"SOURCE_BINDINGS",150);
  checkedRows(offers,"OFFERS",150);
  checkedRows(claims,"RESEARCH_CLAIMS",50);
  if(!Array.isArray(expected_product_ids)||expected_product_ids.length!==10||
    new Set(expected_product_ids).size!==10||expected_product_ids.some(x=>!isUUID(x)))
    throw new TypeError("EXACT_TEN_PRODUCT_IDS_REQUIRED");
  const ids=sort(expected_product_ids);
  if(products.length!==10||sort(products.map(p=>p.id)).join("|")!==ids.join("|"))
    throw new TypeError("EXACT_COHORT_PRODUCT_READ_REQUIRED");
  if(products.some(p=>p.category!=="cleanser"||!text(p.normalized_brand)||
    !text(p.normalized_name)))throw new TypeError("INVALID_CATALOG_ANCHOR");
  if(intakes.some(i=>!ids.includes(i.product_id))||
     tasks.some(t=>!ids.includes(t.product_id))||
     subjects.some(s=>!ids.includes(s.product_id))||
     source_bindings.some(b=>!ids.includes(b.product_id))||
     offers.some(o=>!ids.includes(o.product_id))||
     claims.some(c=>!ids.includes(c.product_id)))throw new TypeError("COHORT_REFERENCE_OUTSIDE_SCOPE");
  if(claims.some(c=>!Number.isFinite(c.amount)||c.amount<=0||
      !["ml","g","sheet","item"].includes(c.unit)||
      c.basis!=="UNVERIFIED_RESEARCH_LEAD"||!text(c.reference)))
    throw new TypeError("RESEARCH_LEAD_SCOPE_INVALID");
  const results=products.map(product=>{
    const id=product.id;
    const canonical=catalogSizeHint(product.size_ml);
    const nameHint=hintFromName(product.name);
    const productIntakes=intakes.filter(row=>row.product_id===id);
    const productTasks=tasks.filter(row=>row.product_id===id);
    const sub=subjects.filter(row=>row.product_id===id);
    const bindings=source_bindings.filter(row=>row.product_id===id);
    const rows=offers.filter(row=>row.product_id===id);
    const productClaims=claims.filter(row=>row.product_id===id);
    const reasons=[];
    if(!canonical)reasons.push("CATALOG_ML_CAPACITY_MISSING_OR_UNUSABLE");
    else reasons.push("CATALOG_ML_CAPACITY_NOT_MANUFACTURER_VERIFIED");
    if(nameHint)reasons.push("PRODUCT_NAME_UNIT_IS_UNVERIFIED_HINT");
    if(nameHint&&canonical&&nameHint.unit!=="ml")reasons.push("CATALOG_AND_LABEL_UNIT_INCOMPARABLE");
    if(nameHint&&canonical&&nameHint.unit==="ml"&&nameHint.amount!==canonical.amount)
      reasons.push("CATALOG_AND_NAME_CAPACITY_DISAGREE");
    if(sub.length!==1||sub[0].identity_status!=="resolved"||sub[0].current_state!=="current")
      reasons.push("CURRENT_GOVERNED_SUBJECT_NOT_ESTABLISHED");
    if(!bindings.some(b=>b.binding_state==="resolved"&&
        b.product_scope_state==="product"&&/^[a-z0-9_]+_official$/.test(String(b.source_name||""))))
      reasons.push("RESOLVED_OFFICIAL_PRODUCT_SOURCE_NOT_ESTABLISHED");
    if(rows.length===0)reasons.push("SELLER_OFFER_NOT_OBSERVED");
    else reasons.push("SELLER_OFFER_COMPONENT_SCOPE_UNVERIFIED");
    if(productIntakes.length!==1||productIntakes[0].identity_state!=="EXACT_SUBJECT_FOUND")
      reasons.push("TRUST_IDENTITY_REVIEW_REQUIRED");
    if(productTasks.length!==2||
      sort(productTasks.map(t=>t.fact_key)).join("|")!==FACT_KEYS.join("|"))
      reasons.push("TRUST_RESEARCH_TASK_SET_DRIFT");
    if(productTasks.some(t=>t.state!=="CONFIRMED"&&t.state!=="ALREADY_COVERED"))
      reasons.push("TRUST_FACT_RESEARCH_UNFINISHED");
    for(const lead of productClaims){
      reasons.push("UNVERIFIED_RESEARCH_LEAD_NOT_SOURCE_AUTHORITY");
      if(canonical&&lead.unit!=="ml")
        reasons.push("RESEARCH_LEAD_UNIT_INCOMPARABLE");
      if(canonical&&lead.unit==="ml"&&canonical.amount!==lead.amount)
        reasons.push("CATALOG_VS_RESEARCH_LEAD_CAPACITY_DISAGREE");
    }
    return Object.freeze({
      product_id:id, catalog_brand:product.brand||null,catalog_name:product.name||null,
      catalog_size_hint:canonical,
      name_unit_hint:nameHint,
      unverified_research_leads:Object.freeze(productClaims.map(c=>({
        amount:c.amount,unit:c.unit,reference:c.reference,authority:"UNVERIFIED_RESEARCH_LEAD"
      })).sort((a,b)=>a.reference.localeCompare(b.reference,"en"))),
      existing_intake_count:productIntakes.length,existing_research_task_count:productTasks.length,
      existing_subject_count:sub.length,existing_official_binding_count:bindings.length,
      existing_offer_count:rows.length,
      decision:"REVIEW_REQUIRED",family_identity:"CATALOG_ANCHOR_ONLY",
      physical_presentation:"UNVERIFIED",
      formula_decision:"FORMULA_UNRESOLVED",
      reasons:Object.freeze(sort(reasons)),
      created_product_count:0,created_offer_count:0,
      created_subject_count:0,confirmed_fact_count:0,production_writes:0
    });
  }).sort((a,b)=>a.product_id.localeCompare(b.product_id,"en"));
  return Object.freeze({
    version:CLEANSER_COHORT_PRESENTATION_SHADOW_VERSION,
    cohort_products:results.length,
    observed_intakes:intakes.length,
    observed_research_tasks:tasks.length,
    cohort_queue_shape_matches_10_20:intakes.length===10&&tasks.length===20&&
      results.every(x=>x.existing_intake_count===1&&x.existing_research_task_count===2)&&
      results.every(x=>!x.reasons.includes("TRUST_RESEARCH_TASK_SET_DRIFT")),
    all_product_identities_preserved:true,
    production_writes:0,confirmed_facts:0,admission_grants:0,
    results:Object.freeze(results)
  });
}
export function evaluateExistingCleanserCohortPresentationsV1(input={}){
  return buildCohort({
    products:input.products,intakes:input.intakes,tasks:input.tasks,
    subjects:input.subjects,source_bindings:input.source_bindings,
    offers:input.offers,claims:input.unverified_research_leads??[],
    expected_product_ids:input.expected_product_ids
  });
}
