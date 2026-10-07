#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  FACE_LAB_SHADE_PROFILE_VERSION,
  buildFaceLabProductVariantCandidateRecord
} from "../lib/face-lab-v2/product-variant-authority.js";
import {
  FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION,
  buildFaceLabVisualTryOnAuthority
} from "../lib/face-lab-v2/visual-try-on-authority.js";
import {
  FACE_LAB_VISUAL_TRY_ON_CATEGORY_REGISTRY,
  FACE_LAB_VISUAL_TRY_ON_REFERENCE_ROLES,
  FACE_LAB_VISUAL_TRY_ON_REGISTRY_VERSION,
  FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS,
  getFaceLabVisualTryOnSlotSupport
} from "../lib/face-lab-v2/visual-try-on-registry.js";
import {
  getFaceLabAppearanceSlotDefinition
} from "../lib/face-lab-v2/appearance-registry.js";

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
      "visual-try-on-fixture-v2",
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
  attributes = null,
  colorAnchors = []
}) {
  const shadeProfile =
    attributes
      ? {
          profileVersion:
            FACE_LAB_SHADE_PROFILE_VERSION,
          shadeKey: variantId,
          displayLabel,
          attributes,
          evidenceRefsByAttribute:
            Object.fromEntries(
              Object.keys(attributes)
                .map((key) => [
                  key,
                  [
                    `catalog_attribute_review:${productId}-${variantId}-${key}`
                  ]
                ])
            ),
          colorAnchors
        }
      : undefined;

  return buildFaceLabProductVariantCandidateRecord({
    variant: {
      productId,
      variantId,
      identityVersion:
        "visual-try-on-fixture-identity-v2",
      identityState: "resolved",
      lifecycleState: "active",
      variantAxes: shadeProfile
        ? {
            shade: variantId,
            market: "KR"
          }
        : {
            market: "KR"
          },
      identityEvidenceRefs: [
        `catalog_variant_review:${productId}-${variantId}`
      ],
      sourceVariantRefs: [
        `brand_variant:${productId}-${variantId}`
      ],
      ...(shadeProfile
        ? { shadeProfile }
        : {})
    },
    capabilityClaims: [
      capabilityClaim(
        capabilityKey,
        capabilityKey
      )
    ]
  });
}

assert.equal(
  FACE_LAB_VISUAL_TRY_ON_REGISTRY_VERSION,
  "face-lab-visual-try-on-registry-v1"
);
assert.equal(
  FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION,
  "face-lab-visual-try-on-authority-v2"
);

const expectedCategoryKeys = [
  "complexion_base",
  "blush",
  "contour",
  "highlighter",
  "eye_shadow",
  "eyeliner",
  "mascara_lash",
  "brow",
  "lip",
  "color_lens",
  "eyewear",
  "hair",
  "facial_hair",
  "face_accessory"
];

assert.deepEqual(
  Object.keys(
    FACE_LAB_VISUAL_TRY_ON_CATEGORY_REGISTRY
  ),
  expectedCategoryKeys
);

assert.deepEqual(
  FACE_LAB_VISUAL_TRY_ON_REFERENCE_ROLES,
  [
    "product_image",
    "brand_swatch",
    "merchant_swatch",
    "applied_reference",
    "style_reference",
    "wearing_reference"
  ]
);

assert.equal(
  FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS.length,
  19
);
assert.equal(
  FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS.includes(
    "overall_palette"
  ),
  false
);

for (
  const slotKey of
    FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS
) {
  const support =
    getFaceLabVisualTryOnSlotSupport(
      slotKey
    );
  const appearance =
    getFaceLabAppearanceSlotDefinition(
      slotKey
    );

  assert.ok(
    support,
    `missing try-on support: ${slotKey}`
  );
  assert.equal(
    support.supportState,
    "supported"
  );
  assert.ok(
    appearance,
    `missing appearance slot: ${slotKey}`
  );
  assert.equal(
    support.slotKey,
    appearance.slotKey
  );
  assert.ok(
    ["P0", "P1", "P2", "P3"]
      .includes(
        support.rolloutStage
      )
  );
  assert.ok(
    support.defaultApplication
  );
}

