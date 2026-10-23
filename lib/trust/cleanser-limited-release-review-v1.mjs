/**
 * Experimental limited-fit R6 review. Separate from the stricter governed
 * Product Fact R6 checklist; neither policy grants runtime admission.
 * Proof must be supplied by protected owners, never by clients or synthetic
 * per-product flags.
 */
export const CLEANSER_LIMITED_RELEASE_REVIEW_VERSION="cleanser-limited-release-review-v1";
export const CHECKS=Object.freeze([
  ["exact_kr_product_match_goldset_reviewed","L1_KR_EXACT_PRODUCT_GOLDSET"],
  ["cross_market_variant_collision_tested","L2_MARKET_VARIANT_COLLISION"],
  ["review_source_rights_approved","L3_REVIEW_SOURCE_USAGE_RIGHTS"],
  ["review_aggregate_scope_and_sample_evaluated","L4_REVIEW_PROVENANCE_AND_BIAS"],
  ["bounded_preference_metadata_reviewed","L5_BOUNDED_PREFERENCE_REVIEW"],
  ["unsupported_functional_claims_abstain_tested","L6_FUNCTIONAL_CLAIM_ABSTENTION"],
  ["live_ten_subject_fact_grants_stay_independent","L7_PRODUCT_FACT_FIREWALL"],
  ["frozen_legacy_recommendation_semantics_passed","L8_LEGACY_RECOMMENDATION_INVARIANCE"],
  ["auth_rls_privacy_security_reviewed","L9_AUTH_AND_PRIVACY_REVIEW"],
  ["feature_flag_canary_kill_rollback_tested","L10_CANARY_ROLLBACK"],
  ["disclosure_and_support_policy_approved","L11_USER_DISCLOSURE"],
  ["explicit_protected_g2_authority_change_approved","L12_PROTECTED_G2_POLICY_CHANGE"]
]);
export function evaluateCleanserLimitedReleaseReviewV1({evidence={},scope="EXISTING_TEN_CLEANSERS"}={}){
  if(!evidence||typeof evidence!=="object"||Array.isArray(evidence)||
    scope!=="EXISTING_TEN_CLEANSERS")
    throw new TypeError("TRUSTED_RELEASE_REVIEW_INPUT_REQUIRED");
  for(const [key] of CHECKS){
    if(evidence[key]!==undefined&&typeof evidence[key]!=="boolean")
      throw new TypeError("BOOLEAN_REVIEW_CHECK_REQUIRED:"+key);
  }
  const missing=CHECKS.filter(([key])=>evidence[key]!==true).map(([,label])=>label);
  return Object.freeze({
    version:CLEANSER_LIMITED_RELEASE_REVIEW_VERSION,
    evidence_tier:"LIMITED_FIT_SHADOW",
    manufacturer_direct_reply_required:false,
    full_governed_fact_checklist_substituted:false,
    checks_required:CHECKS.length,checks_reported_complete:CHECKS.length-missing.length,
    missing:Object.freeze(missing),
    decision:missing.length?"LIMITED_RELEASE_HOLD":"INDEPENDENT_PROTECTED_OWNER_REVIEW_REQUIRED",
    limited_runtime_admission_granted:false,
    feature_flag_enabled:false,
    g2_policy_modified:false,
    fact_confirmation_authorized:false,
    database_writes:0
  });
}
