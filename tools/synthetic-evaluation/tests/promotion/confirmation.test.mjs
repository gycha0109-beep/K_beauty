import assert from "node:assert/strict";
import test from "node:test";
import {
  projectPromotionStatus,
  verifyG4GradeRecordAgainstSources,
  verifyG4GradeRecordIntegrity
} from "../../src/promotion/decision.js";
import {
  confirmPromotion,
  preparePromotionConfirmation,
  preparePromotionSourcePreflight,
  revokePromotion
} from "../../src/promotion/orchestrator.js";
import { sha256Hex, stableStringify } from "../../src/shared/canonical-json.js";
import {
  approvedPolicyReviewDrafts,
  approvedPromotionReviewDraft,
  setupStoredPromotionCase
} from "./helpers.mjs";

async function inputsFor(stored) {
  const source = await preparePromotionSourcePreflight({
    dataRoot: stored.dataRoot,
    candidateId: stored.candidateManifest.candidateId,
    alignmentDigest: stored.alignment.alignmentDigest,
    assembledAt: "2026-08-02T05:00:00.000Z"
  });
  assert.equal(source.ok, true);
  return {
    dataRoot: stored.dataRoot,
    candidateId: stored.candidateManifest.candidateId,
    alignmentDigest: stored.alignment.alignmentDigest,
    reviewDrafts: approvedPolicyReviewDrafts(source.snapshot),
    promotionReviewDraft: approvedPromotionReviewDraft(source.snapshot),
    sourceAssembledAt: "2026-08-02T05:00:00.000Z",
    bundleAssembledAt: "2026-08-02T05:40:00.000Z",
    decidedAt: "2026-08-02T06:10:00.000Z",
    recordedAt: "2026-08-02T06:20:00.000Z"
  };
}

test("approved evidence creates purpose-scoped G4 and activation event idempotently", async () => {
  const stored = await setupStoredPromotionCase({ fixture: "D" });
  const input = await inputsFor(stored);
  const first = await confirmPromotion(input);
  assert.equal(first.ok, true);
  assert.equal(first.state, "registered");
  assert.equal(first.decision.outcome, "promoted_g4");
  assert.equal(first.gradeRecord.grade, "G4_SYNTHETIC_GOLD");
  assert.equal(first.gradeRecord.scope.purpose, "skin_cue_control");
  assert.equal(first.gradeRecord.scope.claimValuesDigest.length, 64);
  assert.equal(first.activationEvent.event, "activated");

  const second = await confirmPromotion({
    ...input,
    decidedAt: "2026-08-03T06:10:00.000Z",
    recordedAt: "2026-08-03T06:20:00.000Z"
  });
  assert.equal(second.ok, true);
  assert.equal(second.state, "existing");
  assert.equal(second.writesPerformed, 0);
  assert.equal(second.gradeRecord.gradeRecordDigest, first.gradeRecord.gradeRecordDigest);
});

test("promotion reviewer cannot reuse a T5 judgment actor identity", async () => {
  const stored = await setupStoredPromotionCase();
  const input = await inputsFor(stored);
  input.promotionReviewDraft.reviewer.reviewerId = "judge_alpha";
  const result = await confirmPromotion(input);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "review_role_separation_unconfirmed");
});

test("misaligned consensus-valid candidate records non-Gold disposition without G4", async () => {
  const stored = await setupStoredPromotionCase({
    fixture: "B",
    overrides: { "skin.redness.presence": { value: "moderate_or_higher" } }
  });
  const input = await inputsFor(stored);
  input.promotionReviewDraft.decision = "reject";
  input.promotionReviewDraft.reasonCodes = ["misaligned_negative_control_retained"];
  const result = await confirmPromotion(input);
  assert.equal(result.ok, true);
  assert.equal(result.decision.outcome, "retained_g3_negative_control");
  assert.equal(result.gradeRecord, null);
  assert.equal(result.activationEvent, null);
});

test("a recomputed G4 digest cannot hide a source-scope mutation", async () => {
  const stored = await setupStoredPromotionCase();
  const input = await inputsFor(stored);
  const prepared = await preparePromotionConfirmation(input);
  assert.equal(prepared.ok, true);
  const tampered = JSON.parse(JSON.stringify(prepared.gradeRecord));
  tampered.scope.claimAxes = tampered.scope.claimAxes.slice(1);
  const { gradeRecordId, recordedAt, gradeRecordDigest, ...semantic } = tampered;
  const digest = sha256Hex(stableStringify(semantic));
  tampered.gradeRecordDigest = digest;
  tampered.gradeRecordId = `grd_${digest.slice(0, 24)}`;
  assert.equal(verifyG4GradeRecordIntegrity(tampered), true);
  assert.equal(verifyG4GradeRecordAgainstSources({
    gradeRecord: tampered,
    snapshot: prepared.snapshot,
    bundle: prepared.bundle,
    decision: prepared.decision,
    ...prepared.reviews,
    promotionReview: prepared.promotionReview
  }), false);
});

test("revocation verifies stored G4 authority and deactivates status projection", async () => {
  const stored = await setupStoredPromotionCase();
  const input = await inputsFor(stored);
  const confirmed = await confirmPromotion(input);
  assert.equal(confirmed.ok, true);
  const revocationInput = {
    dataRoot: stored.dataRoot,
    candidateId: stored.candidateManifest.candidateId,
    promotionKey: confirmed.activationEvent.promotionKey,
    gradeRecordDigest: confirmed.gradeRecord.gradeRecordDigest,
    reasonCodes: ["newer_evidence_requires_review"],
    predecessorEventDigest: confirmed.activationEvent.eventDigest,
    recordedAt: "2026-08-03T07:00:00.000Z"
  };
  const revoked = await revokePromotion(revocationInput);
  assert.equal(revoked.ok, true);
  const projected = projectPromotionStatus([confirmed.activationEvent, revoked.statusEvent]);
  assert.equal(projected.ok, true);
  assert.equal(projected.active, false);
  assert.equal(projected.latestEvent.event, "revoked");

  const conflicting = await revokePromotion({
    ...revocationInput,
    reasonCodes: ["artifact_integrity_invalid"],
    recordedAt: "2026-08-03T08:00:00.000Z"
  });
  assert.equal(conflicting.ok, false);
  assert.equal(conflicting.errors[0].code, "promotion_status_claim_conflict");
});

test("revocation rejects a caller-stated grade that is not stored authority", async () => {
  const stored = await setupStoredPromotionCase();
  const input = await inputsFor(stored);
  const confirmed = await confirmPromotion(input);
  const result = await revokePromotion({
    dataRoot: stored.dataRoot,
    candidateId: stored.candidateManifest.candidateId,
    promotionKey: confirmed.activationEvent.promotionKey,
    gradeRecordDigest: "f".repeat(64),
    reasonCodes: ["artifact_integrity_invalid"],
    predecessorEventDigest: confirmed.activationEvent.eventDigest,
    recordedAt: "2026-08-03T07:00:00.000Z"
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "promotion_status_event_invalid");
});
