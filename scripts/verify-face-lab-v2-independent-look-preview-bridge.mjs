#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  composeFaceLabIndependentLookPreview,
  FACE_LAB_INDEPENDENT_LOOK_PREVIEW_BRIDGE_VERSION
} from "../lib/face-lab-v2/independent-look-preview-bridge.js";
import {
  FACE_LAB_SHADE_PROFILE_VERSION
} from "../lib/face-lab-v2/product-variant-authority.js";

const code = readFileSync(
  new URL("../lib/face-lab-v2/independent-look-preview-bridge.js", import.meta.url),
  "utf8"
);
for (const forbidden of [
  "createServerSupabaseClient", "generateFaceLabVisualTryOnCore",
  "buildFaceLabVisualTryOnProviderRequest", "loadApprovedBlob",
  "readApprovedTryOnBundle", "product_fact_subjects"
]) assert.ok(!code.includes(forbidden), forbidden);

function item(name, kind, executionType) {
  return {
    faceLabItemId: name,
    kind,
    ...(executionType ? { executionType } : {}),
    approvalState: "approved",
    lifecycleState: "active",
    sourceVersion: "fixture-source-v1",
    evidenceRefs: ["face_lab_fixture_item:" + name]
  };
}
function variant(name, variantId) {
  return {
    faceLabItemId: name,
    faceLabVariantId: variantId,
    identityVersion: "fixture-identity-v1",
    identityState: "resolved",
    lifecycleState: "active",
    approvalState: "approved",
    identityEvidenceRefs: ["face_lab_fixture_variant:" + name + "-" + variantId]
  };
}
function claim(slot, proofClass = "curated_capability_mapping") {
  return [{
    capabilityKey: slot,
    supportState: "supported",
    proofClass,
    proofVersion: "fixture-proof-v1",
    evidenceRefs: ["face_lab_fixture_capability:" + slot]
  }];
}
function shade(shadeKey, attributes) {
  return {
    profileVersion: FACE_LAB_SHADE_PROFILE_VERSION,
    shadeKey,
    displayLabel: "Test " + shadeKey,
    attributes,
    evidenceRefsByAttribute: Object.fromEntries(
      Object.keys(attributes).map(key => [
        key, ["face_lab_fixture_attribute:" + shadeKey + "-" + key]
      ])
    ),
    colorAnchors: []
  };
}
function product(name, variantId, executionType, slotKey, profile) {
  const v = variant(name, variantId);
  if (profile) v.shadeProfile = profile;
  return {
    item: item(name, "product", executionType),
    variant: v,
    slotKey,
    capabilityClaims: claim(slotKey)
  };
}
function reference(candidateRef, slotKey, tag, role = "brand_swatch") {
  return {
    assetRef: "face_lab_fixture_asset:" + tag,
    evidenceRef: "face_lab_fixture_reference:" + tag,
    candidateRef,
    slotKey,
    role,
    approvalState: "approved",
    assetStatus: "active",
    usagePermission: "virtual_try_on",
    storageKind: "governed_blob",
    storageKey: "facelab/references/" + tag + ".png",
    mimeType: "image/png",
    byteLength: 999,
    sha256: "1".repeat(64)
  };
}
const lip = product("lip-test", "rose-02", "lip", "lip_color",
  shade("rose-02", { hueFamily: "rose", opacity: "medium" }));
const highlight = product("highlight-test", "lavender-01", "highlighter",
  "face_highlight", shade("lavender-01", { hueFamily: "violet", shimmerLevel: "high" }));
const lens = product("lens-test", "gray-01", "color_lens",
  "iris_appearance", shade("gray-01", { hueFamily: "gray", opacity: "opaque" }));
const glasses = product("glasses-test", "silver-01", "eyewear", "facial_frame");
const hair = {
  item: item("layers-test", "style_reference"),
  slotKey: "hair_shape",
  capabilityClaims: claim("hair_shape", "style_reference_definition")
};
const lipRef = "face_lab_variant:lip-test:rose-02";
const highRef = "face_lab_variant:highlight-test:lavender-01";
const lensRef = "face_lab_variant:lens-test:gray-01";
const glassesRef = "face_lab_variant:glasses-test:silver-01";
const hairRef = "face_lab_item:style_reference:layers-test";
const candidates = [lip, highlight, lens, glasses, hair];
const records = [
  reference(lipRef, "lip_color", "lip"),
  reference(highRef, "face_highlight", "highlight"),
  reference(lensRef, "iris_appearance", "lens"),
  reference(glassesRef, "facial_frame", "glasses", "product_image"),
  reference(hairRef, "hair_shape", "hair", "style_reference")
];

assert.equal(
  FACE_LAB_INDEPENDENT_LOOK_PREVIEW_BRIDGE_VERSION,
  "face-lab-independent-look-preview-bridge-v1"
);
const good = composeFaceLabIndependentLookPreview({
  sessionId: "offline-fixture-look-01",
  candidateSelections: [...candidates].reverse(),
  referenceRecords: [...records].reverse()
});
assert.equal(good.status, "dry_run", JSON.stringify(good));
assert.equal(good.previewSpec.status, "ready");
assert.equal(good.selections.length, candidates.length);
assert.equal(good.referenceManifest.length, records.length);
assert.equal(good.authority, null);
assert.equal(good.providerRequest, null);
assert.equal(good.governedSourceVerified, false);
assert.equal(good.renderReady, false);
assert.equal(good.imageModelInvoked, false);
assert.ok(good.selections.some(x =>
  x.slotKey === "lip_color" && x.candidateRef === lipRef
));
assert.ok(good.selections.some(x =>
  x.slotKey === "hair_shape" && x.candidateRef === hairRef
));
assert.ok(good.previewSpec.operations?.length >= candidates.length ||
  good.previewSpec.operationsBySlot ||
  good.previewSpec.renderOperations,
  "Must produce existing compositor render operations"
);
for (const asset of good.referenceManifest) {
  assert.ok(!Object.hasOwn(asset, "storageKey"));
  assert.ok(!Object.hasOwn(asset, "url"));
  assert.ok(!Object.hasOwn(asset, "imageBuffer"));
}

