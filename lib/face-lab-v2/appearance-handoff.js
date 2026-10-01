import {
  FACE_LAB_APPEARANCE_SLOT_VERSION,
  getFaceLabAppearanceSlotDefinition
} from "./appearance-registry.js";

export const FACE_LAB_APPEARANCE_HANDOFF_VERSION =
  "face-lab-appearance-handoff-v1";

const COMMITTED_ROUTE_STATES = new Set([
  "user_selected",
  "single_route_auto"
]);

const PRODUCT_SPEC_SLOT_MAP = Object.freeze({
  base: "complexion_even",
  foundation: "complexion_even",
  concealer: "complexion_correct",
  primer: "complexion_prepare",
  powder: "complexion_finish",
  setting_product: "complexion_finish",
  blush: "cheek_color",
  contour: "face_shadow",
  bronzer: "face_shadow",
  highlighter: "face_highlight",
  eyeshadow: "eye_color",
  eyeliner: "eye_definition",
  mascara: "lash_definition",
  brow: "brow_definition",
  lip: "lip_color"
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(cleanString).filter(Boolean))];
}

function mergeLists(left, right) {
  return [...new Set([...cleanList(left), ...cleanList(right)])];
}

function hasKeys(value) {
  return isObject(value) && Object.keys(value).length > 0;
}

function cleanAttributeObject(value) {
  if (!isObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, rawValue]) => {
        if (Array.isArray(rawValue)) {
          const normalized = rawValue.filter(
            (item) => item !== null && item !== undefined && item !== ""
          );
          return normalized.length ? [key, normalized] : null;
        }

        if (
          rawValue === null ||
          rawValue === undefined ||
          rawValue === ""
        ) {
          return null;
        }

        return [key, rawValue];
      })
      .filter(Boolean)
  );
}

function criteriaState(criteria, executionCues) {
  if (
    hasKeys(criteria?.requiredAttributes) ||
    hasKeys(criteria?.preferredAttributes) ||
    hasKeys(criteria?.excludedAttributes)
  ) {
    return "structured";
  }

  if (
    cleanList(executionCues?.placement).length ||
    cleanList(executionCues?.direction).length ||
    cleanList(executionCues?.notes).length ||
    cleanString(executionCues?.intensity)
  ) {
    return "descriptive";
  }

  return "empty";
}

function createBinding(criteria, executionCues) {
  return {
    criteriaState: criteriaState(criteria, executionCues),
    bindingState: "unbound",
    candidateRefs: [],
    selectedEntityRef: null,
    selectedVariantRef: null,
    matcherVersion: null,
    catalogTaxonomyVersion: null
  };
}

function createSlot(slotKey, {
  sourceDomains = [],
  sourceRefs = [],
  criteria = {},
  executionCues = {},
  confidence = null
} = {}) {
  const definition = getFaceLabAppearanceSlotDefinition(slotKey);
  if (!definition) return null;

  const normalizedCriteria = {
    requiredAttributes: cleanAttributeObject(criteria.requiredAttributes),
    preferredAttributes: cleanAttributeObject(criteria.preferredAttributes),
    excludedAttributes: cleanAttributeObject(criteria.excludedAttributes)
  };

  const normalizedExecutionCues = {
    placement: cleanList(executionCues.placement),
    direction: cleanList(executionCues.direction),
    intensity: cleanString(executionCues.intensity),
    notes: cleanList(executionCues.notes)
  };

  return {
    slotId: definition.slotId,
    slotKey: definition.slotKey,
    requiredCapability: definition.requiredCapability,
    acceptedEntityTypes: [...definition.acceptedEntityTypes],
    sourceDomains: cleanList(sourceDomains),
    sourceRefs: cleanList(sourceRefs),
    criteria: normalizedCriteria,
    executionCues: normalizedExecutionCues,
    confidence:
      typeof confidence === "number" && Number.isFinite(confidence)
        ? confidence
        : null,
    matchState: createBinding(
      normalizedCriteria,
      normalizedExecutionCues
    )
  };
}

