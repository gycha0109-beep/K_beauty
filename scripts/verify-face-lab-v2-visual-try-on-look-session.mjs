#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  FACE_LAB_SHADE_PROFILE_VERSION
} from "../lib/face-lab-v2/product-variant-authority.js";
import {
  FACE_LAB_TRY_ON_LOOK_SESSION_VERSION,
  createFaceLabVisualTryOnLookSession,
  applyFaceLabVisualTryOnLookAction
} from "../lib/face-lab-v2/visual-try-on-look-session.js";

const p1 = "a1111111-1111-4111-8111-111111111111";
const p2 = "a2222222-2222-4222-8222-222222222222";
const p3 = "a3333333-3333-4333-8333-333333333333";
const s1 = "b1111111-1111-4111-8111-111111111111";
const s2 = "b2222222-2222-4222-8222-222222222222";
const s3 = "b3333333-3333-4333-8333-333333333333";
const v = "try-on-v1";
function selection({
  productId = p1,
  subjectId = s1,
  variantId = "coral",
  slotKey = "lip_color",
  categoryKey = "lip",
  attributes = { hueFamily: "coral_orange", finish: "glossy" }
} = {}) {
  const termId = `${v}:category:${categoryKey}`;
  return {
    slotKey,
    product: { id: productId },
    subject: {
      subject_id: subjectId,
      product_id: productId,
      variant_key: "formula-v1",
      identity_status: "resolved",
      current_state: "current"
    },
    subjectVariantBridge: {
      productId, subjectId, variantId, subjectVariantKey: "formula-v1",
      mappingVersion: "reviewed-fixture-v1", approvalState: "approved",
      evidenceRefs: [`variant_review:${productId}-${variantId}`]
    },
    taxonomyVersion: { version: v, lifecycle_state: "active", authority_mode: "canonical" },
    taxonomyTerm: {
      term_id: termId, term_key: categoryKey, taxonomy_version: v,
      axis: "category", lifecycle_state: "active"
    },
    taxonomyAssignment: {
      product_id: productId, taxonomy_version: v,
      category_term_id: termId, assignment_state: "canonical"
    },
    categoryBinding: {
      approvalState: "approved", mappingVersion: "approved-fixture-v1",
      taxonomyVersion: v, categoryTermId: termId,
      tryOnCategoryKey: categoryKey,
      evidenceRefs: [`manual_category_review:${categoryKey}`]
    },
    variant: {
      productId, variantId, identityVersion: "approved-fixture-v1",
      identityState: "resolved", lifecycleState: "active",
      variantAxes: { shade: variantId },
      identityEvidenceRefs: [`product_fact_subject:${subjectId}`],
      sourceVariantRefs: [`product_fact_subject:${subjectId}`],
      shadeProfile: {
        profileVersion: FACE_LAB_SHADE_PROFILE_VERSION,
        shadeKey: variantId, displayLabel: variantId,
        attributes,
        evidenceRefsByAttribute: Object.fromEntries(
          Object.keys(attributes).map(key => [
            key, [`manual_attribute_review:${productId}-${key}`]
          ])
        ),
        colorAnchors: []
      }
    },
    capabilityClaims: [{
      capabilityKey: slotKey, supportState: "supported",
      proofClass: "governed_catalog_attribute_mapping",
      proofVersion: "approved-fixture-v1",
      evidenceRefs: [`manual_slot_review:${productId}-${slotKey}`]
    }]
  };
}

const lip = selection();
const rose = selection({
  productId: p2, subjectId: s2, variantId: "rose",
  attributes: { hueFamily: "rose", finish: "glossy" }
});
const lens = selection({
  productId: p3, subjectId: s3, variantId: "gray",
  slotKey: "iris_appearance", categoryKey: "color_lens",
  attributes: { hueFamily: "gray", opacity: "medium" }
});
const finish = selection({ slotKey: "lip_finish" });
function meta(item, assetRef) {
  return {
    assetRef,
    candidateRef: `product_variant:${item.product.id}:${item.variant.variantId}`,
    slotKey: item.slotKey,
    role: "brand_swatch",
    evidenceRef: `manual_asset_review:${item.slotKey}-${item.product.id}`,
    approvalState: "approved",
    assetStatus: "active",
    usagePermission: "virtual_try_on",
    storageKind: "governed_blob",
    storageKey: `tryon/${item.slotKey}-${item.product.id}.png`,
    mimeType: "image/png",
    byteLength: 12345,
    sha256: "a".repeat(64)
  };
}
const assets = [
  meta(lip, "brand_swatch:lip-coral"),
  meta(rose, "brand_swatch:lip-rose"),
  meta(lens, "brand_swatch:lens-gray"),
  meta(finish, "brand_swatch:lip-finish")
];

let cases = 0;
function mustFail(result, reason) {
  assert.equal(result.status, "invalid");
  assert.equal(result.reason, reason);
  assert.equal(result.imageModelInvoked, false);
  cases++;
}
function act(state, type, slotKey, item, assetList = assets, revision = state.revision) {
  return applyFaceLabVisualTryOnLookAction({
    state, expectedRevision: revision,
    action: { type, slotKey, ...(item ? { selection: item } : {}) },
    catalogAssets: assetList
  });
}

