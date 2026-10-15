import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyApproval,requiredRoles} from './sca-release-bundle.mjs';
import {verifyScopedApproval} from './sca-release-scoped.mjs';
import {ownerPolicyDecisionSha256,licensePacketSha256} from './sca-release-owner-policy.mjs';

// Ephemeral synthetic approvals exercise cryptographic admission only. They are NOT
// real rights findings, owner trust keys, upload permission or legal approval.
function fixture(scoped){
  const pair=generateKeyPairSync('ed25519'),now=Date.parse('2026-10-15T00:00:00Z');
  const a={schema:scoped?'bejewely.scoped-upload-approval.v2':'bejewely.sca-release-upload-approval.v2',
    candidateSha256:'a'.repeat(64),purpose:scoped?'SCOPED_UPLOAD_READBACK_ONLY':'UPLOAD_AND_READBACK_ONLY',
    registry:scoped?'https://npm.pkg.github.com/':'https://registry.test.internal/reviewed/',
    privateRepository:true,immutableVersions:true,noUpstreamShadowing:true,auditGateRemainsRequired:true,originalAuditRequired:true,
    auditExceptionApproved:false,licenseElections:{braces:'MIT','node-forge':'BSD-3-Clause'},expiresAt:'2026-10-16T00:00:00Z',
    policyDecisionSha256:ownerPolicyDecisionSha256,responsibleOwner:'Test sole owner',licensePacketSha256,
    uploadApproved:true,redistributionApproval:{approved:true,decisionSha256:'b'.repeat(64)},
    rightsReview:{status:'CLEARED_BY_PROJECT_OWNER',unresolved:[],evidenceSha256:'c'.repeat(64)},mergeApproved:false,productionApproved:false,
    tarballUrls:scoped?{braces:'https://npm.pkg.github.com/download/@gycha0109-beep/braces/3.0.3/test',
      'node-forge':'https://npm.pkg.github.com/download/@gycha0109-beep/node-forge/1.4.0/test'}:
      {braces:'https://registry.test.internal/reviewed/braces/-/braces-3.0.3.tgz','node-forge':'https://registry.test.internal/reviewed/node-forge-1.4.0.tgz'}};
  const trust={schema:'bejewely.sca-release-trust.v2',organizationApproved:true,approvalModel:'SOLE_PROJECT_OWNER',
    responsibleOwner:'Test sole owner',policyDecisionSha256:ownerPolicyDecisionSha256,revokedKeyIds:[],
    keys:[{id:'EPHEMERAL_TEST_ONLY',owner:'Test sole owner',roles:requiredRoles,notBefore:'2026-10-14T00:00:00Z',
      notAfter:'2026-11-01T00:00:00Z',publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'})}]};
  const build=(prefix='BEJEWELY-SCA-OWNER-v2:'+a.purpose+':')=>{
    const approvalBytes=Buffer.from(JSON.stringify(a));return {approvalBytes,trust,now,candidateSha256:'a'.repeat(64),
      signatures:requiredRoles.map(role=>({role,keyId:'EPHEMERAL_TEST_ONLY',signature:sign(null,
        Buffer.concat([Buffer.from(prefix+role+'\n'),approvalBytes]),pair.privateKey).toString('base64')}))};};
  return {a,trust,build,verify:scoped?verifyScopedApproval:verifyApproval};
}
for(const scoped of [false,true]){
  const kind=scoped?'scoped':'original';
  test(kind+' v2 accepts one explicitly trusted owner with all four role signatures',()=>{
    const f=fixture(scoped),r=f.verify(f.build());assert.equal(r.officialAudit,'FAIL');assert.equal(r.mergeApproved,false);assert.equal(r.productionApproved,false);
  });
  test(kind+' v2 rejects omitted separate upload/legal approval or unresolved rights',()=>{
    for(const mutate of [f=>f.a.uploadApproved=false,f=>f.a.redistributionApproval.approved=false,
      f=>f.a.redistributionApproval.decisionSha256='',f=>f.a.rightsReview.status='HOLD',
      f=>f.a.rightsReview.unresolved.push('OpenSSL origin unknown'),f=>f.a.rightsReview.evidenceSha256='']){
      const f=fixture(scoped);mutate(f);assert.throws(()=>f.verify(f.build()));
    }
  });
  test(kind+' v2 rejects policy, license packet, owner and schema substitution',()=>{
    for(const mutate of [f=>f.a.policyDecisionSha256='0'.repeat(64),f=>f.trust.policyDecisionSha256='0'.repeat(64),
      f=>f.a.licensePacketSha256='0'.repeat(64),f=>f.a.responsibleOwner='Other owner',f=>f.trust.keys[0].owner='Other owner',
      f=>f.trust.approvalModel='RELAXED',f=>f.trust.schema='bejewely.sca-release-trust.v1',
      f=>f.a.schema=f.a.schema.replace('.v2','.v1')]){
      const f=fixture(scoped);mutate(f);assert.throws(()=>f.verify(f.build()));
    }
  });
  test(kind+' v2 rejects missing/repeated roles, revoked/expired keys and replayed v1 domains',()=>{
    const f=fixture(scoped),v=f.build();v.signatures.pop();assert.throws(()=>f.verify(v));
    const g=fixture(scoped),w=g.build();w.signatures[1]=w.signatures[0];assert.throws(()=>g.verify(w));
    const h=fixture(scoped);h.trust.revokedKeyIds=['EPHEMERAL_TEST_ONLY'];assert.throws(()=>h.verify(h.build()));
    const i=fixture(scoped);i.trust.keys[0].notAfter='2026-10-15T01:00:00Z';assert.throws(()=>i.verify(i.build()));
    const j=fixture(scoped);assert.throws(()=>j.verify(j.build(scoped?'BEJEWELY-SCA-SCOPED-v1:':'BEJEWELY-SCA-UPLOAD-v1:')));
  });
  test(kind+' v2 preserves artifact/audit/purpose/privacy/expiry boundaries',()=>{
    for(const mutate of [f=>f.a.candidateSha256='d'.repeat(64),f=>f.a.auditExceptionApproved=true,
      f=>{f.a.auditGateRemainsRequired=false;f.a.originalAuditRequired=false;},f=>f.a.privateRepository=false,
      f=>f.a.immutableVersions=false,f=>f.a.expiresAt='2026-11-01T00:00:00Z',f=>f.a.purpose='PRODUCTION',
      f=>f.a.mergeApproved=true,f=>f.a.productionApproved=true,
      f=>f.a.tarballUrls.braces='https://public.test.invalid/other.tgz']){
      const f=fixture(scoped);mutate(f);assert.throws(()=>f.verify(f.build()));
    }
    const f=fixture(scoped),v=f.build();v.approvalBytes=Buffer.from(v.approvalBytes.toString()+' ');assert.throws(()=>f.verify(v));
  });
}
