/** Offline GitHub publication plan. Deliberately provides no upload implementation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {args,verifyBundle} from './sca-release-bundle.mjs';
import {verifyScopedCandidate,scopedName} from './sca-release-scoped.mjs';
import {verifyConditionalReview} from './sca-release-review-preflight.mjs';

export function scopedPublicationPlan(receipt,review){
  assert.equal(review.reviewAuthorization,'VALID_LIMITED_REVIEW_ONLY');
  assert.equal(review.uploadApproved,false);assert.equal(review.redistributionApproved,false);
  assert.match(receipt.candidateSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(receipt.artifacts.map(a=>a.originalName).sort(),['braces','node-forge']);
  const packages=receipt.artifacts.map(a=>{
    const name=scopedName(a.originalName),version=a.originalName==='braces'?'3.0.3':'1.4.0';
    assert.equal(a.name,name);assert.equal(a.version,version);assert.equal(a.sourceAndBrowserBytesPreserved,true);
    for(const h of [a.sha256,a.originalArchiveSha256,a.licenseSha256])assert.match(h,/^[a-f0-9]{64}$/);
    return {name,version,sha256:a.sha256,originalName:a.originalName,originalArchiveSha256:a.originalArchiveSha256,
      licenseSha256:a.licenseSha256,registry:'https://npm.pkg.github.com/',
      privateMetadataUrl:'https://api.github.com/users/gycha0109-beep/packages/npm/'+encodeURIComponent(a.originalName),
      readbackUrl:'REQUIRES_OWNER_APPROVED_EXACT_IMMUTABLE_URL',
      expectedReadbackPrefix:'https://npm.pkg.github.com/download/'+name+'/'+version+'/',
      expectedVisibility:'private',repository:'gycha0109-beep/K_beauty',
      noticeDelivery:a.noticeDelivery||'SEPARATE_PACKET_ONLY_NOT_PUBLISHABLE',noticeSha256:a.noticeSha256||null};
  });
  return {schema:'bejewely.scoped-prepublication-plan.v1',candidateSha256:receipt.candidateSha256,
    publicationLinkage:receipt.publicationLinkage||'PRELINKED',
    ...(receipt.publicationLinkage==='UNLINKED_BOOTSTRAP'?{candidateLicensePacketSha256:receipt.candidateLicensePacketSha256,
      stages:['PRIVATE_UNLINKED_OWNER_ONLY','OWNER_APPROVED_INDIVIDUAL_ACL','LATER_SOURCE_LINK_WITHOUT_INHERITANCE','SEPARATELY_REVIEWED_INSTALL_ACCESS'],
      globalInheritanceChangeRequired:false,liveLinkedPrivacyAndActionsRead:'NOT_RUN'}:{}),
    preparation:'OFFLINE_ONLY_NOT_A_SIGNED_PUBLICATION_APPROVAL',uploadExecuted:false,executionReady:false,
    originalAudit:'FAIL_NOT_WAIVED',packages,
    prepublicationRequirements:['Owner final redistribution decision including unresolved OAEP terms',
      'Separate exact-artifact upload approval, signed four-role v2 admission and externally pinned trust',
      'Account quota/billing/stop-usage review; no unapproved charge',
      'Private package ACL and linked repository permission review; separate publish and read credentials',
      'Dormant scoped publisher dry-run with actual signed operational evidence; live execution remains NOT_RUN',
      'Authenticated metadata and exact archive readback plus anonymous/unprivileged denial',
      'Final LICENSE/NOTICE/SBOM delivery with installed and standalone browser artifacts',
      'Actual approved-registry product graph, independent installs and unchanged raw original audits'],
    rollback:'Do not overwrite/unpublish or switch product after partial publication. Quarantine immutable versions; separate owner decision required.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const a=args(process.argv.slice(2),['--original-bundle','--candidate']);
  assert.equal(Object.keys(a).length,2,'require verified original bundle and scoped candidate; no upload/credential options accepted');
  verifyBundle(a['--original-bundle']);
  const originals={braces:path.join(a['--original-bundle'],'braces-3.0.3.tgz'),'node-forge':path.join(a['--original-bundle'],'node-forge-1.4.0.tgz')};
  const receipt=verifyScopedCandidate({originals,output:a['--candidate']});
  const record=JSON.parse(fs.readFileSync(new URL('../../security/release/sca-b6-conditional-review-decision.json',import.meta.url)));
  console.log('SCA_SCOPED_PREPUBLICATION_PLAN='+JSON.stringify(scopedPublicationPlan(receipt,verifyConditionalReview(record))));
}
