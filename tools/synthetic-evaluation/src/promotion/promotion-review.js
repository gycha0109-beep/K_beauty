import {
  PROMOTION_REVIEW_SUBMISSION_SCHEMA_VERSION,
  PROMOTION_USE_SCOPE,
  validatePromotionReviewSubmissionShape
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyPromotionEvidenceBundleIntegrity } from "./evidence.js";
import { verifyPromotionSourceSnapshotIntegrity } from "./source-snapshot.js";

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function semanticOf(value) {
  const { completedAt, submissionDigest, ...semantic } = value;
  return semantic;
}

function decisionAllowed(status, decision, reasonCodes) {
  if (status === "eligible_for_promotion_review") return ["approve_g4", "hold", "reject"].includes(decision);
  if (status === "held_policy_review") return decision === "hold";
  if (status === "blocked") return decision === "reject";
  if (status === "retained_g3_negative_control") {
    return decision === "reject" && reasonCodes.some((code) => [
      "misaligned_negative_control_retained",
      "exact_duplicate_alias_retained",
      "pilot_only_retained"
    ].includes(code));
  }
  return false;
}

export function finalizePromotionReviewSubmission({ snapshot, bundle, preflight, draft }) {
  if (
    !verifyPromotionSourceSnapshotIntegrity(snapshot) ||
    !verifyPromotionEvidenceBundleIntegrity(bundle) ||
    bundle.promotionKey !== snapshot.promotionKey ||
    bundle.sourceSnapshotDigest !== snapshot.sourceSnapshotDigest ||
    !preflight?.ok ||
    preflight.bundle?.bundleDigest !== bundle.bundleDigest ||
    !exactKeys(draft, ["reviewer", "decision", "confirmedScope", "reasonCodes", "completedAt"]) ||
    !exactKeys(draft.reviewer, ["reviewerId", "roleSeparationAttested"]) ||
    !exactKeys(draft.confirmedScope, ["purpose", "claimValuesDigest", "useScope", "excludedClaimsDigest"])
  ) {
    return failure("promotion_review_invalid", "draft");
  }
  if (snapshot.judgment.judgmentActorIds.includes(draft.reviewer.reviewerId)) {
    return failure("review_role_separation_unconfirmed", "reviewer.reviewerId");
  }
  const expectedExcludedClaimsDigest = sha256Hex(stableStringify([...snapshot.claims.excludedClaims].sort()));
  if (
    draft.confirmedScope.purpose !== snapshot.generation.purpose ||
    draft.confirmedScope.claimValuesDigest !== snapshot.claims.claimValuesDigest ||
    draft.confirmedScope.useScope !== PROMOTION_USE_SCOPE ||
    draft.confirmedScope.excludedClaimsDigest !== expectedExcludedClaimsDigest ||
    !decisionAllowed(preflight.status, draft.decision, draft.reasonCodes)
  ) {
    return failure("promotion_review_invalid", "confirmedScope");
  }
  const semantic = {
    schemaVersion: PROMOTION_REVIEW_SUBMISSION_SCHEMA_VERSION,
    promotionKey: snapshot.promotionKey,
    evidenceBundleDigest: bundle.bundleDigest,
    reviewer: {
      reviewerId: draft.reviewer.reviewerId,
      role: "promotion_reviewer",
      roleSeparationAttested: draft.reviewer.roleSeparationAttested
    },
    decision: draft.decision,
    confirmedScope: draft.confirmedScope,
    reasonCodes: [...new Set(draft.reasonCodes)].sort()
  };
  const submissionDigest = sha256Hex(stableStringify(semantic));
  const submission = deepFreeze({ ...semantic, completedAt: draft.completedAt, submissionDigest });
  return validatePromotionReviewSubmissionShape(submission).ok && verifyPromotionReviewSubmissionIntegrity(submission)
    ? Object.freeze({ ok: true, submission })
    : failure("promotion_review_invalid", "draft");
}

export function verifyPromotionReviewSubmissionIntegrity(value) {
  return validatePromotionReviewSubmissionShape(value).ok &&
    value.submissionDigest === sha256Hex(stableStringify(semanticOf(value)));
}
