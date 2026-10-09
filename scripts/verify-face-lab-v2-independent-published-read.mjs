#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  readFaceLabIndependentPublishedDryRun,
  FACE_LAB_INDEPENDENT_PUBLISHED_READ_VERSION
} from "../lib/face-lab-v2/independent-catalog-published-read-core.js";
import {
  createFaceLabIndependentCatalogMemoryStore
} from "./fixtures/face-lab-independent-catalog-memory-store.mjs";
import {
  createFaceLabCatalogReviewRecord,
  transitionFaceLabCatalogReview
} from "../lib/face-lab-v2/independent-catalog-review-state.js";
import {
  fingerprintFaceLabReviewSource
} from "../lib/face-lab-v2/independent-catalog-publication-gate.js";
import {
  FACE_LAB_SHADE_PROFILE_VERSION
} from "../lib/face-lab-v2/product-variant-authority.js";

for (const file of [
  "../lib/face-lab-v2/independent-catalog-published-read-core.js",
  "./fixtures/face-lab-independent-catalog-memory-store.mjs"
]) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  for (const forbidden of [
    "createServerSupabaseClient", "product_fact_subjects",
    "generateFaceLabVisualTryOnCore",
    "buildFaceLabVisualTryOnProviderRequest", "executeOpenAiImageEdit"
  ]) assert.ok(!source.includes(forbidden), file + " " + forbidden);
}
const copy = x => structuredClone(x);
const publisher = {
  actorId: "publisher-mock", actorRole: "publisher"
};
const editor = { actorId: "editor-mock", actorRole: "editor" };
const reviewer = { actorId: "reviewer-mock", actorRole: "reviewer" };
const evidence = ["offline_published_review:fixture"];
let cases = 0, blockedCases = 0;

