import { writeSemanticAddressedJson } from "../judgment/artifact-store.js";
import {
  verifyG4GradeRecordIntegrity,
  verifyPromotionDecisionIntegrity,
  verifyPromotionStatusEventIntegrity
} from "./decision.js";
import { verifyPromotionEvidenceBundleIntegrity } from "./evidence.js";
import { verifyPromotionReviewSubmissionIntegrity } from "./promotion-review.js";
import {
  verifyPromotionAssetPolicyReviewIntegrity,
  verifyPromotionLeakageReviewIntegrity,
  verifyPromotionOperatorReattestationIntegrity,
  verifyUsageRightsReviewIntegrity
} from "./reviews.js";
import { verifyPromotionSourceSnapshotIntegrity } from "./source-snapshot.js";
import {
  promotionAssetReviewRelativePath,
  promotionDecisionRelativePath,
  promotionEvidenceBundleRelativePath,
  promotionG4GradeRelativePath,
  promotionLeakageReviewRelativePath,
  promotionReattestationRelativePath,
  promotionReviewRelativePath,
  promotionRightsReviewRelativePath,
  promotionSourceSnapshotRelativePath,
  promotionStatusEventRelativePath,
  toNativePromotionPath
} from "./storage-layout.js";

async function writeArtifact(dataRoot, relativePath, value, verify, digestKey) {
  const result = await writeSemanticAddressedJson(
    toNativePromotionPath(dataRoot, relativePath),
    value,
    (existing, proposed) => verify(existing) && existing[digestKey] === proposed[digestKey]
  );
  return Object.freeze({ created: result.created, value: result.value, relativePath });
}

export async function registerPromotionConfirmation({
  dataRoot,
  snapshot,
  operatorReattestation,
  rightsReview,
  assetPolicyReview,
  leakageReview,
  bundle,
  promotionReview,
  decision,
  gradeRecord = null,
  activationEvent = null
}) {
  const validators = [
    [snapshot, verifyPromotionSourceSnapshotIntegrity],
    [operatorReattestation, verifyPromotionOperatorReattestationIntegrity],
    [rightsReview, verifyUsageRightsReviewIntegrity],
    [assetPolicyReview, verifyPromotionAssetPolicyReviewIntegrity],
    [leakageReview, verifyPromotionLeakageReviewIntegrity],
    [bundle, verifyPromotionEvidenceBundleIntegrity],
    [promotionReview, verifyPromotionReviewSubmissionIntegrity],
    [decision, verifyPromotionDecisionIntegrity]
  ];
  if (validators.some(([value, verify]) => !verify(value))) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "promotion_confirmation_invalid", path: "artifacts", detail: null }]) });
  }
  if (decision.outcome === "promoted_g4") {
    if (!verifyG4GradeRecordIntegrity(gradeRecord) || !verifyPromotionStatusEventIntegrity(activationEvent) || activationEvent.event !== "activated" || activationEvent.gradeRecordDigest !== gradeRecord.gradeRecordDigest) {
      return Object.freeze({ ok: false, errors: Object.freeze([{ code: "promotion_confirmation_invalid", path: "activation", detail: null }]) });
    }
  } else if (gradeRecord !== null || activationEvent !== null) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "promotion_confirmation_invalid", path: "activation", detail: "non_gold_cannot_activate" }]) });
  }

  const candidateId = snapshot.candidate.candidateId;
  const writes = [];
  writes.push(await writeArtifact(dataRoot, promotionSourceSnapshotRelativePath(candidateId, snapshot.sourceSnapshotDigest), snapshot, verifyPromotionSourceSnapshotIntegrity, "sourceSnapshotDigest"));
  writes.push(await writeArtifact(dataRoot, promotionReattestationRelativePath(candidateId, operatorReattestation.attestationDigest), operatorReattestation, verifyPromotionOperatorReattestationIntegrity, "attestationDigest"));
  writes.push(await writeArtifact(dataRoot, promotionRightsReviewRelativePath(candidateId, rightsReview.reviewDigest), rightsReview, verifyUsageRightsReviewIntegrity, "reviewDigest"));
  writes.push(await writeArtifact(dataRoot, promotionAssetReviewRelativePath(candidateId, assetPolicyReview.reviewDigest), assetPolicyReview, verifyPromotionAssetPolicyReviewIntegrity, "reviewDigest"));
  writes.push(await writeArtifact(dataRoot, promotionLeakageReviewRelativePath(candidateId, leakageReview.reviewDigest), leakageReview, verifyPromotionLeakageReviewIntegrity, "reviewDigest"));
  writes.push(await writeArtifact(dataRoot, promotionEvidenceBundleRelativePath(candidateId, bundle.bundleDigest), bundle, verifyPromotionEvidenceBundleIntegrity, "bundleDigest"));
  writes.push(await writeArtifact(dataRoot, promotionReviewRelativePath(snapshot.promotionKey, promotionReview.submissionDigest), promotionReview, verifyPromotionReviewSubmissionIntegrity, "submissionDigest"));
  writes.push(await writeArtifact(dataRoot, promotionDecisionRelativePath(snapshot.promotionKey, decision.decisionDigest), decision, verifyPromotionDecisionIntegrity, "decisionDigest"));
  if (gradeRecord) {
    writes.push(await writeArtifact(dataRoot, promotionG4GradeRelativePath(candidateId, gradeRecord.gradeRecordDigest), gradeRecord, verifyG4GradeRecordIntegrity, "gradeRecordDigest"));
    writes.push(await writeArtifact(dataRoot, promotionStatusEventRelativePath(snapshot.promotionKey, activationEvent.eventDigest), activationEvent, verifyPromotionStatusEventIntegrity, "eventDigest"));
  }
  return Object.freeze({
    ok: true,
    state: writes.some((item) => item.created) ? "registered" : "existing",
    writesPerformed: writes.filter((item) => item.created).length,
    decision,
    gradeRecord,
    activationEvent,
    artifacts: Object.freeze(writes)
  });
}

export async function registerPromotionStatusEvent({ dataRoot, statusEvent }) {
  if (!verifyPromotionStatusEventIntegrity(statusEvent)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "promotion_status_event_invalid", path: "statusEvent", detail: null }]) });
  }
  const result = await writeArtifact(
    dataRoot,
    promotionStatusEventRelativePath(statusEvent.promotionKey, statusEvent.eventDigest),
    statusEvent,
    verifyPromotionStatusEventIntegrity,
    "eventDigest"
  );
  return Object.freeze({
    ok: true,
    state: result.created ? "registered" : "existing",
    writesPerformed: result.created ? 1 : 0,
    statusEvent: result.value
  });
}
