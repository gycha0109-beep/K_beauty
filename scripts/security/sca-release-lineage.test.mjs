import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import {lineageEvidence,cleanedUtility,bundleModuleInventory,lineageAssessment,supplementalNotices,cleanupProfile} from './sca-release-lineage.mjs';

test('primary grant packet is byte-pinned and cannot imply final approval',()=>{
  const e=lineageEvidence();assert.equal(Object.keys(e.files).length,9);assert.equal(e.manifest.legalApproval,false);
  const n=supplementalNotices().toString();assert.match(n,/permission notice shall be included/i);assert.match(n,/webpack/i);assert.match(n,/Flash integration is not shipped/);
});
test('cleanup refuses unrecognized original utility bytes',()=>{
  assert.throws(()=>cleanedUtility(Buffer.from('modified upstream bytes')));
});
test('native helpers handle own properties and preserve binary unit boundaries',()=>{
  const patch=JSON.parse(lineageEvidence().files['util-replacements.json']),util={formatNumber:(v,d,point,sep)=>JSON.stringify([Number.isFinite(v)?v:String(v),d,point,sep])};
  for(const h of patch.hunks)runInNewContext(h.after,{util});
  assert.equal(util.isEmpty(Object.create({inherited:1})),true);assert.equal(util.isEmpty(Object.assign(Object.create(null),{x:1})),false);
  assert.equal(util.isEmpty({hasOwnProperty:null}),false);assert.equal(util.isEmpty(null),true);
  assert.equal(util.formatSize(1024),'[1,0,null,null] KiB');assert.equal(util.formatSize(1048576),'[1,2,".",""] MiB');assert.equal(util.formatSize(1073741824),'[1,2,".",""] GiB');
  assert.equal(util.formatSize(NaN),'["NaN",0,null,null] bytes');
});
test('compiler module closure rejects unreviewed runtime dependency',()=>{
  const stats={children:[{errors:[],assets:[{name:'forge.min.js'}],modules:[{name:'./node_modules/unreviewed/index.js'}]}]};
  assert.throws(()=>bundleModuleInventory(stats,os.tmpdir()),/unreviewed runtime module/);
});
test('compiler module closure rejects omitted bundles and compile errors',()=>{
  assert.throws(()=>bundleModuleInventory({children:[]},os.tmpdir()));
  assert.throws(()=>bundleModuleInventory({errors:['compile failure']},os.tmpdir()));
});
test('lineage B uncertainties remain disclosed and removed code is not cleared',()=>{
  const result=lineageAssessment({sourceLineageCleanup:cleanupProfile,moduleInventory:[]});
  assert.equal(result.legalApproval,false);assert.equal(result.redistributionApproved,false);assert.match(result.finalOwnerDecision,/PENDING/);
  for(const id of ['aes-jscrypto-sjcl','tweetnacl-ed25519','phpjs-number-format'])assert.equal(result.components.find(c=>c.id===id).classification,'B');
  for(const id of ['historical-oaep','legacy-flash-flex','stackoverflow-isempty','snipplr-size-formatter'])assert.equal(result.components.find(c=>c.id===id).classification,'D');
  assert.throws(()=>lineageAssessment({sourceLineageCleanup:'UNREVIEWED',moduleInventory:[]}));
});

test('Linux external webpack harness is normalized only after version and byte checks',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lineage-webpack-'));
  try{
    const pkg=path.join(temp,'webpack-harness/node_modules/webpack'),file=path.join(pkg,'buildin/global.js'),dir=path.join(temp,'forge');
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.mkdirSync(dir);fs.writeFileSync(file,lineageEvidence().files['webpack-global.js']);fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({version:'4.44.1'}));
    const stats={children:['forge.min.js','forge.all.min.js','prime.worker.min.js'].map(name=>({errors:[],assets:[{name}],modules:[{name:'../webpack-harness/node_modules/webpack/buildin/global.js',identifier:file}]}))};
    const result=bundleModuleInventory(stats,dir);assert.equal(result.length,3);assert.ok(result.every(b=>b.modules[0].path==='webpack/buildin/global.js'));
    fs.writeFileSync(file,'substituted runtime');assert.throws(()=>bundleModuleInventory(stats,dir));
    fs.writeFileSync(file,lineageEvidence().files['webpack-global.js']);fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({version:'4.44.2'}));assert.throws(()=>bundleModuleInventory(stats,dir),/unreviewed webpack runtime version/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
