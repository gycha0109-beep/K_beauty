import assert from "node:assert/strict";
import test from "node:test";
import {
  preparePromotionPolicyReviewPreflight,
  preparePromotionSourcePreflight
} from "../../src/promotion/orchestrator.js";
import { approvedPolicyReviewDrafts, setupStoredPromotionCase } from "./helpers.mjs";

async function preflight(stored, overrides = {}) {
  const source = await preparePromotionSourcePreflight({
    dataRoot: stored.dataRoot,
    candidateId: stored.candidateManifest.candidateId,
    alignmentDigest: stored.alignment.alignmentDigest,
    assembledAt: "2026-08-02T05:00:00.000Z"
  });
  assert.equal(source.ok, true);
  return preparePromotionPolicyReviewPreflight({
    dataRoot: stored.dataRoot,
    candidateId: stored.candidateManifest.candidateId,
    alignmentDigest: stored.alignment.alignmentDigest,
    reviewDrafts: approvedPolicyReviewDrafts(source.snapshot, overrides),
    sourceAssembledAt: "2026-08-02T05:00:00.000Z",
    bundleAssembledAt: "2026-08-02T05:40:00.000Z"
  });
}

test("aligned skin-control evidence becomes eligible for independent promotion review", async () => {
  const stored = await setupStoredPromotionCase({ fixture: "D" });
  const result = await preflight(stored);
  assert.equal(result.ok, true);
  assert.equal(result.preflight.status, "eligible_for_promotion_review");
  assert.deepEqual(result.preflight.reasonCodes, []);
  assert.equal(result.writesPerformed, 0);
});

test("rights uncertain holds and rights denied blocks", async () => {
  const heldStored = await setupStoredPromotionCase();
  const held = await preflight(heldStored, { rightsReview: { status: "uncertain" } });
  assert.equal(held.preflight.status, "held_policy_review");
  assert.equal(held.preflight.reasonCodes.includes("rights_review_uncertain"), true);

  const blockedStored = await setupStoredPromotionCase();
  const blocked = await preflight(blockedStored, { rightsReview: { status: "denied" } });
  assert.equal(blocked.preflight.status, "blocked");
  assert.equal(blocked.preflight.reasonCodes.includes("rights_review_denied"), true);
});

test("canonical image mark review, not the import hint, controls promotion", async () => {
  const presentStored = await setupStoredPromotionCase({ markStatus: "unknown" });
  const present = await preflight(presentStored, { assetPolicyReview: { visibleExternalMark: "present" } });
  assert.equal(present.preflight.status, "blocked");
  assert.equal(present.preflight.reasonCodes.includes("external_mark_present"), true);

  const uncertainStored = await setupStoredPromotionCase({ markStatus: "unknown" });
  const uncertain = await preflight(uncertainStored, { assetPolicyReview: { visibleExternalMark: "uncertain" } });
  assert.equal(uncertain.preflight.status, "held_policy_review");
  assert.equal(uncertain.preflight.reasonCodes.includes("external_mark_unknown"), true);
});

test("consensus-valid misalignment is retained as non-Gold negative control", async () => {
  const stored = await setupStoredPromotionCase({
    fixture: "B",
    overrides: { "skin.redness.presence": { value: "moderate_or_higher" } }
  });
  assert.equal(stored.alignment.overallVerdict, "misaligned");
  const result = await preflight(stored);
  assert.equal(result.preflight.status, "retained_g3_negative_control");
  assert.equal(result.preflight.reasonCodes.includes("misaligned_negative_control_retained"), true);
});

test("exact duplicate representative, alias, and conflict dispositions remain distinct", async () => {
  const representativeStored = await setupStoredPromotionCase({ exactDuplicates: ["cand_aaaaaaaaaaaaaaaaaaaaaaaa"] });
  const representative = await preflight(representativeStored);
  assert.equal(representative.preflight.status, "eligible_for_promotion_review");

  const aliasStored = await setupStoredPromotionCase({ exactDuplicates: ["cand_aaaaaaaaaaaaaaaaaaaaaaaa"] });
  const alias = await preflight(aliasStored, { leakageReview: { exactCanonicalDisposition: "alias_retained_non_gold" } });
  assert.equal(alias.preflight.status, "retained_g3_negative_control");
  assert.equal(alias.preflight.reasonCodes.includes("exact_duplicate_alias_retained"), true);

  const conflictStored = await setupStoredPromotionCase({ exactDuplicates: ["cand_aaaaaaaaaaaaaaaaaaaaaaaa"] });
  const conflict = await preflight(conflictStored, { leakageReview: { exactCanonicalDisposition: "conflicting_claims_blocked" } });
  assert.equal(conflict.preflight.status, "blocked");
  assert.equal(conflict.preflight.reasonCodes.includes("exact_duplicate_conflicting_claims"), true);
});

test("perceptual neighbor stays held until explicit review is complete", async () => {
  const stored = await setupStoredPromotionCase({
    perceptualNeighbors: [{ candidateId: "cand_bbbbbbbbbbbbbbbbbbbbbbbb", hammingDistance: 4 }]
  });
  const result = await preflight(stored, {
    leakageReview: {
      perceptualDisposition: "uncertain",
      splitCouplingKeys: []
    }
  });
  assert.equal(result.preflight.status, "held_policy_review");
  assert.equal(result.preflight.reasonCodes.includes("perceptual_leakage_review_pending"), true);
});

test("mixed-control pilot cannot become G4", async () => {
  const stored = await setupStoredPromotionCase({ fixture: "B", purpose: "mixed_control_pilot" });
  const result = await preflight(stored);
  assert.equal(result.preflight.status, "blocked");
  assert.equal(result.preflight.reasonCodes.includes("mixed_control_gold_disabled"), true);
});
