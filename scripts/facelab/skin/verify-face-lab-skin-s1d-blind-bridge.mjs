import assert from 'node:assert/strict';
import {buildSkinS1DBlindReviewInputs,SKIN_S1D_CASES,SKIN_S1D_AXES} from './skin-s1d-blind-review-bridge.mjs';

// All inputs are fabricated metadata. No actual model observations or real reviewer truth.
const clone=x=>structuredClone(x);
const signal=(state,value,confidence)=>({state,value,confidence});
const lbl=(assessability,cue)=>({assessability,cue});
const model={schemaVersion:'skin-track3-s1d-model-predictions-v1',scope:'TC-01..TC-04',
  axes:[...SKIN_S1D_AXES],cases:SKIN_S1D_CASES.map(caseId=>({caseId,
    signals:Object.fromEntries(SKIN_S1D_AXES.map((axis,i)=>[axis,
      i===0?signal('not_seen',0,'medium'):
      i===1?signal('unassessable',null,'unknown'):signal('present',3,'high')]))}))};
const review=(reviewerId)=>({schemaVersion:'skin-s1d-blind-review-v1',reviewerId,
  scope:'TC-01..TC-04',cases:SKIN_S1D_CASES.map(caseId=>({caseId,
    signals:Object.fromEntries(SKIN_S1D_AXES.map(axis=>[axis,lbl('assessable','present')]))}))});
const tags={schemaVersion:'skin-s1d-capture-tags-v1',cases:SKIN_S1D_CASES.map(caseId=>({caseId,captureTags:['baseline']}))};
const a=review('A'),b=review('B');
const snap=JSON.stringify([model,a,b,tags]);
const run=(more={})=>buildSkinS1DBlindReviewInputs({model,reviewerA:a,reviewerB:b,captureTags:tags,datasetId:'synthetic_s1d',...more});
let o=run();
assert.equal(o.counts.agreedAssessable,28);assert.equal(o.counts.disagreed,0);
assert.equal(o.cueManifest.cases.length,4);
assert.equal(o.agreementManifest.cases.length,28);
assert.deepEqual(o.cueManifest.cases[0].signals.oiliness.prediction,{cue:'absent',confidence:'medium',rawScore:0});
assert.deepEqual(o.cueManifest.cases[0].signals.dehydration.prediction,{cue:'abstain',confidence:'unknown',rawScore:null});
assert.deepEqual(o.cueManifest.cases[0].signals.acne.prediction,{cue:'present',confidence:'high',rawScore:3});
assert.equal(o.cueManifest.evidenceFamily,'human_review');
assert.equal(o.authority.productionActivationAuthorized,false);
assert.equal(o.authority.referenceNotInferredFromModel,true);
assert.equal(JSON.stringify([model,a,b,tags]),snap,'no mutation');
assert.deepEqual(run({reviewerA:{...a,cases:[...a.cases].reverse()},reviewerB:{...b,cases:[...b.cases].reverse()}}),o);
function reject(changes,rx){assert.throws(()=>run(changes),rx)}
const wrong=clone(model);wrong.cases[0].signals.oiliness={state:'unknown',value:0,confidence:'unknown'};
reject({model:wrong},/model_abstention_invalid/);
const unknown=clone(model);unknown.cases[0].signals.acne.sourcePhoto='private.jpg';
reject({model:unknown},/model_axis_schema_invalid/);
const invalid=clone(model);invalid.cases.push(invalid.cases[0]);reject({model:invalid},/requires_four_cases/);
const extra=clone(a);extra.cases[0].signals.acne.imageUrl='https://example.org/face.jpg';
reject({reviewerA:extra},/review_axis_schema_invalid/);
const bad=clone(b);bad.cases[0].signals.oiliness={assessability:'not_assessable',cue:'present'};
reject({reviewerB:bad},/review_label_invalid/);
const noTags=clone(tags);noTags.cases[0].captureTags=['unverified_unlabeled'];
reject({captureTags:noTags},/capture_tags_invalid/);
const tc05=clone(model);tc05.cases[3].caseId='TC-05';reject({model:tc05},/case_set_invalid/);
const mismatch=clone(b);mismatch.cases[0].signals.acne=lbl('assessable','absent');
o=run({reviewerB:mismatch});assert.equal(o.counts.disagreed,1);assert.equal(o.counts.agreedAssessable,27);
assert.equal(Object.hasOwn(o.cueManifest.cases[0].signals,'acne'),false);
const allDisagree=clone(b);for(const c of allDisagree.cases)for(const x of SKIN_S1D_AXES)c.signals[x]=lbl('assessable','absent');
o=run({reviewerB:allDisagree});assert.equal(o.status,'HOLD_NO_AGREED_HUMAN_REFERENCE');
assert.equal(o.cueManifest,null);assert.equal(o.agreementManifest.cases.length,28);
const allHold=clone(a),allHoldB=clone(b);
for(const c of allHold.cases)for(const x of SKIN_S1D_AXES)c.signals[x]=lbl('not_assessable',null);
for(const c of allHoldB.cases)for(const x of SKIN_S1D_AXES)c.signals[x]=lbl('not_assessable',null);
o=run({reviewerA:allHold,reviewerB:allHoldB});assert.equal(o.counts.agreedNotAssessable,28);
assert.equal(o.counts.agreedAssessable,0);
assert.equal(o.cueManifest.cases[0].signals.oiliness.reference.cue,null);
assert.equal(o.cueManifest.cases[0].signals.oiliness.reference.assessability,'not_assessable');
console.log('verify-face-lab-skin-s1d-blind-bridge: PASS (synthetic-only, 4 cases x 7 axes; no provider/photos/human truth)');
