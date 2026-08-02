import {
  PROMOTION_NON_GOLD_PURPOSES,
  PROMOTION_SUPPORTED_G4_PURPOSES
} from "@bejewely/face-contracts";
import { assemblePromotionEvidenceBundle } from "./evidence.js";
import { verifyPromotionSourceSnapshotIntegrity } from "./source-snapshot.js";

const RESOLVABLE_T5_REASONS = new Set([
  "promotion_policy_pending_t6",
  "external_mark_provenance_unresolved",
  "exact_duplicate_requires_review",
  "perceptual_neighbor_requires_review"
]);

function add(set, code) {
  set.add(code);
}

function result(status, reasons, bundle) {
  return Object.freeze({
    ok: true,
    status,
    reasonCodes: Object.freeze([...reasons].sort()),
    bundle
  });
}

export function policyReviewPreflight({
  snapshot,
  context,
  operatorReattestation,
  rightsReview,
  assetPolicyReview,
  leakageReview,
  assembledAt = new Date().toISOString()
}) {
  if (!verifyPromotionSourceSnapshotIntegrity(snapshot) || !context?.alignment || !context?.consensus) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "artifact_integrity_invalid", path: "source", detail: null }]) });
  }
  const evidence = assemblePromotionEvidenceBundle({
    snapshot,
    operatorReattestation,
    rightsReview,
    assetPolicyReview,
    leakageReview,
    assembledAt
  });
  if (!evidence.ok) return evidence;

  const blockers = new Set();
  const holds = new Set();
  const retention = new Set();
  const manifest = snapshot.provenanceProjection;
  const purpose = snapshot.generation.purpose;
  const alignment = context.alignment;

  if (manifest.operatorAttestation?.syntheticOnly !== true || manifest.operatorAttestation?.realPersonReferenceUsed !== false) {
    add(blockers, "real_person_reference_prohibited");
  }
  if (!PROMOTION_SUPPORTED_G4_PURPOSES.includes(purpose)) {
    if (purpose === "paired_skin_edit") add(blockers, "paired_identity_unverified");
    else if (purpose === "mixed_control_pilot") add(blockers, "mixed_control_gold_disabled");
    else add(blockers, "unsupported_purpose");
  }

  const requiredAxes = snapshot.claims.requiredAxes;
  if (!requiredAxes.every((axis) => context.consensus.axes?.[axis]?.status === "agreed")) add(blockers, "required_axis_not_agreed");
  if (alignment.overallVerdict === "misaligned") add(retention, "misaligned_negative_control_retained");
  else if (alignment.overallVerdict !== "aligned") add(blockers, "alignment_not_aligned");

  for (const code of alignment.promotionBlockReasons || []) {
    if (RESOLVABLE_T5_REASONS.has(code)) continue;
    if (code === "overall_misaligned" && alignment.overallVerdict === "misaligned") continue;
    if (code === "paired_identity_verification_unavailable" && purpose === "paired_skin_edit") continue;
    if (code === "mixed_control_pilot_promotion_disabled" && purpose === "mixed_control_pilot") continue;
    add(blockers, "candidate_alignment_mismatch");
  }

  if (rightsReview.status === "denied") add(blockers, "rights_review_denied");
  else if (rightsReview.status === "uncertain") add(holds, "rights_review_uncertain");

  if (assetPolicyReview.prohibitedTransformationDetected) add(blockers, "prohibited_transformation_detected");
  if (assetPolicyReview.visibleExternalMark === "present") add(blockers, "external_mark_present");
  else if (assetPolicyReview.visibleExternalMark === "uncertain") add(holds, "external_mark_unknown");

  const hintedMark = manifest.operatorHints?.visibleExternalMark?.status;
  if (hintedMark === "present" && assetPolicyReview.visibleExternalMark === "absent") add(holds, "operator_hint_visual_conflict");

  const exactReferences = snapshot.leakageInputs.exactCanonicalDuplicateOf || [];
  if (exactReferences.length === 0 && leakageReview.exactCanonicalDisposition !== "unique") add(blockers, "artifact_integrity_invalid");
  if (exactReferences.length > 0 && leakageReview.exactCanonicalDisposition === "unique") add(blockers, "artifact_integrity_invalid");
  if (leakageReview.exactCanonicalDisposition === "conflicting_claims_blocked") add(blockers, "exact_duplicate_conflicting_claims");
  if (leakageReview.exactCanonicalDisposition === "alias_retained_non_gold") add(retention, "exact_duplicate_alias_retained");
  if (leakageReview.exactCanonicalDisposition === "representative_selected" && !leakageReview.splitCouplingKeys.some((item) => item.kind === "canonical")) {
    add(holds, "perceptual_leakage_review_pending");
  }

  const perceptualReferences = snapshot.leakageInputs.nearestPerceptualCandidates || [];
  if (perceptualReferences.length === 0 && leakageReview.perceptualDisposition !== "no_review_candidates") add(blockers, "artifact_integrity_invalid");
  if (perceptualReferences.length > 0 && leakageReview.perceptualDisposition === "no_review_candidates") add(blockers, "artifact_integrity_invalid");
  if (leakageReview.perceptualDisposition === "uncertain") add(holds, "perceptual_leakage_review_pending");
  if (leakageReview.perceptualDisposition === "leakage_coupled" && !leakageReview.splitCouplingKeys.some((item) => item.kind === "reviewed_visual_similarity")) {
    add(holds, "perceptual_leakage_review_pending");
  }

  if (PROMOTION_NON_GOLD_PURPOSES.includes(purpose)) add(retention, "pilot_only_retained");
  if (blockers.size) return result("blocked", blockers, evidence.bundle);
  if (holds.size) return result("held_policy_review", holds, evidence.bundle);
  if (retention.size) return result("retained_g3_negative_control", retention, evidence.bundle);
  return result("eligible_for_promotion_review", new Set(), evidence.bundle);
}
