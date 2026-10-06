import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { compareEvidence, configurationRequests, isolatedEvidence, lockClosure, normalizeSnapshotPaths, rootDependencyDiff, scanSourceRequests, shadowPlan, verifySelectedJobs } from './resolve-mobile-ci-impact.mjs';
const ts = createRequire(path.join(process.cwd(), 'package.json'))('typescript');
const candidate = 'a'.repeat(40), base = 'b'.repeat(40);
const source = [['apps/mobile/app/index.tsx', 'import type { Session } from "@supabase/auth-js"; export { a } from "expo-file-system/legacy"; import React from "react";']];
const imports = scanSourceRequests(ts, source);
const lock = {lockfileVersion:3,packages:{
  'apps/mobile':{dependencies:{react:'19','expo-crypto':'57'}},'packages/shared':{},'packages/face-contracts':{},
  'node_modules/react':{version:'19',integrity:'react-pinned'},
  'node_modules/expo-crypto':{version:'57',integrity:'crypto-pinned',peerDependencies:{react:'*'}},
  'node_modules/@supabase/auth-js':{version:'2',integrity:'auth-pinned'},
  'node_modules/expo-file-system':{version:'57',integrity:'filesystem-pinned'},
  'node_modules/web-only':{version:'1',integrity:'web-pinned'},
}};
const evidence = value => ({global:{workspaces:['apps/*'],scripts:{postinstall:'fixed'}},imports,
  closure:lockClosure(value,imports),native:{android:{modules:['crypto']},apple:{modules:['crypto']},unknownField:['preserved']}});
const clone = value => structuredClone(value);
const baseEvidence = evidence(lock);
const allNeeds = () => Object.fromEntries(['mobile-impact-plan','android-debug-apk','native-shell-smoke','store-capture-20a','store-capture-20b','ios-native-shell'].map(name=>[name,{result:'success',...(name==='mobile-impact-plan'?{outputs:{candidate_sha:candidate,run_android:'true',run_ios:'true',shadow:'true'}}:{})}]));

