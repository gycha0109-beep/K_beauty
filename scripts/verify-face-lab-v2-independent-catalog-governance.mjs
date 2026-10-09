#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FACE_LAB_CATALOG_REVIEW_STATE_VERSION,
  FACE_LAB_CATALOG_REVIEW_SCOPES,
  createFaceLabCatalogReviewRecord,
  inspectFaceLabCatalogReviewRecord,
  transitionFaceLabCatalogReview
} from "../lib/face-lab-v2/independent-catalog-review-state.js";
import {
  FACE_LAB_INDEPENDENT_PUBLICATION_GATE_VERSION,
  composeFaceLabReviewedLookDryRun,
  fingerprintFaceLabReviewSource
} from "../lib/face-lab-v2/independent-catalog-publication-gate.js";
import {
  FACE_LAB_SHADE_PROFILE_VERSION
} from "../lib/face-lab-v2/product-variant-authority.js";

for (const file of [
  "../lib/face-lab-v2/independent-catalog-review-state.js",
  "../lib/face-lab-v2/independent-catalog-publication-gate.js"
]) {
  const text = readFileSync(new URL(file, import.meta.url), "utf8");
  for (const forbidden of [
    "createServerSupabaseClient", "service_role", "product_fact_subjects",
    "readApprovedTryOnBundle", "generateFaceLabVisualTryOnCore",
    "buildFaceLabVisualTryOnProviderRequest", "loadApprovedBlob"
  ]) assert.ok(!text.includes(forbidden), file + " forbidden: " + forbidden);
}

const item = (kind, faceLabItemId, executionType) => ({
  kind, faceLabItemId,
  ...(executionType ? { executionType } : {}),
  approvalState: "approved",
  lifecycleState: "active",
  sourceVersion: "offline-item-v1",
  evidenceRefs: ["offline_review_item:" + faceLabItemId]
});
const variant = (faceLabItemId, faceLabVariantId, shadeProfile) => ({
  faceLabItemId, faceLabVariantId,
  identityVersion: "offline-identity-v1",
  identityState: "resolved",
  lifecycleState: "active",
  approvalState: "approved",
  identityEvidenceRefs: [
    "offline_review_variant:" + faceLabItemId + "-" + faceLabVariantId
  ],
  ...(shadeProfile ? { shadeProfile } : {})
});
const shadeProfile = {
  profileVersion: FACE_LAB_SHADE_PROFILE_VERSION,
  shadeKey: "rose-02", displayLabel: "Test Rose",
  attributes: { hueFamily: "rose", opacity: "medium" },
  evidenceRefsByAttribute: {
    hueFamily: ["offline_review_color:rose-hue"],
    opacity: ["offline_review_color:rose-opacity"]
  },
  colorAnchors: []
};
const lip = {
  item: item("product", "lip-test", "lip"),
  variant: variant("lip-test", "rose-02", shadeProfile),
  slotKey: "lip_color",
  capabilityClaims: [{
    capabilityKey: "lip_color", supportState: "supported",
    proofClass: "curated_capability_mapping",
    proofVersion: "offline-capability-v1",
    evidenceRefs: ["offline_review_capability:lip"]
  }]
};
const hair = {
  item: item("style_reference", "layers-test"),
  slotKey: "hair_shape",
  capabilityClaims: [{
    capabilityKey: "hair_shape", supportState: "supported",
    proofClass: "style_reference_definition",
    proofVersion: "offline-capability-v1",
    evidenceRefs: ["offline_review_capability:hair"]
  }]
};
const refs = [
  {
    assetRef: "offline_review_asset:lip", evidenceRef: "offline_review_image:lip",
    candidateRef: "face_lab_variant:lip-test:rose-02", slotKey: "lip_color",
    role: "brand_swatch", approvalState: "approved", assetStatus: "active",
    usagePermission: "virtual_try_on", storageKind: "governed_blob",
    storageKey: "facelab/fixture/lip.png", mimeType: "image/png",
    byteLength: 999, sha256: "1".repeat(64)
  },
  {
    assetRef: "offline_review_asset:hair", evidenceRef: "offline_review_image:hair",
    candidateRef: "face_lab_item:style_reference:layers-test",
    slotKey: "hair_shape",
    role: "style_reference", approvalState: "approved", assetStatus: "active",
    usagePermission: "virtual_try_on", storageKind: "governed_blob",
    storageKey: "facelab/fixture/hair.png", mimeType: "image/png",
    byteLength: 999, sha256: "2".repeat(64)
  }
];
const evidence = ["offline_reviewer_verification:fixture-v1"];
const editor = { actorId: "editor-1", actorRole: "editor" };
const reviewer = { actorId: "reviewer-1", actorRole: "reviewer" };
const publisher = { actorId: "publisher-1", actorRole: "publisher" };
const action = (type, identity, other = {}) => ({ type, ...identity, ...other });
let transitions = 0, rejectedTransitions = 0, rejectedPreviews = 0;