assert.deepEqual(
  FACE_LAB_VISUAL_TRY_ON_CATEGORY_REGISTRY
    .lip.slotKeys,
  [
    "lip_color",
    "lip_finish"
  ]
);
assert.deepEqual(
  FACE_LAB_VISUAL_TRY_ON_CATEGORY_REGISTRY
    .complexion_base.slotKeys,
  [
    "complexion_prepare",
    "complexion_even",
    "complexion_correct",
    "complexion_finish"
  ]
);
assert.deepEqual(
  FACE_LAB_VISUAL_TRY_ON_CATEGORY_REGISTRY
    .hair.slotKeys,
  [
    "hair_shape",
    "hair_color"
  ]
);

const bundles = {
  lip: variantBundle({
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
  }),
  highlight: variantBundle({
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
  }),
  lens: variantBundle({
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
  }),
  eyeShadow: variantBundle({
    productId:
      "fixture-eye-shadow",
    variantId: "taupe",
    displayLabel: "Soft Taupe",
    capabilityKey: "eye_color",
    attributes: {
      hueFamily: "taupe",
      undertone: "neutral",
      depth: "medium",
      chroma: "low",
      finish: "satin",
      shimmerLevel: "low"
    }
  }),
  eyeliner: variantBundle({
    productId:
      "fixture-eyeliner",
    variantId: "brown-black",
    displayLabel: "Brown Black",
    capabilityKey:
      "eye_definition",
    attributes: {
      hueFamily: "brown_black",
      undertone: "neutral",
      depth: "deep",
      chroma: "low",
      finish: "matte"
    }
  }),
  brow: variantBundle({
    productId: "fixture-brow",
    variantId: "ash-brown",
    displayLabel: "Ash Brown",
    capabilityKey:
      "brow_definition",
    attributes: {
      hueFamily: "ash_brown",
      undertone: "cool",
      depth: "medium",
      chroma: "low",
      finish: "matte"
    }
  }),
  base: variantBundle({
    productId: "fixture-base",
    variantId: "satin-21",
    displayLabel: "Satin 21",
    capabilityKey:
      "complexion_even",
    attributes: {
      undertone: "neutral",
      depth: "light_medium",
      opacity: "medium",
      finish: "satin"
    }
  }),
  eyewear: variantBundle({
    productId: "fixture-eyewear",
    variantId: "thin-gray",
    displayLabel: "Thin Gray",
    capabilityKey:
      "facial_frame",
    attributes: {
      hueFamily: "gray",
      depth: "medium",
      chroma: "low",
      finish: "glossy"
    }
  }),
  hairShape: variantBundle({
    productId: "fixture-hair",
    variantId: "soft-layer",
    displayLabel: "Soft Layer",
    capabilityKey:
      "hair_shape"
  }),
  accessory: variantBundle({
    productId:
      "fixture-accessory",
    variantId: "silver",
    displayLabel: "Silver",
    capabilityKey:
      "face_accessory"
  })
};

for (
  const [key, bundle] of
    Object.entries(bundles)
) {
  assert.ok(
    ["ready", "identity_only"]
      .includes(bundle.status),
    `${key} bundle invalid: ${bundle.reason}`
  );
}