function mergeAttributeObjects(left, right) {
  const result = { ...cleanAttributeObject(left) };

  for (const [key, value] of Object.entries(cleanAttributeObject(right))) {
    if (!(key in result)) {
      result[key] = value;
      continue;
    }

    const current = result[key];

    if (Array.isArray(current) || Array.isArray(value)) {
      result[key] = [
        ...new Set([
          ...(Array.isArray(current) ? current : [current]),
          ...(Array.isArray(value) ? value : [value])
        ])
      ];
      continue;
    }

    if (current !== value) {
      result[key] = [...new Set([current, value])];
    }
  }

  return result;
}

function mergeSlot(existing, incoming) {
  const criteria = {
    requiredAttributes: mergeAttributeObjects(
      existing.criteria.requiredAttributes,
      incoming.criteria.requiredAttributes
    ),
    preferredAttributes: mergeAttributeObjects(
      existing.criteria.preferredAttributes,
      incoming.criteria.preferredAttributes
    ),
    excludedAttributes: mergeAttributeObjects(
      existing.criteria.excludedAttributes,
      incoming.criteria.excludedAttributes
    )
  };

  const executionCues = {
    placement: mergeLists(
      existing.executionCues.placement,
      incoming.executionCues.placement
    ),
    direction: mergeLists(
      existing.executionCues.direction,
      incoming.executionCues.direction
    ),
    intensity:
      existing.executionCues.intensity ||
      incoming.executionCues.intensity ||
      null,
    notes: mergeLists(
      existing.executionCues.notes,
      incoming.executionCues.notes
    )
  };

  return {
    ...existing,
    sourceDomains: mergeLists(
      existing.sourceDomains,
      incoming.sourceDomains
    ),
    sourceRefs: mergeLists(existing.sourceRefs, incoming.sourceRefs),
    criteria,
    executionCues,
    confidence:
      typeof existing.confidence === "number" &&
      typeof incoming.confidence === "number"
        ? Math.min(existing.confidence, incoming.confidence)
        : existing.confidence ?? incoming.confidence ?? null,
    matchState: createBinding(criteria, executionCues)
  };
}

function addSlot(map, slot) {
  if (!slot) return;

  const existing = map.get(slot.slotKey);
  map.set(
    slot.slotKey,
    existing ? mergeSlot(existing, slot) : slot
  );
}

function makeupTechniqueForSlot(makeup, slotKey) {
  const value = makeup?.value;
  if (!isObject(value)) return null;

  switch (slotKey) {
    case "complexion_prepare":
    case "complexion_even":
    case "complexion_correct":
    case "complexion_finish":
      return value.complexion;
    case "cheek_color":
      return value.blush;
    case "face_shadow":
    case "face_highlight":
      return value.contourHighlight;
    case "eye_color":
    case "eye_definition":
      return value.eyes;
    case "lash_definition":
      return value.eyes;
    case "brow_definition":
      return value.brows;
    case "lip_color":
    case "lip_finish":
      return value.lips;
    default:
      return null;
  }
}

function techniqueCues(technique) {
  if (!isObject(technique)) {
    return {
      placement: [],
      direction: [],
      intensity: null,
      notes: []
    };
  }

  return {
    placement: cleanList(technique.placement),
    direction: cleanList(technique.direction),
    intensity: cleanString(technique.intensity),
    notes: [
      ...cleanList(technique.finish),
      ...cleanList(technique.colorDirection),
      cleanString(technique.whyItWorks)
    ].filter(Boolean)
  };
}

function productSpecCriteria(spec) {
  return {
    requiredAttributes: cleanAttributeObject({
      hueFamily: spec?.hueFamily,
      undertone: spec?.undertone,
      depth: spec?.depth,
      chroma: spec?.chroma,
      opacity: spec?.opacity,
      finish: spec?.finish,
      glossLevel: spec?.glossLevel,
      blurLevel: spec?.blurLevel,
      shimmerLevel: spec?.shimmerLevel,
      diffusion: spec?.diffusion,
      buildability: spec?.buildability
    }),
    preferredAttributes: {},
    excludedAttributes: cleanAttributeObject({
      constraints: cleanList(spec?.constraints)
    })
  };
}

