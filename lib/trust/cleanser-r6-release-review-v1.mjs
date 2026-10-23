/**
 * R6/C5: dry-run-only release check, not a G2 or database authorization.
 * A TRUE checklist represents supplied evidence, NOT independent verification.
 * No calling path can return an activation grant or a production write.
 */
export const CLEANSER_R6_RELEASE_CHECK_VERSION="cleanser-r6-release-review-v1";
const checks=Object.freeze([
  ["exact_ten_existing_product_ids_preserved","R0_PRODUCT_IDS"],
  ["physical_unit_and_bundle_goldset_reviewed","R1_PRESENTATION_GOLDSET"],
  ["official_source_snapshots_and_sku_reviewed","R2_OFFICIAL_SKU_SOURCE"],
  ["subject_identity_and_cross_size_formulation_reviewed","R3_FORMULATION_SUBJECT"],
  ["facts_and_recommendation_metadata_governed","R3_FACT_AND_METADATA"],
  ["v1_v2_exact_live_ten_product_diff_reviewed","R4_LIVE_PREFLIGHT_DIFF"],
  ["frozen_164_by_12_semantics_verified","R5_164_BY_12_RECOMMENDATION"],
  ["independent_goldset_no_false_subject_or_offer_links","R5_INDEPENDENT_GOLDSET"],
  ["database_rls_api_security_review_approved","R6_DATABASE_SECURITY_APPROVAL"],
  ["canary_cohort_and_stop_switch_tested","R6_CANARY_KILL_SWITCH"],
  ["rollback_replay_and_observability_tested","R6_ROLLBACK_OBSERVABILITY"],
  ["explicit_protected_g2_governance_approval","R6_G2_GOVERNANCE_APPROVAL"],
]);
export function evaluateCleanserR6ReleaseReviewV1({evidence={},cohort_size=10}={}){
  if(!evidence||typeof evidence!=="object"||Array.isArray(evidence)||
    !Number.isSafeInteger(cohort_size)||cohort_size!==10)
    throw new TypeError("REVIEW_EVIDENCE_EXACT_TEN_COHORT_REQUIRED");
  for(const [key] of checks){
    if(evidence[key]!==undefined&&evidence[key]!==true&&evidence[key]!==false)
      throw new TypeError("REVIEW_EVIDENCE_NOT_BOOLEAN:"+key);
  }
  const missing=checks.filter(([key])=>evidence[key]!==true).map(([,code])=>code);
  return Object.freeze({
    version:CLEANSER_R6_RELEASE_CHECK_VERSION,
    cohort_size,
    checks_supplied:checks.length-missing.length,
    checks_required:checks.length,
    missing:Object.freeze(missing),
    decision:missing.length?"RELEASE_REVIEW_HOLD":"INDEPENDENT_PROTECTED_REVIEW_REQUIRED",
    deployment_authorized:false,production_grant_authorized:false,
    canary_activated:false,kill_switch_modified:false,
    database_writes:0,approved_fact_count:0,
    note:"Checklist is diagnostic only; protected owner must independently attest inputs and approve release"
  });
}
