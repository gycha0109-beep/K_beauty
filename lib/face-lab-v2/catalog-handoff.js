export const FACE_LAB_CATALOG_HANDOFF_VERSION =
  "face-lab-catalog-handoff-v1";

export const FACE_LAB_CATALOG_SLOT_KINDS = Object.freeze([
  "hair_style",
  "complexion_base",
  "eyeliner",
  "eyeshadow",
  "blush",
  "lip",
  "highlighter",
  "brow_grooming",
  "facial_hair_style",
  "eyewear_frame",
  "face_accessory",
  "color_palette"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanList(values) {
  return Array.isArray(values)
    ? [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))]
    : [];
}

function createEmptyBinding() {
  return {
    selectedCandidateId: null,
    candidateIds: [],
    catalogVersion: null,
    matchedAt: null
  };
}

function createSlot({
  slotId,
  slotKind,
  domain,
  sourceRefs = [],
  requirements = {},
  renderHints = {}
}) {
  return {
    slotId,
    slotKind,
    domain,
    sourceRefs: cleanList(sourceRefs),
    requirements: isObject(requirements) ? requirements : {},
    renderHints: isObject(renderHints) ? renderHints : {},
    binding: createEmptyBinding()
  };
}

function makeupSpecRequirements(spec) {
  return {
    category: spec?.category || null,
    hueFamily: spec?.hueFamily || null,
    undertone: spec?.undertone || null,
    depth: spec?.depth || null,
    chroma: spec?.chroma || null,
    opacity: spec?.opacity || null,
    finish: Array.isArray(spec?.finish) ? [...spec.finish] : spec?.finish || null,
    glossLevel: spec?.glossLevel || null,
    blurLevel: spec?.blurLevel || null,
    shimmerLevel: spec?.shimmerLevel || null,
    diffusion: spec?.diffusion || null,
    buildability: spec?.buildability || null,
    constraints: cleanList(spec?.constraints)
  };
}

function slotKindForMakeupCategory(category) {
  const map = {
    base: "complexion_base",
    eyeliner: "eyeliner",
    eyeshadow: "eyeshadow",
    blush: "blush",
    lip: "lip",
    highlighter: "highlighter"
  };
  return map[category] || null;
}

function addMakeupSlots(slots, makeup, productSpecifications) {
  if (makeup?.status !== "available" || !isObject(makeup.value)) return;

  const seenKinds = new Set();

  for (const spec of Array.isArray(productSpecifications) ? productSpecifications : []) {
    const slotKind = slotKindForMakeupCategory(spec?.category);
    if (!slotKind || seenKinds.has(slotKind)) continue;
    seenKinds.add(slotKind);

    slots.push(createSlot({
      slotId: `makeup:${slotKind}`,
      slotKind,
      domain: "makeup",
      sourceRefs: [spec.specId, makeup.version],
      requirements: makeupSpecRequirements(spec),
      renderHints: {
        placement:
          slotKind === "eyeliner" || slotKind === "eyeshadow"
            ? cleanList(makeup.value.eyes?.placement)
            : slotKind === "blush"
              ? cleanList(makeup.value.blush?.placement)
              : slotKind === "lip"
                ? cleanList(makeup.value.lips?.placement)
                : slotKind === "complexion_base"
                  ? cleanList(makeup.value.complexion?.placement)
                  : slotKind === "highlighter"
                    ? cleanList(makeup.value.contourHighlight?.placement)
                    : [],
        direction:
          slotKind === "eyeliner" || slotKind === "eyeshadow"
            ? cleanList(makeup.value.eyes?.direction)
            : slotKind === "blush"
              ? cleanList(makeup.value.blush?.direction)
              : slotKind === "lip"
                ? cleanList(makeup.value.lips?.direction)
                : slotKind === "complexion_base"
                  ? cleanList(makeup.value.complexion?.direction)
                  : slotKind === "highlighter"
                    ? cleanList(makeup.value.contourHighlight?.direction)
                    : []
      }
    }));
  }

  const techniqueFallbacks = [
    ["blush", makeup.value.blush],
    ["highlighter", makeup.value.contourHighlight]
  ];

  for (const [slotKind, technique] of techniqueFallbacks) {
    if (
      seenKinds.has(slotKind) ||
      !isObject(technique) ||
      (!cleanList(technique.placement).length && !cleanList(technique.direction).length)
    ) {
      continue;
    }

    seenKinds.add(slotKind);
    slots.push(createSlot({
      slotId: `makeup:${slotKind}`,
      slotKind,
      domain: "makeup",
      sourceRefs: [makeup.version],
      requirements: {
        category: slotKind,
        intensity: technique.intensity || null,
        finish: cleanList(technique.finish),
        colorDirection: cleanList(technique.colorDirection)
      },
      renderHints: {
        placement: cleanList(technique.placement),
        direction: cleanList(technique.direction)
      }
    }));
  }
}

