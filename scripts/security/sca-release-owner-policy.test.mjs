import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyApproval,requiredRoles} from './sca-release-bundle.mjs';
import {verifyScopedApproval} from './sca-release-scoped.mjs';
import {ownerPolicyDecisionSha256,licensePacketSha256} from './sca-release-owner-policy.mjs';
import fs from 'node:fs';
import {verifyConditionalReview} from './sca-release-review-preflight.mjs';
import {scopedPublicationPlan} from './prepare-sca-release-scoped-publication.mjs';
import {runScopedPublication,checkScopedExecutionControls} from './publish-approved-sca-scoped-candidate.mjs';

function scopedOperatorFixture(){
  const approval={schema:'bejewely.scoped-upload-approval.v2',uploadApproved:true,redistributionApproval:{approved:true},operationalChecks:{
    noChargeControlsVerified:true,privateAclReviewed:true,noticeDeliveryReviewed:true,credentialsProvisioned:true,evidenceSha256:'e'.repeat(64)}};
  const receipt={candidateSha256:'a'.repeat(64),artifacts:['braces','node-forge'].map(n=>({name:'@gycha0109-beep/'+n,noticeDelivery:'IN_TARBALL_V1',noticeSha256:'d'.repeat(64)}))};
  const calls=[];return {approval,receipt,calls,operations:{admit:()=>({approval:structuredClone(approval),receipt:structuredClone(receipt)}),
    checkAbsent:async a=>calls.push('absent:'+a.name),publish:async a=>calls.push('publish:'+a.name),readback:async a=>calls.push('readback:'+a.name)}};
}
test('dormant scoped operator checks both identities before mutation and reads back each upload',async()=>{
  const f=scopedOperatorFixture(),r=await runScopedPublication(f.operations);
  assert.deepEqual(f.calls.map(x=>x.split(':')[0]),['absent','absent','publish','readback','publish','readback']);
  assert.equal(r.officialAudit,'FAIL_NOT_WAIVED');assert.equal(r.productApplied,false);
});
test('operator rejects the historical external-only notice kit before any registry operation',async()=>{
  for(const change of [a=>delete a.noticeDelivery,a=>a.noticeSha256='missing']){
    const f=scopedOperatorFixture();change(f.receipt.artifacts[1]);
    await assert.rejects(()=>runScopedPublication(f.operations));assert.deepEqual(f.calls,[]);
  }
});
test('scoped operator stops before mutation on missing cost/privacy/notice/credential evidence',async()=>{
  for(const key of ['noChargeControlsVerified','privateAclReviewed','noticeDeliveryReviewed','credentialsProvisioned']){
    const f=scopedOperatorFixture();f.approval.operationalChecks[key]=false;
    await assert.rejects(runScopedPublication(f.operations));assert.deepEqual(f.calls,[]);
  }
  assert.throws(()=>checkScopedExecutionControls(conditionalReview()));
});
test('scoped operator refuses existing versions and halts partial publication on readback failure',async()=>{
  const f=scopedOperatorFixture();f.operations.checkAbsent=async()=>{throw Error('exists');};
  await assert.rejects(runScopedPublication(f.operations));assert.deepEqual(f.calls,[]);
  const g=scopedOperatorFixture();g.operations.readback=async()=>{throw Error('readback failed');};
  await assert.rejects(runScopedPublication(g.operations));assert.equal(g.calls.filter(x=>x.startsWith('publish:')).length,1);
});
test('scoped operator revalidates signed candidate and approval before every publication',async()=>{
  const f=scopedOperatorFixture();let count=0;
  f.operations.admit=()=>({approval:structuredClone(f.approval),receipt:{...structuredClone(f.receipt),candidateSha256:++count===1?'a'.repeat(64):'b'.repeat(64)}});
  await assert.rejects(runScopedPublication(f.operations));assert.ok(!f.calls.some(x=>x.startsWith('publish:')));
});
test('bootstrap publication requires new signed linkage and derived packet authority, and stops before final linkage',async()=>{
  const f=scopedOperatorFixture();f.receipt.publicationLinkage='UNLINKED_BOOTSTRAP';f.receipt.candidateLicensePacketSha256='f'.repeat(64);
  await assert.rejects(runScopedPublication(f.operations));assert.deepEqual(f.calls,[]);
  f.approval.publicationLinkage='UNLINKED_BOOTSTRAP';f.approval.candidateLicensePacketSha256='0'.repeat(64);
  await assert.rejects(runScopedPublication(f.operations));assert.deepEqual(f.calls,[]);
  f.approval.candidateLicensePacketSha256='f'.repeat(64);const r=await runScopedPublication(f.operations);
  assert.equal(r.stage,'PRIVATE_UNLINKED_ONLY');assert.equal(r.finalLinkageAndAcl,'HOLD_OWNER_ACTION_NOT_RUN');assert.equal(r.productApplied,false);
});

