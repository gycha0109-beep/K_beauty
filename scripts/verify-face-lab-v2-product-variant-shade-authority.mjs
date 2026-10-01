import assert from "node:assert/strict";
import {
  FACE_LAB_COLOR_ANCHOR_ROLES,
  FACE_LAB_COLOR_SPACES,
  FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
  FACE_LAB_SHADE_ATTRIBUTE_KEYS,
  FACE_LAB_SHADE_PROFILE_VERSION,
  buildFaceLabProductVariantCandidateRecord,
  createFaceLabProductVariantRef,
  validateFaceLabProductVariantAuthority,
  validateFaceLabShadeProfile
} from "../lib/face-lab-v2/product-variant-authority.js";
import {
  matchFaceLabAppearanceSlotCandidatesShadow
} from "../lib/face-lab-v2/catalog-matcher-shadow.js";

assert.equal(
  FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
  "face-lab-product-variant-authority-v1"
);
assert.equal(
  FACE_LAB_SHADE_PROFILE_VERSION,
  "face-lab-shade-profile-v1"
);
assert.ok(
  FACE_LAB_SHADE_ATTRIBUTE_KEYS.includes(
    "hueFamily"
  )
);
assert.ok(
  FACE_LAB_SHADE_ATTRIBUTE_KEYS.includes(
    "finish"
  )
);
assert.deepEqual(
  FACE_LAB_COLOR_ANCHOR_ROLES,
  [
    "brand_swatch",
    "merchant_swatch",
    "applied_reference"
  ]
);
assert.deepEqual(
  FACE_LAB_COLOR_SPACES,
  ["srgb_hex", "cie_lab"]
);

function lipCapabilityClaim() {
  return {
    capabilityKey: "lip_color",
    supportState: "supported",
    proofClass:
      "governed_catalog_attribute_mapping",
    proofVersion:
      "fixture-capability-mapping-v1",
    evidenceRefs: [
      "catalog_attribute_review:fixture-lip-capability"
    ]
  };
}

function baseVariant(overrides = {}) {
  return {
    productId:
      "11111111-1111-1111-1111-111111111111",
    variantId: "012-rosewood",
    identityVersion:
      "face-lab-variant-identity-fixture-v1",
    identityState: "resolved",
    lifecycleState: "active",
    variantAxes: {
      shade: "012-rosewood",
      market: "KR"
    },
    identityEvidenceRefs: [
      "catalog_variant_review:fixture-lip-012"
    ],
    sourceVariantRefs: [
      "brand_variant:fixture-lip-012"
    ],
    shadeProfile: {
      profileVersion:
        FACE_LAB_SHADE_PROFILE_VERSION,
      shadeKey: "012-rosewood",
      displayLabel: "012 Rosewood",
      attributes: {
        hueFamily: "rose",
        undertone: "neutral_cool",
        depth: "medium",
        chroma: "medium",
        opacity: "buildable",
        finish: "satin",
        glossLevel: "medium"
      },
      evidenceRefsByAttribute: {
        hueFamily: [
          "catalog_attribute_review:fixture-lip-hue"
        ],
        undertone: [
          "catalog_attribute_review:fixture-lip-undertone"
        ],
        depth: [
          "catalog_attribute_review:fixture-lip-depth"
        ],
        chroma: [
          "catalog_attribute_review:fixture-lip-chroma"
        ],
        opacity: [
          "catalog_attribute_review:fixture-lip-opacity"
        ],
        finish: [
          "catalog_attribute_review:fixture-lip-finish"
        ],
        glossLevel: [
          "catalog_attribute_review:fixture-lip-gloss"
        ]
      },
      colorAnchors: [
        {
          anchorId: "brand-swatch-01",
          role: "brand_swatch",
          colorSpace: "srgb_hex",
          value: "#9A5061",
          evidenceRefs: [
            "brand_swatch:fixture-lip-012"
          ]
        },
        {
          anchorId: "applied-reference-01",
          role: "applied_reference",
          colorSpace: "cie_lab",
          value: {
            l: 51.2,
            a: 27.4,
            b: 6.3
          },
          evidenceRefs: [
            "applied_reference:fixture-lip-012"
          ]
        }
      ]
    },
    ...overrides
  };
}