export function buildFaceLabCatalogHandoff({
  route = null,
  hair = null,
  makeup = null,
  makeupProductSpecifications = [],
  color = null,
  grooming = null,
  eyewear = null,
  accessories = null
} = {}) {
  if (!route) {
    return {
      status: "not_requested",
      version: FACE_LAB_CATALOG_HANDOFF_VERSION,
      routeId: null,
      slots: [],
      catalogVersion: null
    };
  }

  const slots = [];

  if (hair?.status === "available" && isObject(hair.value)) {
    slots.push(createSlot({
      slotId: "hair:style",
      slotKind: "hair_style",
      domain: "hair",
      sourceRefs: [hair.version],
      requirements: {
        styleKeys: Array.isArray(hair.value.examples)
          ? cleanList(hair.value.examples.map((item) => item?.styleKey))
          : [],
        requiredParameters: Array.isArray(hair.value.examples)
          ? cleanList(hair.value.examples.flatMap((item) => item?.requiredParameters || []))
          : [],
        avoidOrModerate: cleanList(hair.value.avoidOrModerate)
      },
      renderHints: {
        parting: cleanList(hair.value.parting),
        fringe: cleanList(hair.value.fringe),
        crownVolume: cleanList(hair.value.crownVolume),
        sideVolume: cleanList(hair.value.sideVolume),
        layerDirection: cleanList(hair.value.layerDirection),
        curvature: cleanList(hair.value.curvature),
        texture: cleanList(hair.value.texture),
        silhouette: cleanList(hair.value.silhouette)
      }
    }));
  }

  addMakeupSlots(slots, makeup, makeupProductSpecifications);

  if (grooming?.status === "available" && isObject(grooming.value)) {
    if (cleanList(grooming.value.brows).length) {
      slots.push(createSlot({
        slotId: "grooming:brow",
        slotKind: "brow_grooming",
        domain: "grooming",
        sourceRefs: [grooming.version],
        requirements: {
          directions: cleanList(grooming.value.brows),
          maintenancePlan: cleanList(grooming.value.maintenancePlan)
        }
      }));
    }

    if (cleanList(grooming.value.facialHair).length) {
      slots.push(createSlot({
        slotId: "grooming:facial_hair",
        slotKind: "facial_hair_style",
        domain: "grooming",
        sourceRefs: [grooming.version],
        requirements: {
          directions: cleanList(grooming.value.facialHair),
          maintenancePlan: cleanList(grooming.value.maintenancePlan)
        }
      }));
    }
  }

  if (eyewear?.status === "available" && isObject(eyewear.value)) {
    slots.push(createSlot({
      slotId: "eyewear:frame",
      slotKind: "eyewear_frame",
      domain: "eyewear",
      sourceRefs: [eyewear.version],
      requirements: {
        frameWidth: cleanList(eyewear.value.frameWidth),
        frameHeight: cleanList(eyewear.value.frameHeight),
        angularity: cleanList(eyewear.value.angularity),
        curvature: cleanList(eyewear.value.curvature),
        rimThickness: cleanList(eyewear.value.rimThickness),
        bridgeDirection: cleanList(eyewear.value.bridgeDirection),
        browAlignment: cleanList(eyewear.value.browAlignment),
        visualWeight: cleanList(eyewear.value.visualWeight),
        colorContrast: cleanList(eyewear.value.colorContrast)
      }
    }));
  }

  if (accessories?.status === "available" && isObject(accessories.value)) {
    slots.push(createSlot({
      slotId: "accessories:face_adjacent",
      slotKind: "face_accessory",
      domain: "accessories",
      sourceRefs: [accessories.version],
      requirements: {
        scale: cleanList(accessories.value.scale),
        angularity: cleanList(accessories.value.angularity),
        curvature: cleanList(accessories.value.curvature),
        length: cleanList(accessories.value.length),
        visualWeight: cleanList(accessories.value.visualWeight),
        colorContrast: cleanList(accessories.value.colorContrast),
        directions: Array.isArray(accessories.value.examples)
          ? accessories.value.examples
              .filter((item) => isObject(item))
              .map((item) => ({
                category: item.category || null,
                direction: item.direction || null
              }))
          : []
      }
    }));
  }

  if (color?.status === "available" && isObject(color.value)) {
    slots.push(createSlot({
      slotId: "color:palette",
      slotKind: "color_palette",
      domain: "color",
      sourceRefs: [color.version],
      requirements: {
        temperatureDirection: color.value.temperatureDirection || null,
        depthDirection: color.value.depthDirection || null,
        chromaDirection: color.value.chromaDirection || null,
        contrastDirection: color.value.contrastDirection || null,
        preferredFamilies: cleanList(color.value.preferredFamilies),
        moderateFamilies: cleanList(color.value.moderateFamilies)
      },
      renderHints: {
        applicationNotes: cleanList(color.value.applicationNotes)
      }
    }));
  }

  return {
    status: slots.length ? "ready_for_matching" : "not_requested",
    version: FACE_LAB_CATALOG_HANDOFF_VERSION,
    routeId: route.routeId || null,
    slots,
    catalogVersion: null
  };
}
