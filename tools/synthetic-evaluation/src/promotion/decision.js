import {
  G4_GRADE_RECORD_SCHEMA_VERSION,
  PROMOTION_DECISION_SCHEMA_VERSION,
  PROMOTION_POLICY_ID,
  PROMOTION_POLICY_VERSION,
  PROMOTION_STATUS_EVENT_SCHEMA_VERSION,
  PROMOTION_USE_SCOPE,
  validateG4GradeRecordShape,
  validatePromotionDecisionShape,
  validatePromotionStatusEventShape
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyPromotionEvidenceBundleIntegrity } from "./evidence.js";
import { PROMOTION_POLICY_DIGEST, splitCouplingKeysDigest } from "./policy.js";
import { verifyPromotionReviewSubmissionIntegrity } from "./promotion-review.js";
import {
  verifyPromotionAssetPolicyReviewIntegrity,
  verifyPromotionLeakageReviewIntegrity,
  verifyPromotionOperatorReattestationIntegrity,
  verifyUsageRightsReviewIntegrity
} from "./reviews.js";
import { verifyPromotionSourceSnapshotIntegrity } from "./source-snapshot.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function semanticWithout(value, timestampKey, digestKey) {
  const { [timestampKey]: timestamp, [digestKey]: digest, ...semantic } = value;
  return semantic;
}

function gradeSemantic(value) {
  const { gradeRecordId, recordedAt, gradeRecordDigest, ...semantic } = value;
  return semantic;
}

function decisionOutcome(preflight, review) {
  if (preflight.status === "eligible_for_promotion_review" && review.decision === "approve_g4") return "promoted_g4";
  if (preflight.status === "retained_g3_negative_control" && review.decision === "reject") return "retained_g3_negative_control";
  if (review.decision === "hold") return "held";
  return "rejected";
}

function expectedSourceDigests({
  snapshot,
  bundle,
  decision,
  rightsReview,
  assetPolicyReview,
  leakageReview,
  operatorReattestation,
  promotionReview
}) {
  return [
    snapshot.sourceSnapshotDigest,
    bundle.bundleDigest,
    snapshot.observation.g2RecordDigest,
    snapshot.judgment.g3RecordDigest,
    snapshot.judgment.consensusDigest,
    snapshot.judgment.alignmentDigest,
    rightsReview.reviewDigest,
    assetPolicyReview.reviewDigest,
    leakageReview.reviewDigest,
    operatorReattestation.attestationDigest,
    promotionReview.submissionDigest,
    decision.decisionDigest
  ].sort();
}

export function derivePromotionDecision({
  snapshot,
  bundle,
  preflight,
  operatorReattestation,
  rightsReview,
  assetPolicyReview,
  leakageReview,
  promotionReview,
  predecessorDecisionDigest = null,
  decidedAt = new Date().toISOString()
}) {
  if (
    !verifyPromotionSourceSnapshotIntegrity(snapshot) ||
    !verifyPromotionEvidenceBundleIntegrity(bundle) ||
    !verifyPromotionReviewSubmissionIntegrity(promotionReview) ||
    !verifyPromotionOperatorReattestationIntegrity(operatorReattestation) ||
    !verifyUsageRightsReviewIntegrity(rightsReview) ||
    !verifyPromotionAssetPolicyReviewIntegrity(assetPolicyReview) ||
    !verifyPromotionLeakageReviewIntegrity(leakageReview) ||
    !preflight?.ok ||
    preflight.bundle?.bundleDigest !== bundle.bundleDigest ||
    promotionReview.promotionKey !== snapshot.promotionKey ||
    promotionReview.evidenceBundleDigest !== bundle.bundleDigest ||
    bundle.promotionKey !== snapshot.promotionKey ||
    bundle.sourceSnapshotDigest !== snapshot.sourceSnapshotDigest ||
    bundle.operatorReattestationDigest !== operatorReattestation.attestationDigest ||
    bundle.rightsReviewDigest !== rightsReview.reviewDigest ||
    bundle.assetPolicyReviewDigest !== assetPolicyReview.reviewDigest ||
    bundle.leakageReviewDigest !== leakageReview.reviewDigest ||
    !(predecessorDecisionDigest === null || /^[a-f0-9]{64}$/.test(predecessorDecisionDigest)) ||
    !Number.isFinite(Date.parse(decidedAt))
  ) {
    return failure("promotion_decision_invalid", "sources");
  }
  const semantic = {
    schemaVersion: PROMOTION_DECISION_SCHEMA_VERSION,
    promotionKey: snapshot.promotionKey,
    candidateId: snapshot.candidate.candidateId,
    purpose: snapshot.generation.purpose,
    policyId: PROMOTION_POLICY_ID,
    policyVersion: PROMOTION_POLICY_VERSION,
    evidenceBundleDigest: bundle.bundleDigest,
    rightsReviewDigest: rightsReview.reviewDigest,
    leakageReviewDigest: leakageReview.reviewDigest,
    operatorReattestationDigest: operatorReattestation.attestationDigest,
    promotionReviewDigest: promotionReview.submissionDigest,
    outcome: decisionOutcome(preflight, promotionReview),
    predecessorDecisionDigest
  };
  const decisionDigest = sha256Hex(stableStringify(semantic));
  const decision = deepFreeze({ ...semantic, decidedAt, decisionDigest });
  return verifyPromotionDecisionIntegrity(decision)
    ? Object.freeze({ ok: true, decision })
    : failure("promotion_decision_invalid", "decision");
}

