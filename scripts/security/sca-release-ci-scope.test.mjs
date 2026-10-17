import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {determineScaScope,runtimePath,runtimeReferenceVerified} from './sca-release-ci-scope.mjs';

function fixture(){
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'sca-ci-scope-'));
  const git=a=>{const r=spawnSync('git',a,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  const write=(p,s)=>{fs.mkdirSync(path.dirname(path.join(cwd,p)),{recursive:true});fs.writeFileSync(path.join(cwd,p),s);};
  git(['init','-q']);git(['config','user.name','Synthetic CI test']);git(['config','user.email','synthetic@example.invalid']);
  write('.github/workflows/sca-release-readiness.yml',"node-version: 22\njava-version: '17'\n");write('package-lock.json','{}');
  const commit=()=>{git(['add','.']);git(['commit','-qm','synthetic fixture']);return git(['rev-parse','HEAD']);};
  const ref={schema:'bejewely.sca-runtime-reference.v1',head:commit(),run:1,nodeVersion:process.versions.node,producerJob:11,replayJob:12};
  return {cwd,ref,write,commit,scope:more=>determineScaScope({cwd,ref,verifyReference:async()=>true,...more}),close:()=>fs.rmSync(cwd,{recursive:true,force:true})};
}
test('release policy/notice/workflow-only delta reuses real reference and reports its exact SHA',async()=>{
  const f=fixture();try{f.write('security/release/NOTICE.md','changed licensing text');f.write('scripts/security/sca-release-ci-scope.mjs','scoped CI');f.commit();
    const r=await f.scope();assert.equal(r.runtimeRequired,false);assert.equal(r.referenceHead,f.ref.head);
  }finally{f.close();}
});
test('lock, app, native/vendor patches, source provenance and unknown paths require full runtime',async()=>{
  for(const p of ['package-lock.json','apps/mobile/app/a.tsx','security/vendor/node-forge/source-manifest.json',
    'security/release/sca-b6-browser-provenance.json','scripts/security/materialize-private-forge-source.mjs','unclassified/new-input.txt']){
    const f=fixture();try{f.write(p,'runtime changed');f.commit();assert.equal((await f.scope()).runtimeRequired,true,p);}finally{f.close();}
  }
});
test('unavailable/non-ancestor proof, denied evidence and changed Node/JDK do not reuse runtime',async()=>{
  const f=fixture();try{
    assert.equal((await f.scope({verifyReference:async()=>false})).runtimeRequired,true);
    assert.equal((await f.scope({nodeVersion:'999.0.0'})).runtimeRequired,true);
    assert.equal((await f.scope({ref:{...f.ref,head:'0'.repeat(40)}})).runtimeRequired,true);
    f.write('.github/workflows/sca-release-readiness.yml','node-version: 22\njava-version: 21\n');f.commit();
    assert.equal((await f.scope()).runtimeRequired,true);
  }finally{f.close();}
});
test('runtime path selection covers every workspace and browser/tool source',()=>{
  for(const p of ['crawler/package.json','packages/shared/package-lock.json','public/a.js','metro.config.js','scripts/security/run-sca-b3-forge-browser-dist-rebuild-probe.mjs'])assert.equal(runtimePath(p),true,p);
});
test('reference API must prove exact HEAD and both completed successful jobs; failed original audit is never reused',async()=>{
  const ref={head:'a'.repeat(40),run:1,producerJob:11,replayJob:12};
  const mock=(bad=false)=>async(u,o)=>{assert.ok(u.startsWith('https://api.github.com/repos/gycha0109-beep/K_beauty/actions/runs/1'));
    assert.equal(o.redirect,'error');return {ok:true,json:async()=>u.includes('/jobs?')?{jobs:[11,12].map(id=>({id,head_sha:ref.head,status:'completed',conclusion:bad?'failure':'success'}))}:{head_sha:ref.head,status:'completed',conclusion:'failure'}};};
  assert.equal(await runtimeReferenceVerified(ref,'SYNTHETIC_NOT_A_TOKEN',mock()),true);
  assert.equal(await runtimeReferenceVerified(ref,'SYNTHETIC_NOT_A_TOKEN',mock(true)),false);
  assert.equal(await runtimeReferenceVerified(ref,''),false);
  assert.equal(await runtimeReferenceVerified(ref,'SYNTHETIC_NOT_A_TOKEN',async()=>{throw Error('denied');}),false);
});