const canonicalRef =
  createFaceLabProductVariantRef({
    productId:
      "11111111-1111-1111-1111-111111111111",
    variantId: "012-rosewood"
  });

assert.equal(
  canonicalRef,
  "product_variant:11111111-1111-1111-1111-111111111111:012-rosewood"
);

const authorized =
  validateFaceLabProductVariantAuthority(
    baseVariant()
  );

assert.equal(authorized.valid, true);
assert.equal(authorized.status, "ready");
assert.equal(
  authorized.reason,
  "variant_and_shade_authorized"
);
assert.equal(
  authorized.variant.variantRef,
  canonicalRef
);
assert.equal(
  authorized.variant.shadeProfile.colorAnchors[0]
    .role,
  "brand_swatch"
);
assert.equal(
  authorized.variant.shadeProfile.colorAnchors[1]
    .role,
  "applied_reference",
  "source swatch and applied appearance must remain semantically distinct"
);

const bundle =
  buildFaceLabProductVariantCandidateRecord({
    variant: baseVariant(),
    capabilityClaims: [
      lipCapabilityClaim()
    ]
  });

assert.equal(bundle.status, "ready");
assert.equal(
  bundle.candidate.entityType,
  "product_variant"
);
assert.equal(
  bundle.candidate.entityId,
  "11111111-1111-1111-1111-111111111111"
);
assert.equal(
  bundle.candidate.variantId,
  "012-rosewood"
);
assert.equal(
  bundle.attributeSnapshot.attributes.hueFamily,
  "rose"
);
assert.equal(
  bundle.attributeSnapshot.attributes.finish,
  "satin"
);
assert.deepEqual(
  bundle.attributeSnapshot
    .evidenceRefsByAttribute.finish,
  [
    "catalog_attribute_review:fixture-lip-finish"
  ]
);
assert.equal(
  bundle.renderHints.shadeKey,
  "012-rosewood"
);
assert.equal(
  bundle.renderHints.colorAnchors[0].role,
  "brand_swatch"
);

const lipSlot = {
  slotId:
    "face-lab-appearance-slot:lip_color",
  slotKey: "lip_color",
  requiredCapability: "lip_color",
  acceptedEntityTypes: [
    "product",
    "service"
  ],
  sourceDomains: ["makeup"],
  sourceRefs: ["fixture"],
  criteria: {
    requiredAttributes: {
      hueFamily: "rose",
      undertone: "neutral_cool",
      chroma: "medium",
      opacity: "buildable",
      finish: ["satin", "glossy"]
    },
    preferredAttributes: {
      glossLevel: "medium"
    },
    excludedAttributes: {}
  },
  executionCues: {
    placement: ["full lip"],
    direction: [],
    intensity: "moderate",
    notes: []
  }
};

const shadow =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: lipSlot,
    candidates: [
      {
        candidate: bundle.candidate,
        attributeSnapshot:
          bundle.attributeSnapshot
      }
    ]
  });

assert.equal(shadow.status, "matched");
assert.deepEqual(
  shadow.eligibleCandidateRefs,
  [canonicalRef]
);
assert.equal(
  shadow.results[0].status,
  "eligible"
);

const identityOnly =
  validateFaceLabProductVariantAuthority(
    baseVariant({
      variantId: "mini-size",
      variantAxes: {
        size: "1.5g"
      },
      shadeProfile: undefined
    })
  );

assert.equal(identityOnly.valid, true);
assert.equal(
  identityOnly.status,
  "identity_only"
);
assert.equal(
  identityOnly.reason,
  "variant_identity_authorized"
);

