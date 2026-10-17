// S1-D private, offline research bridge. No Provider calls, photos, network, storage or inference.
// Human labels MUST be independently obtained; this module never fabricates references.
export const SKIN_S1D_BRIDGE_VERSION = 'skin-s1d-blind-review-bridge-v1';
export const SKIN_S1D_CASES = Object.freeze(['TC-01','TC-02','TC-03','TC-04']);
export const SKIN_S1D_AXES = Object.freeze([
  'oiliness','dehydration','acne','uneven_tone','pores','redness','barrier'
]);
const STATES = new Set(['present','not_seen','unassessable','unknown']);
const CONF = new Set(['low','medium','high','unknown']);
const ASSESS = new Set(['assessable','not_assessable','ambiguous']);
const CUE = new Set(['present','absent']);
const TAGS = new Set([
  'baseline','low_light','strong_glare','white_balance_shift','angle_change',
  'makeup_present','filter_suspected','skin_occluded','low_resolution',
  'different_device','controlled_repeat'
]);
const IDs = new Set(SKIN_S1D_CASES);
const AXES = new Set(SKIN_S1D_AXES);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const has = (x,k) => Object.prototype.hasOwnProperty.call(x,k);
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function keys(x, expected, where) {
  if (!record(x) || Object.keys(x).length !== expected.length ||
      !expected.every(k => has(x,k))) throw new Error(where+'_schema_invalid');
}
function exactCases(cases, where) {
  if (!Array.isArray(cases) || cases.length !== SKIN_S1D_CASES.length)
    throw new Error(where+'_requires_four_cases');
  const byId = new Map();
  for (const row of cases) {
    if (!record(row) || !IDs.has(row.caseId) || byId.has(row.caseId))
      throw new Error(where+'_case_set_invalid');
    byId.set(row.caseId,row);
  }
  if (!SKIN_S1D_CASES.every(id => byId.has(id))) throw new Error(where+'_case_missing');
  return byId;
}
function checkSeven(signals, where) {
  if (!record(signals) || Object.keys(signals).length !== SKIN_S1D_AXES.length ||
      !SKIN_S1D_AXES.every(axis=>has(signals,axis)) ||
      !Object.keys(signals).every(axis=>AXES.has(axis)))
    throw new Error(where+'_seven_axes_invalid');
}
function validateModel(input) {
  keys(input,['schemaVersion','scope','axes','cases'],'model');
  if (input.schemaVersion !== 'skin-track3-s1d-model-predictions-v1' || input.scope !== 'TC-01..TC-04' ||
      !Array.isArray(input.axes) || input.axes.length !== 7 ||
      !SKIN_S1D_AXES.every((ax,i)=>input.axes[i]===ax))
    throw new Error('model_version_or_scope_invalid');
  const rows=exactCases(input.cases,'model');
  for (const id of SKIN_S1D_CASES) {
    const r=rows.get(id);
    keys(r,['caseId','signals'],'model_case');
    checkSeven(r.signals,'model');
    for (const axis of SKIN_S1D_AXES) {
      const v=r.signals[axis];
      keys(v,['state','value','confidence'],'model_axis');
      if (!STATES.has(v.state) || !CONF.has(v.confidence)) throw new Error('model_state_invalid');
      if (v.state==='present') {
        if (!Number.isInteger(v.value) || v.value<1 || v.value>5 || v.confidence==='unknown')
          throw new Error('model_present_invalid');
      } else if (v.state==='not_seen') {
        // Explicit validated v2 state, not an inferred legacy zero.
        if (v.value!==0 || v.confidence==='unknown') throw new Error('model_not_seen_invalid');
      } else if (v.value!==null || v.confidence!=='unknown') {
        throw new Error('model_abstention_invalid');
      }
    }
  }
  return rows;
}
function validateReview(input, expected) {
  keys(input,['schemaVersion','reviewerId','scope','cases'],'review');
  if (input.schemaVersion!=='skin-s1d-blind-review-v1' || input.reviewerId!==expected ||
      input.scope!=='TC-01..TC-04') throw new Error('review_identity_or_scope_invalid');
  const rows=exactCases(input.cases,'review');
  for(const id of SKIN_S1D_CASES) {
    const r=rows.get(id);keys(r,['caseId','signals'],'review_case');checkSeven(r.signals,'review');
    for(const axis of SKIN_S1D_AXES) {
      const v=r.signals[axis];keys(v,['assessability','cue'],'review_axis');
      if(!ASSESS.has(v.assessability) ||
         (v.assessability==='assessable' ? !CUE.has(v.cue) : v.cue!==null))
        throw new Error('review_label_invalid');
    }
  }
  return rows;
}
function validateTags(input) {
  keys(input,['schemaVersion','cases'],'tags');
  if(input.schemaVersion!=='skin-s1d-capture-tags-v1') throw new Error('tags_schema_version_invalid');
  const rows=exactCases(input.cases,'tags');
  for(const id of SKIN_S1D_CASES) {
    const r=rows.get(id);keys(r,['caseId','captureTags'],'tags_case');
    if(!Array.isArray(r.captureTags) || !r.captureTags.length ||
       r.captureTags.length > TAGS.size || new Set(r.captureTags).size !== r.captureTags.length ||
       !r.captureTags.every(tag=>TAGS.has(tag))) throw new Error('capture_tags_invalid');
  }
  return rows;
}
function decodeModel(v) {
  return {cue:v.state==='present'?'present':v.state==='not_seen'?'absent':'abstain',
          confidence:v.confidence,rawScore:v.value};
}
export function buildSkinS1DBlindReviewInputs({model,reviewerA,reviewerB,captureTags,datasetId}) {
  if(typeof datasetId!=='string'||!ID.test(datasetId)) throw new Error('dataset_id_invalid');
  const m=validateModel(model),a=validateReview(reviewerA,'A'),b=validateReview(reviewerB,'B');
  const tags=validateTags(captureTags);
  const agreementRows=[],cueRows=[];
  let agreedAssessable=0,agreedNotAssessable=0,disagreed=0;
  for(const id of SKIN_S1D_CASES) {
    const signals={};
    for(const axis of SKIN_S1D_AXES) {
      const left=a.get(id).signals[axis],right=b.get(id).signals[axis];
      agreementRows.push({caseId:id,axis,reviewerA:{...left},reviewerB:{...right}});
      if(left.assessability!==right.assessability || left.cue!==right.cue) {
        disagreed++;
        continue; // Do not adjudicate by model output or majority vote.
      }
      if(left.assessability==='assessable') agreedAssessable++;else agreedNotAssessable++;
      signals[axis]={reference:{...left},prediction:decodeModel(m.get(id).signals[axis])};
    }
    if(Object.keys(signals).length) {
      // Distinct opaque groups: no ungrounded inference that images show the same person.
      cueRows.push({caseId:id,subjectGroupId:'isolated_'+id.replace('-','_'),
        captureTags:[...tags.get(id).captureTags],signals});
    }
  }
  const usable=agreedAssessable+agreedNotAssessable;
  return {
    version:SKIN_S1D_BRIDGE_VERSION,
    status:usable?'INPUTS_PREPARED_DIAGNOSTIC_ONLY':'HOLD_NO_AGREED_HUMAN_REFERENCE',
    counts:{cases:4,totalAxisRows:28,agreedAssessable,agreedNotAssessable,disagreed,usable},
    agreementManifest:{schemaVersion:'skin-annotation-agreement-v1',datasetId,cases:agreementRows},
    cueManifest:usable?{schemaVersion:'skin-cue-evaluation-v1',datasetId,
      evidenceFamily:'human_review',cases:cueRows}:null,
    authority:{reviewerBlindnessNotVerified:true,referenceNotInferredFromModel:true,
      v2NotSeenOnlyInterpretedFromExplicitState:true,disagreementsHeld:true,
      clinicalAccuracyNotEstablished:true,faceValueParityNotVerified:true,
      productionActivationAuthorized:false,releaseReady:false}
  };
}
