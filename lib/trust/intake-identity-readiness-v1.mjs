export const TRUST_INTAKE_IDENTITY_READINESS_VERSION =
  "trust-intake-identity-readiness-v1";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256=/^[a-f0-9]{64}$/;
const MAX_ENTRIES=500;
const NEXT_ACTIONS=Object.freeze([
  "SUBJECT_ALREADY_EXISTS",
  "MARKET_EVIDENCE_REQUIRED",
  "CATALOG_IDENTITY_AUTHORITY_REQUIRED",
  "OFFICIAL_SOURCE_EVIDENCE_REQUIRED",
  "FORMULATION_ATTESTATION_REQUIRED",
  "GOVERNED_SUBJECT_PREFLIGHT_REQUIRED",
]);
function object(x){return !!x&&typeof x==="object"&&!Array.isArray(x);}
function text(x){return typeof x==="string"?x.trim():"";}
function fail(code){throw new Error(code);}

/**
 * Triage is diagnostic only. A resolved Hwahae/source binding is not an
 * authoritative manufacturer or formulation attestation.
 * NEVER grants Subject creation or Product Fact confirmation.
 */
export function classifyTrustIntakeIdentityReadiness(input) {
  if(!object(input) || !object(input.intake) ||
    !UUID.test(text(input.intake.id)) ||
    !UUID.test(text(input.intake.product_id)) ||
    !Array.isArray(input.subjects) ||
    !Array.isArray(input.sourceBindings) ||
    !Number.isInteger(input.taskCount) || input.taskCount<1)
    fail("TRUST_READINESS_INVALID_INPUT");
  const {intake,candidate,subjects,sourceBindings,taskCount}=input;
  if(intake.identity_state!=="SUBJECT_CREATION_REQUIRED" ||
    intake.trust_state!=="REVIEW_REQUIRED" || intake.subject_id!==null)
    fail("TRUST_READINESS_NOT_SUBJECT_CREATION_BACKLOG");
  if(subjects.some(s=>!object(s)||s.product_id!==intake.product_id) ||
    sourceBindings.some(b=>!object(b)||b.product_id!==intake.product_id))
    fail("TRUST_READINESS_SCOPE_MISMATCH");
  const issues=[];
  const currentSubjects=subjects.filter(s=>
    s.identity_status==="resolved" && s.current_state==="current");
  if(subjects.length) issues.push("SUBJECT_ALREADY_EXISTS");
  const market=text(intake.market);
  if(!/^[A-Z]{2}$/.test(market)) issues.push("MARKET_EVIDENCE_REQUIRED");

  const governedCandidate=object(candidate) &&
    candidate.id===intake.source_candidate_id &&
    candidate.matched_product_id===intake.product_id &&
    candidate.review_status==="promoted" &&
    candidate.identity_resolution_state==="resolved" &&
    object(candidate.identity_resolution_evidence?.authority_boundary) &&
    candidate.identity_resolution_evidence.authority_boundary.product_fact_write_allowed===false;
  const detail=object(intake.identity_resolution_detail)?
    intake.identity_resolution_detail:{};
  const adminAuthority=object(detail.identity_authority)?
    detail.identity_authority:null;
  const governedAdminAuthority=intake.source_candidate_id===null &&
    adminAuthority?.authority_kind==="admin_identity_authority" &&
    text(adminAuthority.market)===market &&
    text(adminAuthority.official_source_locator).startsWith("https://") &&
    SHA256.test(text(adminAuthority.source_content_digest)) &&
    !!text(adminAuthority.authority_resolution_version);
  if(!governedCandidate && !governedAdminAuthority)
    issues.push("CATALOG_IDENTITY_AUTHORITY_REQUIRED");

  // A binding by itself (including an official-looking URL) is NOT a
  // governed, exact-product evidence assertion. Separate qualified source
  // verification must be supplied by a future controlled reader.
  if(input.qualifiedOfficialEvidence!==true)
    issues.push("OFFICIAL_SOURCE_EVIDENCE_REQUIRED");
  if(input.formulationAttested!==true)
    issues.push("FORMULATION_ATTESTATION_REQUIRED");

  const resolvedSourceBindings=sourceBindings.filter(b=>b.binding_state==="resolved");
  const thirdPartyBindings=resolvedSourceBindings.filter(b=>
    ["hwahae","oliveyoung"].includes(text(b.source_name).toLowerCase()));
  const nextAction=NEXT_ACTIONS.find(x=>issues.includes(x)) ??
    "GOVERNED_SUBJECT_PREFLIGHT_REQUIRED";
  return Object.freeze({
    intakeId:intake.id,
    productId:intake.product_id,
    market:market||null,
    taskCount,
    existingSubjectCount:subjects.length,
    existingCurrentSubjectCount:currentSubjects.length,
    resolvedBindingCount:resolvedSourceBindings.length,
    thirdPartyBindingCount:thirdPartyBindings.length,
    catalogIdentityAuthorityPresent:!!(governedCandidate||governedAdminAuthority),
    nextAction,
    blockers:Object.freeze(issues),
    subjectCreationAuthorized:false,
    productFactWrites:0,
    recommendationWrites:0,
  });
}

export function summarizeTrustIntakeReadiness(rows) {
  if(!Array.isArray(rows) || rows.length>MAX_ENTRIES ||
    rows.some(r=>!object(r)||!NEXT_ACTIONS.includes(r.nextAction)||
      r.subjectCreationAuthorized!==false))
    fail("TRUST_READINESS_INVALID_REPORT");
  const products=new Set(),byAction={}; let tasks=0,linked=0;
  for(const row of rows){
    if(products.has(row.productId)) fail("TRUST_READINESS_DUPLICATE_PRODUCT");
    products.add(row.productId);
    tasks+=row.taskCount;
    if(row.resolvedBindingCount>0) linked++;
    byAction[row.nextAction]=(byAction[row.nextAction]??0)+1;
  }
  return Object.freeze({
    version:TRUST_INTAKE_IDENTITY_READINESS_VERSION,
    products:rows.length,blockedTasks:tasks,
    productsWithResolvedBindings:linked,
    byNextAction:Object.freeze(byAction),
    eligibleForAutomaticSubjectCreation:0,
  });
}
