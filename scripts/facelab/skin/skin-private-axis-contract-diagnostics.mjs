// S1-D PRIVATE on-device diagnostic. No network or raw Provider persistence.
// ONLY canonical axis names, closed categories and failure-code enums escape.
// This does not lower the acceptance gate, estimate clinical truth or score skin.
import {
  SKIN_VISIBLE_AXES, SKIN_AXIS_EVIDENCE_VERSION, assessSkinAxisEvidence
} from "./skin-axis-evidence-contract-core.mjs";

export const SKIN_PRIVATE_AXIS_DIAGNOSTIC_VERSION="skin-private-axis-diagnostic-v1";
const AXES=new Set(SKIN_VISIBLE_AXES);
const CUES=Object.freeze({
  oiliness:["surface_shine"],dehydration:["dry_texture","visible_flaking"],
  acne:["active_spots"],uneven_tone:["tone_variation"],
  pores:["pore_visibility"],redness:["red_appearance"],
  barrier:["surface_stress","dry_texture","visible_flaking"]
});
const AREAS=new Set([
  "full_face","t_zone","forehead","nose","cheeks","chin","jawline","eye_area"
]);
const ASSESSABILITY=new Set(["blur","occlusion","lighting","makeup","filter","low_resolution","unsupported"]);
const UNKNOWABLE=new Set(["missing","unsupported","legacy_unverifiable","invalid_field"]);
const ROW_KEYS=new Set(["axis","state","value","confidence","cue","area","reason"]);
const STATES=new Set(["present","not_seen","unassessable","unknown"]);
const VALUE_CONFIDENCE=new Set(["low","medium","high"]);
const NEGATIVE_CONFIDENCE=new Set(["medium","high"]);
function object(v){return v!==null&&typeof v==="object"&&!Array.isArray(v);}
function closedState(v){return STATES.has(v) ? v : "invalid";}
function rowReasons(row,axis) {
  const reasons=[];
  if(!object(row)||Object.keys(row).length!==ROW_KEYS.size||
      Object.keys(row).some(k=>!ROW_KEYS.has(k)))
    reasons.push("row_shape_invalid");
  const state=closedState(row?.state);
  if(state==="invalid")reasons.push("state_invalid");
  if(state==="present"||state==="not_seen") {
    if(state==="present"?
       !(Number.isInteger(row.value)&&row.value>=1&&row.value<=5):row.value!==0)
      reasons.push("value_state_mismatch");
    const allowed=state==="present"?VALUE_CONFIDENCE:NEGATIVE_CONFIDENCE;
    if(!allowed.has(row.confidence))reasons.push("confidence_state_mismatch");
    // Equality-only checks: never return the provider's cue/area strings.
    if(!CUES[axis].includes(row.cue))reasons.push("target_cue_missing_or_invalid");
    if(!AREAS.has(row.area))reasons.push("inspected_area_missing_or_invalid");
    if(row.reason!=="none")reasons.push("reason_state_mismatch");
  }
  if(state==="unassessable"||state==="unknown") {
    if(row.value!==null)reasons.push("value_state_mismatch");
    if(row.confidence!=="unknown")reasons.push("confidence_state_mismatch");
    if(row.cue!==null)reasons.push("cue_must_be_null");
    if(row.area!==null)reasons.push("area_must_be_null");
    if(!(state==="unassessable"?ASSESSABILITY:UNKNOWABLE).has(row.reason))
      reasons.push("reason_state_mismatch");
  }
  return reasons;
}
/** Restricted local diagnostic for the LIVE v2 parsed response, held in memory.
 * Output is closed-category only. Never pass the raw parsed object into a log.
 */
export function inspectPrivateSkinV2AxisContract(parsed) {
  if(parsed?.schemaVersion!=="vision-observation-v2") {
    return {version:SKIN_PRIVATE_AXIS_DIAGNOSTIC_VERSION,
      status:"UNSUPPORTED_VERSION",axisDiagnostics:[],issues:["schema_invalid"]};
  }
  const eligible=parsed?.eligibility?.source==="vision" &&
    parsed?.eligibility?.skinAnalysisEligible===true;
  const raw=parsed?.skin?.axisEvidence;
  if(!Array.isArray(raw)) {
    return {version:SKIN_PRIVATE_AXIS_DIAGNOSTIC_VERSION,
      status:"AXIS_ROWS_MISSING",axisDiagnostics:[],issues:["axis_rows_invalid"]};
  }
  if(raw.length>16) {
    return {version:SKIN_PRIVATE_AXIS_DIAGNOSTIC_VERSION,
      status:"AXIS_ROWS_EXCESSIVE",axisDiagnostics:[],issues:["axis_rows_excessive"]};
  }
  if(!eligible) {
    return {version:SKIN_PRIVATE_AXIS_DIAGNOSTIC_VERSION,
      status:raw.length===0?"SKIN_INELIGIBLE_ZERO_AXES":"SKIN_INELIGIBLE_UNEXPECTED_AXES",
      axisDiagnostics:[],
      issues:raw.length===0?[]:["ineligible_nonempty_axes"]};
  }
  const rows=raw.filter(item=>object(item)&&AXES.has(item.axis));
  const out=SKIN_VISIBLE_AXES.map(axis=>{
    const matches=rows.filter(row=>row.axis===axis);
    let issues=[];
    let state="missing";
    if(matches.length===0) issues=["missing_axis"];
    else if(matches.length>1) {issues=["duplicate_axis"];state="invalid";}
    else {
      state=closedState(matches[0].state);
      issues=rowReasons(matches[0],axis);
    }
    return {axis,state,valid:issues.length===0,issues};
  });
  const existing=assessSkinAxisEvidence({
    schemaVersion:SKIN_AXIS_EVIDENCE_VERSION,axes:raw
  },{photoStatus:"available",skinAnalysisEligible:true});
  // If authoritative validator disagrees with this narrow diagnostic,
  // fail closed and suppress detailed claims instead of making up a cause.
  const localInvalid=out.filter(x=>!x.valid).map(x=>x.axis).sort();
  const coreInvalid=SKIN_VISIBLE_AXES.filter(axis=>
    existing.axes?.[axis]?.reason==="invalid_field"||
    existing.axes?.[axis]?.reason==="missing").sort();
  const unexpected=raw.some(row=>!object(row)||!AXES.has(row.axis));
  const contractMismatch=localInvalid.join("|")!==coreInvalid.join("|") ||
    (existing.status==="ready")!==(!localInvalid.length&&!unexpected);
  return {
    version:SKIN_PRIVATE_AXIS_DIAGNOSTIC_VERSION,
    status:contractMismatch?"DIAGNOSTIC_DISAGREES_WITH_CORE":
      existing.status==="ready"?"ELIGIBLE_ROWS_CONTRACT_READY":"ELIGIBLE_ROWS_CONTRACT_HOLD",
    axisDiagnostics:contractMismatch?[]:out,
    issues:contractMismatch?["diagnostic_core_disagreement"]:
      unexpected?["unsupported_axis_or_row"]:[]
  };
}
