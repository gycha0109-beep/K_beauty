#!/usr/bin/env node
// Run privately only after independently collected reviewer labels and verified capture tags.
// No images or provider keys; stdout aggregate only; never write into repo/CI.
import {readFileSync} from 'node:fs';
import {buildSkinS1DBlindReviewInputs} from './skin-s1d-blind-review-bridge.mjs';
import {evaluateSkinAnnotationAgreement} from './skin-human-annotation-agreement.mjs';
import {evaluateSkinCues} from './skin-cue-evaluation-core.mjs';

const argv=process.argv.slice(2);
if(argv.length!==5){
  console.error('Usage: node scripts/facelab/skin/run-skin-s1d-blind-review.mjs <private-model.json> <private-review-A.json> <private-review-B.json> <private-capture-tags.json> <opaque-dataset-id>');
  process.exitCode=2;
} else {
  try {
    const read=p=>{
      let bytes;try{bytes=readFileSync(p);}catch{throw Error('private_metadata_read_error');}
      if(bytes.length>256*1024)throw Error('private_metadata_too_large');
      try{return JSON.parse(bytes.toString('utf8'));}catch{throw Error('private_metadata_json_invalid');}
    };
    const bridge=buildSkinS1DBlindReviewInputs({
      model:read(argv[0]),reviewerA:read(argv[1]),reviewerB:read(argv[2]),
      captureTags:read(argv[3]),datasetId:argv[4]
    });
    const agreement=evaluateSkinAnnotationAgreement(bridge.agreementManifest);
    const cue=bridge.cueManifest?evaluateSkinCues(bridge.cueManifest):null;
    process.stdout.write(JSON.stringify({
      version:bridge.version,scope:'TC-01..TC-04',status:bridge.status,
      counts:bridge.counts,
      independentAgreement:{status:agreement.status,overall:agreement.overall,
        byAxis:agreement.byAxis,disagreements:agreement.disagreements},
      provisionalCueMetrics:cue?{
        count:cue.count,axes:cue.axes,strata:cue.strata,
        note:'Agreement-filtered visual cue metrics only. NOT clinical accuracy, unbiased truth or deployment approval.'
      }:null,
      authority:{...bridge.authority,reviewerIndependenceExternallyVerified:false,
        humanTruthCertified:false,realPhotoAccuracyCertified:false}
    },null,2)+'\n');
  } catch(e){
    // Do not log source content, filenames or error stacks; names are not required to debug schema holds.
    console.error('S1D_PRIVATE_HOLD: '+String(e?.message||'validation_failure'));
    process.exitCode=1;
  }
}