const direct = composeFaceLabIndependentLookPreview({
  sessionId: "offline-fixture-look-01",
  candidateSelections: candidates,
  referenceRecords: records
});
assert.deepEqual(good.referenceManifest, direct.referenceManifest);
assert.deepEqual(good.selections, direct.selections);

const sameLipOtherSlot = structuredClone(lip);
sameLipOtherSlot.slotKey = "lip_finish";
sameLipOtherSlot.capabilityClaims = claim("lip_finish");
const sameLipRef = reference(lipRef, "lip_finish", "lip-finish");
const twoSlots = composeFaceLabIndependentLookPreview({
  sessionId: "offline-fixture-look-02",
  candidateSelections: [lip, sameLipOtherSlot],
  referenceRecords: [records[0], sameLipRef]
});
assert.equal(twoSlots.status, "dry_run", JSON.stringify(twoSlots));
assert.equal(twoSlots.selections.length, 2);

let blocked = 0;
function reject(label, input, expectedReason) {
  const r = composeFaceLabIndependentLookPreview(input);
  assert.equal(r.status, "invalid", label + ": " + JSON.stringify(r));
  assert.equal(r.reason, expectedReason, label);
  assert.equal(r.authority, null);
  assert.equal(r.providerRequest, null);
  assert.equal(r.imageModelInvoked, false);
  blocked++;
}
function input(candidateSelections = candidates, referenceRecords = records) {
  return {
    sessionId: "offline-fixture-look-01",
    candidateSelections: structuredClone(candidateSelections),
    referenceRecords: structuredClone(referenceRecords)
  };
}
function edit(fn) {
  const x = input();
  fn(x);
  return x;
}
reject("no session", edit(x => x.sessionId = ""), "independent_preview_inputs_invalid");
reject("no selections", input([], []), "independent_preview_inputs_invalid");
reject("untrusted embedded assets", edit(x => x.candidateSelections[0].referenceAssets = []),
  "independent_preview_selection_untrusted");
reject("untrusted embedding", edit(x => x.candidateSelections[0].binding = {}),
  "independent_preview_selection_untrusted");
reject("variant swapped", edit(x => x.candidateSelections[0].variant.faceLabItemId = "alien"),
  "independent_preview_candidate_invalid");
reject("retired candidate", edit(x => x.candidateSelections[0].item.lifecycleState = "retired"),
  "independent_preview_candidate_invalid");
reject("unapproved variant", edit(x => x.candidateSelections[0].variant.approvalState = "pending"),
  "independent_preview_candidate_invalid");
reject("category slot mismatch", edit(x => x.candidateSelections[0].item.executionType = "eyewear"),
  "independent_preview_candidate_invalid");
reject("duplicate slot", edit(x => x.candidateSelections.push(structuredClone(x.candidateSelections[0]))),
  "independent_preview_slot_duplicate");
reject("missing color evidence", edit(x => delete x.candidateSelections[0].variant.shadeProfile),
  "independent_preview_color_evidence_missing");
reject("guidance-only service", input([{
  item: item("haircut", "service"),
  slotKey: "hair_shape",
  capabilityClaims: claim("hair_shape", "service_definition")
}], []), "independent_preview_guidance_not_renderable");
reject("no matching reference", edit(x => x.referenceRecords.pop()),
  "independent_preview_reference_count_invalid");
reject("cross-candidate reference", edit(x => x.referenceRecords[0].candidateRef = highRef),
  "independent_preview_reference_count_invalid");
reject("cross-slot reference", edit(x => x.referenceRecords[0].slotKey = "lip_finish"),
  "independent_preview_reference_count_invalid");
reject("invalid permission", edit(x => x.referenceRecords[0].usagePermission = "public"),
  "independent_preview_reference_not_governed");
reject("revoked image", edit(x => x.referenceRecords[0].assetStatus = "revoked"),
  "independent_preview_reference_not_governed");
reject("forged URL", edit(x => x.referenceRecords[0].url = "https://not-authorized.example/ref.png"),
  "independent_preview_reference_not_governed");
reject("path traversal", edit(x => x.referenceRecords[0].storageKey = "../private/asset.png"),
  "independent_preview_reference_not_governed");
reject("invalid digest", edit(x => x.referenceRecords[0].sha256 = "1234"),
  "independent_preview_reference_not_governed");
reject("raw image bytes", edit(x => x.referenceRecords[0].imageBuffer = "base64"),
  "independent_preview_reference_not_governed");
reject("unselected reference", edit(x => x.referenceRecords.push(reference(
  "face_lab_variant:unselected:01", "lip_color", "unused"
))), "independent_preview_reference_scope_invalid");
reject("duplicate reference", edit(x => x.referenceRecords[1].assetRef = x.referenceRecords[0].assetRef),
  "independent_preview_reference_duplicate");
reject("two references same slot over limit", edit(x => {
  x.referenceRecords.push(reference(lipRef, "lip_color", "lip-2"));
  x.referenceRecords.push(reference(lipRef, "lip_color", "lip-3"));
}), "independent_preview_reference_count_invalid");

console.log(JSON.stringify({
  status: "PASS",
  positiveLookCases: 3,
  slots: good.selections.length,
  negativeCases: blocked,
  actualSourceVerified: false,
  providerCalls: 0,
  databaseAccess: 0,
  skincareDependencies: 0,
  executableAuthorityReturned: false
}));