function addMakeupSlots(map, makeup, productSpecifications) {
  if (makeup?.status !== "available") return;

  for (const spec of Array.isArray(productSpecifications)
    ? productSpecifications
    : []) {
    const category = cleanString(spec?.category);
    const slotKey = PRODUCT_SPEC_SLOT_MAP[category];
    if (!slotKey) continue;

    addSlot(
      map,
      createSlot(slotKey, {
        sourceDomains: ["makeup"],
        sourceRefs: [makeup.version, spec.specId],
        criteria: productSpecCriteria(spec),
        executionCues: techniqueCues(
          makeupTechniqueForSlot(makeup, slotKey)
        ),
        confidence: makeup.confidence
      })
    );
  }

  const techniqueOnly = [
    ["cheek_color", makeup.value?.blush],
    ["face_highlight", makeup.value?.contourHighlight],
    ["brow_definition", makeup.value?.brows]
  ];

  for (const [slotKey, technique] of techniqueOnly) {
    if (!isObject(technique)) continue;

    addSlot(
      map,
      createSlot(slotKey, {
        sourceDomains: ["makeup"],
        sourceRefs: [makeup.version],
        executionCues: techniqueCues(technique),
        confidence: makeup.confidence
      })
    );
  }
}

function addHairSlot(map, hair) {
  if (hair?.status !== "available" || !isObject(hair.value)) return;

  const examples = Array.isArray(hair.value.examples)
    ? hair.value.examples.filter(isObject)
    : [];

  addSlot(
    map,
    createSlot("hair_shape", {
      sourceDomains: ["hair"],
      sourceRefs: [hair.version],
      criteria: {
        preferredAttributes: {
          styleKeys: cleanList(examples.map((item) => item.styleKey)),
          requiredParameters: cleanList(
            examples.flatMap((item) =>
              Array.isArray(item.requiredParameters)
                ? item.requiredParameters
                : []
            )
          )
        }
      },
      executionCues: {
        direction: [
          ...cleanList(hair.value.parting),
          ...cleanList(hair.value.fringe),
          ...cleanList(hair.value.crownVolume),
          ...cleanList(hair.value.sideVolume),
          ...cleanList(hair.value.layerDirection),
          ...cleanList(hair.value.curvature),
          ...cleanList(hair.value.texture),
          ...cleanList(hair.value.silhouette)
        ],
        notes: cleanList(hair.value.avoidOrModerate)
      },
      confidence: hair.confidence
    })
  );
}

function addGroomingSlots(map, grooming) {
  if (
    grooming?.status !== "available" ||
    !isObject(grooming.value)
  ) {
    return;
  }

  if (cleanList(grooming.value.brows).length) {
    addSlot(
      map,
      createSlot("brow_definition", {
        sourceDomains: ["grooming"],
        sourceRefs: [grooming.version],
        executionCues: {
          direction: cleanList(grooming.value.brows),
          notes: cleanList(grooming.value.maintenancePlan)
        },
        confidence: grooming.confidence
      })
    );
  }

  if (cleanList(grooming.value.facialHair).length) {
    addSlot(
      map,
      createSlot("facial_hair_shape", {
        sourceDomains: ["grooming"],
        sourceRefs: [grooming.version],
        executionCues: {
          direction: cleanList(grooming.value.facialHair),
          notes: cleanList(grooming.value.maintenancePlan)
        },
        confidence: grooming.confidence
      })
    );
  }
}

function addEyewearSlot(map, eyewear) {
  if (
    eyewear?.status !== "available" ||
    !isObject(eyewear.value)
  ) {
    return;
  }

  addSlot(
    map,
    createSlot("facial_frame", {
      sourceDomains: ["eyewear"],
      sourceRefs: [eyewear.version],
      executionCues: {
        direction: [
          ...cleanList(eyewear.value.frameWidth),
          ...cleanList(eyewear.value.frameHeight),
          ...cleanList(eyewear.value.angularity),
          ...cleanList(eyewear.value.curvature),
          ...cleanList(eyewear.value.rimThickness),
          ...cleanList(eyewear.value.bridgeDirection),
          ...cleanList(eyewear.value.browAlignment),
          ...cleanList(eyewear.value.visualWeight),
          ...cleanList(eyewear.value.colorContrast)
        ]
      },
      confidence: eyewear.confidence
    })
  );
}

