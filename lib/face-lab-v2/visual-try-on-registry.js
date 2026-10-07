import {
  getFaceLabAppearanceSlotDefinition
} from "./appearance-registry.js";

export const FACE_LAB_VISUAL_TRY_ON_REGISTRY_VERSION =
  "face-lab-visual-try-on-registry-v1";

export const FACE_LAB_VISUAL_TRY_ON_REFERENCE_ROLES =
  Object.freeze([
    "product_image",
    "brand_swatch",
    "merchant_swatch",
    "applied_reference",
    "style_reference",
    "wearing_reference"
  ]);

export const FACE_LAB_VISUAL_TRY_ON_CATEGORY_REGISTRY =
  Object.freeze({
    complexion_base: Object.freeze({
      categoryKey: "complexion_base",
      group: "makeup",
      rolloutStage: "P3",
      slotKeys: Object.freeze([
        "complexion_prepare",
        "complexion_even",
        "complexion_correct",
        "complexion_finish"
      ])
    }),
    blush: Object.freeze({
      categoryKey: "blush",
      group: "makeup",
      rolloutStage: "P0",
      slotKeys: Object.freeze([
        "cheek_color"
      ])
    }),
    contour: Object.freeze({
      categoryKey: "contour",
      group: "makeup",
      rolloutStage: "P1",
      slotKeys: Object.freeze([
        "face_shadow"
      ])
    }),
    highlighter: Object.freeze({
      categoryKey: "highlighter",
      group: "makeup",
      rolloutStage: "P0",
      slotKeys: Object.freeze([
        "face_highlight"
      ])
    }),
    eye_shadow: Object.freeze({
      categoryKey: "eye_shadow",
      group: "makeup",
      rolloutStage: "P1",
      slotKeys: Object.freeze([
        "eye_color"
      ])
    }),
    eyeliner: Object.freeze({
      categoryKey: "eyeliner",
      group: "makeup",
      rolloutStage: "P1",
      slotKeys: Object.freeze([
        "eye_definition"
      ])
    }),
    mascara_lash: Object.freeze({
      categoryKey: "mascara_lash",
      group: "makeup",
      rolloutStage: "P1",
      slotKeys: Object.freeze([
        "lash_definition"
      ])
    }),
    brow: Object.freeze({
      categoryKey: "brow",
      group: "makeup",
      rolloutStage: "P1",
      slotKeys: Object.freeze([
        "brow_definition"
      ])
    }),
    lip: Object.freeze({
      categoryKey: "lip",
      group: "makeup",
      rolloutStage: "P0",
      slotKeys: Object.freeze([
        "lip_color",
        "lip_finish"
      ])
    }),
    color_lens: Object.freeze({
      categoryKey: "color_lens",
      group: "vision",
      rolloutStage: "P0",
      slotKeys: Object.freeze([
        "iris_appearance"
      ])
    }),
    eyewear: Object.freeze({
      categoryKey: "eyewear",
      group: "accessory",
      rolloutStage: "P0",
      slotKeys: Object.freeze([
        "facial_frame"
      ])
    }),
    hair: Object.freeze({
      categoryKey: "hair",
      group: "hair",
      rolloutStage: "P2",
      slotKeys: Object.freeze([
        "hair_shape",
        "hair_color"
      ])
    }),
    facial_hair: Object.freeze({
      categoryKey: "facial_hair",
      group: "grooming",
      rolloutStage: "P2",
      slotKeys: Object.freeze([
        "facial_hair_shape"
      ])
    }),
    face_accessory: Object.freeze({
      categoryKey: "face_accessory",
      group: "accessory",
      rolloutStage: "P2",
      slotKeys: Object.freeze([
        "face_accessory"
      ])
    })
  });