const conditionalReview=()=>JSON.parse(fs.readFileSync(new URL('../../security/release/sca-b6-conditional-review-decision.json',import.meta.url)));
test('GitHub prepublication plan preserves scoped/original mapping and never executes or clears audit',()=>{
  const receipt={candidateSha256:'a'.repeat(64),artifacts:['braces','node-forge'].map(originalName=>({originalName,
    name:'@gycha0109-beep/'+originalName,version:originalName==='braces'?'3.0.3':'1.4.0',sourceAndBrowserBytesPreserved:true,
    sha256:'b'.repeat(64),originalArchiveSha256:'c'.repeat(64),licenseSha256:'d'.repeat(64)}))};
  const review=verifyConditionalReview(conditionalReview()),p=scopedPublicationPlan(receipt,review);
  assert.equal(p.uploadExecuted,false);assert.equal(p.executionReady,false);assert.equal(p.originalAudit,'FAIL_NOT_WAIVED');
  assert.equal(p.packages[0].expectedVisibility,'private');assert.ok(p.packages[1].expectedReadbackPrefix.includes('/@gycha0109-beep/node-forge/1.4.0/'));
  receipt.artifacts[0].name='braces';assert.throws(()=>scopedPublicationPlan(receipt,review));
});
test('actual conditional owner instruction permits only offline review with open OAEP conditions',()=>{
  const r=verifyConditionalReview(conditionalReview());
  assert.equal(r.reviewAuthorization,'VALID_LIMITED_REVIEW_ONLY');assert.equal(r.executionReady,false);
  assert.equal(r.signedReleaseApproval,false);assert.equal(r.originalAudit,'FAIL_NOT_WAIVED');
});
test('conditional record rejects every unauthorized execution/legal permission and closed rights',()=>{
  for(const key of ['legalConformityConfirmed','redistributionApproved','uploadApproved','costApproved','auditExceptionApproved','mergeApproved','productionApproved','unresolvedRightsCleared','upstreamInquiryAuthorized','upstreamReplyRequired','cryptographicallySigned']){
    const r=conditionalReview();r[key]=true;assert.throws(()=>verifyConditionalReview(r));
  }
  const r=conditionalReview();r.unresolved=[];assert.throws(()=>verifyConditionalReview(r));
});
test('conditional record rejects altered evidence, notice packet or unapproved review basis',()=>{
  assert.throws(()=>verifyConditionalReview(conditionalReview(),()=>Buffer.from('tamper')));
  for(const change of [r=>r.licensePacketSha256='0'.repeat(64),r=>r.policyDecisionSha256='0'.repeat(64),r=>r.reviewBasis['node-forge']='GPL-2.0',r=>r.evidence.pop()]){
    const r=conditionalReview();change(r);assert.throws(()=>verifyConditionalReview(r));
  }
});
test('conditional review record cannot substitute for final signed upload approval',()=>{
  for(const scoped of [false,true]){
    const f=fixture(scoped);f.a=conditionalReview();
    assert.throws(()=>f.verify({approvalBytes:Buffer.from(JSON.stringify(f.a)),candidateSha256:'a'.repeat(64),signatures:[],trust:f.trust,now:Date.parse('2026-10-15T00:00:00Z')}));
  }
});

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
    rightsReview:{status:'CLEARED_BY_PROJECT_OWNER',unresolved:[],informationalGaps:[],upstreamReplyRequired:false,evidenceSha256:'c'.repeat(64)},mergeApproved:false,productionApproved:false,
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
  test(kind+' v2 permits disclosed internal lineage gaps, never missing external conditions or an invented reply gate',()=>{
    const f=fixture(scoped);f.a.rightsReview.informationalGaps=['Exact historical copied revision unproven'];f.verify(f.build());
    f.a.rightsReview.unresolved=['Required BSD conditions not provided'];assert.throws(()=>f.verify(f.build()));
    const g=fixture(scoped);g.a.rightsReview.upstreamReplyRequired=true;assert.throws(()=>g.verify(g.build()));
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
