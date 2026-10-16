import assert from "node:assert/strict";
import {
  inspectSkinPrivatePhotoGovernance as inspect,
  SKIN_PRIVATE_PHOTO_GATE_VERSION as V
} from "./skin-private-photo-governance-gate.mjs";
const CASES=["TC-01","TC-02","TC-03","TC-04","TC-05"];
const caseFixture=(caseId,value="unverified")=>({
  caseId,sourceAuthorization:value,personPermission:value,
  aiTransferNoticeAndPermission:value
});
const policies=[
  "purposeRestriction","privateAccess","retentionDeadline",
  "deletionAndWithdrawal","independentHumanReview","ownerPrivacyReview"
];
const sample={
  schemaVersion:V,studyId:"LOCAL_TEST",
  cases:CASES.map(id=>caseFixture(id)),
  policy:Object.fromEntries(policies.map(k=>[k,"not_approved"]))
};
const clone=x=>structuredClone(x);
const held=inspect(sample);
assert.equal(held.status,"PERSONAL_PHOTO_TRANSFER_HOLD");
assert.equal(held.caseCounts.cases,5);
assert.equal(held.missingCases.length,5);
assert.equal(held.missingPolicies.length,policies.length);
assert.equal(held.caseCounts.providerTransferPermissionsDocumented,0);
assert.equal(held.providerExecutionAuthorized,false);
assert.equal(held.productReady,false);
assert.equal(held.releaseReady,false);
const partly=clone(sample);
partly.cases[0].sourceAuthorization="operator_documented";
partly.policy.purposeRestriction="owner_approved";
assert.equal(inspect(partly).caseCounts.sourceRightsDocumented,1);
assert.equal(inspect(partly).status,"PERSONAL_PHOTO_TRANSFER_HOLD");
const declared=clone(sample);
declared.cases=CASES.map(id=>caseFixture(id,"operator_documented"));
declared.policy=Object.fromEntries(policies.map(k=>[k,"owner_approved"]));
const nominal=inspect(declared);
assert.equal(nominal.declarationsComplete,true);
assert.equal(nominal.status,"DECLARATIONS_PRESENT_INDEPENDENT_REVIEW_REQUIRED");
assert.equal(nominal.providerExecutionAuthorized,false);
assert.equal(nominal.actualConsentDocumentsVerifiedByTool,false);
assert.equal(nominal.biometricPrivacyOwnerSignoffVerifiedByTool,false);
assert.equal(nominal.privateRunnerAndDeletionEvidenceVerifiedByTool,false);
for(const payload of [
  {...sample,sourcePhoto:"image data"},
  {...sample,cases:[...sample.cases.slice(0,4),sample.cases[0]]},
  {...sample,cases:sample.cases.slice(0,4)},
  {...sample,cases:[{...sample.cases[0],imageUrl:"https://example.org/picture.jpg"},...sample.cases.slice(1)]},
  {...sample,cases:[{...sample.cases[0],personPermission:"user_says_go"},...sample.cases.slice(1)]},
  {...sample,cases:[{...sample.cases[0],fullName:"Sensitive Name"},...sample.cases.slice(1)]},
  {...sample,policy:{...sample.policy,photoUploadToGitHub:"allowed"}},
  {...sample,studyId:"mailto:test@example.com"}
]){
  assert.throws(()=>inspect(payload));
}
const encoded=JSON.stringify(nominal);
assert(!encoded.includes("imageUrl"));
assert(!encoded.includes("fullName"));
assert(!encoded.includes("mailto:"));
assert(!encoded.includes("sourcePhoto"));
console.log("verify-skin-private-photo-governance-gate: PASS (synthetic metadata only, all transfers fail closed)");
