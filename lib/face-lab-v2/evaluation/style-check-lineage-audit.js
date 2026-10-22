/**
 * SC-02 / Face Lab Style Check: read-only evidence-lineage audit.
 *
 * This module inspects *existing* canonical V2 output; it NEVER mutates,
 * promotes or enriches production decisions. Source references are
 * categorical only; it never returns face/photo/target user input.
 *
 * Technical provenance is NOT human evaluation of styling quality.
 */
export const STYLE_CHECK_LINEAGE_AUDIT_VERSION =
  "face-lab-style-check-lineage-audit-p0-v1";

const DOMAIN_SOURCES = Object.freeze({
  hair: ["hair"],
  makeup: ["makeup"],
  color: ["color"],
  grooming: ["brow_grooming", "facial_hair"],
  eyewear: ["eyewear"],
  accessories: ["accessories"]
});
const TARGET_AXES = new Set([
  "softSharp","naturalPolished","playfulMature",
  "minimalStatement","warmCool","classicTrendy"
]);
const allowedStatuses = new Set(["allowed","blocked"]);
const array = (x) => Array.isArray(x) ? x : [];
const strings = (x) => array(x).filter(v=>typeof v==="string");
const actionKey = (x) => [x?.domain,x?.parameter,x?.direction].join(":");
const faceEvidence = (a) => strings(a?.evidence).filter(x=>x.startsWith("face_feature:"));
const targetEvidence = (a) => strings(a?.evidence).filter(x=>x.startsWith("target_axis:"));

