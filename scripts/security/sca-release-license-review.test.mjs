import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {leadingNotices,licenseReviewResources,embeddedReview,verifyPublicLicenseEvidence} from './sca-release-license-review.mjs';

test('notice collector preserves full permission/disclaimer and later JSBN copyright',()=>{
  const b=Buffer.from('// Copyright A\n/* Permission granted\n * disclaimer retained */\nvar x=1;\n// Copyright B\nx++;');
  const n=leadingNotices(b);
  assert.ok(n.includes('Permission granted\n * disclaimer retained'));
  assert.ok(n.includes('Copyright B'));
  assert.ok(!n.includes('var x=1'));
});
test('license substitution or incomplete package set fails before review output',()=>{
  assert.throws(()=>licenseReviewResources([],{}));
  assert.throws(()=>licenseReviewResources([{originalName:'braces'},{originalName:'node-forge'}],{
    braces:{LICENSE:Buffer.from('fake MIT')},'node-forge':{LICENSE:Buffer.from('fake BSD')}}),/license substitution/);
});
test('third-party ambiguities stay explicit; none are silently relabeled BSD-3-Clause',()=>{
  assert.equal(embeddedReview.length,6);
  for(const path of ['lib/aes.js','lib/pkcs1.js']){
    const r=embeddedReview.find(r=>r.path===path);
    assert.ok(/UNCONFIRMED|REQUIRE_REVIEW/.test(r.status));
    assert.notEqual(r.license,'BSD-3-Clause');
  }
});
const record=()=>JSON.parse(fs.readFileSync(new URL('../../security/release/sca-b6-public-license-findings.json',import.meta.url)));
const read=n=>fs.readFileSync(new URL('../../security/release/license-evidence/'+n,import.meta.url));
test('DES author full BSD2 conditions are retained and all six public source extracts verify',()=>{
  const texts=verifyPublicLicenseEvidence(record(),read);
  assert.equal(Object.keys(texts).length,6);assert.ok(texts['des-BSD-2-Clause.txt'].includes('2. Redistributions in binary form'));
  assert.equal(embeddedReview.find(r=>r.path==='lib/des.js').license,'BSD-2-Clause');
  assert.ok(texts['openssl-1.0.0-aes-public-domain.txt'].includes('placed in the public domain'));
});
test('modified or truncated public license evidence fails integrity',()=>{
  assert.throws(()=>verifyPublicLicenseEvidence(record(),n=>Buffer.concat([read(n),Buffer.from('tamper')])));
  assert.throws(()=>verifyPublicLicenseEvidence(record(),n=>{const b=Buffer.from(read(n));b[0]^=1;return b;}),/SHA mismatch/);
});
test('missing, repeated or substituted public evidence inventory fails closed',()=>{
  for(const mutate of [r=>r.sources.pop(),r=>r.sources.push(r.sources[0]),r=>r.sources[0].file='../LICENSE']){
    const r=record();mutate(r);assert.throws(()=>verifyPublicLicenseEvidence(r,read));
  }
});
test('public research never invents a reply gate, permission to contact authors or final redistribution approval',()=>{
  for(const k of ['upstreamReplyRequired','externalCommunicationAuthorized','packageRedistributionApproved']){
    const r=record();r[k]=true;assert.throws(()=>verifyPublicLicenseEvidence(r,read));
  }
});
