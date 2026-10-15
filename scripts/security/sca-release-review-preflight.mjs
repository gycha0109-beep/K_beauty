/** Offline review authorization only. No network, signing, upload or product mutation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ownerPolicyDecisionSha256,licensePacketSha256} from './sca-release-owner-policy.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const root=fileURLToPath(new URL('../..',import.meta.url));
export function verifyConditionalReview(record,read=p=>fs.readFileSync(path.join(root,p))){
  assert.equal(record.schema,'bejewely.conditional-review-authorization.v1');
  assert.equal(record.purpose,'PREPUBLICATION_REVIEW_ONLY');
  assert.equal(record.authority,'PROJECT_OWNER_HUMAN_INSTRUCTION');
  assert.equal(record.cryptographicallySigned,false,'chat instruction is not a signed release approval');
  assert.equal(record.reviewApproved,true);assert.equal(record.finalChecksApproved,true);
  for(const key of ['legalConformityConfirmed','redistributionApproved','uploadApproved','costApproved','auditExceptionApproved','mergeApproved','productionApproved','unresolvedRightsCleared','upstreamInquiryAuthorized','upstreamReplyRequired'])
    assert.equal(record[key],false,'conditional review does not authorize '+key);
  assert.equal(record.policyDecisionSha256,ownerPolicyDecisionSha256,'owner policy changed');
  assert.equal(record.licensePacketSha256,licensePacketSha256,'frozen license packet changed');
  assert.equal(record.reviewBasis.braces,'MIT');assert.equal(record.reviewBasis['node-forge'],'BSD-3-Clause');
  assert.ok(record.unresolved.some(x=>x.id==='OAEP_BSD_TERMS'&&x.status==='OPEN'),'OAEP terms must remain open');
  assert.ok(record.unresolved.some(x=>x.id==='REAL_NOTICE_DELIVERY'&&x.status==='NOT_RUN'),'real recipient delivery is not a local proof');
  assert.ok(record.humanInstruction.includes('이번 승인은 법적 적합성 확정이나 실제 재배포 허가가 아닙니다.'));
  const expected=['docs/security/sec-sca-20261015-oaep-original-recovery.json','security/release/sca-b6-public-license-findings.json'];
  assert.deepEqual(record.evidence.map(x=>x.path).sort(),expected.sort());
  for(const e of record.evidence){const b=read(e.path);assert.equal(b.length,e.bytes);assert.equal(sha(b),e.sha256,'review evidence changed');}
  return {reviewAuthorization:'VALID_LIMITED_REVIEW_ONLY',signedReleaseApproval:false,
    evidenceIntegrity:'PASS',legalApproval:false,redistributionApproved:false,uploadApproved:false,
    executionReady:false,originalAudit:'FAIL_NOT_WAIVED',remaining:record.unresolved};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv.length,2,'offline review accepts no execution or credential options');
  const record=JSON.parse(fs.readFileSync(path.join(root,'security/release/sca-b6-conditional-review-decision.json')));
  console.log('SCA_CONDITIONAL_REVIEW_PREFLIGHT='+JSON.stringify(verifyConditionalReview(record)));
}