const initialized = createFaceLabVisualTryOnLookSession({ sessionId: "look-1" });
assert.equal(initialized.status, "ready");
assert.equal(initialized.reason, "empty_look");
assert.equal(initialized.state.revision, 0);
assert.equal(initialized.authority, null);
assert.equal(initialized.imageModelInvoked, false);
mustFail(createFaceLabVisualTryOnLookSession({sessionId:""}), "session_id_invalid");

const addedLip = act(initialized.state, "add", "lip_color", lip);
assert.equal(addedLip.status, "ready", JSON.stringify(addedLip));
assert.equal(addedLip.state.revision, 1);
assert.equal(addedLip.state.history[0].selectedVariantRef, `product_variant:${p1}:coral`);
assert.equal(addedLip.referenceCount, 1);
assert.equal(addedLip.authority.imageModelInvoked, false);
assert.equal(addedLip.renderSpec.operations[0].slotKey, "lip_color");
mustFail(act(addedLip.state, "add", "lip_color", lip), "look_slot_already_selected");
const invalidMapping = structuredClone(finish);
invalidMapping.subjectVariantBridge.approvalState = "pending";
mustFail(act(addedLip.state, "add", "lip_finish", invalidMapping), "subject_variant_mapping_not_approved");
mustFail(act(addedLip.state, "replace", "iris_appearance", lens), "look_slot_not_selected");
mustFail(act(addedLip.state, "remove", "eye_color"), "look_slot_not_selected");
mustFail(act(addedLip.state, "add", "hair_jewelry", lip), "look_action_slot_invalid");
mustFail(act(addedLip.state, "add", "lip_color", lip, assets, 0), "look_revision_conflict");
mustFail(act(addedLip.state, "add", "lip_finish",
  { ...finish, referenceAssets: [{assetRef:"raw:invalid"}] }),
  "look_action_selection_invalid");

const addedLens = act(addedLip.state, "add", "iris_appearance", lens);
assert.equal(addedLens.status, "ready", JSON.stringify(addedLens));
assert.equal(addedLens.state.revision, 2);
assert.deepEqual(addedLens.state.selections.map(s=>s.slotKey),[
  "iris_appearance", "lip_color"
]);
assert.deepEqual(addedLens.provenance.map(s=>s.slotKey),[
  "iris_appearance", "lip_color"
]);
assert.equal(addedLens.referenceCount, 2);
assert.equal(addedLens.renderSpec.operations.length, 2);
assert.equal(addedLens.state.history.length, 2);

const addedFinish = act(addedLens.state, "add", "lip_finish", finish);
assert.equal(addedFinish.status, "ready", JSON.stringify(addedFinish));
assert.equal(addedFinish.referenceCount, 3);
assert.equal(addedFinish.state.selections.length, 3);
assert.equal(addedFinish.provenance.filter(p=>p.productId===p1).length,2,
  "one product can occupy separately authorized slots");
assert.deepEqual(addedFinish.renderSpec.operations.map(op=>op.slotKey),[
  "iris_appearance", "lip_color", "lip_finish"
]);

const replaced = act(addedFinish.state, "replace", "lip_color", rose);
assert.equal(replaced.status, "ready", JSON.stringify(replaced));
assert.equal(replaced.state.revision, 4);
assert.equal(replaced.provenance.find(p=>p.slotKey==="lip_color").productId,p2);
assert.equal(replaced.provenance.find(p=>p.slotKey==="lip_finish").productId,p1);
mustFail(act(replaced.state, "replace", "lip_color", lip, assets.slice(1)),
  "catalog_reference_unavailable");

const removed = act(replaced.state, "remove", "iris_appearance");
assert.equal(removed.status,"ready",JSON.stringify(removed));
assert.equal(removed.state.selections.length,2);
assert.equal(removed.referenceCount,2);
assert.equal(removed.state.history.at(-1).action,"remove");

const cleared = act(removed.state, "clear");
assert.equal(cleared.status, "ready");
assert.equal(cleared.state.revision,6);
assert.equal(cleared.authority,null);
assert.equal(cleared.referenceCount,0);
assert.deepEqual(cleared.state.history.at(-1).slotKeys,["lip_color","lip_finish"]);
mustFail(act(cleared.state,"clear"),"look_already_empty");

const lensFirst=act(initialized.state,"add","iris_appearance",lens);
const lipSecond=act(lensFirst.state,"add","lip_color",lip);
assert.equal(lipSecond.status,"ready");
assert.deepEqual(lipSecond.authority.referenceAssets,addedLens.authority.referenceAssets);
assert.deepEqual(lipSecond.renderSpec.operations,addedLens.renderSpec.operations);

const stale=structuredClone(addedLens.state);
stale.selections[0].referenceAssets=[];
mustFail(act(stale,"remove","lip_color"),"look_state_selection_invalid");
const duplicate=structuredClone(addedLens.state);
duplicate.selections.push(structuredClone(duplicate.selections[0]));
mustFail(act(duplicate,"remove","lip_color"),"look_state_selection_invalid");
assert.equal(addedFinish.state.revision,3,
  "a rejected action must never mutate previously committed state");
assert.equal(addedLip.state.revision,1);
console.log(JSON.stringify({
  status:"PASS",
  casesBlocked:cases,
  maxSimultaneousSlots:3,
  providerCalls:0,
  stableOrdering:true,
  multiSlotSameProduct:true,
  revisionConflictBlocked:true,
  immutableHistory:true
}));