export function verifyPromotionDecisionIntegrity(value) {
  return validatePromotionDecisionShape(value).ok &&
    value.decisionDigest === sha256Hex(stableStringify(semanticWithout(value, "decidedAt", "decisionDigest")));
}

export function deriveG4GradeRecord({
  snapshot,
  bundle,
  decision,
  rightsReview,
  assetPolicyReview,
  leakageReview,
  operatorReattestation,
  promotionReview,
  recordedAt = new Date().toISOString()
}) {
  if (
    !verifyPromotionSourceSnapshotIntegrity(snapshot) ||
    !verifyPromotionEvidenceBundleIntegrity(bundle) ||
    !verifyPromotionDecisionIntegrity(decision) ||
    !verifyPromotionOperatorReattestationIntegrity(operatorReattestation) ||
    !verifyUsageRightsReviewIntegrity(rightsReview) ||
    !verifyPromotionAssetPolicyReviewIntegrity(assetPolicyReview) ||
    !verifyPromotionLeakageReviewIntegrity(leakageReview) ||
    !verifyPromotionReviewSubmissionIntegrity(promotionReview) ||
    decision.outcome !== "promoted_g4" ||
    decision.promotionKey !== snapshot.promotionKey ||
    decision.candidateId !== snapshot.candidate.candidateId ||
    decision.purpose !== snapshot.generation.purpose ||
    decision.evidenceBundleDigest !== bundle.bundleDigest ||
    promotionReview.decision !== "approve_g4" ||
    !Number.isFinite(Date.parse(recordedAt))
  ) {
    return failure("g4_grade_record_invalid", "sources");
  }
  const semantic = {
    schemaVersion: G4_GRADE_RECORD_SCHEMA_VERSION,
    candidateId: snapshot.candidate.candidateId,
    grade: "G4_SYNTHETIC_GOLD",
    scope: {
      purpose: snapshot.generation.purpose,
      claimAxes: [...snapshot.claims.requiredAxes].sort(),
      claimValuesDigest: snapshot.claims.claimValuesDigest,
      useScope: PROMOTION_USE_SCOPE,
      excludedClaims: [...snapshot.claims.excludedClaims].sort()
    },
    policy: {
      id: PROMOTION_POLICY_ID,
      version: PROMOTION_POLICY_VERSION,
      digest: PROMOTION_POLICY_DIGEST
    },
    sourceDigests: expectedSourceDigests({
      snapshot,
      bundle,
      decision,
      rightsReview,
      assetPolicyReview,
      leakageReview,
      operatorReattestation,
      promotionReview
    }),
    splitCouplingKeysDigest: splitCouplingKeysDigest(leakageReview.splitCouplingKeys)
  };
  const gradeRecordDigest = sha256Hex(stableStringify(semantic));
  const gradeRecord = deepFreeze({
    ...semantic,
    gradeRecordId: `grd_${gradeRecordDigest.slice(0, 24)}`,
    recordedAt,
    gradeRecordDigest
  });
  return verifyG4GradeRecordAgainstSources({
    gradeRecord,
    snapshot,
    bundle,
    decision,
    rightsReview,
    assetPolicyReview,
    leakageReview,
    operatorReattestation,
    promotionReview
  })
    ? Object.freeze({ ok: true, gradeRecord })
    : failure("g4_grade_record_invalid", "gradeRecord");
}

export function verifyG4GradeRecordIntegrity(value) {
  if (!validateG4GradeRecordShape(value).ok || value.policy.digest !== PROMOTION_POLICY_DIGEST) return false;
  const digest = sha256Hex(stableStringify(gradeSemantic(value)));
  return value.gradeRecordDigest === digest && value.gradeRecordId === `grd_${digest.slice(0, 24)}`;
}