const SLOT_APPLICATION_DEFAULTS =
  Object.freeze({
    complexion_prepare: Object.freeze({
      placement: Object.freeze(["face skin surface"]),
      direction: Object.freeze([]),
      intensity: "light",
      notes: Object.freeze([
        "preserve natural skin texture and facial geometry"
      ])
    }),
    complexion_even: Object.freeze({
      placement: Object.freeze(["face skin surface"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "change only visible tone evenness and coverage supported by the selected product"
      ])
    }),
    complexion_correct: Object.freeze({
      placement: Object.freeze(["localized complexion regions"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve surrounding skin and correct only the intended visible color imbalance"
      ])
    }),
    complexion_finish: Object.freeze({
      placement: Object.freeze(["face skin surface"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "change only visible finish such as matte, satin, or dewy appearance"
      ])
    }),
    cheek_color: Object.freeze({
      placement: Object.freeze(["cheeks"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "keep cheek color diffused into the existing skin texture"
      ])
    }),
    face_shadow: Object.freeze({
      placement: Object.freeze(["facial shadow regions"]),
      direction: Object.freeze([]),
      intensity: "light",
      notes: Object.freeze([
        "add controlled visible shadow without altering facial geometry"
      ])
    }),
    face_highlight: Object.freeze({
      placement: Object.freeze(["upper cheekbones"]),
      direction: Object.freeze([]),
      intensity: "light",
      notes: Object.freeze([
        "preserve skin texture while changing visible reflectivity"
      ])
    }),
    eye_color: Object.freeze({
      placement: Object.freeze(["eyelids"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve eye anatomy and apply only the selected eye color treatment"
      ])
    }),
    eye_definition: Object.freeze({
      placement: Object.freeze(["lash line", "outer eye"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve eye anatomy while changing only visible liner definition"
      ])
    }),
    lash_definition: Object.freeze({
      placement: Object.freeze(["lashes"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve eye anatomy and change only visible lash definition"
      ])
    }),
    brow_definition: Object.freeze({
      placement: Object.freeze(["brows"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve brow position and facial geometry"
      ])
    }),
    lip_color: Object.freeze({
      placement: Object.freeze(["lips"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve natural lip texture and lip geometry"
      ])
    }),
    lip_finish: Object.freeze({
      placement: Object.freeze(["lips"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "change finish only as supported by the selected product evidence"
      ])
    }),
    iris_appearance: Object.freeze({
      placement: Object.freeze(["irises"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve eye anatomy, pupil position, gaze, and catchlights"
      ])
    }),
    facial_frame: Object.freeze({
      placement: Object.freeze(["eyewear region"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve facial geometry and camera perspective"
      ])
    }),
    hair_shape: Object.freeze({
      placement: Object.freeze(["hair"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve identity, head pose, and hairline relationship while applying the selected hairstyle reference"
      ])
    }),
    hair_color: Object.freeze({
      placement: Object.freeze(["hair"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve hair shape unless hair shape is also explicitly selected"
      ])
    }),
    facial_hair_shape: Object.freeze({
      placement: Object.freeze(["facial hair"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve facial geometry while changing only facial-hair appearance"
      ])
    }),
    face_accessory: Object.freeze({
      placement: Object.freeze(["face-adjacent accessory region"]),
      direction: Object.freeze([]),
      intensity: "moderate",
      notes: Object.freeze([
        "preserve facial geometry, head pose, and camera perspective"
      ])
    })
  });

const SLOT_REGISTRY = (() => {
  const result = {};

  for (
    const category of Object.values(
      FACE_LAB_VISUAL_TRY_ON_CATEGORY_REGISTRY
    )
  ) {
    for (const slotKey of category.slotKeys) {
      if (result[slotKey]) {
        throw new Error(
          "visual_try_on_duplicate_slot:" +
          slotKey
        );
      }

      const definition =
        getFaceLabAppearanceSlotDefinition(
          slotKey
        );

      if (!definition) {
        throw new Error(
          "visual_try_on_unknown_slot:" +
          slotKey
        );
      }

      const defaultApplication =
        SLOT_APPLICATION_DEFAULTS[
          slotKey
        ];

      if (!defaultApplication) {
        throw new Error(
          "visual_try_on_missing_application:" +
          slotKey
        );
      }

      result[slotKey] =
        Object.freeze({
          registryVersion:
            FACE_LAB_VISUAL_TRY_ON_REGISTRY_VERSION,
          slotKey,
          categoryKey:
            category.categoryKey,
          group:
            category.group,
          rolloutStage:
            category.rolloutStage,
          supportState: "supported",
          defaultApplication
        });
    }
  }

  return Object.freeze(result);
})();

export const FACE_LAB_VISUAL_TRY_ON_SLOT_REGISTRY =
  SLOT_REGISTRY;

export const FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS =
  Object.freeze(
    Object.keys(
      FACE_LAB_VISUAL_TRY_ON_SLOT_REGISTRY
    ).sort()
  );

export function getFaceLabVisualTryOnSlotSupport(
  slotKey
) {
  return (
    FACE_LAB_VISUAL_TRY_ON_SLOT_REGISTRY[
      slotKey
    ] || null
  );
}

export function getFaceLabVisualTryOnCategory(
  categoryKey
) {
  return (
    FACE_LAB_VISUAL_TRY_ON_CATEGORY_REGISTRY[
      categoryKey
    ] || null
  );
}
