import assert from "node:assert/strict";
import { buildFaceLabV2Canonical } from "../lib/face-lab-v2/canonical-composer.js";
import {
  buildFaceLabV2EvaluationCohort
} from "../lib/face-lab-v2/evaluation/harness.js";
import {
  auditFaceLabStyleCheckLineage,
  STYLE_CHECK_LINEAGE_AUDIT_VERSION
} from "../lib/face-lab-v2/evaluation/style-check-lineage-audit.js";

const cases=buildFaceLabV2EvaluationCohort({caseCount:24}).cases;
assert.equal(cases.length,24);
const seen=[];
let actionTotal=0;
let routeTotal=0;
for(const item of cases){
  const canonical=buildFaceLabV2Canonical({
    analysis:item.analysis,surveyAnswers:item.surveyAnswers,
    resultId:item.caseId
  });
  const before=JSON.stringify(canonical);
  const report=auditFaceLabStyleCheckLineage(canonical);
  assert.equal(JSON.stringify(canonical),before,
    "read-only contract audit must never mutate canonical or presentation");
  assert.equal(report.auditVersion,STYLE_CHECK_LINEAGE_AUDIT_VERSION);
  assert.equal(report.status,"verified_wiring_only",
    JSON.stringify({caseId:item.caseId,issues:report.issues}));
  assert.deepEqual(report.issues,[]);
  assert.equal(report.outputIsUserFacing,false);
  assert.equal(report.evaluatesAestheticQuality,false);
  assert.equal(report.productionAuthorization,false);
  assert.equal(JSON.stringify(report).includes(item.caseId),false,
    "report must not persist session or face identifier");
  actionTotal+=report.summary.deltaActions;
  routeTotal+=report.summary.routes;
  if(canonical.routes?.routes?.length && canonical.styleDelta?.priorities?.length)
    seen.push({analysis:item.analysis,survey:item.surveyAnswers,canonical});
}
assert.ok(seen.length>0);
assert.ok(actionTotal>0&&routeTotal>0);
const selectedCase=seen.find(x=>x.canonical.routes.routes.length>1)||seen[0];
const selectedRoute=selectedCase.canonical.routes.routes[0];
const selected=buildFaceLabV2Canonical({
  analysis:selectedCase.analysis,
  surveyAnswers:selectedCase.survey,
  selectedRouteId:selectedRoute.routeId,
  resultId:"synthetic-selected-contract"
});
const selectedReport=auditFaceLabStyleCheckLineage(selected);
assert.equal(selectedReport.status,"verified_wiring_only",
  JSON.stringify(selectedReport.issues));

function corrupted(mutator) {
  const c=structuredClone(selected);
  mutator(c);
  return auditFaceLabStyleCheckLineage(c);
}
function contains(report,code) {
  assert.equal(report.status,"contract_violation");
  assert.ok(report.issues.some(x=>x.code===code),
    JSON.stringify(report.issues));
}
contains(corrupted(c=>{
  const a=c.styleDelta.priorities.find(a=>a.constraintState==="allowed");
  a.evidence=a.evidence.filter(x=>!x.startsWith("target_axis:"));
}),"delta_action_missing_target_axis");
contains(corrupted(c=>{
  const a=c.styleDelta.priorities.find(a=>a.constraintState==="allowed");
  a.evidence.push("face_feature:inventedFeature=upturned");
}),"face_modifier_evidence_unresolved");
contains(corrupted(c=>{
  c.routes.routes[0].actions.push({
    domain:"hair",parameter:"inventedAction",direction:"increase",
    evidence:["target_axis:softSharp"]
  });
}),"route_action_missing_allowed_source");
contains(corrupted(c=>{
  c.routes.routes[0].faceEvidence=["face_feature:inventedFeature=upturned"];
}),"route_face_evidence_mismatch");
const preview=buildFaceLabV2Canonical({
  analysis:selectedCase.analysis,surveyAnswers:selectedCase.survey,
  resultId:"synthetic-preview-contract"
});
assert.equal(preview.routes.selectionState,"default_preview");
contains(auditFaceLabStyleCheckLineage({
  ...preview,
  appearanceHandoff:{status:"available",slots:[{slotKey:"hair_shape"}]}
}),"default_preview_appearance_leak");
contains(auditFaceLabStyleCheckLineage({
  ...selected,
  targetStyle:{...selected.targetStyle,approvedByUser:false}
}),"unconfirmed_target_has_delta");
assert.equal(auditFaceLabStyleCheckLineage({
  ...selected,targetStyle:null,styleDelta:null,routes:null
}).status,"held_no_confirmed_target");

console.log(JSON.stringify({
  ok:true,auditVersion:STYLE_CHECK_LINEAGE_AUDIT_VERSION,
  syntheticCases:cases.length,deltaActionCount:actionTotal,
  routeCount:routeTotal,selectedRouteChecked:true,
  mutationChecks:6,
  canonicalMutationCount:0,
  realPhotoOrAestheticAccuracyValidated:false,
  productionPolicyModified:false
}));
