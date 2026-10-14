/** P2 preparation only: source-verified BSD-3-Clause review and private registry plan. No network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {digest, inspectArchive, verifyBundle, reference} from './sca-release-bundle.mjs';

const ownerRoles=['product-planning','development','security-review','license-review','maintenance','distribution'];
const requiredClaims=['originalPackageNames','immutableArtifactBytes','authenticatedWrite','anonymousArchiveReadDenied','noPublicNpmShadowing','noRedirectedCredentialDisclosure','separateReadAndPublishTokens','strictRegistryUrlAndTarballPathBinding','officialNpmAuditUnchanged'];

export function validateP2OfflinePolicy({authorization,plan}) {
  assert.equal(authorization?.schema,'bejewely.sca-p2-preparation-authorization.v1');
  assert.equal(authorization?.project,'BEJEWELY');
  assert.equal(authorization?.governance?.mode,'single-owner');
  assert.equal(authorization?.governance?.separateHumanApproversRequired,false);
  assert.deepEqual([...authorization.governance.accountableRoles].sort(),[...ownerRoles].sort());
  assert.ok(authorization.approvedNow.includes('prepare-private-patch-distribution-path'));
  assert.ok(authorization.approvedNow.includes('review-node-forge-under-BSD-3-Clause-terms'));
  assert.ok(authorization.separateOwnerApprovalRequired.includes('actually-upload-or-publish-patched-packages'));
  assert.ok(authorization.separateOwnerApprovalRequired.includes('incur-cost-or-subscribe-to-paid-service'));
  assert.equal(authorization.formalReleaseApproval,'NOT_GRANTED');
  assert.equal(authorization.signingKeyRegistered,false);
  assert.equal(authorization.privateRegistrySelected,false);
  assert.equal(authorization.officialAuditStatus,'FAIL_UNRESOLVED');

  assert.equal(plan?.schema,'bejewely.sca-p2-private-registry-plan.v1');
  assert.equal(plan?.state,'OFFLINE_DESIGN_ONLY');
  assert.equal(plan.providerSelected,false);
  assert.equal(plan.provider,'UNSELECTED');
  assert.equal(plan.candidateArchitecture,'SELF_HOSTED_NPM_COMPATIBLE_PRIVATE_REGISTRY');
  assert.equal(plan.endpoint,null,'live registry endpoint needs separate approval');
  assert.equal(plan.credentialsProvisioned,false,'real registry tokens not approved');
  assert.equal(plan.paidServicesAuthorized,false,'paid services not approved');
  assert.equal(plan.actualPackagePublicationAuthorized,false,'package publication not approved');
  assert.equal(plan.packagesPublished,false);
  assert.deepEqual(plan.packages,['braces@3.0.3','node-forge@1.4.0']);
  assert.equal(plan.packageNamesMustRemainUnscoped,true,'original package identities must be preserved');
  for(const claim of requiredClaims)assert.equal(plan.candidateRequirements?.[claim],true,'missing proposed registry capability '+claim);
  assert.equal(plan.externalCapabilitiesVerified,false,'registry is not provisioned or externally tested');
  assert.ok(Array.isArray(plan.evidenceRequiredBeforeActivation)&&plan.evidenceRequiredBeforeActivation.length>=7);

  return {ownerGovernance:'SINGLE_OWNER_PREPARATION_APPROVED',registryState:'OFFLINE_DESIGN_ONLY',actualPublish:false};
}
export function reviewP2Preparation({authorization,plan,forgeLicense,expectedForgeLicenseSha256}) {
  validateP2OfflinePolicy({authorization,plan});
  assert.ok(typeof forgeLicense==='string'&&forgeLicense.length>500,'actual forge upstream license bytes required');
  assert.match(expectedForgeLicenseSha256,/^[a-f0-9]{64}$/,'pinned forge LICENSE SHA256 required');
  assert.equal(digest(Buffer.from(forgeLicense,'utf8')),expectedForgeLicenseSha256,'actual forge LICENSE does not match pinned source bytes');
  const clauses=[
    ['dual-license BSD or GPL option',/terms of either the BSD License or the[\s\S]{0,100}GNU General Public License/i],
    ['three-clause BSD heading',/New BSD License \(3-clause\)/i],
    ['upstream copyright',/Copyright \(c\) 2010, Digital Bazaar, Inc\./i],
    ['source redistributions retain notices',/Redistributions of source code must retain the above copyright[\s\S]{0,90}list of conditions and the following disclaimer/i],
    ['binary redistributions reproduce notices',/Redistributions in binary form must reproduce the above copyright[\s\S]{0,100}list of conditions and the following disclaimer/i],
    ['non-endorsement without permission',/Neither the name of Digital Bazaar, Inc\. nor the[\s\S]{0,100}names of its contributors may be used to endorse or promote/i],
    ['BSD warranty disclaimer',/THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"/i]
  ];
  for(const [label,regex]of clauses)assert.match(forgeLicense,regex,'missing original BSD obligation: '+label);
  const original=reference.installed.find(x=>x.name==='node-forge');
  assert.ok(original,'pinned graph lacks node-forge');
  assert.equal(expectedForgeLicenseSha256,original.fileSha256.LICENSE,'forge LICENSE must bind to B4 installed graph');

  return {
    schema:'bejewely.sca-p2-offline-readiness.v1',informationalOnly:true,
    owner:{mode:'SINGLE_OWNER',preparation:'APPROVED',humanApproversRequired:1},
    license:{component:'node-forge@1.4.0',electionUnderReview:'BSD-3-Clause',originalLicenseSha256:expectedForgeLicenseSha256,clauseChecks:clauses.map(x=>x[0]),originalFullLicensePreserved:true,redistributionApproved:false,legalConclusion:'NOT_ATTESTED'},
    registry:{architecture:'SELF_HOSTED_NPM_COMPATIBLE_PRIVATE_REGISTRY',selection:'UNSELECTED',deployed:false,approvedCapabilities:requiredClaims,actualCapabilitiesVerified:false},
    gates:{cost:'NOT_AUTHORIZED',actualPackagePublish:'NOT_AUTHORIZED',productLock:'NOT_APPLIED',production:'NOT_AUTHORIZED',officialAudit:'FAIL_UNRESOLVED'},
    decision:'PREPARATION_ONLY_HOLD_ACTUAL_PUBLISH'
  };
}
export function reviewP2Bundle({bundleDir,authorizationPath='security/release/sca-p2-preparation-authorization.json',planPath='security/release/sca-p2-registry-plan.json'}){
  const approvedCandidate=verifyBundle(bundleDir); // digest+69 files, pinned NOTICE/SBOM and real archives
  assert.equal(approvedCandidate.productApplied,false);
  assert.equal(approvedCandidate.officialAudit,'FAIL');
  const forge=inspectArchive(fs.readFileSync(path.join(bundleDir,'node-forge-1.4.0.tgz')));
  const result=reviewP2Preparation({
    authorization:JSON.parse(fs.readFileSync(authorizationPath,'utf8')),
    plan:JSON.parse(fs.readFileSync(planPath,'utf8')),
    forgeLicense:forge.LICENSE?.toString('utf8'),
    expectedForgeLicenseSha256:reference.installed.find(x=>x.name==='node-forge').fileSha256.LICENSE
  });
  return {...result,exactCandidateSha256:approvedCandidate.candidateSha256};
}
