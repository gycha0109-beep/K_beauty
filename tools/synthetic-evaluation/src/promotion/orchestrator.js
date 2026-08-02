import {
  createPromotionStatusEvent,
  deriveG4GradeRecord,
  derivePromotionDecision
} from "./decision.js";
import { policyReviewPreflight } from "./preflight.js";
import { finalizePromotionReviewSubmission } from "./promotion-review.js";
import { registerPromotionConfirmation, registerPromotionStatusEvent } from "./registrar.js";
import {
  finalizePromotionAssetPolicyReview,
  finalizePromotionLeakageReview,
  finalizePromotionOperatorReattestation,
  finalizeUsageRightsReview
} from "./reviews.js";
import { assemblePromotionSourceSnapshot } from "./source-snapshot.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function finalizePolicyReviews(snapshot, drafts) {
  if (!drafts || typeof drafts !== "object" || Array.isArray(drafts)) return failure("promotion_policy_reviews_invalid", "reviews");
  const operator = finalizePromotionOperatorReattestation({ snapshot, draft: drafts.operatorReattestation });
  if (!operator.ok) return operator;
  const rights = finalizeUsageRightsReview({ snapshot, draft: drafts.rightsReview });
  if (!rights.ok) return rights;
  const asset = finalizePromotionAssetPolicyReview({ snapshot, draft: drafts.assetPolicyReview });
  if (!asset.ok) return asset;
  const leakage = finalizePromotionLeakageReview({ snapshot, draft: drafts.leakageReview });
  if (!leakage.ok) return leakage;
  return Object.freeze({
    ok: true,
    operatorReattestation: operator.artifact,
    rightsReview: rights.artifact,
    assetPolicyReview: asset.artifact,
    leakageReview: leakage.artifact
  });
}

export async function preparePromotionSourcePreflight({ dataRoot, candidateId, alignmentDigest, assembledAt }) {
  const source = await assemblePromotionSourceSnapshot({ dataRoot, candidateId, alignmentDigest, assembledAt });
  if (!source.ok) return source;
  return Object.freeze({
    ok: true,
    snapshot: source.snapshot,
    context: source.context,
    writesPerformed: 0
  });
}

export async function preparePromotionPolicyReviewPreflight({
  dataRoot,
  candidateId,
  alignmentDigest,
  reviewDrafts,
  sourceAssembledAt,
  bundleAssembledAt
}) {
  const source = await preparePromotionSourcePreflight({ dataRoot, candidateId, alignmentDigest, assembledAt: sourceAssembledAt });
  if (!source.ok) return source;
  const reviews = finalizePolicyReviews(source.snapshot, reviewDrafts);
  if (!reviews.ok) return reviews;
  const preflight = policyReviewPreflight({
    snapshot: source.snapshot,
    context: source.context,
    ...reviews,
    assembledAt: bundleAssembledAt
  });
  if (!preflight.ok) return preflight;
  return Object.freeze({
    ok: true,
    snapshot: source.snapshot,
    context: source.context,
    reviews,
    preflight,
    bundle: preflight.bundle,
    writesPerformed: 0
  });
}

export async function preparePromotionConfirmation({
  dataRoot,
  candidateId,
  alignmentDigest,
  reviewDrafts,
  promotionReviewDraft,
  predecessorDecisionDigest = null,
  sourceAssembledAt,
  bundleAssembledAt,
  decidedAt,
  recordedAt
}) {
  const prepared = await preparePromotionPolicyReviewPreflight({
    dataRoot,
    candidateId,
    alignmentDigest,
    reviewDrafts,
    sourceAssembledAt,
    bundleAssembledAt
  });
  if (!prepared.ok) return prepared;
  const review = finalizePromotionReviewSubmission({
    snapshot: prepared.snapshot,
    bundle: prepared.bundle,
    preflight: prepared.preflight,
    draft: promotionReviewDraft
  });
  if (!review.ok) return review;
  const decision = derivePromotionDecision({
    snapshot: prepared.snapshot,
    bundle: prepared.bundle,
    preflight: prepared.preflight,
    ...prepared.reviews,
    promotionReview: review.submission,
    predecessorDecisionDigest,
    decidedAt
  });
  if (!decision.ok) return decision;

  let gradeRecord = null;
  let activationEvent = null;
  if (decision.decision.outcome === "promoted_g4") {
    const grade = deriveG4GradeRecord({
      snapshot: prepared.snapshot,
      bundle: prepared.bundle,
      decision: decision.decision,
      ...prepared.reviews,
      promotionReview: review.submission,
      recordedAt
    });
    if (!grade.ok) return grade;
    gradeRecord = grade.gradeRecord;
    const event = createPromotionStatusEvent({
      promotionKey: prepared.snapshot.promotionKey,
      gradeRecordDigest: gradeRecord.gradeRecordDigest,
      event: "activated",
      reasonCodes: [],
      predecessorEventDigest: null,
      recordedAt
    });
    if (!event.ok) return event;
    activationEvent = event.statusEvent;
  }

  return Object.freeze({
    ok: true,
    ...prepared,
    promotionReview: review.submission,
    decision: decision.decision,
    gradeRecord,
    activationEvent,
    writesPerformed: 0
  });
}

export async function confirmPromotion(input) {
  const prepared = await preparePromotionConfirmation(input);
  if (!prepared.ok) return prepared;
  return registerPromotionConfirmation({
    dataRoot: input.dataRoot,
    snapshot: prepared.snapshot,
    ...prepared.reviews,
    bundle: prepared.bundle,
    promotionReview: prepared.promotionReview,
    decision: prepared.decision,
    gradeRecord: prepared.gradeRecord,
    activationEvent: prepared.activationEvent
  });
}

export async function revokePromotion({
  dataRoot,
  promotionKey,
  gradeRecordDigest,
  reasonCodes,
  predecessorEventDigest,
  recordedAt
}) {
  if (!Array.isArray(reasonCodes) || reasonCodes.length === 0) return failure("promotion_status_event_invalid", "reasonCodes");
  const event = createPromotionStatusEvent({
    promotionKey,
    gradeRecordDigest,
    event: "revoked",
    reasonCodes,
    predecessorEventDigest,
    recordedAt
  });
  if (!event.ok) return event;
  return registerPromotionStatusEvent({ dataRoot, statusEvent: event.statusEvent });
}