const identityOnlyBundle =
  buildFaceLabProductVariantCandidateRecord({
    variant: baseVariant({
      variantId: "mini-size",
      variantAxes: {
        size: "1.5g"
      },
      shadeProfile: undefined
    }),
    capabilityClaims: [
      lipCapabilityClaim()
    ]
  });

assert.equal(
  identityOnlyBundle.status,
  "identity_only"
);
assert.deepEqual(
  identityOnlyBundle.attributeSnapshot
    .attributes,
  {}
);
assert.equal(
  identityOnlyBundle.renderHints,
  null
);

const retired =
  validateFaceLabProductVariantAuthority(
    baseVariant({
      lifecycleState: "retired"
    })
  );

assert.equal(retired.valid, true);
assert.equal(retired.status, "inactive");

const retiredBundle =
  buildFaceLabProductVariantCandidateRecord({
    variant: baseVariant({
      lifecycleState: "retired"
    }),
    capabilityClaims: [
      lipCapabilityClaim()
    ]
  });

assert.equal(retiredBundle.status, "inactive");
assert.equal(retiredBundle.candidate, null);

for (const identityState of [
  "ambiguous",
  "unresolved"
]) {
  const result =
    validateFaceLabProductVariantAuthority(
      baseVariant({
        identityState
      })
    );

  assert.equal(result.valid, false);
  assert.equal(
    result.reason,
    "variant_identity_not_resolved"
  );
}

const noIdentityEvidence =
  validateFaceLabProductVariantAuthority(
    baseVariant({
      identityEvidenceRefs: []
    })
  );

assert.equal(noIdentityEvidence.valid, false);
assert.equal(
  noIdentityEvidence.reason,
  "variant_identity_evidence_invalid"
);

const mismatchedRef =
  validateFaceLabProductVariantAuthority(
    baseVariant({
      variantRef:
        "product_variant:wrong:wrong"
    })
  );

assert.equal(mismatchedRef.valid, false);
assert.equal(
  mismatchedRef.reason,
  "variant_ref_mismatch"
);

const mismatchedShadeAxis =
  validateFaceLabProductVariantAuthority(
    baseVariant({
      variantAxes: {
        shade: "different-shade"
      }
    })
  );

assert.equal(
  mismatchedShadeAxis.valid,
  false
);
assert.equal(
  mismatchedShadeAxis.reason,
  "variant_shade_axis_mismatch"
);

const labelOnlyShade =
  validateFaceLabShadeProfile({
    profileVersion:
      FACE_LAB_SHADE_PROFILE_VERSION,
    shadeKey: "rose-gold",
    displayLabel: "Rose Gold",
    attributes: {},
    evidenceRefsByAttribute: {},
    colorAnchors: []
  });

assert.equal(labelOnlyShade.valid, false);
assert.equal(
  labelOnlyShade.reason,
  "shade_profile_empty",
  "shade labels alone must not manufacture color facts"
);

const unknownShadeAttribute =
  validateFaceLabShadeProfile({
    ...baseVariant().shadeProfile,
    attributes: {
      ...baseVariant().shadeProfile.attributes,
      marketingGlowMagic: "ultra"
    },
    evidenceRefsByAttribute: {
      ...baseVariant().shadeProfile
        .evidenceRefsByAttribute,
      marketingGlowMagic: [
        "marketing_copy:fixture"
      ]
    }
  });

assert.equal(
  unknownShadeAttribute.valid,
  false
);
assert.equal(
  unknownShadeAttribute.reason,
  "shade_attribute_unknown"
);

const missingShadeEvidence =
  validateFaceLabShadeProfile({
    ...baseVariant().shadeProfile,
    evidenceRefsByAttribute: {
      ...baseVariant().shadeProfile
        .evidenceRefsByAttribute,
      finish: []
    }
  });

assert.equal(
  missingShadeEvidence.valid,
  false
);
assert.equal(
  missingShadeEvidence.reason,
  "shade_attribute_snapshot_missing_evidence"
);