test('web-only lock change is an impact candidate; shadow still selects both platforms',()=>{
  const changed=clone(lock); changed.packages['node_modules/web-only'].version='2';
  const proof=compareEvidence(baseEvidence,evidence(changed)); assert.equal(proof.impact,'no-mobile-impact');
  const plan=shadowPlan({event:'pull_request',base,candidate,diff:'M\0package-lock.json\0',evidence:proof});
  assert.equal(plan.run_android,true); assert.equal(plan.run_ios,true); assert.equal(plan.shadow,true);
});
for(const [name,key] of [['shared React','node_modules/react'],['expo-crypto','node_modules/expo-crypto'],['implicit auth import','node_modules/@supabase/auth-js'],['implicit file-system import','node_modules/expo-file-system']]) {
  test(name+' resolution change selects full native',()=>{
    const changed=clone(lock); changed.packages[key].integrity='different';
    assert.equal(compareEvidence(baseEvidence,evidence(changed)).reason,'mobile-resolution-changed');
  });
}
test('peer hoisting changes the physical mobile resolver location',()=>{
  const changed=clone(lock); changed.packages['apps/mobile/node_modules/react']=clone(changed.packages['node_modules/react']);
  assert.equal(compareEvidence(baseEvidence,evidence(changed)).impact,'full-native');
});
test('optional peer appearing changes the resolution graph',()=>{
  const before=clone(lock); before.packages['node_modules/react'].peerDependencies={optional:'*'};
  before.packages['node_modules/react'].peerDependenciesMeta={optional:{optional:true}};
  const after=clone(before); after.packages['node_modules/optional']={version:'1'};
  assert.equal(compareEvidence(evidence(before),evidence(after)).impact,'full-native');
});
test('unknown lock and native fields remain meaningful',()=>{
  const changed=clone(lock); changed.packages['node_modules/react'].newField={condition:'other'};
  assert.equal(compareEvidence(baseEvidence,evidence(changed)).impact,'full-native');
  const head=clone(baseEvidence); head.native.unknownField=['different'];
  assert.equal(compareEvidence(baseEvidence,head).reason,'native-discovery-changed');
});
test('global install hook and conditional export order changes require full native',()=>{
  const head=clone(baseEvidence); head.global.scripts.postinstall='different';
  assert.equal(compareEvidence(baseEvidence,head).reason,'global-install-condition-changed');
  const left=clone(baseEvidence),right=clone(baseEvidence);
  left.global.exports={native:'./a',default:'./b'}; right.global.exports={default:'./b',native:'./a'};
  assert.equal(compareEvidence(left,right).impact,'full-native');
});
test('source/config/module changes and deleted/renamed/unknown paths cannot enter root-only proof',()=>{
  for(const diff of ['M\0apps/mobile/app.json\0','D\0package-lock.json\0','R100\0package.json\0renamed.json\0','M\0unknown\0','M\0package.json','']) assert.equal(rootDependencyDiff(diff),false);
  assert.equal(rootDependencyDiff('M\0package.json\0M\0package-lock.json\0'),true);
});
test('manual, missing/zero base and unsupported events always select both platforms',()=>{
  for(const args of [{event:'workflow_dispatch',base},{event:'push',base:'0'.repeat(40)},{event:'pull_request',base:''},{event:'schedule',base}]) {
    const plan=shadowPlan({...args,candidate,diff:'M\0package-lock.json\0',evidence:{impact:'no-mobile-impact'}});
    assert.equal(plan.impact,'full-native'); assert.equal(plan.run_android,true); assert.equal(plan.run_ios,true);
  }
});
test('incomplete evidence cannot become a no-impact proof',()=>{
  const head=clone(baseEvidence); delete head.native;
  assert.equal(compareEvidence(baseEvidence,head).impact,'full-native');
  assert.equal(shadowPlan({event:'pull_request',base,candidate,diff:'M\0package-lock.json\0'}).reason,'incomplete-evidence');
});
test('unsupported parser syntax, dynamic loaders and imports outside the source boundary reject proof',()=>{
  for(const code of ['import(name)','require(name)','const r=createRequire(import.meta.url)','const loader=require; loader(name)','const run=eval; run(code)','import { createRequire as cr } from "node:module"','import "../../../../server"','import {']) assert.throws(()=>scanSourceRequests(ts,[['apps/mobile/app/index.tsx',code]]));
});
test('all literal import forms include implicit package subpaths',()=>{
  const result=scanSourceRequests(ts,[['apps/mobile/app/index.tsx','import a = require("@supabase/auth-js"); const f = require.resolve("expo-file-system/legacy"); type X = import("react").X;']]);
  assert.deepEqual(result.map(([,name])=>name).sort(),['@supabase/auth-js','expo-file-system','react']);
});
test('normalization touches snapshot path values only and preserves unknown fields/order',()=>{
  const input={path:'/tmp/one/node_modules/react',near:'/tmp/one-more/value',exports:{native:'a',default:'b'},extra:[1,2]};
  const result=normalizeSnapshotPaths(input,'/tmp/one');
  assert.equal(result.path,'<snapshot>/node_modules/react'); assert.equal(result.near,input.near);
  assert.deepEqual(result.exports,input.exports); assert.deepEqual(result.extra,[1,2]);
});
test('planner crash/missing outputs/stale SHA are workflow failures',()=>{
  for(const change of [needs=>needs['mobile-impact-plan'].result='failure',needs=>delete needs['mobile-impact-plan'].outputs,needs=>needs['mobile-impact-plan'].outputs.candidate_sha=base]) {
    const needs=allNeeds(); change(needs); assert.throws(()=>verifySelectedJobs('android',needs,candidate));
  }
});
test('producer/capture/smoke failure or skip cannot be hidden by final guard',()=>{
  for(const name of ['android-debug-apk','native-shell-smoke','store-capture-20a','store-capture-20b']) for(const status of ['failure','skipped','cancelled']) {
    const needs=allNeeds(); needs[name].result=status; assert.throws(()=>verifySelectedJobs('android',needs,candidate));
  }
});
test('iOS failure is a workflow failure and full current selection passes',()=>{
  const needs=allNeeds(); assert.equal(verifySelectedJobs('ios',needs,candidate),true);
  assert.equal(verifySelectedJobs('android',needs,candidate),true);
  needs['ios-native-shell'].result='failure'; assert.throws(()=>verifySelectedJobs('ios',needs,candidate));
});
test('skip activation is absent regardless of cache/protection/evidence conditions',()=>{
  const needs=allNeeds(); needs['mobile-impact-plan'].outputs.run_android='false';
  assert.throws(()=>verifySelectedJobs('android',needs,candidate));
  assert.throws(()=>shadowPlan({event:'pull_request',candidate:'0'.repeat(40),base,diff:''}));
});
test('unsupported lock and unresolved nonoptional imports cannot prove no impact',()=>{
  assert.throws(()=>lockClosure({...lock,lockfileVersion:2},imports));
  assert.throws(()=>lockClosure(lock,[['apps/mobile/app','missing']]));
});
test('entry and undeclared Expo plugin packages are explicit resolver roots',()=>{
  const requests=configurationRequests([], {expo:{plugins:[['extra-plugin',{}]]}}, {extends:'expo/tsconfig.base'}, {}, {main:'expo-router/entry'});
  assert.deepEqual(requests,[['apps/mobile','expo-router'],['apps/mobile','extra-plugin']]);
  const before=clone(lock); before.packages['node_modules/expo-router']={version:'57'};
  before.packages['node_modules/extra-plugin']={version:'1',integrity:'plugin-pinned'};
  const after=clone(before); after.packages['node_modules/extra-plugin'].integrity='changed';
  assert.notDeepEqual(lockClosure(before,requests),lockClosure(after,requests));
});
test('dynamic Babel/Metro/app config cannot be classified by JSON alone',()=>{
  for(const file of ['babel.config.js','apps/mobile/metro.config.js','apps/mobile/app.config.ts','react-native.config.js','.babelrc'])
    assert.throws(()=>configurationRequests([file],{expo:{plugins:[]}},{extends:'expo/tsconfig.base'},{},{main:'expo-router/entry'}));
});
test('custom aliases, JSX resolver and package mappings require full native',()=>{
  for(const option of ['paths','jsxImportSource','baseUrl','plugins'])
    assert.throws(()=>configurationRequests([],{expo:{plugins:[]}},{extends:'expo/tsconfig.base',compilerOptions:{[option]:{}}},{},{main:'expo-router/entry'}));
  assert.throws(()=>configurationRequests([],{expo:{plugins:[]}},{extends:'expo/tsconfig.base'},{browser:{}},{main:'expo-router/entry'}));
});