function published(scope, targetRef, source) {
  const sourceDigest = fingerprintFaceLabReviewSource({
    scope, targetRef, source
  });
  let record = createFaceLabCatalogReviewRecord({
    scope, targetRef, sourceDigest
  });
  for (const action of [
    { type: "submit", ...editor },
    { type: "approve", ...reviewer, evidenceRefs: evidence },
    { type: "publish", ...publisher }
  ]) {
    const result = transitionFaceLabCatalogReview({
      record, expectedRevision: record.revision, action
    });
    assert.equal(result.status, "accepted", JSON.stringify(result));
    record = result.record;
  }
  return record;
}
function makeProduct(name, slotKey = "lip_color") {
  const item = {
    faceLabItemId: name, kind: "product", executionType: "lip",
    approvalState: "approved", lifecycleState: "active",
    sourceVersion: "fixture-item-v1",
    evidenceRefs: ["fixture_item:" + name]
  };
  const shadeProfile = {
    profileVersion: FACE_LAB_SHADE_PROFILE_VERSION,
    shadeKey: "rose-02", displayLabel: "Fixture Rose",
    attributes: { hueFamily: "rose", opacity: "medium" },
    evidenceRefsByAttribute: {
      hueFamily: ["fixture_shade:hue"],
      opacity: ["fixture_shade:opacity"]
    },
    colorAnchors: []
  };
  const variant = {
    faceLabItemId: name, faceLabVariantId: "rose-02",
    identityVersion: "fixture-variant-v1", identityState: "resolved",
    lifecycleState: "active", approvalState: "approved",
    identityEvidenceRefs: ["fixture_variant:" + name],
    shadeProfile
  };
  return {
    item, variant, slotKey,
    capabilityClaims: [{
      capabilityKey: slotKey, supportState: "supported",
      proofClass: "curated_capability_mapping",
      proofVersion: "fixture-v1",
      evidenceRefs: ["fixture_capability:" + name]
    }]
  };
}
function makeHair() {
  return {
    item: {
      faceLabItemId: "layers", kind: "style_reference",
      approvalState: "approved", lifecycleState: "active",
      sourceVersion: "fixture-style-v1",
      evidenceRefs: ["fixture_item:layers"]
    },
    slotKey: "hair_shape",
    capabilityClaims: [{
      capabilityKey: "hair_shape", supportState: "supported",
      proofClass: "style_reference_definition",
      proofVersion: "fixture-style-proof-v1",
      evidenceRefs: ["fixture_capability:layers"]
    }]
  };
}
function reference(candidate, candidateRef, tag) {
  return {
    assetRef: "fixture_asset:" + tag,
    candidateRef, slotKey: candidate.slotKey,
    evidenceRef: "fixture_rights:" + tag,
    role: candidate.item.kind === "style_reference"
      ? "style_reference" : "brand_swatch",
    approvalState: "approved", assetStatus: "active",
    usagePermission: "virtual_try_on",
    storageKind: "governed_blob",
    storageKey: "facelab/test/" + tag + ".png",
    mimeType: "image/png", byteLength: 1000,
    sha256: "a".repeat(64)
  };
}
function buildEntry(candidate, tag) {
  const ref = candidate.item.kind === "product"
    ? "face_lab_variant:" + candidate.item.faceLabItemId +
      ":" + candidate.variant.faceLabVariantId
    : "face_lab_item:style_reference:" + candidate.item.faceLabItemId;
  const itemRef = "face_lab_item:" + candidate.item.kind +
    ":" + candidate.item.faceLabItemId;
  const asset = reference(candidate, ref, tag);
  const reviews = [
    published("item", itemRef, { item: candidate.item }),
    published("capability",
      "face_lab_capability:" + ref + ":" + candidate.slotKey, {
        candidateRef: ref,
        slotKey: candidate.slotKey,
        capabilityClaims: candidate.capabilityClaims
      })
  ];
  if (candidate.item.kind === "product") {
    reviews.push(
      published("variant", ref, { variant: candidate.variant }),
      published("shade", "face_lab_shade:" + ref, {
        shadeProfile: candidate.variant.shadeProfile
      })
    );
  }
  reviews.push(
    published("asset", "face_lab_asset:" + asset.assetRef, {
      asset
    })
  );
  return {
    candidate,
    referenceRecords: [asset],
    reviewRecords: reviews
  };
}
const lip = makeProduct("lip-primary");
const hair = makeHair();
const unrelated = makeProduct("lip-unrelated");
const seed = [
  buildEntry(lip, "lip-main"),
  buildEntry(hair, "hair-main"),
  buildEntry(unrelated, "lip-unrelated")
];
const lipSel = {
  faceLabItemId: "lip-primary", faceLabVariantId: "rose-02",
  slotKey: "lip_color"
};
const hairSel = { faceLabItemId: "layers", slotKey: "hair_shape" };
const unrelatedSel = {
  faceLabItemId: "lip-unrelated", faceLabVariantId: "rose-02",
  slotKey: "lip_color"
};
const makeStore = () => createFaceLabIndependentCatalogMemoryStore({
  entries: copy(seed)
});
const run = (source, selections = [lipSel, hairSel]) =>
  readFaceLabIndependentPublishedDryRun({
    sessionId: "offline-published-read-test",
    selections: copy(selections), source
  });
async function allow(label, action, selectionCount) {
  const r = await action();
  assert.equal(r.status, "dry_run", label + " " + JSON.stringify(r));
  assert.equal(r.selectionCount, selectionCount);
  assert.equal(r.previewSpec.status, "ready");
  assert.equal(r.authority, null);
  assert.equal(r.providerRequest, null);
  assert.equal(r.governedSourceVerified, false);
  assert.equal(r.renderReady, false);
  assert.equal(r.imageModelInvoked, false);
  cases++;
}
async function deny(label, action, expectedStatus, expectedReason) {
  const r = await action();
  assert.equal(r.status, expectedStatus, label + " " + JSON.stringify(r));
  assert.equal(r.reason, expectedReason, label);
  assert.equal(r.previewSpec, null, label);
  assert.equal(r.authority, null, label);
  assert.equal(r.providerRequest, null, label);
  assert.equal(r.imageModelInvoked, false, label);
  blockedCases++;
}

assert.equal(FACE_LAB_INDEPENDENT_PUBLISHED_READ_VERSION,
  "face-lab-independent-published-read-dry-run-v1");
