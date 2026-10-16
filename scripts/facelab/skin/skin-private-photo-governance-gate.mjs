// Face Lab S1-D: metadata-only privacy/rights review preflight.
// Evaluation-only; NEVER handles photos, external providers, file paths, identities or secrets.
// "documented" is an operator claim, not independently verified evidence or authorization.
export const SKIN_PRIVATE_PHOTO_GATE_VERSION = "skin-private-photo-governance-gate-v1";
const ID=/^[A-Za-z0-9_-]{1,48}$/;
const allowedCaseKeys=["caseId","sourceAuthorization","personPermission","aiTransferNoticeAndPermission"];
const allowedPolicyKeys=["purposeRestriction","privateAccess","retentionDeadline","deletionAndWithdrawal","independentHumanReview","ownerPrivacyReview"];
const requiredCases=["TC-01","TC-02","TC-03","TC-04","TC-05"];
const declarationValues=new Set(["unverified","operator_documented"]);
const policyValues=new Set(["not_approved","owner_approved"]);

function record(x){return x!==null&&typeof x==="object"&&!Array.isArray(x)}
function exactKeys(data,allowed,ctx){
  if(!record(data)||Object.keys(data).length!==allowed.length||
      !allowed.every(key=>Object.hasOwn(data,key))) throw new Error(ctx+"_invalid_shape");
}
function safeCase(input){
  exactKeys(input,allowedCaseKeys,"case");
  if(typeof input.caseId!=="string"||!ID.test(input.caseId))throw new Error("case_id_invalid");
  for(const k of allowedCaseKeys.slice(1)){
    if(!declarationValues.has(input[k]))throw new Error("case_declaration_invalid");
  }
}
export function inspectSkinPrivatePhotoGovernance(input){
  exactKeys(input,["schemaVersion","studyId","cases","policy"],"manifest");
  if(input.schemaVersion!==SKIN_PRIVATE_PHOTO_GATE_VERSION||
     typeof input.studyId!=="string"||!ID.test(input.studyId))throw new Error("study_header_invalid");
  if(!Array.isArray(input.cases)||input.cases.length!==requiredCases.length)
    throw new Error("expected_five_private_cases");
  const seen=new Set(), blocked=[], counts={
    cases:input.cases.length,sourceRightsDocumented:0,
    subjectPermissionsDocumented:0,providerTransferPermissionsDocumented:0
  };
  for(const item of input.cases){
    safeCase(item);
    if(!requiredCases.includes(item.caseId)||seen.has(item.caseId))
      throw new Error("case_unknown_or_duplicate");
    seen.add(item.caseId);
    const needs=[];
    if(item.sourceAuthorization!=="operator_documented")needs.push("source_rights");
    else counts.sourceRightsDocumented++;
    if(item.personPermission!=="operator_documented")needs.push("person_permission");
    else counts.subjectPermissionsDocumented++;
    if(item.aiTransferNoticeAndPermission!=="operator_documented")needs.push("ai_provider_transfer_permission");
    else counts.providerTransferPermissionsDocumented++;
    if(needs.length)blocked.push({caseId:item.caseId,missing:needs});
  }
  exactKeys(input.policy,allowedPolicyKeys,"policy");
  const missingPolicy=allowedPolicyKeys.filter(k=>{
    if(!policyValues.has(input.policy[k]))throw new Error("policy_state_invalid");
    return input.policy[k]!=="owner_approved";
  });
  const administrativeDeclarationsComplete=blocked.length===0&&missingPolicy.length===0;
  return{
    version:SKIN_PRIVATE_PHOTO_GATE_VERSION,studyId:input.studyId,
    status:administrativeDeclarationsComplete
      ?"DECLARATIONS_PRESENT_INDEPENDENT_REVIEW_REQUIRED"
      :"PERSONAL_PHOTO_TRANSFER_HOLD",
    caseCounts:counts,missingCases:blocked,missingPolicies:missingPolicy,
    declarationsComplete:administrativeDeclarationsComplete,
    // No machine may turn self-declared/metadata-only statuses into authority.
    actualConsentDocumentsVerifiedByTool:false,
    thirdPartyPhotoRightsVerifiedByTool:false,
    biometricPrivacyOwnerSignoffVerifiedByTool:false,
    privateRunnerAndDeletionEvidenceVerifiedByTool:false,
    humanFaceSentToProviderByTool:false,
    providerExecutionAuthorized:false,
    modelAccuracyEstablished:false,
    productionScoreActivationAuthorized:false,
    productReady:false,releaseReady:false
  };
}