function step(record, move, expectedError = null) {
  const result = transitionFaceLabCatalogReview({
    record, expectedRevision: record.revision, action: move
  });
  if (expectedError) {
    assert.equal(result.status, "blocked", JSON.stringify(result));
    assert.equal(result.reason, expectedError);
    assert.equal(result.record, null);
    rejectedTransitions++;
    return record;
  }
  assert.equal(result.status, "accepted", JSON.stringify(result));
  assert.deepEqual(inspectFaceLabCatalogReviewRecord(result.record),
    { valid: true, reason: null });
  assert.equal(record.revision + 1, result.record.revision);
  assert.equal(result.governedSourceVerified, false);
  transitions++;
  return result.record;
}
function digest(scope, targetRef, source) {
  const output = fingerprintFaceLabReviewSource({ scope, targetRef, source });
  assert.match(output, /^[a-f0-9]{64}$/);
  return output;
}
function published(scope, targetRef, source) {
  const d = digest(scope, targetRef, source);
  let record = createFaceLabCatalogReviewRecord({
    scope, targetRef, sourceDigest: d
  });
  assert.equal(record.status, "draft", JSON.stringify(record));
  record = step(record, action("submit", editor));
  record = step(record, action("approve", reviewer, { evidenceRefs: evidence }));
  record = step(record, action("publish", publisher));
  assert.equal(record.status, "published");
  assert.equal(record.publishedContentRevision, 1);
  return record;
}
const reviewRecords = [
  published("item", "face_lab_item:product:lip-test", { item: lip.item }),
  published("variant", "face_lab_variant:lip-test:rose-02", {
    variant: lip.variant
  }),
  published("shade", "face_lab_shade:face_lab_variant:lip-test:rose-02", {
    shadeProfile: lip.variant.shadeProfile
  }),
  published("capability",
    "face_lab_capability:face_lab_variant:lip-test:rose-02:lip_color", {
      candidateRef: "face_lab_variant:lip-test:rose-02",
      slotKey: "lip_color", capabilityClaims: lip.capabilityClaims
    }),
  published("item", "face_lab_item:style_reference:layers-test", {
    item: hair.item
  }),
  published("capability",
    "face_lab_capability:face_lab_item:style_reference:layers-test:hair_shape", {
      candidateRef: "face_lab_item:style_reference:layers-test",
      slotKey: "hair_shape", capabilityClaims: hair.capabilityClaims
    }),
  ...refs.map(x => published("asset", "face_lab_asset:" + x.assetRef, {
    asset: x
  }))
];
assert.equal(FACE_LAB_CATALOG_REVIEW_STATE_VERSION,
  "face-lab-independent-catalog-review-state-v1");
assert.deepEqual(FACE_LAB_CATALOG_REVIEW_SCOPES,
  ["item", "variant", "shade", "capability", "asset"]);
assert.equal(FACE_LAB_INDEPENDENT_PUBLICATION_GATE_VERSION,
  "face-lab-independent-publication-gate-v1");

const base = () => ({
  sessionId: "offline-review-session",
  candidateSelections: structuredClone([lip, hair]),
  referenceRecords: structuredClone(refs),
  reviewRecords: structuredClone(reviewRecords)
});
const good = composeFaceLabReviewedLookDryRun(base());
assert.equal(good.status, "dry_run", JSON.stringify(good));
assert.equal(good.selectionCount, 2);
assert.equal(good.reviewSummary.length, 8);
assert.equal(good.previewSpec.status, "ready");
assert.equal(good.authority, null);
assert.equal(good.providerRequest, null);
assert.equal(good.governedSourceVerified, false);
assert.equal(good.renderReady, false);
assert.equal(good.imageModelInvoked, false);

function deny(label, mutate, reason) {
  const input = base();
  mutate(input);
  const result = composeFaceLabReviewedLookDryRun(input);
  assert.equal(result.status, "blocked", label + ": " + JSON.stringify(result));
  assert.equal(result.reason, reason, label);
  assert.equal(result.previewSpec, null);
  assert.equal(result.authority, null);
  assert.equal(result.providerRequest, null);
  assert.equal(result.imageModelInvoked, false);
  rejectedPreviews++;
}
deny("missing publication", x => x.reviewRecords.pop(),
  "review_gate_review_scope_mismatch");
deny("duplicate review", x => x.reviewRecords.push(x.reviewRecords[0]),
  "review_gate_duplicate_record");
deny("unrelated review", x => x.reviewRecords.push({
  ...x.reviewRecords[0], targetRef: "face_lab_item:product:unrelated"
}), "review_gate_review_scope_mismatch");
deny("altered product identity", x => x.candidateSelections[0].item.sourceVersion = "other-v2",
  "review_gate_content_changed");
deny("altered shade", x => x.candidateSelections[0].variant.shadeProfile.attributes.hueFamily = "violet",
  "review_gate_content_changed");
