import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateP2OfflinePolicy,reviewP2Preparation} from './sca-p2-offline-readiness.mjs';
import {reference} from './sca-release-bundle.mjs';

const authorization=JSON.parse(fs.readFileSync('security/release/sca-p2-preparation-authorization.json','utf8'));
const registry=JSON.parse(fs.readFileSync('security/release/sca-p2-registry-plan.json','utf8'));
const copy=x=>structuredClone(x);

test('single accountable project owner approves only offline preparation',()=>{
  assert.deepEqual(validateP2OfflinePolicy({authorization,plan:registry}),{
    ownerGovernance:'SINGLE_OWNER_PREPARATION_APPROVED',
    registryState:'OFFLINE_DESIGN_ONLY',actualPublish:false
  });
});
test('fake extra human approval is unnecessary, but authorization cannot become publishing',()=>{
  for(const [key,value]of [
    ['formalReleaseApproval','GRANTED'],['privateRegistrySelected',true],
    ['signingKeyRegistered',true],['officialAuditStatus','PASS']
  ]){
    const copyAuth=copy(authorization);copyAuth[key]=value;
    assert.throws(()=>validateP2OfflinePolicy({authorization:copyAuth,plan:registry}));
  }
  const multi=copy(authorization);multi.governance.mode='multi-owner';
  assert.throws(()=>validateP2OfflinePolicy({authorization:multi,plan:registry}));
});
test('fail closed on any implied live registry, credentials, publication or cost',()=>{
  for(const [key,value]of [
    ['state','LIVE'],['providerSelected',true],['endpoint','https://repo.example.org/'],
    ['credentialsProvisioned',true],['paidServicesAuthorized',true],
    ['actualPackagePublicationAuthorized',true],['packagesPublished',true],
    ['externalCapabilitiesVerified',true],['packageNamesMustRemainUnscoped',false]
  ]){
    const plan=copy(registry);plan[key]=value;
    assert.throws(()=>validateP2OfflinePolicy({authorization,plan}),key);
  }
});
test('rejects scoped alias and missing private artifact invariants',()=>{
  const scoped=copy(registry);scoped.packages=['@fork/braces@3.0.3','node-forge@1.4.0'];
  assert.throws(()=>validateP2OfflinePolicy({authorization,plan:scoped}),/deep|equal|packages/);
  for(const key of Object.keys(registry.candidateRequirements)){
    const plan=copy(registry);plan.candidateRequirements[key]=false;
    assert.throws(()=>validateP2OfflinePolicy({authorization,plan}),/missing proposed registry capability/);
  }
});
test('license review refuses missing or incorrect original bytes independently of approval',()=>{
  const expected=reference.installed.find(x=>x.name==='node-forge').fileSha256.LICENSE;
  assert.throws(()=>reviewP2Preparation({authorization,plan:registry,forgeLicense:'not a license',expectedForgeLicenseSha256:expected}),/actual forge upstream license bytes/);
  assert.throws(()=>reviewP2Preparation({authorization,plan:registry,forgeLicense:'x'.repeat(1000),expectedForgeLicenseSha256:expected}),/does not match pinned source bytes/);
  assert.throws(()=>reviewP2Preparation({authorization,plan:registry,forgeLicense:'x'.repeat(1000),expectedForgeLicenseSha256:'z'.repeat(64)}),/pinned forge LICENSE SHA256/);
});
