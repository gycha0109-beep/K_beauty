import { readJson, writeExclusiveJson, writeSemanticAddressedJson } from "../judgment/artifact-store.js";
import { stableStringify } from "../shared/canonical-json.js";
import {
  verifyG4GradeRecordAgainstSources,
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
  promotionActivationClaimRelativePath,
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
  promotionStatusSuccessorClaimRelativePath,
  toNativePromotionPath
} from "./storage-layout.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

async function writeArtifact(dataRoot, relativePath, value, verify, digestKey) {
  const result = await writeSemanticAddressedJson(
    toNativePromotionPath(dataRoot, relativePath),
    value,
    (existing, proposed) => verify(existing) && existing[digestKey] === proposed[digestKey]
  );
  return Object.freeze({ created: result.created, value: result.value, relativePath });
}

async function claimSingleSuccessor(dataRoot, relativePath, claim) {
  const absolutePath = toNativePromotionPath(dataRoot, relativePath);
  try {
    await writeExclusiveJson(absolutePath, claim);
    return Object.freeze({ created: true, claim, relativePath });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let existing;
    try {
      existing = await readJson(absolutePath);
    } catch {
      throw Object.assign(new Error("promotion_status_claim_conflict"), { code: "promotion_status_claim_conflict" });
    }
    if (stableStringify(existing) !== stableStringify(claim)) {
      throw Object.assign(new Error("promotion_status_claim_conflict"), { code: "promotion_status_claim_conflict" });
    }
    return Object.freeze({ created: false, claim: existing, relativePath });
  }
}

function confirmationLinksValid({
  snapshot,
  operatorReattestation,
  rightsReview,
  assetPolicyReview,
  leakageReview,
  bundle,
  promotionReview,
  decision
}) {
  const candidateId = snapshot.candidate.candidateId;
  return operatorReattestation.candidateId === candidateId &&
    rightsReview.candidateId === candidateId &&
    assetPolicyReview.candidateId === candidateId &&
    leakageReview.candidateId === candidateId &&
    operatorReattestation.sourceSnapshotDigest === snapshot.sourceSnapshotDigest &&
    rightsReview.sourceSnapshotDigest === snapshot.sourceSnapshotDigest &&
    assetPolicyReview.sourceSnapshotDigest === snapshot.sourceSnapshotDigest &&
    leakageReview.sourceSnapshotDigest === snapshot.sourceSnapshotDigest &&
    bundle.promotionKey === snapshot.promotionKey &&
    bundle.sourceSnapshotDigest === snapshot.sourceSnapshotDigest &&
    bundle.operatorReattestationDigest === operatorReattestation.attestationDigest &&
    bundle.rightsReviewDigest === rightsReview.reviewDigest &&
    bundle.assetPolicyReviewDigest === assetPolicyReview.reviewDigest &&
    bundle.leakageReviewDigest === leakageReview.reviewDigest &&
    promotionReview.promotionKey === snapshot.promotionKey &&
    promotionReview.evidenceBundleDigest === bundle.bundleDigest &&
    decision.promotionKey === snapshot.promotionKey &&
    decision.candidateId === candidateId &&
    decision.purpose === snapshot.generation.purpose &&
    decision.evidenceBundleDigest === bundle.bundleDigest &&
    decision.rightsReviewDigest === rightsReview.reviewDigest &&
    decision.leakageReviewDigest === leakageReview.reviewDigest &&
    decision.operatorReattestationDigest === operatorReattestation.attestationDigest &&
    decision.promotionReviewDigest === promotionReview.submissionDigest;
}

function decisionMatchesReview(decision, promotionReview) {
  if (decision.outcome === "promoted_g4") return promotionReview.decision === "approve_g4";
  if (decision.outcome === "held") return promotionReview.decision === "hold";
  if (["rejected", "retained_g3_negative_control"].includes(decision.outcome)) return promotionReview.decision === "reject";
  return false;
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
  if (validators.some(([value, verify]) => !verify(value)) || !confirmationLinksValid({ snapshot, operatorReattestation, rightsReview, assetPolicyReview, leakageReview, bundle, promotionReview, decision }) || !decisionMatchesReview(decision, promotionReview)) {
    return failure("promotion_confirmation_invalid", "artifacts");
  }
  if (decision.outcome === "promoted_g4") {
    if (
      !verifyG4GradeRecordAgainstSources({ gradeRecord, snapshot, bundle, decision, rightsReview, assetPolicyReview, leakageReview, operatorReattestation, promotionReview }) ||
      !verifyPromotionStatusEventIntegrity(activationEvent) ||
      activationEvent.event !== "activated" ||
      activationEvent.promotionKey !== snapshot.promotionKey ||
      activationEvent.gradeRecordDigest !== gradeRecord.gradeRecordDigest
    ) {
      return failure("promotion_confirmation_invalid", "activation");
    }
  } else if (gradeRecord !== null || activationEvent !== null) {
    return failure("promotion_confirmation_invalid", "activation", "non_gold_cannot_activate");
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
    const activationClaim = {
      schemaVersion: "promotion-activation-claim-v1",
      promotionKey: snapshot.promotionKey,
      gradeRecordDigest: gradeRecord.gradeRecordDigest,
      activationEventDigest: activationEvent.eventDigest
    };
    writes.push(await claimSingleSuccessor(dataRoot, promotionActivationClaimRelativePath(snapshot.promotionKey), activationClaim));
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
  if (!verifyPromotionStatusEventIntegrity(statusEvent) || statusEvent.event === "activated") {
    return failure("promotion_status_event_invalid", "statusEvent");
  }
  const claim = {
    schemaVersion: "promotion-status-successor-claim-v1",
    promotionKey: statusEvent.promotionKey,
    gradeRecordDigest: statusEvent.gradeRecordDigest,
    predecessorEventDigest: statusEvent.predecessorEventDigest,
    successorEventDigest: statusEvent.eventDigest
  };
  let claimResult;
  try {
    claimResult = await claimSingleSuccessor(
      dataRoot,
      promotionStatusSuccessorClaimRelativePath(statusEvent.promotionKey, statusEvent.predecessorEventDigest),
      claim
    );
  } catch (error) {
    return failure(error?.code || "promotion_status_claim_conflict", "statusEvent.predecessorEventDigest");
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
    state: claimResult.created || result.created ? "registered" : "existing",
    writesPerformed: Number(claimResult.created) + Number(result.created),
    statusEvent: result.value
  });
}