deny("changed capability", x => x.candidateSelections[0].capabilityClaims[0].proofVersion = "wrong-v2",
  "review_gate_content_changed");
deny("changed asset rights", x => x.referenceRecords[0].usagePermission = "other",
  "review_gate_content_changed");
deny("cross-linked asset", x => x.referenceRecords[0].candidateRef =
  "face_lab_item:style_reference:layers-test",
  "review_gate_content_changed");
deny("changed digest only", x => x.reviewRecords[0].sourceDigest = "a".repeat(64),
  "review_gate_record_invalid");
deny("fabricated approval flag", x => {
  const r = x.reviewRecords[0];
  r.status = "published";
  r.revision = 0;
  r.history = [];
}, "review_gate_record_invalid");
deny("non-published review", x => {
  const r = x.reviewRecords[0];
  x.reviewRecords[0] = step(r, action("revoke", publisher,
    { reason: "Official source retracted" }));
}, "review_gate_not_published");
deny("stale modified snapshot", x => {
  const r = x.reviewRecords[0];
  x.reviewRecords[0] = step(r, action("revise", editor,
    { nextSourceDigest: "c".repeat(64) }));
}, "review_gate_not_published");
deny("unapproved reference", x => x.referenceRecords[0].assetStatus = "revoked",
  "review_gate_content_changed");
deny("guidance service", x => {
  x.candidateSelections = [{
    item: item("service", "haircut"),
    slotKey: "hair_shape", capabilityClaims: [{
      capabilityKey: "hair_shape", supportState: "supported",
      proofClass: "service_definition", proofVersion: "fixture-v1",
      evidenceRefs: ["offline_review_capability:service"]
    }]
  }];
}, "review_gate_guidance_not_renderable");

// Invalid transitions cannot mutate the source record.
let draft = createFaceLabCatalogReviewRecord({
  scope: "item", targetRef: "face_lab_item:product:test",
  sourceDigest: "9".repeat(64)
});
const original = structuredClone(draft);
step(draft, action("publish", publisher), "review_transition_forbidden");
step(draft, action("approve", editor, { evidenceRefs: evidence }),
  "review_actor_or_action_invalid");
assert.deepEqual(draft, original);
draft = step(draft, action("submit", editor));
step(draft, action("publish", publisher), "review_transition_forbidden");
step(draft, action("approve", reviewer, { evidenceRefs: [] }),
  "review_evidence_missing");
const stale = transitionFaceLabCatalogReview({
  record: draft, expectedRevision: 0,
  action: action("approve", reviewer, { evidenceRefs: evidence })
});
assert.equal(stale.reason, "review_revision_conflict");
rejectedTransitions++;
draft = step(draft, action("reject", reviewer,
  { reason: "Evidence is not reliable" }));
step(draft, action("publish", publisher), "review_transition_forbidden");
draft = step(draft, action("revise", editor,
  { nextSourceDigest: "a".repeat(64) }));
draft = step(draft, action("submit", editor));
draft = step(draft, action("approve", reviewer, { evidenceRefs: evidence }));
draft = step(draft, action("publish", publisher));
assert.equal(draft.contentRevision, 2);
assert.equal(draft.publishedContentRevision, 2);
const publishedBeforeRevision = structuredClone(draft);
draft = step(draft, action("revise", editor,
  { nextSourceDigest: "b".repeat(64) }));
assert.equal(draft.status, "draft");
assert.equal(draft.publishedContentRevision, null);
assert.equal(draft.revocationEpoch,
  publishedBeforeRevision.revocationEpoch + 1);
step(draft, action("publish", publisher), "review_transition_forbidden");
draft = step(draft, action("submit", editor));
draft = step(draft, action("approve", reviewer, { evidenceRefs: evidence }));
draft = step(draft, action("publish", publisher));
draft = step(draft, action("suspend", publisher,
  { reason: "License review pending" }));
assert.equal(draft.status, "suspended");
draft = step(draft, action("revoke", publisher,
  { reason: "License permission revoked" }));
assert.equal(draft.status, "revoked");
step(draft, action("publish", publisher), "review_transition_forbidden");
draft = step(draft, action("reopen", publisher,
  { reason: "Reassessment required" }));
assert.equal(draft.status, "draft");
assert.equal(draft.publishedContentRevision, null);
assert.equal(draft.reviewedEvidenceRefs.length, 0);
assert.equal(draft.imageModelInvoked, undefined);

console.log(JSON.stringify({
  status: "PASS", transitions,
  rejectedTransitions, rejectedPreviews,
  reviewScopes: FACE_LAB_CATALOG_REVIEW_SCOPES.length,
  successfulPreviewSelections: good.selectionCount,
  providerCalls: 0, databaseAccess: 0,
  skincareReads: 0, governedSourceVerified: false,
  executableAuthorityReturned: false
}));
