import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeAuditCauses} from './sca-audit-root-causes.mjs';

const advisory=(name,id,range,severity='high')=>({name,severity,range,url:'https://github.com/advisories/'+id});
const pkg=(name,severity,via)=>({name,severity,via,isDirect:false,effects:[],nodes:['node_modules/'+name]});
const braces=advisory('braces','GHSA-vfj7-8cjw-p6xm','<=3.0.3');
const forge=advisory('node-forge','GHSA-86w9-cpqp-85rv','<=1.4.0');
function fixture(){return {vulnerabilities:{
  braces:pkg('braces','high',[braces]),
  micromatch:pkg('micromatch','high',['braces']),
  metro:pkg('metro','high',['micromatch','metro-config']),
  'metro-config':pkg('metro-config','high',['metro']),
  'node-forge':pkg('node-forge','high',[forge]),
  '@expo/cli':pkg('@expo/cli','high',['node-forge']),
  expo:pkg('expo','high',['@expo/cli','metro'])
}};}
test('resolves both concrete high advisories through a Metro cycle to their consumers',()=>{
  const out=analyzeAuditCauses(fixture());
  assert.equal(out.counts.affectedVulnerabilityNodes,7);
  assert.equal(out.counts.highSeverityLeaves,2);
  assert.equal(out.highCauseDisposition,'KNOWN_HIGH_WITHOUT_OFFICIAL_FIX_RELEASE');
  const by=Object.fromEntries(out.causes.map(x=>[x.id,x]));
  assert.deepEqual(by['GHSA-vfj7-8cjw-p6xm'].affectedPackages,['braces','expo','metro','metro-config','micromatch']);
  assert.deepEqual(by['GHSA-86w9-cpqp-85rv'].affectedPackages,['@expo/cli','expo','node-forge']);
  assert.equal(by['GHSA-vfj7-8cjw-p6xm'].sourceSnapshot.ownerApproval,'REQUIRED');
  assert.equal(out.informationalOnly,true);
});
test('new or changed high advisories cannot inherit existing review',()=>{
  const payload=fixture();
  payload.vulnerabilities.braces.via=[advisory('braces','GHSA-new1-new2-new3','<=3.0.3')];
  let x=analyzeAuditCauses(payload);
  assert.equal(x.highCauseDisposition,'REVIEW_NEW_HIGH_SOURCE');
  assert.deepEqual(x.unreviewedHighIds,['GHSA-new1-new2-new3']);
  payload.vulnerabilities.braces.via=[advisory('braces','GHSA-vfj7-8cjw-p6xm','<=3.0.4')];
  x=analyzeAuditCauses(payload);
  assert.equal(x.highCauseDisposition,'REVIEW_NEW_HIGH_SOURCE');
});
test('moderate leaves do not become high remediation, zero vulnerabilities are not approved',()=>{
  const payload={vulnerabilities:{uuid:pkg('uuid','moderate',[advisory('uuid','GHSA-w5hq-g745-h8pq','<11.1.1','moderate')])}};
  const result=analyzeAuditCauses(payload);
  assert.equal(result.counts.highSeverityLeaves,0);
  assert.equal(result.highCauseDisposition,'NO_HIGH_ADVISORY');
  assert.equal(result.causes[0].reviewStatus,'NON_HIGH_REVIEW_SEPARATE');
  const clean=analyzeAuditCauses({vulnerabilities:{}});
  assert.equal(clean.counts.affectedVulnerabilityNodes,0);
  assert.equal(clean.informationalOnly,true);
});
test('reject missing graph, dangling via, orphan cycle, broken advisory and bad root attribution',()=>{
  assert.throws(()=>analyzeAuditCauses({}),/missing audit vulnerability graph/);
  assert.throws(()=>analyzeAuditCauses({error:'offline',vulnerabilities:{}}),/audit service error/);
  assert.throws(()=>analyzeAuditCauses({vulnerabilities:{a:pkg('a','high',['missing'])}}),/unknown npm audit dependency/);
  assert.throws(()=>analyzeAuditCauses({vulnerabilities:{a:pkg('a','high',['b']),b:pkg('b','high',['a'])}}),/no reachable concrete advisory root/);
  assert.throws(()=>analyzeAuditCauses({vulnerabilities:{a:pkg('a','high',[{...braces,name:'other'}])}}),/advisory belongs to other package/);
  assert.throws(()=>analyzeAuditCauses({vulnerabilities:{a:pkg('a','high',[{...braces,name:'a',url:'https://untrusted.invalid/foo'}])}}),/invalid advisory URL/);
  assert.throws(()=>analyzeAuditCauses({vulnerabilities:{a:pkg('a','high',[advisory('a','GHSA-aaaa-bbbb-cccc','<=1','moderate')])}}),/has no high advisory root/);
});