// The expensive SDK fixture runs for classifier changes, not every app change.
// Ordinary fixtures above always run using the already-installed pinned TypeScript.
function requiresSdkFixture() {
  if (process.env.MOBILE_CI_IMPACT_REAL_FIXTURE === '1') return true;
  if (process.env.CI !== 'true') return false;
  const base = process.env.MOBILE_CI_BASE_SHA;
  if (!/^[a-f0-9]{40}$/.test(base || '') || /^0+$/.test(base)) return true;
  try {
    const files = execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD']).toString().split('\0');
    return ['scripts/resolve-mobile-ci-impact.mjs', 'scripts/test-mobile-ci-impact.mjs'].some(file=>files.includes(file));
  } catch { return true; }
}
test('real fixed SDK resolves a web-only version fixture equally in isolated installs', {skip:!requiresSdkFixture(),timeout:420000},()=>{
  const sha = execFileSync('git',['rev-parse','HEAD']).toString().trim();
  const started = Date.now();
  const result = isolatedEvidence(sha,sha,(_base,head)=>{
    const pkgFile = path.join(head,'package.json'),lockFile = path.join(head,'package-lock.json');
    const pkg = JSON.parse(readFileSync(pkgFile,'utf8')),lock = JSON.parse(readFileSync(lockFile,'utf8'));
    assert(pkg.dependencies['html-to-image']);
    assert.notEqual(lock.packages['node_modules/html-to-image'].version,'1.11.12','Update the fixed web fixture when its baseline changes');
    pkg.dependencies['html-to-image']='1.11.12'; lock.packages[''].dependencies['html-to-image']='1.11.12';
    Object.assign(lock.packages['node_modules/html-to-image'],{
      version:'1.11.12',resolved:'https://registry.npmjs.org/html-to-image/-/html-to-image-1.11.12.tgz',
      integrity:'sha512-rhfgxyBJ8wLGqetvYk0EmaiPQs+b5JqApb2ImZf46pt8QIw/UzGISXMXTZ/UARnU02TSrTmZMqF0ncIRa/4k4Q==',
    });
    writeFileSync(pkgFile,JSON.stringify(pkg,null,2)); writeFileSync(lockFile,JSON.stringify(lock,null,2));
  });
  assert.equal(result.impact,'no-mobile-impact');
  console.log(JSON.stringify({marker:'MOBILE_CI_REAL_WEB_FIXTURE=PASS',scope:'temporary package/lock overlay; no app or repo lock change',duration_ms:Date.now()-started,fingerprint:result.fingerprint}));
});
