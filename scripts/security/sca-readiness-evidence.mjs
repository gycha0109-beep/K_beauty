/** SCA audit evidence projection. Informational only: never a deployment authorization. */
import assert from 'node:assert/strict';

const SHA = /^[a-f0-9]{40}$/;
const SEVERITIES = ['info','low','moderate','high','critical'];

function sha(value,label) {
  assert.ok(typeof value === 'string' && SHA.test(value),label+' must be an exact git SHA');
  return value;
}
function countsFrom(payload,label) {
  assert.ok(payload && typeof payload === 'object' && !Array.isArray(payload),label+' raw JSON object required');
  assert.ok(!payload.error,label+' audit service error');
  const v=payload.metadata?.vulnerabilities;
  assert.ok(v && typeof v==='object' && !Array.isArray(v),label+' missing audit metadata');
  const counts={};
  for(const severity of SEVERITIES) {
    assert.ok(Number.isSafeInteger(v[severity]) && v[severity]>=0,label+' invalid '+severity+' count');
    counts[severity]=v[severity];
  }
  assert.ok(Number.isSafeInteger(v.total) && v.total>=0,label+' invalid total count');
  assert.equal(SEVERITIES.reduce((s,k)=>s+counts[k],0),v.total,label+' inconsistent totals');
  counts.total=v.total;
  return counts;
}
function leaves(payload){
  assert.ok(payload.vulnerabilities && typeof payload.vulnerabilities==='object' && !Array.isArray(payload.vulnerabilities),'missing vulnerability graph');
  const out=new Map();
  for(const [path,detail] of Object.entries(payload.vulnerabilities)){
    assert.ok(detail && typeof detail==='object' && Array.isArray(detail.via),'malformed vulnerability '+path);
    for(const via of detail.via) {
      if(!via || typeof via!=='object')continue;
      assert.ok(typeof via.url==='string' && /^https:\/\/github.com\/advisories\/GHSA-[A-Za-z0-9-]+$/.test(via.url),'unrecognized advisory source');
      if(out.has(via.url))continue;
      out.set(via.url,{package:via.name ?? path,id:via.url.split('/').at(-1),severity:via.severity,url:via.url});
    }
  }
  return [...out.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
export function projectAudit({label,exitCode,payload}){
  assert.ok(label==='full'||label==='production','unknown audit scope');
  assert.ok(exitCode===0||exitCode===1,label+' npm audit execution must return 0 or 1');
  const counts=countsFrom(payload,label);
  if(counts.total===0)assert.equal(exitCode,0,label+' inconsistent clean audit exit');
  if(counts.total>0)assert.equal(exitCode,1,label+' inconsistent vulnerable audit exit');
  return {exitCode,counts,advisoryLeaves:leaves(payload),highCriticalZero:counts.high===0&&counts.critical===0};
}
export function buildScaReadiness({checkedOutHead,expectedHead,sourceReceiptHead,runUrl=null,full,production}){
  sha(checkedOutHead,'checkedOutHead');
  sha(expectedHead,'expectedHead');
  sha(sourceReceiptHead,'sourceReceiptHead');
  assert.equal(checkedOutHead,expectedHead,'CI checkout SHA differs from PR exact HEAD');
  const f=projectAudit({...full,label:'full'});
  const p=projectAudit({...production,label:'production'});
  const rawAuditGate=f.highCriticalZero&&p.highCriticalZero?'HIGH_CRITICAL_ZERO':'FAIL_UNRESOLVED';
  return {
    schema:'bejewely.sca-readiness-evidence.v1',
    informationalOnly:true,
    releaseAuthorized:false,
    run:{exactHead:checkedOutHead,runUrl},
    historicalPatchReference:{validatedSourceHead:sourceReceiptHead,scope:'HISTORICAL_B4_CANDIDATE_ONLY'},
    rawAudit:{full:f,production:p,gate:rawAuditGate,officialVerifier:'SEPARATE_REQUIRED_GATE'},
    boundaries:{
      candidateReproducibility:'SEPARATE_EXACT_HEAD_JOB_REQUIRED',
      securityLicenseMaintenanceDistributionApproval:'NOT_ATTESTED',
      privateRegistryPublishedAndReadBack:'NOT_ATTESTED',
      actualProductLockInstalledAndVerified:'NOT_ATTESTED',
      canonicalAppBuildFromApprovedGraph:'NOT_ATTESTED',
      isolatedDeviceApiAuthSmoke:'NOT_ATTESTED',
      merge:'HOLD',
      production:'NOT_AUTHORIZED'
    },
    decision:'HOLD_EXTERNAL_APPROVAL_AND_CANONICAL_AUDIT',
    generatedAtUtc:new Date().toISOString()
  };
}