export function auditFaceLabStyleCheckLineage(canonical) {
  const issues=[];
  const counts={
    deltaActions:0,activeActions:0,blockedActions:0,
    targetOnlyActions:0,faceQualifiedActions:0,
    routes:0,routeActions:0,domainExecutions:0
  };
  const report=(status)=>({
    auditVersion:STYLE_CHECK_LINEAGE_AUDIT_VERSION,
    status,
    summary:counts,
    issues,
    outputIsUserFacing:false,
    evaluatesAestheticQuality:false,
    productionAuthorization:false
  });
  const issue=(code,context={})=>issues.push({code,...context});

  if(!canonical || typeof canonical!=="object" || Array.isArray(canonical)){
    issue("canonical_missing");
    return report("contract_violation");
  }
  const target=canonical.targetStyle;
  const delta=canonical.styleDelta;
  const confirmed=target?.status==="available" && target?.approvedByUser===true;
  if(!confirmed){
    if(delta!==null&&delta!==undefined)issue("unconfirmed_target_has_delta");
    if(canonical.routes!==null&&canonical.routes!==undefined)
      issue("unconfirmed_target_has_routes");
    return report(issues.length?"contract_violation":"held_no_confirmed_target");
  }
  if(!delta||!Array.isArray(delta.priorities)){
    issue("confirmed_target_missing_delta");
    return report("contract_violation");
  }

  const features=new Map(array(canonical.currentFaceProfile?.keyFeatures)
    .filter(f=>typeof f?.key==="string")
    .map(f=>[f.key,f.direction]));

  const actions=delta.priorities;
  counts.deltaActions=actions.length;
  const active=[];
  for(const a of actions) {
    if(!a || typeof a!=="object"){
      issue("delta_action_invalid");
      continue;
    }
    const context={domain:a.domain||"unknown",parameter:a.parameter||"unknown"};
    if(!allowedStatuses.has(a.constraintState))
      issue("delta_action_constraint_state_invalid",context);
    const blocked=a.constraintState==="blocked";
    if(blocked)counts.blockedActions++;
    else if(a.constraintState==="allowed"){
      counts.activeActions++;
      active.push(a);
    }
    const targets=targetEvidence(a);
    const faces=faceEvidence(a);
    if(!targets.length)issue("delta_action_missing_target_axis",context);
    for(const evidence of targets){
      const axis=evidence.slice("target_axis:".length);
      if(!TARGET_AXES.has(axis) ||
        !Number.isFinite(target.vector?.[axis]))
        issue("delta_target_axis_unresolved",context);
    }
    if(faces.length)counts.faceQualifiedActions++;
    else counts.targetOnlyActions++;
    for(const evidence of faces) {
      const match=/^face_feature:([A-Za-z][A-Za-z0-9]*)(?:=(.+))?$/.exec(evidence);
      if(!match || !features.has(match[1]) ||
        (match[2]!==undefined && String(features.get(match[1]))!==match[2])) {
        issue("face_modifier_evidence_unresolved",context);
      }
    }
  }

  const routes=array(canonical.routes?.routes);
  counts.routes=routes.length;
  for(const route of routes) {
    const routeId=typeof route?.routeId==="string"?route.routeId:"invalid";
    const available=new Map();
    for(const item of active) {
      const key=actionKey(item);
      const bucket=available.get(key)||[];
      bucket.push(item);
      available.set(key,bucket);
    }
    const seen=new Set();
    const routeActions=array(route?.actions);
    counts.routeActions+=routeActions.length;
    for(const action of routeActions) {
      const key=actionKey(action);
      const evidence=strings(action?.evidence);
      const source=(available.get(key)||[]).find(item=>
        evidence.every(e=>strings(item.evidence).includes(e))
      );
      if(!source){
        issue("route_action_missing_allowed_source",{routeId});
      }
      if(seen.has(key))
        issue("route_duplicate_action",{routeId});
      seen.add(key);
    }
    const actualFaces=[...new Set(routeActions.flatMap(faceEvidence))].sort();
    const declaredFaces=[...new Set(strings(route?.faceEvidence))].sort();
    if(JSON.stringify(actualFaces)!==JSON.stringify(declaredFaces))
      issue("route_face_evidence_mismatch",{routeId});
    const actualDomains=[...new Set(routeActions.map(a=>a?.domain))].sort();
    const declaredDomains=[...new Set(strings(route?.domains))].sort();
    if(JSON.stringify(actualDomains)!==JSON.stringify(declaredDomains))
      issue("route_domains_mismatch",{routeId});
  }

  const selection=canonical.routes?.selectionState;
  const selectedId=canonical.routes?.selectedRouteId;
  const selected=routes.find(x=>x?.routeId===selectedId)||null;
  if(selectedId && !selected)
    issue("selected_route_unknown");
  if(selection==="user_selected" && !selected)
    issue("user_selected_route_missing");
  if(selection==="default_preview"){
    // canonical may compute an internal preview Look, but Appearance
    // handoff must not expose *committed* domain/product slots.
    if(canonical.appearanceHandoff?.status==="available" ||
      array(canonical.appearanceHandoff?.slots).length>0)
      issue("default_preview_appearance_leak");
  }
  if(selection==="user_selected" && canonical.appearanceHandoff?.status==="available" &&
    canonical.appearanceHandoff.routeId!==selectedId)
    issue("committed_appearance_wrong_route");

  for(const [domain,sources] of Object.entries(DOMAIN_SOURCES)){
    const execution=canonical[domain];
    if(execution?.status!=="available")continue;
    counts.domainExecutions++;
    if(!selected || execution.routeId!==selected.routeId){
      issue("execution_route_mismatch",{domain});
      continue;
    }
    const permitted=new Set(array(selected.actions)
      .filter(x=>sources.includes(x?.domain))
      .map(x=>x.parameter));
    // A domain can contain structural notes in addition to its actions,
    // but style_delta references must resolve to a selected Route action.
    for(const e of strings(execution.evidence).filter(x=>x.startsWith("style_delta:"))){
      if(!permitted.has(e.slice("style_delta:".length)))
        issue("execution_evidence_unresolved",{domain});
    }
  }
  if(canonical.looks?.status==="available" && selected){
    for(const look of array(canonical.looks.looks)){
      if(look?.routeId!==selected.routeId)
        issue("look_route_mismatch");
    }
  }
  return report(issues.length?"contract_violation":"verified_wiring_only");
}
