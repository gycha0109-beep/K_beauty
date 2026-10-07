#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  FACE_LAB_SHADE_PROFILE_VERSION,
  buildFaceLabProductVariantCandidateRecord
} from "../lib/face-lab-v2/product-variant-authority.js";
import {
  FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION,
  FACE_LAB_VISUAL_TRY_ON_P0_SLOT_KEYS,
  buildFaceLabVisualTryOnAuthority
} from "../lib/face-lab-v2/visual-try-on-authority.js";

function capabilityClaim(
  capabilityKey,
  suffix
) {
  return {
    capabilityKey,
    supportState: "supported",
    proofClass:
      "governed_catalog_attribute_mapping",
    proofVersion:
      "visual-try-on-fixture-v1",
    evidenceRefs: [
      `catalog_attribute_review:try-on-${suffix}`
    ]
  };
}

function variantBundle({
  productId,
  variantId,
  displayLabel,
  capabilityKey,
  attributes,
  colorAnchors = []
}) {
  const evidenceRefsByAttribute =
    Object.fromEntries(
      Object.keys(attributes)
        .map((key) => [
          key,
          [
            `catalog_attribute_review:${productId}-${variantId}-${key}`
          ]
        ])
    );

  return buildFaceLabProductVariantCandidateRecord({
    variant: {
      productId,
      variantId,
      identityVersion:
        "visual-try-on-fixture-identity-v1",
      identityState: "resolved",
      lifecycleState: "active",
      variantAxes: {
        shade: variantId,
        market: "KR"
      },
      identityEvidenceRefs: [
        `catalog_variant_review:${productId}-${variantId}`
      ],
      sourceVariantRefs: [
        `brand_variant:${productId}-${variantId}`
      ],
      shadeProfile: {
        profileVersion:
          FACE_LAB_SHADE_PROFILE_VERSION,
        shadeKey: variantId,
        displayLabel,
        attributes,
        evidenceRefsByAttribute,
        colorAnchors
      }
    },
    capabilityClaims: [
      capabilityClaim(
        capabilityKey,
        capabilityKey
      )
    ]
  });
}

const lip =
  variantBundle({
    productId: "fixture-lip",
    variantId: "coral-orange",
    displayLabel: "Coral Orange",
    capabilityKey: "lip_color",
    attributes: {
      hueFamily: "coral_orange",
      undertone: "warm",
      depth: "medium",
      chroma: "medium_high",
      opacity: "buildable",
      finish: "glossy",
      glossLevel: "high"
    },
    colorAnchors: [
      {
        anchorId:
          "lip-brand-swatch",
        role: "brand_swatch",
        colorSpace: "srgb_hex",
        value: "#D86B55",
        evidenceRefs: [
          "brand_swatch:fixture-lip-coral"
        ]
      }
    ]
  });

const highlight =
  variantBundle({
    productId:
      "fixture-highlighter",
    variantId: "lavender",
    displayLabel:
      "Lavender Pearl",
    capabilityKey:
      "face_highlight",
    attributes: {
      hueFamily: "lavender",
      undertone: "cool",
      depth: "light",
      chroma: "low",
      opacity: "sheer",
      finish: "pearl",
      shimmerLevel: "medium"
    }
  });

const lens =
  variantBundle({
    productId: "fixture-lens",
    variantId: "soft-gray",
    displayLabel: "Soft Gray",
    capabilityKey:
      "iris_appearance",
    attributes: {
      hueFamily: "gray",
      undertone: "cool",
      depth: "medium",
      chroma: "low",
      opacity: "medium"
    }
  });

for (const bundle of [
  lip,
  highlight,
  lens
]) {
  assert.equal(
    bundle.status,
    "ready"
  );
}

