#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION
} from "../lib/face-lab-v2/catalog-matcher-shadow.js";
import {
  FACE_LAB_SHADE_PROFILE_VERSION
} from "../lib/face-lab-v2/product-variant-authority.js";
import {
  FACE_LAB_PRODUCT_DRIVEN_TRY_ON_BINDING_VERSION,
  buildFaceLabCatalogProductTryOnSelection,
  buildFaceLabCatalogProductTryOnAuthority
} from "../lib/face-lab-v2/catalog-product-try-on-binding.js";

const P1 = "a1111111-1111-4111-8111-111111111111";
const S1 = "b1111111-1111-4111-8111-111111111111";
const P2 = "a2222222-2222-4222-8222-222222222222";
const S2 = "b2222222-2222-4222-8222-222222222222";
const version = "tryon-contract-v1";

function curated({
  productId = P1,
  subjectId = S1,
  shade = "coral-01",
  category = "lip",
  capability = "lip_color",
  includeShadeProfile = true
} = {}) {
  const term = `${version}:category:${category}`;
  const attrs = {
    hueFamily: category === "lip" ? "coral_orange" : "gray",
    undertone: "cool",
    opacity: "medium"
  };
  return {
    product: { id: productId, brand: "Fixture", name: "Fixture item" },
    subject: {
      subject_id: subjectId,
      product_id: productId,
      variant_key: shade,
      identity_status: "resolved",
      current_state: "current",
      subject_semantic_key: "a".repeat(64)
    },
    taxonomyVersion: {
      version,
      lifecycle_state: "active",
      authority_mode: "canonical"
    },
    taxonomyTerm: {
      taxonomy_version: version,
      term_id: term,
      axis: "category",
      term_key: category,
      lifecycle_state: "active"
    },
    taxonomyAssignment: {
      product_id: productId,
      taxonomy_version: version,
      category_term_id: term,
      assignment_state: "canonical",
      assignment_method: "manual_review"
    },
    categoryBinding: {
      approvalState: "approved",
      mappingVersion: "governed-test-v1",
      taxonomyVersion: version,
      categoryTermId: term,
      tryOnCategoryKey: category,
      evidenceRefs: [
        `catalog_taxonomy_review:${category}`
      ]
    },
    variant: {
      productId,
      variantId: shade,
      identityVersion: "governed-test-variant-v1",
      identityState: "resolved",
      lifecycleState: "active",
      variantAxes: { shade, market: "KR" },
      identityEvidenceRefs: [
        `product_fact_subject:${subjectId}`
      ],
      sourceVariantRefs: [
        `product_fact_subject:${subjectId}`
      ],
      ...(includeShadeProfile ? {
        shadeProfile: {
          profileVersion: FACE_LAB_SHADE_PROFILE_VERSION,
          shadeKey: shade,
          displayLabel: shade,
          attributes: attrs,
          evidenceRefsByAttribute: Object.fromEntries(
            Object.keys(attrs).map(key => [
              key, [`governed_catalog_attribute:${productId}-${key}`]
            ])
          ),
          colorAnchors: []
        }
      } : {})
    },
    capabilityClaims: [{
      capabilityKey: capability,
      supportState: "supported",
      proofClass: "governed_catalog_attribute_mapping",
      proofVersion: "governed-test-v1",
      evidenceRefs: [
        `catalog_attribute_review:${productId}-${capability}`
      ]
    }],
    slotKey: capability,
    referenceAssets: [{
      assetRef: `brand_swatch:${productId}-${shade}`,
      role: "brand_swatch",
      evidenceRef: `brand_swatch:${productId}-${shade}`
    }]
  };
}

assert.equal(
  FACE_LAB_PRODUCT_DRIVEN_TRY_ON_BINDING_VERSION,
  "face-lab-product-driven-try-on-binding-v1"
);
assert.equal(
  FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
  "face-lab-candidate-attribute-snapshot-v1"
);

const lip = curated();
const lens = curated({
  productId: P2,
  subjectId: S2,
  shade: "gray-01",
  category: "color_lens",
  capability: "iris_appearance"
});

