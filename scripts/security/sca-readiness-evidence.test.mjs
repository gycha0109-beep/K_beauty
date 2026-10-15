import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScaReadiness,projectAudit} from './sca-readiness-evidence.mjs';

const HEAD='a'.repeat(40),REF='b'.repeat(40);
function audit({high=0,moderate=0,critical=0,leaves=[]}={}){
  const vulnerabilities={};
  for(const [i,v] of leaves.entries())vulnerabilities['dep-'+i]={via:[{name:v.name||'braces',url:'https://github.com/advisories/'+v.id,severity:v.severity||'high'}]};
  return {metadata:{vulnerabilities:{info:0,low:0,moderate,high,critical,total:high+moderate+critical}},vulnerabilities};
}
const input=(f,p)=>({checkedOutHead:HEAD,expectedHead:HEAD,sourceReceiptHead:REF,
  full:{exitCode:f.metadata.vulnerabilities.total?1:0,payload:f},
  production:{exitCode:p.metadata.vulnerabilities.total?1:0,payload:p}});
test('reported high counts remain failure and advisory leaves are deduplicated',()=>{
  const v=audit({high:22,moderate:13,leaves:[{id:'GHSA-vfj7-8cjw-p6xm'},{id:'GHSA-vfj7-8cjw-p6xm'}]});
  const result=buildScaReadiness(input(v,audit({high:19,moderate:11})));
  assert.equal(result.rawAudit.gate,'FAIL_UNRESOLVED');
  assert.equal(result.rawAudit.full.counts.high,22);
  assert.equal(result.rawAudit.full.advisoryLeaves.length,1);
  assert.equal(result.decision,'HOLD_EXTERNAL_APPROVAL_AND_CANONICAL_AUDIT');
  assert.equal(result.releaseAuthorized,false);
  assert.equal(result.boundaries.actualProductLockInstalledAndVerified,'NOT_ATTESTED');
});
test('even a clean audit cannot authorize packaging, merge or production',()=>{
  const result=buildScaReadiness(input(audit(),audit()));
  assert.equal(result.rawAudit.gate,'HIGH_CRITICAL_ZERO');
  assert.equal(result.decision,'HOLD_EXTERNAL_APPROVAL_AND_CANONICAL_AUDIT');
  assert.equal(result.releaseAuthorized,false);
  assert.equal(result.boundaries.production,'NOT_AUTHORIZED');
});
test('moderates do not falsely turn high/critical gate red, but require separate official verifier',()=>{
  const result=buildScaReadiness(input(audit({moderate:2}),audit({moderate:1})));
  assert.equal(result.rawAudit.gate,'HIGH_CRITICAL_ZERO');
  assert.equal(result.rawAudit.officialVerifier,'SEPARATE_REQUIRED_GATE');
  assert.equal(result.rawAudit.full.exitCode,1);
});
test('rejects wrong exact-head checkout, audit outage, forged counts and incorrect exits',()=>{
  const good=input(audit(),audit());
  assert.throws(()=>buildScaReadiness({...good,expectedHead:'c'.repeat(40)}),/checkout SHA/);
  assert.throws(()=>buildScaReadiness({...good,sourceReceiptHead:'not-a-sha'}),/exact git SHA/);
  assert.throws(()=>projectAudit({label:'full',exitCode:2,payload:audit()}),/0 or 1/);
  assert.throws(()=>projectAudit({label:'full',exitCode:0,payload:audit({high:1})}),/inconsistent vulnerable/);
  const bad=audit({high:1});bad.metadata.vulnerabilities.total=2;
  assert.throws(()=>projectAudit({label:'full',exitCode:1,payload:bad}),/inconsistent totals/);
  const err=audit();err.error='registry_offline';
  assert.throws(()=>projectAudit({label:'full',exitCode:1,payload:err}),/service error/);
  const malformed=audit({high:1,leaves:[{id:'not-a-ghsa'}]});
  assert.throws(()=>projectAudit({label:'full',exitCode:1,payload:malformed}),/unrecognized advisory/);
});
