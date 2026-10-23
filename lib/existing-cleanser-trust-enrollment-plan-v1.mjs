/**
 * Existing canonical cleanser -> governed TRUST research enrollment PROPOSAL.
 *
 * No client, DB writes, RPC calls, or actual approval. Enrollment is a
 * research-queue action, NOT recommendation admission or Fact confirmation.
 * The canonical product UUID is preserved and product_candidates is untouched.
 */
export const EXISTING_CLEANSER_TRUST_ENROLLMENT_VERSION =
  "existing-cleanser-trust-research-enrollment-plan-v1";
export const CLEANSER_REQUIRED_FACT_KEYS = Object.freeze(["low_ph","deep_cleansing"]);
export const CLEANSER_REGISTRY_VERSION = "product-fact-registry-cross-category-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (x) => typeof x === "string" ? x.trim() : "";
const canonical = (x) => text(x).normalize("NFKC").toLowerCase().replace(/\s+/g," ");
const rev = (productId) => "existing-cleanser-trust-research-v1:" + productId;

/**
 * Policy must come from a trusted DB read, never a request body.
 * Keys are checked exactly, so a missing registry gate fails closed.
 */
export function planExistingCleanserTrustResearchEnrollment({
  product, catalogProducts=[], existingIntakes=[], policy=null,
}={}){
  const issues=[];
  const productId=UUID.test(String(product?.id||""))?product.id:null;
  if(!productId||product?.category!=="cleanser"||
    !text(product?.brand)||!text(product?.name)||
    !text(product?.normalized_brand)||!text(product?.normalized_name)){
    issues.push("INVALID_EXISTING_CANONICAL_CLEANSER");
  }
  if(!Array.isArray(catalogProducts)||!Array.isArray(existingIntakes)){
    issues.push("INVENTORY_SCOPE_UNVERIFIED");
  }
  if(!Array.isArray(catalogProducts)||!catalogProducts.some(row=>row?.id===productId)){
    issues.push("CANONICAL_PRODUCT_MISSING_FROM_INVENTORY");
  }
  if(Array.isArray(catalogProducts)&&catalogProducts.some(row=>
    row?.id!==productId && canonical(row?.normalized_brand)===canonical(product?.normalized_brand)&&
    canonical(row?.normalized_name)===canonical(product?.normalized_name))){
    issues.push("CANONICAL_IDENTITY_COLLISION");
  }
  const rows=Array.isArray(existingIntakes)?existingIntakes.filter(row=>row?.product_id===productId):[];
  if(rows.length) issues.push("EXISTING_TRUST_INTAKE_PRESENT");
  if(!policy||policy.registryVersion!==CLEANSER_REGISTRY_VERSION||
    !Array.isArray(policy.requiredFactKeys)||
    policy.requiredFactKeys.length!==CLEANSER_REQUIRED_FACT_KEYS.length||
    !CLEANSER_REQUIRED_FACT_KEYS.every(key=>policy.requiredFactKeys.includes(key))||
    policy.allNewLineageAllowed!==true){
    issues.push("GOVERNED_REGISTRY_WRITE_POLICY_UNVERIFIED");
  }
  const blockers=Object.freeze([...new Set(issues)].sort());
  const ready=blockers.length===0;
  return Object.freeze({
    version:EXISTING_CLEANSER_TRUST_ENROLLMENT_VERSION,
    productId,
    state:ready?"TRUST_INTAKE_ENROLLMENT_PROPOSED":"TRUST_INTAKE_ENROLLMENT_HELD",
    blockers,
    proposal:ready?Object.freeze({
      product_id:productId,
      source_candidate_id:null,
      catalog_revision:rev(productId),
      category:"cleanser",
      market:"KR",
      subject_id:null,
      identity_state:"PENDING",
      trust_state:"PENDING",
      required_fact_policy_version:"product-fact-required-policy-v1",
    }):null,
    requiredFactKeys:CLEANSER_REQUIRED_FACT_KEYS,
    nextGovernedAction:ready?
      "PRIVILEGED_TRUST_INTAKE_REVIEW_AND_IDEMPOTENT_ENQUEUE":
      "RESEARCH_OR_IDENTITY_RECONCILIATION_REQUIRED",
    reviewRequired:true,
    enrollmentPerformed:false,
    productCandidatesCreated:0,
    subjectsCreated:0,
    currentFactsConfirmed:0,
    admissionGrantsIssued:0,
    productionWrites:0,
  });
}