const bound = buildFaceLabCatalogProductTryOnSelection(lip);
assert.equal(bound.status, "ready", JSON.stringify(bound));
assert.equal(bound.productId, P1);
assert.equal(bound.subjectId, S1);
assert.equal(bound.variantRef, `product_variant:${P1}:coral-01`);
assert.equal(bound.categoryKey, "lip");
assert.equal(bound.slotKey, "lip_color");
assert.equal(bound.selection.binding.candidate.entityType, "product_variant");
assert.equal(bound.selection.binding.attributeSnapshot.attributes.hueFamily, "coral_orange");
assert.equal(bound.imageModelInvoked, false);

const composed = buildFaceLabCatalogProductTryOnAuthority({
  sessionId: "catalog-selections-1",
  productSelections: [lens, lip]
});
assert.equal(composed.status, "ready", JSON.stringify(composed));
assert.equal(composed.authority.status, "ready");
assert.equal(composed.authority.imageModelInvoked, false);
assert.equal(composed.authority.providerPayload, null);
assert.deepEqual(
  composed.authority.renderSpec.operations.map(op => op.slotKey),
  ["iris_appearance", "lip_color"]
);
assert.deepEqual(
  composed.provenance.map(p => p.slotKey),
  ["iris_appearance", "lip_color"]
);

const cases = [
  ["product id mismatch", p => {p.product.id = P2;}, "subject_product_identity_mismatch"],
  ["unresolved subject", p => {p.subject.identity_status = "ambiguous";}, "subject_variant_not_current_resolved"],
  ["historical subject", p => {p.subject.current_state = "historical";}, "subject_variant_not_current_resolved"],
  ["missing variant", p => {p.subject.variant_key = null;}, "subject_variant_not_current_resolved"],
  ["shadow taxonomy", p => {p.taxonomyVersion.authority_mode = "shadow_only";}, "taxonomy_not_canonical"],
  ["shadow assignment", p => {p.taxonomyAssignment.assignment_state = "shadow";}, "product_taxonomy_assignment_not_canonical"],
  ["reserved category", p => {p.taxonomyTerm.lifecycle_state = "reserved";}, "taxonomy_category_term_not_active"],
  ["mismatch category", p => {p.categoryBinding.categoryTermId = "wrong";}, "category_slot_mapping_not_governed"],
  ["unreviewed mapping", p => {p.categoryBinding.approvalState = "pending";}, "category_slot_mapping_not_governed"],
  ["wrong slot", p => {p.slotKey = "hair_color";}, "slot_not_in_governed_category"],
  ["subject variant drift", p => {p.variant.variantId = "shade-02";}, "variant_subject_identity_mismatch"],
  ["subject provenance absent", p => {p.variant.sourceVariantRefs = [];}, "variant_subject_provenance_missing"],
  ["ungoverned capability", p => {p.capabilityClaims[0].proofClass = "category_inference";}, "variant_candidate_not_authorized"],
  ["non-supported capability", p => {p.capabilityClaims[0].supportState = "unsupported";}, "variant_candidate_not_authorized"],
  ["missing visual evidence", p => {delete p.variant.shadeProfile; p.referenceAssets = [];}, "product_visual_evidence_missing"]
];
for (const [name, mutate, reason] of cases) {
  const fixture = structuredClone(lip);
  mutate(fixture);
  const result = buildFaceLabCatalogProductTryOnSelection(fixture);
  assert.equal(result.reason, reason, name + ": " + JSON.stringify(result));
  assert.equal(result.imageModelInvoked, false);
}
const duplication = buildFaceLabCatalogProductTryOnAuthority({
  sessionId: "dup",
  productSelections: [lip, lip]
});
assert.equal(duplication.status, "invalid");
assert.equal(duplication.authorityReason, "duplicate_selection_slot");
assert.equal(duplication.imageModelInvoked, false);

console.log(JSON.stringify({
  status: "PASS",
  bindingVersion: FACE_LAB_PRODUCT_DRIVEN_TRY_ON_BINDING_VERSION,
  eligibleCatalogSelections: 2,
  negativeCases: cases.length + 1,
  renderOperations: composed.authority.renderSpec.operations.length,
  paidProviderCalls: 0
}));