const malformedBrandSwatch =
  validateFaceLabShadeProfile({
    ...baseVariant().shadeProfile,
    colorAnchors: [
      {
        anchorId: "bad-swatch",
        role: "brand_swatch",
        colorSpace: "srgb_hex",
        value: "rose gold",
        evidenceRefs: [
          "brand_swatch:bad"
        ]
      }
    ]
  });

assert.equal(
  malformedBrandSwatch.valid,
  false
);
assert.equal(
  malformedBrandSwatch.reason,
  "color_anchor_value_invalid"
);

const invalidLab =
  validateFaceLabShadeProfile({
    ...baseVariant().shadeProfile,
    colorAnchors: [
      {
        anchorId: "bad-lab",
        role: "applied_reference",
        colorSpace: "cie_lab",
        value: {
          l: 140,
          a: 0,
          b: 0
        },
        evidenceRefs: [
          "applied_reference:bad"
        ]
      }
    ]
  });

assert.equal(invalidLab.valid, false);
assert.equal(
  invalidLab.reason,
  "color_anchor_value_invalid"
);

const duplicateAnchor =
  validateFaceLabShadeProfile({
    ...baseVariant().shadeProfile,
    colorAnchors: [
      {
        anchorId: "same-anchor",
        role: "brand_swatch",
        colorSpace: "srgb_hex",
        value: "#112233",
        evidenceRefs: [
          "brand_swatch:first"
        ]
      },
      {
        anchorId: "same-anchor",
        role: "applied_reference",
        colorSpace: "srgb_hex",
        value: "#223344",
        evidenceRefs: [
          "applied_reference:second"
        ]
      }
    ]
  });

assert.equal(duplicateAnchor.valid, false);
assert.equal(
  duplicateAnchor.reason,
  "color_anchor_duplicate_id"
);

const malformedClaimsBundle =
  buildFaceLabProductVariantCandidateRecord({
    variant: baseVariant(),
    capabilityClaims: {
      capabilityKey: "lip_color"
    }
  });

assert.equal(
  malformedClaimsBundle.status,
  "invalid"
);
assert.equal(
  malformedClaimsBundle.reason,
  "candidate_capability_claims_not_array"
);

const noImplicitCapability =
  buildFaceLabProductVariantCandidateRecord({
    variant: baseVariant(),
    capabilityClaims: []
  });

assert.equal(
  noImplicitCapability.status,
  "ready"
);
assert.deepEqual(
  noImplicitCapability.candidate
    .capabilityClaims,
  [],
  "variant/shade authority must not manufacture Gate B capability claims"
);

const noImplicitCapabilityMatch =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: lipSlot,
    candidates: [
      {
        candidate:
          noImplicitCapability.candidate,
        attributeSnapshot:
          noImplicitCapability
            .attributeSnapshot
      }
    ]
  });

assert.equal(
  noImplicitCapabilityMatch.results[0]
    .status,
  "capability_ineligible"
);
assert.equal(
  noImplicitCapabilityMatch.results[0]
    .reason,
  "capability_claim_missing"
);

for (const forbidden of [
  "score",
  "rank",
  "selectedEntityRef",
  "selectedVariantRef",
  "bindingState"
]) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      bundle,
      forbidden
    ),
    false,
    `Gate D must not rank or bind variants: ${forbidden}`
  );
}

console.log(JSON.stringify({
  ok: true,
  authorityVersion:
    FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
  shadeProfileVersion:
    FACE_LAB_SHADE_PROFILE_VERSION,
  checked: [
    "canonical_variant_ref",
    "variant_identity_evidence",
    "variant_resolution_fail_closed",
    "retired_variant_inactive",
    "shade_axis_coherence",
    "label_not_color_authority",
    "shade_attribute_evidence",
    "unknown_shade_attribute_fail_closed",
    "brand_swatch_role_preserved",
    "applied_reference_role_preserved",
    "color_anchor_validation",
    "gate_c_projection",
    "no_implicit_capability_claim",
    "no_ranking_or_binding",
    "identity_only_variant_boundary"
  ]
}, null, 2));