const authority =
  buildFaceLabVisualTryOnAuthority({
    sessionId:
      "fixture-visual-try-on",
    selections: [
      {
        slotKey: "lip_color",
        binding: lip,
        referenceAssets: [
          {
            assetRef:
              "catalog_image:fixture-lip-product",
            role:
              "product_image",
            evidenceRef:
              "catalog_variant_review:fixture-lip-product"
          },
          {
            assetRef:
              "brand_swatch:fixture-lip-coral",
            role:
              "brand_swatch",
            evidenceRef:
              "brand_swatch:fixture-lip-coral"
          }
        ]
      },
      {
        slotKey:
          "face_highlight",
        binding: highlight,
        referenceAssets: [
          {
            assetRef:
              "catalog_image:fixture-highlight",
            role:
              "product_image",
            evidenceRef:
              "catalog_variant_review:fixture-highlight"
          }
        ]
      },
      {
        slotKey:
          "iris_appearance",
        binding: lens,
        referenceAssets: [
          {
            assetRef:
              "applied_reference:fixture-gray-lens",
            role:
              "applied_reference",
            evidenceRef:
              "applied_reference:fixture-gray-lens"
          }
        ]
      }
    ]
  });

assert.equal(
  FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION,
  "face-lab-visual-try-on-authority-v1"
);
assert.deepEqual(
  FACE_LAB_VISUAL_TRY_ON_P0_SLOT_KEYS,
  [
    "lip_color",
    "lip_finish",
    "cheek_color",
    "face_highlight",
    "iris_appearance",
    "facial_frame"
  ]
);
assert.equal(
  authority.status,
  "ready"
);
assert.equal(
  authority.reason,
  "visual_try_on_authority_built"
);
assert.equal(
  authority.imageModelInvoked,
  false
);
assert.equal(
  authority.providerPayload,
  null
);
assert.equal(
  authority.renderSpec.status,
  "ready"
);
assert.deepEqual(
  authority.renderSpec
    .operations
    .map((operation) =>
      operation.slotKey
    ),
  [
    "face_highlight",
    "iris_appearance",
    "lip_color"
  ]
);
assert.ok(
  authority.renderSpec
    .identityLock
    .includes("identity")
);
assert.ok(
  authority.renderSpec
    .identityLock
    .includes(
      "facial_geometry"
    )
);
assert.equal(
  authority.referenceAssets.length,
  4
);
assert.deepEqual(
  authority.referenceAssets
    .map((asset) =>
      asset.slotKey
    ),
  [
    "face_highlight",
    "iris_appearance",
    "lip_color",
    "lip_color"
  ]
);

const duplicateSlot =
  buildFaceLabVisualTryOnAuthority({
    sessionId:
      "duplicate-slot",
    selections: [
      {
        slotKey: "lip_color",
        binding: lip
      },
      {
        slotKey: "lip_color",
        binding: lip
      }
    ]
  });

assert.equal(
  duplicateSlot.status,
  "invalid"
);
assert.equal(
  duplicateSlot.reason,
  "duplicate_selection_slot"
);

const unsupportedSlot =
  buildFaceLabVisualTryOnAuthority({
    sessionId:
      "unsupported-slot",
    selections: [
      {
        slotKey: "hair_shape",
        binding: lip
      }
    ]
  });

assert.equal(
  unsupportedSlot.status,
  "invalid"
);
assert.equal(
  unsupportedSlot.reason,
  "selection_slot_not_p0"
);

const malformedReference =
  buildFaceLabVisualTryOnAuthority({
    sessionId:
      "bad-reference",
    selections: [
      {
        slotKey: "lip_color",
        binding: lip,
        referenceAssets: [
          {
            assetRef: "not namespaced",
            role: "brand_swatch",
            evidenceRef:
              "brand_swatch:fixture"
          }
        ]
      }
    ]
  });

assert.equal(
  malformedReference.status,
  "invalid"
);
assert.equal(
  malformedReference.reason,
  "reference_asset_ref_invalid"
);

const mismatchedCapability =
  buildFaceLabVisualTryOnAuthority({
    sessionId:
      "mismatched-capability",
    selections: [
      {
        slotKey:
          "face_highlight",
        binding: lip
      }
    ]
  });

assert.equal(
  mismatchedCapability.status,
  "invalid"
);
assert.equal(
  mismatchedCapability.reason,
  "render_spec_unavailable"
);

console.log(
  JSON.stringify({
    status: "PASS",
    authorityVersion:
      FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION,
    p0Slots:
      FACE_LAB_VISUAL_TRY_ON_P0_SLOT_KEYS,
    operationCount:
      authority.renderSpec
        .operations.length,
    referenceAssetCount:
      authority.referenceAssets
        .length,
    providerCalls: 0
  })
);