const authority =
  buildFaceLabVisualTryOnAuthority({
    sessionId:
      "fixture-registry-driven",
    selections: [
      {
        slotKey: "complexion_even",
        binding: bundles.base,
        referenceAssets: [
          {
            assetRef:
              "catalog_image:fixture-base-product",
            role:
              "product_image",
            evidenceRef:
              "catalog_variant_review:fixture-base-product"
          }
        ]
      },
      {
        slotKey: "eye_color",
        binding: bundles.eyeShadow,
        referenceAssets: [
          {
            assetRef:
              "applied_reference:fixture-eye-shadow",
            role:
              "applied_reference",
            evidenceRef:
              "applied_reference:fixture-eye-shadow"
          }
        ]
      },
      {
        slotKey:
          "eye_definition",
        binding: bundles.eyeliner
      },
      {
        slotKey:
          "brow_definition",
        binding: bundles.brow
      },
      {
        slotKey: "lip_color",
        binding: bundles.lip,
        referenceAssets: [
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
          "iris_appearance",
        binding: bundles.lens,
        referenceAssets: [
          {
            assetRef:
              "wearing_reference:fixture-gray-lens",
            role:
              "wearing_reference",
            evidenceRef:
              "applied_reference:fixture-gray-lens"
          }
        ]
      },
      {
        slotKey: "facial_frame",
        binding: bundles.eyewear,
        referenceAssets: [
          {
            assetRef:
              "product_image:fixture-eyewear",
            role:
              "product_image",
            evidenceRef:
              "catalog_variant_review:fixture-eyewear"
          }
        ]
      },
      {
        slotKey: "hair_shape",
        binding: bundles.hairShape,
        referenceAssets: [
          {
            assetRef:
              "style_reference:fixture-soft-layer",
            role:
              "style_reference",
            evidenceRef:
              "style_reference:fixture-soft-layer"
          }
        ]
      },
      {
        slotKey: "face_accessory",
        binding: bundles.accessory,
        referenceAssets: [
          {
            assetRef:
              "wearing_reference:fixture-accessory",
            role:
              "wearing_reference",
            evidenceRef:
              "applied_reference:fixture-accessory"
          }
        ]
      }
    ]
  });

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
assert.equal(
  authority.renderSpec
    .operations.length,
  9
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

const selectionBySlot =
  new Map(
    authority.selections.map(
      (item) => [
        item.slotKey,
        item
      ]
    )
  );

assert.equal(
  selectionBySlot
    .get("complexion_even")
    .categoryKey,
  "complexion_base"
);
assert.equal(
  selectionBySlot
    .get("complexion_even")
    .rolloutStage,
  "P3"
);
assert.equal(
  selectionBySlot
    .get("eye_color")
    .categoryKey,
  "eye_shadow"
);
assert.equal(
  selectionBySlot
    .get("hair_shape")
    .categoryKey,
  "hair"
);
assert.equal(
  selectionBySlot
    .get("hair_shape")
    .rolloutStage,
  "P2"
);

assert.equal(
  authority.referenceAssets.length,
  7
);
assert.deepEqual(
  authority.referenceAssets
    .map((asset) =>
      asset.slotKey
    ),
  [
    "complexion_even",
    "eye_color",
    "face_accessory",
    "facial_frame",
    "hair_shape",
    "iris_appearance",
    "lip_color"
  ]
);

const originalExperiment =
  buildFaceLabVisualTryOnAuthority({
    sessionId:
      "fixture-original-experiment",
    selections: [
      {
        slotKey: "lip_color",
        binding: bundles.lip
      },
      {
        slotKey:
          "face_highlight",
        binding: bundles.highlight
      },
      {
        slotKey:
          "iris_appearance",
        binding: bundles.lens
      }
    ]
  });

assert.equal(
  originalExperiment.status,
  "ready"
);
assert.equal(
  originalExperiment
    .renderSpec
    .operations.length,
  3
);

const duplicateSlot =
  buildFaceLabVisualTryOnAuthority({
    sessionId:
      "duplicate-slot",
    selections: [
      {
        slotKey: "lip_color",
        binding: bundles.lip
      },
      {
        slotKey: "lip_color",
        binding: bundles.lip
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
        slotKey:
          "overall_palette",
        binding: bundles.lip
      }
    ]
  });

assert.equal(
  unsupportedSlot.status,
  "invalid"
);
assert.equal(
  unsupportedSlot.reason,
  "selection_slot_not_supported"
);

const malformedReference =
  buildFaceLabVisualTryOnAuthority({
    sessionId:
      "bad-reference",
    selections: [
      {
        slotKey: "lip_color",
        binding: bundles.lip,
        referenceAssets: [
          {
            assetRef:
              "not namespaced",
            role:
              "brand_swatch",
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
        binding: bundles.lip
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
    registryVersion:
      FACE_LAB_VISUAL_TRY_ON_REGISTRY_VERSION,
    authorityVersion:
      FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION,
    categoryCount:
      Object.keys(
        FACE_LAB_VISUAL_TRY_ON_CATEGORY_REGISTRY
      ).length,
    supportedSlotCount:
      FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS
        .length,
    mixedLookOperationCount:
      authority.renderSpec
        .operations.length,
    referenceAssetCount:
      authority.referenceAssets
        .length,
    providerCalls: 0
  })
);