export function verifyG4GradeRecordAgainstSources({
  gradeRecord,
  snapshot,
  bundle,
  decision,
  rightsReview,
  assetPolicyReview,
  leakageReview,
  operatorReattestation,
  promotionReview
}) {
  if (
    !verifyG4GradeRecordIntegrity(gradeRecord) ||
    !verifyPromotionSourceSnapshotIntegrity(snapshot) ||
    !verifyPromotionEvidenceBundleIntegrity(bundle) ||
    !verifyPromotionDecisionIntegrity(decision) ||
    !verifyPromotionOperatorReattestationIntegrity(operatorReattestation) ||
    !verifyUsageRightsReviewIntegrity(rightsReview) ||
    !verifyPromotionAssetPolicyReviewIntegrity(assetPolicyReview) ||
    !verifyPromotionLeakageReviewIntegrity(leakageReview) ||
    !verifyPromotionReviewSubmissionIntegrity(promotionReview)
  ) {
    return false;
  }
  return gradeRecord.candidateId === snapshot.candidate.candidateId &&
    gradeRecord.scope.purpose === snapshot.generation.purpose &&
    stableStringify(gradeRecord.scope.claimAxes) === stableStringify([...snapshot.claims.requiredAxes].sort()) &&
    gradeRecord.scope.claimValuesDigest === snapshot.claims.claimValuesDigest &&
    stableStringify(gradeRecord.scope.excludedClaims) === stableStringify([...snapshot.claims.excludedClaims].sort()) &&
    gradeRecord.splitCouplingKeysDigest === splitCouplingKeysDigest(leakageReview.splitCouplingKeys) &&
    stableStringify(gradeRecord.sourceDigests) === stableStringify(expectedSourceDigests({
      snapshot,
      bundle,
      decision,
      rightsReview,
      assetPolicyReview,
      leakageReview,
      operatorReattestation,
      promotionReview
    }));
}

export function createPromotionStatusEvent({
  promotionKey,
  gradeRecordDigest,
  event,
  reasonCodes = [],
  predecessorEventDigest = null,
  recordedAt = new Date().toISOString()
}) {
  const semantic = {
    schemaVersion: PROMOTION_STATUS_EVENT_SCHEMA_VERSION,
    promotionKey,
    gradeRecordDigest,
    event,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    predecessorEventDigest
  };
  const eventDigest = sha256Hex(stableStringify(semantic));
  const statusEvent = deepFreeze({ ...semantic, recordedAt, eventDigest });
  return verifyPromotionStatusEventIntegrity(statusEvent)
    ? Object.freeze({ ok: true, statusEvent })
    : failure("promotion_status_event_invalid", "statusEvent");
}

export function verifyPromotionStatusEventIntegrity(value) {
  if (!validatePromotionStatusEventShape(value).ok) return false;
  if (value.event === "activated" && (value.predecessorEventDigest !== null || value.reasonCodes.length !== 0)) return false;
  if (value.event !== "activated" && value.predecessorEventDigest === null) return false;
  return value.eventDigest === sha256Hex(stableStringify(semanticWithout(value, "recordedAt", "eventDigest")));
}

export function projectPromotionStatus(events) {
  if (!Array.isArray(events) || events.length === 0 || !events.every(verifyPromotionStatusEventIntegrity)) {
    return failure("promotion_status_event_invalid", "events");
  }
  const eventDigests = events.map((event) => event.eventDigest);
  if (new Set(eventDigests).size !== eventDigests.length) return failure("promotion_status_event_invalid", "events", "duplicate_event");
  const promotionKeys = new Set(events.map((event) => event.promotionKey));
  const gradeDigests = new Set(events.map((event) => event.gradeRecordDigest));
  if (promotionKeys.size !== 1 || gradeDigests.size !== 1) return failure("promotion_status_event_invalid", "events", "mixed_chain");

  const byDigest = new Map(events.map((event) => [event.eventDigest, event]));
  const roots = events.filter((event) => event.predecessorEventDigest === null);
  if (roots.length !== 1 || roots[0].event !== "activated") return failure("promotion_status_event_invalid", "events", "invalid_root");
  const childCounts = new Map();
  for (const event of events) {
    if (!event.predecessorEventDigest) continue;
    if (!byDigest.has(event.predecessorEventDigest)) return failure("promotion_status_event_invalid", "events", "broken_event_chain");
    childCounts.set(event.predecessorEventDigest, (childCounts.get(event.predecessorEventDigest) || 0) + 1);
  }
  if ([...childCounts.values()].some((count) => count !== 1)) return failure("promotion_status_event_invalid", "events", "branched_event_chain");
  const leaves = events.filter((event) => !childCounts.has(event.eventDigest));
  if (leaves.length !== 1) return failure("promotion_status_event_invalid", "events", "ambiguous_event_chain");

  const seen = new Set();
  let current = leaves[0];
  while (current) {
    if (seen.has(current.eventDigest)) return failure("promotion_status_event_invalid", "events", "cyclic_event_chain");
    seen.add(current.eventDigest);
    current = current.predecessorEventDigest ? byDigest.get(current.predecessorEventDigest) : null;
  }
  if (seen.size !== events.length) return failure("promotion_status_event_invalid", "events", "disconnected_event_chain");

  const latest = leaves[0];
  return Object.freeze({
    ok: true,
    promotionKey: latest.promotionKey,
    gradeRecordDigest: latest.gradeRecordDigest,
    active: latest.event === "activated",
    latestEvent: latest
  });
}