await allow("multi-slot publication", () => run(makeStore()), 2);
await allow("reverse order", () => run(makeStore(), [hairSel, lipSel]), 2);
await allow("single product", () => run(makeStore(), [lipSel]), 1);

await deny("invalid request", () => readFaceLabIndependentPublishedDryRun(null),
  "blocked", "published_read_input_invalid");
await deny("missing selection", () => run(makeStore(), []),
  "blocked", "published_read_input_invalid");
await deny("duplicate slot", () => run(makeStore(), [lipSel, unrelatedSel]),
  "blocked", "published_read_duplicate_slot");
await deny("browser supplied approval", () => run(makeStore(), [
  { ...lipSel, approvalState: "approved" }
]), "blocked", "published_read_input_invalid");
await deny("unknown item", () => run(makeStore(), [
  { ...lipSel, faceLabItemId: "not-in-catalog" }
]), "blocked", "published_read_snapshot_not_available");
await deny("wrong option", () => run(makeStore(), [
  { ...lipSel, faceLabVariantId: "other-shade" }
]), "blocked", "published_read_snapshot_not_available");
await deny("wrong slot", () => run(makeStore(), [
  { ...lipSel, slotKey: "face_highlight" }
]), "blocked", "published_read_snapshot_not_available");
await deny("missing source", () => run(null),
  "unavailable", "published_read_source_unavailable");
const missing = makeStore();
missing.setOffline(true);
await deny("offline source", () => run(missing),
  "unavailable", "published_read_source_unavailable");

function mutate(store, scope, targetRef, type, requestId, extra = {}) {
  const old = store.getFixtureReview(scope, targetRef);
  return store.applyReviewAction({
    scope, targetRef, expectedRevision: old.revision, requestId,
    action: { type, ...publisher, ...extra }
  });
}
const lipRef = "face_lab_item:product:lip-primary";
const assetRef = "face_lab_asset:fixture_asset:lip-main";
const revoked = makeStore();
const saved = revoked.readSnapshot({ selections: [lipSel] });
assert.equal(saved.status, "available");
const rev = mutate(revoked, "item", lipRef, "revoke", "req-revoke-item",
  { reason: "Withdrawn item evidence" });
assert.equal(rev.status, "accepted");
assert.equal(rev.revocationEpoch, 1);
assert.deepEqual(revoked.verifySnapshot(saved.snapshotToken),
  { status: "changed" });
await deny("revoked item", () => run(revoked, [lipSel]),
  "blocked", "published_read_snapshot_not_available");
await allow("unrelated item unaffected", () => run(revoked, [hairSel]), 1);

const rights = makeStore();
const assetRev = mutate(rights, "asset", assetRef,
  "suspend", "req-suspend-image", { reason: "License review pending" });
assert.equal(assetRev.status, "accepted");
await deny("asset suspended", () => run(rights, [lipSel]),
  "blocked", "published_read_snapshot_not_available");
await allow("other item unaffected", () => run(rights, [hairSel]), 1);

const same = makeStore();
const original = same.getFixtureReview("item", lipRef);
const request = {
  scope: "item", targetRef: lipRef, expectedRevision: original.revision,
  requestId: "req-idempotent-001",
  action: { type: "revoke", ...publisher, reason: "Fixture withdrawal" }
};
const first = same.applyReviewAction(request);
const replay = same.applyReviewAction(copy(request));
assert.deepEqual(replay, first);
assert.equal(same.getFixtureReview("item", lipRef).revision, original.revision + 1);
assert.equal(same.applyReviewAction({
  ...request, action: { ...request.action, reason: "Different withdrawal" }
}).reason, "mock_request_id_conflict");
assert.equal(same.applyReviewAction({
  ...request, requestId: "req-new-stale-001"
}).reason, "review_revision_conflict");
const badRoleStore = makeStore();
const old = badRoleStore.getFixtureReview("item", lipRef);
assert.equal(badRoleStore.applyReviewAction({
  scope: "item", targetRef: lipRef,
  expectedRevision: old.revision, requestId: "req-role-failure-01",
  action: { type: "revoke", ...editor, reason: "No permission here" }
}).reason, "review_actor_or_action_invalid");
assert.equal(badRoleStore.getFixtureReview("item", lipRef).revision,
  old.revision);
