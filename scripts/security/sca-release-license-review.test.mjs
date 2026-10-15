import test from 'node:test';
import assert from 'node:assert/strict';
import {leadingNotices,licenseReviewResources,embeddedReview} from './sca-release-license-review.mjs';

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
  for(const path of ['lib/aes.js','lib/des.js','lib/pkcs1.js']){
    const r=embeddedReview.find(r=>r.path===path);
    assert.ok(r.status.endsWith('REQUIRE_REVIEW'));
    assert.notEqual(r.license,'BSD-3-Clause');
  }
});
