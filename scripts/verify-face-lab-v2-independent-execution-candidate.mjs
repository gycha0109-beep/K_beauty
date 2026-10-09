#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FACE_LAB_INDEPENDENT_EXECUTION_CANDIDATE_VERSION,
  FACE_LAB_INDEPENDENT_EXECUTION_KINDS,
  validateFaceLabIndependentExecutionCandidate
} from "../lib/face-lab-v2/independent-execution-candidate.js";
import {
  FACE_LAB_SHADE_PROFILE_VERSION
} from "../lib/face-lab-v2/product-variant-authority.js";

const source = readFileSync(
  new URL("../lib/face-lab-v2/independent-execution-candidate.js", import.meta.url),
  "utf8"
);
// The new pure validator must not import skincare or privileged catalog readers.
assert.doesNotMatch(source, /from\s+["'][^"']*(catalog-product-try-on|catalog-reference-resolver|supabase|recommendation)/i);

const claim = (slot, proofClass = "curated_capability_mapping") => ({
  capabilityKey: slot,
  supportState: "supported",
  proofClass,
  proofVersion: "fixture-reviewed-v1",
  evidenceRefs: ["face_lab_fixture_capability:" + slot]
});
const item = (kind, name, executionType) => ({
  kind,
  faceLabItemId: name,
  ...(executionType ? { executionType } : {}),
  approvalState: "approved",
  lifecycleState: "active",
  sourceVersion: "fixture-v1",
  evidenceRefs: ["face_lab_fixture_item:" + name]
});
const variant = (name, shade = "color-01") => ({
  faceLabItemId: name,
  faceLabVariantId: shade,
  identityVersion: "fixture-v1",
  identityState: "resolved",
  lifecycleState: "active",
  approvalState: "approved",
  identityEvidenceRefs: ["face_lab_fixture_variant:" + name + "-" + shade]
});
const shade = {
  profileVersion: FACE_LAB_SHADE_PROFILE_VERSION,
  shadeKey: "coral-shade",
  displayLabel: "Test Coral",
  attributes: { hueFamily: "coral_orange", opacity: "medium" },
  evidenceRefsByAttribute: {
    hueFamily: ["face_lab_fixture_color:hue"],
    opacity: ["face_lab_fixture_color:opacity"]
  },
  colorAnchors: []
};
const product = (name, executionType, slotKey, variantId = "color-01") => ({
  item: item("product", name, executionType),
  variant: variant(name, variantId),
  slotKey,
  capabilityClaims: [claim(slotKey)]
});
const lip = product("lip-a", "lip", "lip_color");
lip.variant.shadeProfile = structuredClone(shade);
const highlighter = product("highlighter-a", "highlighter", "face_highlight");
const lens = product("lens-a", "color_lens", "iris_appearance", "gray-01");
const eyewear = product("glasses-a", "eyewear", "facial_frame", "silver-01");
const hairstyle = {
  item: item("style_reference", "layered-hair"),
  slotKey: "hair_shape",
  capabilityClaims: [claim("hair_shape", "style_reference_definition")]
};
const service = {
  item: item("service", "haircut-service"),
  slotKey: "hair_shape",
  capabilityClaims: [claim("hair_shape", "service_definition")]
};
const palette = {
  item: item("color_palette", "cool-neutral"),
  slotKey: "overall_palette",
  capabilityClaims: [claim("overall_palette", "palette_definition")]
};
const expected = [
  [lip, "face_lab_variant:lip-a:color-01", "visual_candidate"],
  [highlighter, "face_lab_variant:highlighter-a:color-01", "visual_candidate"],
  [lens, "face_lab_variant:lens-a:gray-01", "visual_candidate"],
  [eyewear, "face_lab_variant:glasses-a:silver-01", "visual_candidate"],
  [hairstyle, "face_lab_item:style_reference:layered-hair", "visual_candidate"],
  [service, "face_lab_item:service:haircut-service", "guidance_only"],
  [palette, "face_lab_item:color_palette:cool-neutral", "guidance_only"]
];
assert.equal(
  FACE_LAB_INDEPENDENT_EXECUTION_CANDIDATE_VERSION,
  "face-lab-independent-execution-candidate-v1"
);
assert.deepEqual(FACE_LAB_INDEPENDENT_EXECUTION_KINDS, [
  "product", "style_reference", "service", "color_palette"
]);
for (const [fixture, ref, mode] of expected) {
  const result = validateFaceLabIndependentExecutionCandidate(fixture);
  assert.equal(result.status, "contract_valid", JSON.stringify(result));
  assert.equal(result.candidate.candidateRef, ref);
  assert.equal(result.mode, mode);
  assert.equal(result.governedSourceVerified, false);
  assert.equal(result.renderReady, false);
  assert.equal(result.providerRequest, null);
  assert.equal(result.imageModelInvoked, false);
}
assert.equal(
  validateFaceLabIndependentExecutionCandidate(lip).shadeProfile.shadeKey,
  "coral-shade",
  "Shade ID is not inferred from the saleable variant ID"
);

// One item can have multiple independently proven appearance capabilities.
const sameLipFinish = structuredClone(lip);
sameLipFinish.slotKey = "lip_finish";
sameLipFinish.capabilityClaims = [claim("lip_finish")];
assert.equal(
  validateFaceLabIndependentExecutionCandidate(sameLipFinish).candidate.candidateRef,
  "face_lab_variant:lip-a:color-01"
);
const differentShade = structuredClone(lip);
differentShade.variant.faceLabVariantId = "rose-02";
assert.notEqual(
  validateFaceLabIndependentExecutionCandidate(differentShade).candidate.candidateRef,
  validateFaceLabIndependentExecutionCandidate(lip).candidate.candidateRef
);
assert.equal(
  validateFaceLabIndependentExecutionCandidate({
    ...hairstyle,
    item: { ...hairstyle.item, faceLabItemId: "lip-a" }
  }).candidate.candidateRef,
  "face_lab_item:style_reference:lip-a",
  "Different kinds never collide with product variant references"
);

let blocked = 0;
function reject(label, input, reason) {
  const output = validateFaceLabIndependentExecutionCandidate(input);
  assert.equal(output.status, "invalid", label + ": " + JSON.stringify(output));
  assert.equal(output.reason, reason, label);
  assert.equal(output.candidate, null, label);
  assert.equal(output.renderReady, false, label);
  assert.equal(output.governedSourceVerified, false, label);
  assert.equal(output.imageModelInvoked, false, label);
  blocked++;
}
const bad = (fixture, edit) => {
  const copy = structuredClone(fixture);
  edit(copy);
  return copy;
};
reject("null request", null, "face_lab_item_identity_invalid");
reject("no item", { slotKey: "lip_color" }, "face_lab_item_identity_invalid");
reject("invalid kind", bad(lip, x => x.item.kind = "skincare"), "face_lab_item_identity_invalid");
reject("invalid id", bad(lip, x => x.item.faceLabItemId = "https://unreviewed.example"),
  "face_lab_item_identity_invalid");
reject("pending item", bad(lip, x => x.item.approvalState = "pending"),
  "face_lab_item_approval_missing");
reject("retired item", bad(lip, x => x.item.lifecycleState = "retired"),
  "face_lab_item_approval_missing");
reject("unproven source", bad(lip, x => x.item.evidenceRefs = []),
  "face_lab_item_approval_missing");
reject("forged label as source", bad(lip, x => x.item.evidenceRefs = ["Some pretty lip"]),
  "face_lab_item_approval_missing");
reject("unknown slot", bad(lip, x => x.slotKey = "not_a_slot"),
  "face_lab_slot_unknown");
reject("inherited slot key", bad(lip, x => x.slotKey = "constructor"),
  "face_lab_slot_unknown");
reject("inherited category key", bad(lip, x => x.item.executionType = "constructor"),
  "face_lab_execution_type_slot_mismatch");
reject("wrong product category", bad(lip, x => x.item.executionType = "eyewear"),
  "face_lab_execution_type_slot_mismatch");
reject("missing physical variant", bad(lip, x => x.variant = null),
  "face_lab_variant_identity_invalid");
reject("cross-product variant", bad(lip, x => x.variant.faceLabItemId = "other-lip"),
  "face_lab_variant_identity_invalid");
reject("unapproved variant", bad(lip, x => x.variant.approvalState = "pending"),
  "face_lab_variant_approval_missing");
reject("unresolved variant", bad(lip, x => x.variant.identityState = "ambiguous"),
  "face_lab_variant_approval_missing");
reject("retired variant", bad(lip, x => x.variant.lifecycleState = "retired"),
  "face_lab_variant_approval_missing");
reject("no option evidence", bad(lip, x => x.variant.identityEvidenceRefs = []),
  "face_lab_variant_approval_missing");
reject("invalid shade", bad(lip, x => x.variant.shadeProfile.attributes.badShadeFact = "x"),
  "face_lab_shade_profile_invalid");
reject("no shade proof", bad(lip, x => x.variant.shadeProfile.evidenceRefsByAttribute.hueFamily = []),
  "face_lab_shade_profile_invalid");
reject("nonproduct variant", { ...hairstyle, variant: variant("layered-hair") },
  "face_lab_nonproduct_variant_forbidden");
reject("nonproduct category", bad(hairstyle, x => x.item.executionType = "hair"),
  "face_lab_nonproduct_category_forbidden");
reject("missing capability", bad(lip, x => x.capabilityClaims = []),
  "face_lab_capability_claims_missing");
reject("unproven capability", bad(lip, x => x.capabilityClaims = [claim("lip_finish")]),
  "face_lab_slot_capability_not_proven");
reject("explicitly unsupported", bad(lip, x => x.capabilityClaims[0].supportState = "unsupported"),
  "face_lab_slot_capability_not_proven");
reject("conflicting evidence", bad(lip, x => x.capabilityClaims.push({
  ...x.capabilityClaims[0], supportState: "unsupported"
})), "face_lab_slot_capability_not_proven");
reject("category inference", bad(lip, x => x.capabilityClaims[0].proofClass = "category_inference"),
  "face_lab_capability_claims_invalid");
reject("wrong proof kind", bad(hairstyle, x => x.capabilityClaims[0].proofClass = "service_definition"),
  "face_lab_capability_claims_invalid");
reject("wrong entity type for lens", {
  ...hairstyle, slotKey: "iris_appearance",
  capabilityClaims: [claim("iris_appearance", "style_reference_definition")]
}, "face_lab_slot_capability_not_proven");
reject("palette not a direct try-on option", {
  ...palette, slotKey: "lip_color",
  capabilityClaims: [claim("lip_color", "palette_definition")]
}, "face_lab_slot_capability_not_proven");
reject("missing source version", bad(lip, x => x.item.sourceVersion = null),
  "face_lab_item_approval_missing");

console.log(JSON.stringify({
  status: "PASS",
  scope: "face_lab_independent_contract_only",
  validatedKinds: FACE_LAB_INDEPENDENT_EXECUTION_KINDS.length,
  positiveCases: expected.length + 3,
  blockedCases: blocked,
  skincareReads: 0,
  externalReads: 0,
  providerCalls: 0,
  trustedSourceVerified: false,
  liveCatalogConnected: false
}));
