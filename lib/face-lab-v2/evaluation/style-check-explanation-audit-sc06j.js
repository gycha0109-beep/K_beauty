export const STYLE_CHECK_EXPLANATION_AUDIT_VERSION="face-lab-style-check-explanation-audit-sc06j-v1";
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const provenance=(a)=>(Array.isArray(a?.evidence)?a.evidence:[]).filter(x=>typeof x==="string");
const supported=(ev)=>ev.some(x=>x.startsWith("target_axis:")||x.startsWith("face_")||x.startsWith("observation:"));
export function auditStyleCheckExplanation({canonical,explanation,targetKey,routeId}={}){
 const issues=[];
 const mark=(code,index=null)=>issues.push(index===null?{code}:{code,index});
 const routes=canonical?.routes;
 const route=routes?.routes?.find(x=>x?.routeId===(routeId||routes?.defaultRouteId));
 const cards=Array.isArray(explanation?.cards)?explanation.cards:[];
 if(!route?.actions?.length||canonical?.targetStyle?.status!=="available")mark("canonical_route_missing");
 if(!canonical?.targetStyle?.targetLabels?.includes(targetKey))mark("selected_target_mismatch");
 if(explanation?.productionActive!==false||explanation?.providerInvoked!==false||explanation?.qualityValidated!==false)mark("unsafe_research_flags");
 if(explanation?.status!=="research_copy_ready"||!cards.length||cards.length>4)mark("explanation_not_ready");
 const indexed=new Set();let matched=0;let faceLinked=0;
 for(const [index,card] of cards.entries()){
  const source=card?.source,routeIndex=route?.actions?.findIndex((a,j)=>!indexed.has(j)&&a?.domain===source?.domain&&a?.parameter===source?.parameter&&a?.direction===source?.direction&&a?.strength===card?.strength&&a?.reason===source?.reason&&same(provenance(a),source?.evidence));
  if(routeIndex==null||routeIndex<0){mark("card_without_canonical_action",index);continue;}
  indexed.add(routeIndex);matched++;
  if(!supported(provenance(route.actions[routeIndex])))mark("action_evidence_not_supported",index);
  const face=provenance(route.actions[routeIndex]).some(x=>x.startsWith("face_")||x.startsWith("observation:"));
  if(card?.scope!==(face?"face_and_target":"target_only"))mark("face_source_scope_mismatch",index);
  if(card?.scope==="face_and_target")faceLinked++;
  if(typeof card?.title!=="string"||card.title.trim().length<6||typeof card?.how!=="string"||card.how.trim().length<15)mark("copy_not_actionable",index);
 }
 if(faceLinked===0&&explanation?.observedCue)mark("unlinked_face_cue_claim");
 if(faceLinked===0&&typeof explanation?.rationale==="string"&&explanation.rationale.includes("이 특징과 추구미"))mark("unlinked_face_claim");
 if(explanation?.headline!==cards[0]?.title)mark("headline_not_from_first_action");
 if(!explanation?.caveat)mark("missing_scope_disclosure");
 return {version:STYLE_CHECK_EXPLANATION_AUDIT_VERSION,status:issues.length?"fail":"pass",issues,routeActionCount:route?.actions?.length||0,explainedActionCount:matched,unexplainedActionCount:Math.max(0,(route?.actions?.length||0)-matched),faceLinkedCount:faceLinked,productionActive:false,accuracyValidated:false};
}