function addAccessorySlot(map, accessories) {
  if (
    accessories?.status !== "available" ||
    !isObject(accessories.value)
  ) {
    return;
  }

  addSlot(
    map,
    createSlot("face_accessory", {
      sourceDomains: ["accessories"],
      sourceRefs: [accessories.version],
      executionCues: {
        direction: [
          ...cleanList(accessories.value.scale),
          ...cleanList(accessories.value.angularity),
          ...cleanList(accessories.value.curvature),
          ...cleanList(accessories.value.length),
          ...cleanList(accessories.value.visualWeight),
          ...cleanList(accessories.value.colorContrast)
        ],
        notes: Array.isArray(accessories.value.examples)
          ? accessories.value.examples
              .filter(isObject)
              .flatMap((item) => [
                cleanString(item.category),
                cleanString(item.direction),
                cleanString(item.whyItWorks)
              ])
              .filter(Boolean)
          : []
      },
      confidence: accessories.confidence
    })
  );
}

function addColorSlot(map, color) {
  if (color?.status !== "available" || !isObject(color.value)) return;

  addSlot(
    map,
    createSlot("overall_palette", {
      sourceDomains: ["color"],
      sourceRefs: [color.version],
      criteria: {
        preferredAttributes: {
          temperatureDirection: color.value.temperatureDirection,
          depthDirection: color.value.depthDirection,
          chromaDirection: color.value.chromaDirection,
          contrastDirection: color.value.contrastDirection,
          preferredFamilies: cleanList(color.value.preferredFamilies),
          moderateFamilies: cleanList(color.value.moderateFamilies)
        }
      },
      executionCues: {
        direction: cleanList(color.value.applicationNotes),
        notes: cleanList(color.value.qualityWarnings)
      },
      confidence: color.confidence
    })
  );
}

export function buildFaceLabAppearanceHandoff({
  selectionState = null,
  route = null,
  hair = null,
  makeup = null,
  makeupProductSpecifications = [],
  color = null,
  grooming = null,
  eyewear = null,
  accessories = null
} = {}) {
  const committed = COMMITTED_ROUTE_STATES.has(selectionState);

  if (!committed) {
    return {
      status:
        selectionState === "default_preview"
          ? "awaiting_route_choice"
          : "not_requested",
      version: FACE_LAB_APPEARANCE_HANDOFF_VERSION,
      slotRegistryVersion: FACE_LAB_APPEARANCE_SLOT_VERSION,
      routeId: null,
      slots: [],
      matcherVersion: null,
      catalogTaxonomyVersion: null
    };
  }

  if (!route?.routeId) {
    return {
      status: "not_requested",
      version: FACE_LAB_APPEARANCE_HANDOFF_VERSION,
      slotRegistryVersion: FACE_LAB_APPEARANCE_SLOT_VERSION,
      routeId: null,
      slots: [],
      matcherVersion: null,
      catalogTaxonomyVersion: null
    };
  }

  const slots = new Map();

  addHairSlot(slots, hair);
  addMakeupSlots(slots, makeup, makeupProductSpecifications);
  addGroomingSlots(slots, grooming);
  addEyewearSlot(slots, eyewear);
  addAccessorySlot(slots, accessories);
  addColorSlot(slots, color);

  return {
    status: slots.size ? "available" : "not_requested",
    version: FACE_LAB_APPEARANCE_HANDOFF_VERSION,
    slotRegistryVersion: FACE_LAB_APPEARANCE_SLOT_VERSION,
    routeId: route.routeId,
    slots: [...slots.values()],
    matcherVersion: null,
    catalogTaxonomyVersion: null
  };
}
