import {
  FACE_LAB_SHADE_PROFILE_VERSION,
  buildFaceLabProductVariantCandidateRecord
} from "./product-variant-authority.js";
import {
  buildFaceLabVisualTryOnAuthority
} from "./visual-try-on-authority.js";

export const FACE_LAB_VISUAL_TRY_ON_CANARY_PLAN_VERSION =
  "face-lab-visual-try-on-canary-plan-v1";

export const FACE_LAB_VISUAL_TRY_ON_CANARY_SESSION_ID =
  "visual-try-on-local-canary-v1";

export const FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS =
  Object.freeze({
    lip: "local_file:lip-reference",
    highlight:
      "local_file:highlight-reference",
    lens:
      "local_file:lens-reference"
  });

function capabilityClaim(
  capabilityKey,
  suffix
) {
  return {
    capabilityKey,
    supportState: "supported",
    proofClass:
      "curated_capability_mapping",
    proofVersion:
      FACE_LAB_VISUAL_TRY_ON_CANARY_PLAN_VERSION,
    evidenceRefs: [
      `local_calibration:${suffix}-capability`
    ]
  };
}

function variantBundle({
  productId,
  variantId,
  displayLabel,
  capabilityKey,
  attributes
}) {
  const evidenceRefsByAttribute =
    Object.fromEntries(
      Object.keys(attributes)
        .map((key) => [
          key,
          [
            `local_calibration:${productId}-${variantId}-${key}`
          ]
        ])
    );

  return buildFaceLabProductVariantCandidateRecord({
    variant: {
      productId,
      variantId,
      identityVersion:
        FACE_LAB_VISUAL_TRY_ON_CANARY_PLAN_VERSION,
      identityState: "resolved",
      lifecycleState: "active",
      variantAxes: {
        shade: variantId,
        market: "LOCAL"
      },
      identityEvidenceRefs: [
        `local_calibration:${productId}-${variantId}-identity`
      ],
      sourceVariantRefs: [
        `local_calibration:${productId}-${variantId}-source`
      ],
      shadeProfile: {
        profileVersion:
          FACE_LAB_SHADE_PROFILE_VERSION,
        shadeKey: variantId,
        displayLabel,
        attributes,
        evidenceRefsByAttribute,
        colorAnchors: []
      }
    },
    capabilityClaims: [
      capabilityClaim(
        capabilityKey,
        productId
      )
    ]
  });
}

export function buildFaceLabVisualTryOnCanaryAuthority() {
  const lip =
    variantBundle({
      productId:
        "local-calibration-lip",
      variantId:
        "coral-orange",
      displayLabel:
        "Coral Orange Reference",
      capabilityKey:
        "lip_color",
      attributes: {
        hueFamily:
          "coral_orange",
        undertone: "warm",
        depth: "medium",
        chroma:
          "medium_high",
        opacity:
          "buildable",
        finish: "glossy",
        glossLevel: "high"
      }
    });

  const highlight =
    variantBundle({
      productId:
        "local-calibration-highlighter",
      variantId:
        "lavender-purple",
      displayLabel:
        "Lavender Purple Reference",
      capabilityKey:
        "face_highlight",
      attributes: {
        hueFamily: "lavender",
        undertone: "cool",
        depth: "light",
        chroma: "low",
        opacity: "sheer",
        finish: "pearl",
        shimmerLevel:
          "medium"
      }
    });

  const lens =
    variantBundle({
      productId:
        "local-calibration-lens",
      variantId: "gray",
      displayLabel:
        "Gray Lens Reference",
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

  for (
    const bundle of
      [lip, highlight, lens]
  ) {
    if (bundle.status !== "ready") {
      throw new Error(
        "visual_try_on_canary_variant_invalid_" +
          bundle.reason
      );
    }
  }

  return buildFaceLabVisualTryOnAuthority({
    sessionId:
      FACE_LAB_VISUAL_TRY_ON_CANARY_SESSION_ID,
    selections: [
      {
        slotKey: "lip_color",
        binding: lip,
        referenceAssets: [
          {
            assetRef:
              FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS
                .lip,
            role:
              "product_image",
            evidenceRef:
              "local_calibration:lip-reference"
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
              FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS
                .highlight,
            role:
              "product_image",
            evidenceRef:
              "local_calibration:highlight-reference"
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
              FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS
                .lens,
            role:
              "wearing_reference",
            evidenceRef:
              "local_calibration:lens-reference"
          }
        ]
      }
    ]
  });
}