blockedCases += 3;

const staleHead = makeStore();
const snapshot = staleHead.readSnapshot({ selections: [lipSel] });
const changed = staleHead.applyReviewAction({
  scope: "item", targetRef: lipRef,
  expectedRevision: staleHead.getFixtureReview("item", lipRef).revision,
  requestId: "req-revise-content",
  action: {
    type: "revise", ...editor, nextSourceDigest: "c".repeat(64)
  }
});
assert.equal(changed.status, "accepted");
assert.equal(staleHead.verifySnapshot(snapshot.snapshotToken).status, "changed");
assert.equal(staleHead.publishHead({
  selection: lipSel, expectedHeadRevision: 1
}).reason, "mock_review_not_published");
await deny("revised evidence invalidated", () => run(staleHead, [lipSel]),
  "blocked", "published_read_snapshot_not_available");
blockedCases++;

// Revoke between snapshot and first current-state check.
const beforeStore = makeStore();
const beforeSource = {
  async readSnapshot(args) {
    const result = beforeStore.readSnapshot(args);
    mutate(beforeStore, "item", lipRef, "revoke", "req-race-before-01",
      { reason: "Withdrawn during fetch" });
    return result;
  },
  verifySnapshot: token => beforeStore.verifySnapshot(token)
};
await deny("revoked before first check",
  () => run(beforeSource, [lipSel]),
  "blocked", "published_read_current_state_mismatch");

// Revoke after first current-state check, before the final one.
const betweenStore = makeStore();
let checks = 0;
const betweenSource = {
  readSnapshot: args => betweenStore.readSnapshot(args),
  verifySnapshot(token) {
    checks++;
    if (checks === 2) {
      mutate(betweenStore, "asset", assetRef, "revoke",
        "req-race-after-01", { reason: "Rights withdrawn during preview" });
    }
    return betweenStore.verifySnapshot(token);
  }
};
await deny("revoked before final check",
  () => run(betweenSource, [lipSel]),
  "blocked", "published_read_current_state_mismatch");
assert.equal(checks, 2);

// An unrelated item's change cannot invalidate a selected item's snapshot.
const independent = makeStore();
const unrelatedSource = {
  readSnapshot: args => independent.readSnapshot(args),
  verifySnapshot(token) {
    mutateOnlyOnce();
    return independent.verifySnapshot(token);
  }
};
let mutatedUnrelated = false;
function mutateOnlyOnce() {
  if (mutatedUnrelated) return;
  mutatedUnrelated = true;
  mutate(independent, "item",
    "face_lab_item:product:lip-unrelated", "revoke",
    "req-unrelated-01", { reason: "Other item withdrawn" });
}
await allow("unrelated change after snapshot",
  () => run(independentSourceFix(), [lipSel]), 1);
function independentSourceFix() {
  return unrelatedSource;
}

// Recheck outage must fail closed, never return dry_run.
const outage = makeStore();
const outageSource = {
  readSnapshot: args => outage.readSnapshot(args),
  verifySnapshot: () => { throw new Error("simulated_read_timeout"); }
};
await deny("recheck failure", () => run(outageSource, [lipSel]),
  "unavailable", "published_read_current_state_mismatch");

// Reject swapped identities even if fixture yields a published-looking row.
const swapped = makeStore();
const swappedSource = {
  readSnapshot(args) {
    const s = swapped.readSnapshot(args);
    s.candidateSelections[0].item.faceLabItemId = "wrong-product";
    return s;
  },
  verifySnapshot: token => swapped.verifySnapshot(token)
};
await deny("swapped identity", () => run(swappedSource, [lipSel]),
  "blocked", "published_read_identity_mismatch");

console.log(JSON.stringify({
  status: "PASS",
  positiveReadCases: cases,
  blockedAndConflictCases: blockedCases,
  liveDatabaseAccess: 0,
  paidProviderCalls: 0,
  skincareReads: 0,
  realSourceVerified: false,
  executableAuthorityReturned: false
}));
