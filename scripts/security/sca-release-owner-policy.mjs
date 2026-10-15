/** Explicit human-approved internal policy v2; never an upload or legal approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const ownerPolicyDecisionSha256=sha(fs.readFileSync(new URL('../../security/release/sca-b6-owner-policy-decision.json',import.meta.url)));
export const licensePacketSha256=sha(Buffer.concat(['THIRD-PARTY-NOTICES.md','license-review.json','license-review-sbom.json'].map(n=>
  Buffer.concat([Buffer.from(n+'\0'),fs.readFileSync(new URL('../../security/release/license-review/'+n,import.meta.url))]))));
export const normalizeOwner=s=>{assert.ok(typeof s==='string'&&s.trim().length>0,'named responsible owner required');return s.trim().toLowerCase();};
const hash=(s,label)=>assert.match(s||'',/^[a-f0-9]{64}$/,label+' SHA256 required');

export function approvalPolicyContext(a,trust,{scoped=false}={}){
  const schema=scoped?'bejewely.scoped-upload-approval.':'bejewely.sca-release-upload-approval.';
  if(a.schema===schema+'v1'){
    assert.equal(trust.schema,'bejewely.sca-release-trust.v1','cross-version trust rejected');
    return {version:1,minOwners:2,prefix:scoped?'BEJEWELY-SCA-SCOPED-v1:':'BEJEWELY-SCA-UPLOAD-v1:'};
  }
  assert.equal(a.schema,schema+'v2','unknown approval schema');
  assert.equal(trust.schema,'bejewely.sca-release-trust.v2','v2 trust required');
  assert.equal(trust.approvalModel,'SOLE_PROJECT_OWNER');
  assert.equal(trust.policyDecisionSha256,ownerPolicyDecisionSha256,'unapproved policy transition');
  assert.equal(a.policyDecisionSha256,ownerPolicyDecisionSha256,'approval policy decision mismatch');
  const owner=normalizeOwner(trust.responsibleOwner);
  assert.equal(normalizeOwner(a.responsibleOwner),owner,'approval owner mismatch');
  assert.equal(a.licensePacketSha256,licensePacketSha256,'license packet mismatch');
  assert.equal(a.uploadApproved,true,'separate upload approval required');
  assert.equal(a.redistributionApproval?.approved,true,'separate final redistribution approval required');
  hash(a.redistributionApproval.decisionSha256,'redistribution decision');
  assert.equal(a.rightsReview?.status,'CLEARED_BY_PROJECT_OWNER','rights review remains HOLD');
  assert.equal(a.rightsReview.upstreamReplyRequired,false,'individual author reply is not a gate for these observed licenses');
  assert.ok(Array.isArray(a.rightsReview.informationalGaps)&&a.rightsReview.informationalGaps.every(s=>typeof s==='string'&&s.trim().length>0),'informational provenance gaps must be disclosed separately');
  assert.deepEqual(a.rightsReview.unresolved,[],'unresolved rights cannot be waived by policy change');
  hash(a.rightsReview.evidenceSha256,'rights evidence');
  assert.equal(a.mergeApproved,false);assert.equal(a.productionApproved,false);
  return {version:2,minOwners:1,owner,prefix:'BEJEWELY-SCA-OWNER-v2:'+a.purpose+':'};
}
export function checkPolicyOwner(context,owner){
  if(context.version===2)assert.equal(normalizeOwner(owner),context.owner,'key owner differs from sole project owner');
}
export function checkPolicySigners(context,owners){
  assert.ok(owners.size>=context.minOwners,context.version===1?'two named owners required':'sole project owner required');
  if(context.version===2)assert.deepEqual([...owners],[context.owner],'single responsible owner required');
}
