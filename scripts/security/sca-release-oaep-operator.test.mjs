import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {verifyPublicationCandidate,verifyPublicationReadback} from './publish-approved-sca-scoped-candidate.mjs';

test('publication dispatch rejects unknown profile before admission',()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'oaep-dispatch-'));
  try{fs.writeFileSync(path.join(output,'scoped-candidate.json'),JSON.stringify({schema:'unreviewed'}));assert.throws(()=>verifyPublicationCandidate({originals:{},output}),/unknown publication candidate profile/);}
  finally{fs.rmSync(output,{recursive:true,force:true});}
});
test('replacement dispatch cannot fall back to legacy or admit a manifest alone',()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'oaep-dispatch-'));
  try{fs.writeFileSync(path.join(output,'scoped-candidate.json'),JSON.stringify({schema:'bejewely.oaep-replacement-scoped-candidate.v1'}));assert.throws(()=>verifyPublicationCandidate({originals:{},output}));}
  finally{fs.rmSync(output,{recursive:true,force:true});}
});
test('replacement readback refuses public and prematurely linked package metadata',()=>{
  const artifact={originalName:'node-forge'},receipt={publicationLinkage:'UNLINKED_BOOTSTRAP',manifest:{schema:'bejewely.oaep-replacement-scoped-candidate.v1'},artifacts:[artifact]};
  const metadata={package_type:'npm',name:'@gycha0109-beep/node-forge',owner:{login:'gycha0109-beep'},visibility:'private'};
  const check=m=>verifyPublicationReadback({receipt,artifact,originalName:'node-forge',metadata:m});
  assert.throws(()=>check({...metadata,visibility:'public'}),/privacy/);
  assert.throws(()=>check({...metadata,repository:{full_name:'gycha0109-beep/K_beauty'}}),/unexpectedly linked/);
});
