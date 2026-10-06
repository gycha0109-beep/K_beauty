import assert from "node:assert/strict";
import {
  FACE_LAB_IDENTITY_LOCK,
  FACE_LAB_RENDER_ADAPTER_VERSION,
  FACE_LAB_RENDER_SPEC_VERSION,
  buildFaceLabRenderSpec
} from "../lib/face-lab-v2/render-adapter.js";
import {
  FACE_LAB_SHADE_PROFILE_VERSION,
  buildFaceLabProductVariantCandidateRecord
} from "../lib/face-lab-v2/product-variant-authority.js";

assert.equal(
  FACE_LAB_RENDER_ADAPTER_VERSION,
  "face-lab-render-adapter-v2"
);
assert.equal(
  FACE_LAB_RENDER_SPEC_VERSION,
  "face-lab-render-spec-v2"
);
assert.ok(
  FACE_LAB_IDENTITY_LOCK.includes(
    "identity"
  )
);
assert.ok(
  FACE_LAB_IDENTITY_LOCK.includes(
    "facial_geometry"
  )
);
assert.ok(
  FACE_LAB_IDENTITY_LOCK.includes(
    "camera_perspective"
  )
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

function productVariant({
  variantId = "012-rosewood",
  colorAnchors = [
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
  ],
  attributes = {
    hueFamily: "rose",
    undertone: "neutral_cool",
    depth: "medium",
    chroma: "medium",
    opacity: "buildable",
    finish: "satin",
    glossLevel: "medium"
  },
  evidenceRefsByAttribute = {
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
  }
} = {}) {
  return {
    productId:
      "11111111-1111-1111-1111-111111111111",
    variantId,
    identityVersion:
      "face-lab-variant-identity-fixture-v1",
    identityState: "resolved",
    lifecycleState: "active",
    variantAxes: {
      shade: variantId,
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
      shadeKey: variantId,
      displayLabel: "012 Rosewood",
      attributes,
      evidenceRefsByAttribute,
      colorAnchors
    }
  };
}

const lipBundle =
  buildFaceLabProductVariantCandidateRecord({
    variant: productVariant(),
    capabilityClaims: [
      lipCapabilityClaim()
    ]
  });

assert.equal(lipBundle.status, "ready");

const swatchOnlyBundle =
  buildFaceLabProductVariantCandidateRecord({
    variant: productVariant({
      variantId: "013-swatch-only",
      colorAnchors: [
        {
          anchorId: "brand-swatch-only",
          role: "brand_swatch",
          colorSpace: "srgb_hex",
          value: "#A05A66",
          evidenceRefs: [
            "brand_swatch:fixture-lip-013"
          ]
        }
      ]
    }),
    capabilityClaims: [
      lipCapabilityClaim()
    ]
  });

assert.equal(
  swatchOnlyBundle.status,
  "ready"
);

const semanticOnlyBundle =
  buildFaceLabProductVariantCandidateRecord({
    variant: productVariant({
      variantId: "014-semantic-only",
      colorAnchors: []
    }),
    capabilityClaims: [
      lipCapabilityClaim()
    ]
  });

assert.equal(
  semanticOnlyBundle.status,
  "ready"
);

function slot({
  key,
  requiredCapability = key,
  requiredAttributes = {},
  preferredAttributes = {},
  excludedAttributes = {},
  placement = [],
  direction = [],
  intensity = null,
  notes = []
}) {
  return {
    slotId:
      `face-lab-appearance-slot:${key}`,
    slotKey: key,
    requiredCapability,
    acceptedEntityTypes:
      key === "hair_shape"
        ? [
            "product",
            "style_reference",
            "service"
          ]
        : key === "overall_palette"
          ? ["color_palette"]
          : ["product", "service"],
    sourceDomains: ["fixture"],
    sourceRefs: ["fixture:v1"],
    criteria: {
      requiredAttributes,
      preferredAttributes,
      excludedAttributes
    },
    executionCues: {
      placement,
      direction,
      intensity,
      notes
    },
    matchState: {
      criteriaState: "structured",
      bindingState: "unbound",
      candidateRefs: [],
      selectedEntityRef: null,
      selectedVariantRef: null,
      matcherVersion: null,
      catalogTaxonomyVersion: null
    }
  };
}

const appearanceHandoff = {
  status: "available",
  version:
    "face-lab-appearance-handoff-v2",
  slotRegistryVersion:
    "face-lab-appearance-slot-v1",
  routeId: "route-balanced",
  slots: [
    slot({
      key: "lip_color",
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
      placement: ["full lip"],
      direction: [
        "controlled boundary"
      ],
      intensity: "moderate"
    }),
    slot({
      key: "hair_shape",
      preferredAttributes: {
        styleKeys: [
          "soft-curve-layers"
        ],
        requiredParameters: [
          "curvature",
          "light_layers"
        ]
      },
      direction: [
        "soft curve",
        "face-framing layers"
      ],
      notes: [
        "avoid excessive crown height"
      ]
    }),
    slot({
      key: "overall_palette",
      preferredAttributes: {
        temperatureDirection: "cooler",
        chromaDirection:
          "slightly_clearer",
        preferredFamilies: [
          "steel_blue"
        ]
      },
      direction: [
        "keep palette coherent"
      ]
    })
  ],
  matcherVersion: null,
  catalogTaxonomyVersion: null
};

const look = {
  lookId: "look-route-balanced",
  routeId: "route-balanced",
  title: "Balanced",
  conflictsResolved: [
    "reduce secondary accent"
  ],
  remainingTradeoffs: [
    "more daily styling"
  ]
};

const render =
  buildFaceLabRenderSpec({
    appearanceHandoff,
    look,
    presentationPreference:
      "masculine_examples",
    bindingsBySlot: {
      lip_color: {
        candidate:
          lipBundle.candidate,
        attributeSnapshot:
          lipBundle.attributeSnapshot,
        renderHints:
          lipBundle.renderHints
      }
    }
  });

assert.equal(render.status, "ready");
assert.equal(
  render.reason,
  "render_spec_built"
);
assert.equal(
  render.routeId,
  "route-balanced"
);
assert.equal(
  render.lookId,
  "look-route-balanced"
);
assert.equal(
  render.presentationPreference,
  "masculine_examples"
);
assert.equal(
  render.providerPayload,
  null
);
assert.equal(
  render.imageModelInvoked,
  false
);
assert.deepEqual(
  render.identityLock,
  FACE_LAB_IDENTITY_LOCK
);
assert.deepEqual(
  render.operations.map(
    (item) => item.slotKey
  ),
  [
    "hair_shape",
    "lip_color",
    "overall_palette"
  ],
  "operation ordering must remain deterministic by slot key, not recommendation rank"
);

const hairOperation =
  render.operations.find(
    (item) =>
      item.slotKey === "hair_shape"
  );
assert.equal(
  hairOperation.sourceMode,
  "execution_only"
);
assert.equal(
  hairOperation.candidateRef,
  null
);
assert.deepEqual(
  hairOperation.targetRegions,
  ["hair"]
);
assert.ok(
  hairOperation.application.direction.includes(
    "soft curve"
  )
);
assert.equal(
  hairOperation.colorAuthority
    .fidelityState,
  "none"
);

const lipOperation =
  render.operations.find(
    (item) =>
      item.slotKey === "lip_color"
  );
assert.equal(
  lipOperation.sourceMode,
  "candidate_bound"
);
assert.equal(
  lipOperation.candidateRef,
  lipBundle.candidate.candidateRef
);
assert.equal(
  lipOperation.variantId,
  "012-rosewood"
);
assert.deepEqual(
  lipOperation.targetRegions,
  ["lips"]
);
assert.equal(
  lipOperation.colorAuthority
    .fidelityState,
  "applied_reference"
);
assert.equal(
  lipOperation.colorAuthority
    .renderGuarantee,
  "not_pixel_exact"
);
assert.equal(
  lipOperation.colorAuthority
    .primaryAnchor.role,
  "applied_reference",
  "applied reference must outrank source swatches"
);
assert.equal(
  lipOperation.colorAuthority
    .alternateAnchors[0].role,
  "brand_swatch"
);
assert.equal(
  lipOperation.colorAuthority
    .candidateSemanticAttributes
    .hueFamily,
  "rose"
);
assert.equal(
  lipOperation.colorAuthority
    .requestedSemanticAttributes
    .hueFamily,
  "rose"
);
assert.equal(
  lipOperation.renderIdentity
    .displayLabel,
  "012 Rosewood"
);

const paletteOperation =
  render.operations.find(
    (item) =>
      item.slotKey === "overall_palette"
  );
assert.equal(
  paletteOperation.sourceMode,
  "execution_only"
);
assert.deepEqual(
  paletteOperation.targetRegions,
  ["rendered_style_elements"],
  "overall palette must not target the background or natural skin"
);
assert.equal(
  paletteOperation.colorAuthority
    .fidelityState,
  "semantic_only"
);
assert.deepEqual(
  paletteOperation.colorAuthority
    .preferredSemanticAttributes
    .preferredFamilies,
  ["steel_blue"]
);

assert.deepEqual(
  render.conflictsResolved,
  ["reduce secondary accent"]
);
assert.deepEqual(
  render.remainingTradeoffs,
  ["more daily styling"]
);

const swatchRender =
  buildFaceLabRenderSpec({
    appearanceHandoff: {
      ...appearanceHandoff,
      slots: [
        appearanceHandoff.slots.find(
          (item) =>
            item.slotKey === "lip_color"
        )
      ]
    },
    look,
    bindingsBySlot: {
      lip_color: {
        candidate:
          swatchOnlyBundle.candidate,
        attributeSnapshot:
          swatchOnlyBundle.attributeSnapshot,
        renderHints:
          swatchOnlyBundle.renderHints
      }
    }
  });

assert.equal(
  swatchRender.status,
  "ready"
);
assert.equal(
  swatchRender.operations[0]
    .colorAuthority.fidelityState,
  "swatch_reference"
);
assert.equal(
  swatchRender.operations[0]
    .colorAuthority.primaryAnchor.role,
  "brand_swatch",
  "a brand swatch must remain a swatch and must not be relabeled as applied appearance"
);

const semanticRender =
  buildFaceLabRenderSpec({
    appearanceHandoff: {
      ...appearanceHandoff,
      slots: [
        appearanceHandoff.slots.find(
          (item) =>
            item.slotKey === "lip_color"
        )
      ]
    },
    look,
    bindingsBySlot: {
      lip_color: {
        candidate:
          semanticOnlyBundle.candidate,
        attributeSnapshot:
          semanticOnlyBundle
            .attributeSnapshot,
        renderHints:
          semanticOnlyBundle.renderHints
      }
    }
  });

assert.equal(
  semanticRender.status,
  "ready"
);
assert.equal(
  semanticRender.operations[0]
    .colorAuthority.fidelityState,
  "semantic_only"
);
assert.equal(
  semanticRender.operations[0]
    .colorAuthority.primaryAnchor,
  null
);

const badCandidateBinding =
  buildFaceLabRenderSpec({
    appearanceHandoff: {
      ...appearanceHandoff,
      slots: [
        appearanceHandoff.slots.find(
          (item) =>
            item.slotKey === "lip_color"
        )
      ]
    },
    look,
    bindingsBySlot: {
      lip_color: {
        candidate: {
          ...lipBundle.candidate,
          capabilityClaims: []
        },
        attributeSnapshot:
          lipBundle.attributeSnapshot,
        renderHints:
          lipBundle.renderHints
      }
    }
  });

assert.equal(
  badCandidateBinding.status,
  "invalid"
);
assert.equal(
  badCandidateBinding.reason,
  "binding_gate_c_replay_failed",
  "an invalid supplied binding must fail closed instead of silently falling back to execution-only rendering"
);

const nullBinding =
  buildFaceLabRenderSpec({
    appearanceHandoff,
    look,
    bindingsBySlot: {
      lip_color: null
    }
  });

assert.equal(nullBinding.status, "invalid");
assert.equal(
  nullBinding.reason,
  "binding_not_object"
);

const extraBinding =
  buildFaceLabRenderSpec({
    appearanceHandoff,
    look,
    bindingsBySlot: {
      iris_appearance: {
        candidate:
          lipBundle.candidate,
        attributeSnapshot:
          lipBundle.attributeSnapshot
      }
    }
  });

assert.equal(extraBinding.status, "invalid");
assert.equal(
  extraBinding.reason,
  "binding_for_uncommitted_slot"
);
assert.equal(
  extraBinding.invalidBindingSlotKey,
  "iris_appearance"
);

const routeMismatch =
  buildFaceLabRenderSpec({
    appearanceHandoff,
    look: {
      ...look,
      routeId: "route-other"
    }
  });

assert.equal(routeMismatch.status, "invalid");
assert.equal(
  routeMismatch.reason,
  "look_route_mismatch"
);

const invalidPresentation =
  buildFaceLabRenderSpec({
    appearanceHandoff,
    look,
    presentationPreference:
      "unsupported_presentation"
  });

assert.equal(
  invalidPresentation.status,
  "invalid"
);
assert.equal(
  invalidPresentation.reason,
  "presentation_preference_invalid"
);

const unavailableHandoff =
  buildFaceLabRenderSpec({
    appearanceHandoff: {
      ...appearanceHandoff,
      status: "awaiting_route_choice"
    },
    look
  });

assert.equal(
  unavailableHandoff.status,
  "invalid"
);
assert.equal(
  unavailableHandoff.reason,
  "appearance_handoff_not_renderable"
);

const duplicateSlotHandoff =
  buildFaceLabRenderSpec({
    appearanceHandoff: {
      ...appearanceHandoff,
      slots: [
        appearanceHandoff.slots[0],
        structuredClone(
          appearanceHandoff.slots[0]
        )
      ]
    },
    look
  });

assert.equal(
  duplicateSlotHandoff.status,
  "invalid"
);
assert.equal(
  duplicateSlotHandoff.reason,
  "appearance_handoff_slot_identity_invalid"
);

const forgedRenderHints =
  buildFaceLabRenderSpec({
    appearanceHandoff: {
      ...appearanceHandoff,
      slots: [
        appearanceHandoff.slots.find(
          (item) =>
            item.slotKey === "lip_color"
        )
      ]
    },
    look,
    bindingsBySlot: {
      lip_color: {
        candidate:
          lipBundle.candidate,
        attributeSnapshot:
          lipBundle.attributeSnapshot,
        renderHints: {
          ...lipBundle.renderHints,
          colorAnchors: [
            {
              anchorId:
                "invented-applied",
              role:
                "applied_reference",
              colorSpace:
                "srgb_hex",
              value:
                "rose gold",
              evidenceRefs: [
                "applied_reference:invented"
              ]
            }
          ]
        }
      }
    }
  });

assert.equal(
  forgedRenderHints.status,
  "invalid"
);
assert.equal(
  forgedRenderHints.reason,
  "render_hints_color_anchor_value_invalid"
);

const ungovernedRenderHints =
  buildFaceLabRenderSpec({
    appearanceHandoff: {
      ...appearanceHandoff,
      slots: [
        appearanceHandoff.slots.find(
          (item) =>
            item.slotKey === "lip_color"
        )
      ]
    },
    look,
    bindingsBySlot: {
      lip_color: {
        candidate: {
          ...lipBundle.candidate,
          metadata: {}
        },
        attributeSnapshot:
          lipBundle.attributeSnapshot,
        renderHints:
          lipBundle.renderHints
      }
    }
  });

assert.equal(
  ungovernedRenderHints.status,
  "invalid"
);
assert.equal(
  ungovernedRenderHints.reason,
  "render_hints_variant_authority_missing"
);

for (const forbiddenField of [
  "score",
  "rank",
  "selectedCandidate",
  "selectedEntityRef",
  "selectedVariantRef"
]) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      render,
      forbiddenField
    ),
    false,
    `Render Adapter must not become a candidate ranking/selection layer: ${forbiddenField}`
  );
}

console.log(JSON.stringify({
  ok: true,
  adapterVersion:
    FACE_LAB_RENDER_ADAPTER_VERSION,
  renderSpecVersion:
    FACE_LAB_RENDER_SPEC_VERSION,
  operationCount:
    render.operations.length,
  checked: [
    "committed_handoff_required",
    "look_route_authority",
    "deterministic_operation_order",
    "identity_lock",
    "execution_only_mode",
    "candidate_bound_mode",
    "gate_c_binding_replay",
    "invalid_binding_fail_closed",
    "applied_reference_precedence",
    "swatch_role_preserved",
    "semantic_only_fallback",
    "overall_palette_scope",
    "variant_render_hint_authority",
    "no_provider_payload",
    "no_image_invocation",
    "no_ranking_or_selection"
  ]
}, null, 2));
