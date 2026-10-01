export const FACE_LAB_STYLE_CAPABILITY_VERSION =
  "face-lab-style-capability-v1";
export const FACE_LAB_APPEARANCE_SLOT_VERSION =
  "face-lab-appearance-slot-v1";

const DEFINITIONS = Object.freeze([
  {
    key: "complexion_prepare",
    domain: "complexion",
    acceptedEntityTypes: ["product", "service"],
    description: "Prepare the complexion surface before tone/coverage work."
  },
  {
    key: "complexion_even",
    domain: "complexion",
    acceptedEntityTypes: ["product", "service"],
    description: "Even visible complexion tone or coverage."
  },
  {
    key: "complexion_correct",
    domain: "complexion",
    acceptedEntityTypes: ["product", "service"],
    description: "Correct localized visible color imbalance."
  },
  {
    key: "complexion_finish",
    domain: "complexion",
    acceptedEntityTypes: ["product", "service"],
    description: "Control the final visible complexion finish."
  },
  {
    key: "cheek_color",
    domain: "face",
    acceptedEntityTypes: ["product", "service"],
    description: "Add or adjust visible cheek color."
  },
  {
    key: "face_shadow",
    domain: "face",
    acceptedEntityTypes: ["product", "service"],
    description: "Add controlled shadow for visible facial dimension."
  },
  {
    key: "face_highlight",
    domain: "face",
    acceptedEntityTypes: ["product", "service"],
    description: "Add controlled highlight or reflectivity."
  },
  {
    key: "eye_color",
    domain: "eye",
    acceptedEntityTypes: ["product", "service"],
    description: "Add or adjust visible eyelid/eye-area color."
  },
  {
    key: "eye_definition",
    domain: "eye",
    acceptedEntityTypes: ["product", "service"],
    description: "Adjust visible eye-line definition."
  },
  {
    key: "lash_definition",
    domain: "eye",
    acceptedEntityTypes: ["product", "service"],
    description: "Adjust visible lash definition, volume, or direction."
  },
  {
    key: "brow_definition",
    domain: "brow",
    acceptedEntityTypes: ["product", "service"],
    description: "Adjust visible brow structure, edge, or grooming."
  },
  {
    key: "lip_color",
    domain: "lip",
    acceptedEntityTypes: ["product", "service"],
    description: "Add or adjust visible lip color."
  },
  {
    key: "lip_finish",
    domain: "lip",
    acceptedEntityTypes: ["product", "service"],
    description: "Adjust visible lip finish such as gloss or softness."
  },
  {
    key: "iris_appearance",
    domain: "eye",
    acceptedEntityTypes: ["product"],
    description: "Adjust visible iris appearance through an eligible vision product."
  },
  {
    key: "facial_frame",
    domain: "face_frame",
    acceptedEntityTypes: ["product"],
    description: "Adjust the visible frame around the eyes/face, such as eyewear."
  },
  {
    key: "hair_shape",
    domain: "hair",
    acceptedEntityTypes: ["product", "style_reference", "service"],
    description: "Adjust visible hair silhouette, volume, movement, or line."
  },
  {
    key: "hair_color",
    domain: "hair",
    acceptedEntityTypes: ["product", "style_reference", "service"],
    description: "Adjust visible hair color."
  },
  {
    key: "facial_hair_shape",
    domain: "grooming",
    acceptedEntityTypes: ["product", "style_reference", "service"],
    description: "Adjust visible facial-hair shape, edge, length, or density."
  },
  {
    key: "face_accessory",
    domain: "accessory",
    acceptedEntityTypes: ["product"],
    description: "Adjust a visible face-adjacent accessory."
  },
  {
    key: "overall_palette",
    domain: "color",
    acceptedEntityTypes: ["color_palette"],
    description: "Provide a coherent color direction across the composed look."
  }
]);

function freezeDefinition(definition) {
  const acceptedEntityTypes = Object.freeze([...definition.acceptedEntityTypes]);
  return Object.freeze({
    ...definition,
    acceptedEntityTypes
  });
}

export const FACE_LAB_STYLE_CAPABILITIES = Object.freeze(
  Object.fromEntries(
    DEFINITIONS.map((definition) => [
      definition.key,
      freezeDefinition({
        capabilityId: `face-lab-style-capability:${definition.key}`,
        ...definition
      })
    ])
  )
);

export const FACE_LAB_APPEARANCE_SLOTS = Object.freeze(
  Object.fromEntries(
    DEFINITIONS.map((definition) => [
      definition.key,
      freezeDefinition({
        slotId: `face-lab-appearance-slot:${definition.key}`,
        slotKey: definition.key,
        requiredCapability: definition.key,
        domain: definition.domain,
        acceptedEntityTypes: definition.acceptedEntityTypes,
        description: `Face Lab requirement slot for ${definition.key}.`
      })
    ])
  )
);

export function getFaceLabStyleCapability(key) {
  return FACE_LAB_STYLE_CAPABILITIES[key] || null;
}

export function getFaceLabAppearanceSlotDefinition(key) {
  return FACE_LAB_APPEARANCE_SLOTS[key] || null;
}

export function isFaceLabStyleCapability(key) {
  return Boolean(getFaceLabStyleCapability(key));
}

export function isFaceLabAppearanceSlot(key) {
  return Boolean(getFaceLabAppearanceSlotDefinition(key));
}
