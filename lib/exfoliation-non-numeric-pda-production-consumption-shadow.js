export const EXFOLIATION_PDA_PRODUCTION_CONSUMPTION_SHADOW_VERSION = "exfoliation-non-numeric-pda-production-consumption-shadow-v1";
export const EXFOLIATION_PDA_PRODUCTION_CONSUMPTION_CONTRACT_VERSION = "exfoliation-non-numeric-pda-production-consumption-contract-v1";
const BLOCKED = new Set(["conflict_blocked","identity_blocked"]);
const INSUFFICIENT = new Set(["insufficient_fact","missing_fact","category_unknown"]);
const t=v=>String(v??"").normalize("NFKC").trim();
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const uniq=v=>Array.from(new Set((Array.isArray(v)?v:[]).map(t).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"en"));
const rid=r=>t(r?.product_id||r?.productId||r?.id);
const ids=r=>uniq((Array.isArray(r?.pda?.active_identities?.items)?r.pda.active_identities.items:[]).map(x=>x?.identity));
const conflict=v=>Array.isArray(v)?v.some(conflict):v&&typeof v==="object"?Object.values(v).some(conflict):t(v).toLowerCase()==="conflict";
export function deriveExfoliationProductionConsumptionExternalContextCompleteness(x={}){
  if(x?.not_applicable===true)return "not_applicable";
  if(x?.semantic_conflict===true||conflict(x))return "conflict";
  const set=t(x?.current_product_set_completeness).toLowerCase();
  if(!["known","empty"].includes(set))return "unknown";
  const s=x?.safety_state||{},c=x?.recent_skin_or_product_change_state||{},r=x?.reaction_instability_state||{};
  const req=[s.level,s.sensitive_burden,s.exfoliation_expansion_allowed,x?.user_sensitivity_state,c.recent_skin_change,c.recent_product_change,r.product_reaction,r.reaction_link_state,r.recent_exposure_state].map(v=>t(v).toLowerCase());
  return req.every(v=>v&&v!=="unknown")?"complete":"unknown";
}
export function evaluateExfoliationProductionConsumptionNeutralGate(input={}){
  const status=t(input.signal_status),coverage=t(input.coverage_state),ext=t(input.external_context_completeness).toLowerCase();
  const missing=status==="GOVERNED_SIGNAL_ESTABLISHED"?uniq(input.missing_context_keys):[];
  if(status==="NOT_APPLICABLE")return {gate:"NOT_APPLICABLE",reason_codes:["NOT_APPLICABLE"],uncertainty:[]};
  if(input.blocked===true||status==="GOVERNED_SIGNAL_BLOCKED"||BLOCKED.has(coverage))return {gate:"DEFER_BLOCKED_AUTHORITY",reason_codes:["GOVERNED_AUTHORITY_BLOCKED"],uncertainty:["BLOCKED_AUTHORITY_PRESERVED"]};
  const reasons=[];
  if(status==="GOVERNED_SIGNAL_UNKNOWN")reasons.push("GOVERNED_SIGNAL_UNKNOWN");
  if(INSUFFICIENT.has(coverage))reasons.push("GOVERNED_COVERAGE_INSUFFICIENT");
  for(const k of missing)reasons.push(`MISSING_PRODUCT_CONTEXT:${k}`);
  if(["partial","unknown"].includes(ext))reasons.push("EXTERNAL_CONTEXT_INSUFFICIENT");
  if(reasons.length)return {gate:"DEFER_INSUFFICIENT_AUTHORITY",reason_codes:uniq(reasons),uncertainty:uniq(reasons)};
  if(input.semantic_conflict===true||ext==="conflict")return {gate:"DEFER_CONTEXT_CONFLICT",reason_codes:["EXTERNAL_CONTEXT_CONFLICT"],uncertainty:["EXTERNAL_CONTEXT_CONFLICT_PRESERVED"]};
  return {gate:"READY_FOR_SEPARATE_POLICY_EVALUATION",reason_codes:["READY_FOR_SEPARATE_POLICY_EVALUATION"],uncertainty:[]};
}
export function deriveExfoliationIdentityOverlap(input={}){
  const status=t(input.signal_status),ext=t(input.external_context_completeness).toLowerCase();
  if(status==="NOT_APPLICABLE")return {state:"not_applicable",identities:[]};
  if(input.blocked===true||status==="GOVERNED_SIGNAL_BLOCKED")return {state:"blocked",identities:[]};
  if(status==="GOVERNED_SIGNAL_UNKNOWN"||["partial","unknown","conflict"].includes(ext))return {state:"unknown",identities:[]};
  const a=new Set(uniq(input.active_identities)),b=new Set((Array.isArray(input.current_identity_sets)?input.current_identity_sets:[]).flat().map(t));
  const identities=[...a].filter(x=>b.has(x)).sort((x,y)=>x.localeCompare(y,"en"));
  return {state:identities.length?"present":"not_established",identities};
}
export function materializeExfoliationProductionConsumptionEnvelope({input={},productId=null,intrinsicProvenance={},externalProvenance={}}={}){
  const n={signal_status:t(input.signal_status)||"GOVERNED_SIGNAL_UNKNOWN",active_identities:uniq(input.active_identities),current_identity_sets:(Array.isArray(input.current_identity_sets)?input.current_identity_sets:[]).map(uniq),missing_context_keys:uniq(input.missing_context_keys),coverage_state:t(input.coverage_state)||"missing_fact",external_context_completeness:t(input.external_context_completeness).toLowerCase()||"unknown",blocked:input.blocked===true,semantic_conflict:input.semantic_conflict===true};
  const g=evaluateExfoliationProductionConsumptionNeutralGate(n);
  return stable({version:EXFOLIATION_PDA_PRODUCTION_CONSUMPTION_SHADOW_VERSION,contract_version:EXFOLIATION_PDA_PRODUCTION_CONSUMPTION_CONTRACT_VERSION,product_id:productId,intrinsic:{signal_status:n.signal_status,active_identity_set:{items:n.active_identities,semantic_ordering:"NONE"},coverage_state:n.coverage_state,missing_context_keys:n.missing_context_keys,decision_relevant_missing_context_keys:n.signal_status==="GOVERNED_SIGNAL_ESTABLISHED"?n.missing_context_keys:[]},derived_relations:{identity_overlap:deriveExfoliationIdentityOverlap(n),cross_product_overlap_rule:"GOVERNED_IDENTITY_SET_INTERSECTION_ONLY",identity_count_is_potency:false,multiple_is_stronger:false},external_context:{completeness:n.external_context_completeness,semantic_conflict:n.semantic_conflict,promoted_to_intrinsic_authority:false},neutral_gate:g.gate,reason_codes:g.reason_codes,uncertainty:{preserved:true,reasons:g.uncertainty},provenance:{intrinsic:stable(intrinsicProvenance),external:stable(externalProvenance),consumption_contract_version:EXFOLIATION_PDA_PRODUCTION_CONSUMPTION_CONTRACT_VERSION,shadow_implementation_version:EXFOLIATION_PDA_PRODUCTION_CONSUMPTION_SHADOW_VERSION},production_decision:"UNSPECIFIED",production_authority:false});
}
export function materializeExfoliationProductionConsumptionFromGovernedRecord({pdaRecord,pdaRecords=[],externalContext,pdaAuthority={}}={}){
  const status=t(pdaRecord?.pda?.signal_status)||"GOVERNED_SIGNAL_UNKNOWN",id=rid(pdaRecord),byId=new Map((Array.isArray(pdaRecords)?pdaRecords:[]).map(r=>[rid(r),r]).filter(([x])=>x));
  const current=(Array.isArray(externalContext?.current_product_set)?externalContext.current_product_set:[]).filter(r=>r?.source_state==="selected"&&t(r?.product_id)!==id).map(r=>byId.get(t(r?.product_id))).filter(Boolean).filter(r=>r?.pda?.signal_status==="GOVERNED_SIGNAL_ESTABLISHED").map(ids);
  const ext=status==="NOT_APPLICABLE"?"not_applicable":deriveExfoliationProductionConsumptionExternalContextCompleteness(externalContext);
  return materializeExfoliationProductionConsumptionEnvelope({input:{signal_status:status,active_identities:ids(pdaRecord),current_identity_sets:current,missing_context_keys:uniq(pdaRecord?.pda?.coverage?.missing_context_keys),coverage_state:t(pdaRecord?.pda?.coverage?.state)||"missing_fact",external_context_completeness:ext,blocked:status==="GOVERNED_SIGNAL_BLOCKED"||BLOCKED.has(t(pdaRecord?.pda?.coverage?.state)),semantic_conflict:ext==="conflict"},productId:id||null,intrinsicProvenance:{contract_version:pdaRecord?.pda?.contract_version??null,mapper_version:pdaAuthority?.mapper_version??null,registry_version:pdaAuthority?.registry_version??null,snapshot_sha256:pdaAuthority?.snapshot_sha256??null,evidence_provenance:stable(pdaRecord?.pda?.evidence_provenance||[]),uncertainty_reasons:uniq(pdaRecord?.pda?.uncertainty?.reasons)},externalProvenance:{authority:"CURRENT_REQUEST_AND_VERSIONED_ROUTINE_USER_SAFETY_CONTEXT",context_version:externalContext?.version??null}});
}
