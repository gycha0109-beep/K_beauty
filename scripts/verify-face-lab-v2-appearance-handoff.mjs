import assert from "node:assert/strict";
import {
  FACE_LAB_APPEARANCE_SLOTS,
  FACE_LAB_STYLE_CAPABILITIES,
  FACE_LAB_APPEARANCE_SLOT_VERSION,
  FACE_LAB_STYLE_CAPABILITY_VERSION,
  getFaceLabAppearanceSlotDefinition
} from "../lib/face-lab-v2/appearance-registry.js";
import {
  FACE_LAB_APPEARANCE_HANDOFF_VERSION,
  buildFaceLabAppearanceHandoff
} from "../lib/face-lab-v2/appearance-handoff.js";

const EXPECTED_SLOT_KEYS = [
  "complexion_prepare",
  "complexion_even",
  "complexion_correct",
  "complexion_finish",
  "cheek_color",
  "face_shadow",
  "face_highlight",
  "eye_color",
  "eye_definition",
  "lash_definition",
  "brow_definition",
  "lip_color",
  "lip_finish",
  "iris_appearance",
  "facial_frame",
  "hair_shape",
  "hair_color",
  "facial_hair_shape",
  "face_accessory",
  "overall_palette"
];

assert.equal(
  FACE_LAB_STYLE_CAPABILITY_VERSION,
  "face-lab-style-capability-v1"
);
assert.equal(
  FACE_LAB_APPEARANCE_SLOT_VERSION,
  "face-lab-appearance-slot-v1"
);
assert.equal(
  FACE_LAB_APPEARANCE_HANDOFF_VERSION,
  "face-lab-appearance-handoff-v1"
);

assert.deepEqual(
  Object.keys(FACE_LAB_STYLE_CAPABILITIES),
  EXPECTED_SLOT_KEYS
);
assert.deepEqual(
  Object.keys(FACE_LAB_APPEARANCE_SLOTS),
  EXPECTED_SLOT_KEYS
);

for (const key of EXPECTED_SLOT_KEYS) {
  const definition = getFaceLabAppearanceSlotDefinition(key);
  assert.ok(definition, `missing slot definition: ${key}`);
  assert.equal(definition.slotKey, key);
  assert.equal(definition.requiredCapability, key);
  assert.ok(
    definition.slotId.startsWith("face-lab-appearance-slot:"),
    `slot id must remain namespaced: ${key}`
  );
  assert.ok(
    definition.acceptedEntityTypes.length >= 1,
    `slot must declare accepted entity types: ${key}`
  );
}

const route = {
  routeId: "fixture-route-balanced"
};

const preview = buildFaceLabAppearanceHandoff({
  selectionState: "default_preview",
  route
});

assert.equal(preview.status, "awaiting_route_choice");
assert.equal(preview.routeId, null);
assert.deepEqual(preview.slots, []);
assert.equal(preview.matcherVersion, null);

const selected = buildFaceLabAppearanceHandoff({
  selectionState: "user_selected",
  route,
  hair: {
    status: "available",
    version: "hair-v-fixture",
    confidence: 0.72,
    value: {
      parting: ["soft off-center part"],
      fringe: [],
      crownVolume: [],
      sideVolume: ["moderate side volume"],
      layerDirection: ["face-framing layer"],
      curvature: ["soft curve"],
      texture: ["controlled natural texture"],
      silhouette: ["balanced silhouette"],
      examples: [
        {
          styleKey: "soft-curve-layers",
          requiredParameters: ["curvature", "light_layers"]
        }
      ],
      avoidOrModerate: ["avoid excessive crown height"]
    }
  },
  makeup: {
    status: "available",
    version: "makeup-v-fixture",
    confidence: 0.68,
    value: {
      eyes: {
        placement: ["outer third"],
        direction: ["soft outward extension"],
        intensity: "moderate",
        finish: [],
        colorDirection: [],
        whyItWorks: "fixture eye direction"
      },
      blush: {
        placement: ["upper cheek"],
        direction: ["diffused edge"],
        intensity: "light",
        finish: [],
        colorDirection: [],
        whyItWorks: "fixture blush direction"
      },
      brows: {
        placement: [],
        direction: ["controlled brow edge"],
        intensity: "light",
        finish: [],
        colorDirection: [],
        whyItWorks: "fixture brow direction"
      },
      lips: {
        placement: ["full lip"],
        direction: ["controlled boundary"],
        intensity: "moderate",
        finish: [],
        colorDirection: [],
        whyItWorks: "fixture lip direction"
      },
      complexion: {
        placement: ["thin coverage where needed"],
        direction: ["natural satin base"],
        intensity: "light",
        finish: [],
        colorDirection: [],
        whyItWorks: "fixture complexion direction"
      },
      contourHighlight: null
    }
  },
  makeupProductSpecifications: [
    {
      specId: "spec-base",
      category: "base",
      opacity: "light_to_medium",
      finish: ["natural", "satin"],
      constraints: ["avoid_heavy_coverage"]
    },
    {
      specId: "spec-liner",
      category: "eyeliner",
      opacity: "buildable",
      finish: ["matte"]
    },
    {
      specId: "spec-shadow",
      category: "eyeshadow",
      chroma: "medium_low",
      finish: ["soft_satin"],
      diffusion: "high"
    },
    {
      specId: "spec-lip",
      category: "lip",
      chroma: "medium",
      opacity: "buildable",
      finish: ["satin"]
    },
    {
      specId: "spec-unknown",
      category: "marketing_glitter_magic",
      finish: ["glitter"]
    }
  ],
  grooming: {
    status: "available",
    version: "grooming-v-fixture",
    confidence: 0.7,
    value: {
      brows: ["brow edge cleanup"],
      facialHair: ["soft beard outline"],
      maintenancePlan: ["maintain existing structure"]
    }
  },
  eyewear: {
    status: "available",
    version: "eyewear-v-fixture",
    confidence: 0.62,
    value: {
      frameWidth: [],
      frameHeight: [],
      angularity: ["slight structure"],
      curvature: [],
      rimThickness: ["thin rim"],
      bridgeDirection: [],
      browAlignment: [],
      visualWeight: ["light visual weight"],
      colorContrast: []
    }
  },
  accessories: {
    status: "available",
    version: "accessory-v-fixture",
    confidence: 0.6,
    value: {
      scale: [],
      angularity: [],
      curvature: [],
      length: [],
      visualWeight: ["single light face-adjacent point"],
      colorContrast: [],
      examples: [
        {
          category: "face_adjacent_accessory",
          direction: "reduce_count",
          whyItWorks: "fixture accessory direction"
        }
      ]
    }
  },
  color: {
    status: "available",
    version: "color-v-fixture",
    confidence: 0.64,
    value: {
      temperatureDirection: "cooler",
      depthDirection: null,
      chromaDirection: "slightly_clearer",
      contrastDirection: null,
      preferredFamilies: ["steel_blue"],
      moderateFamilies: [],
      applicationNotes: ["keep color direction coherent"],
      qualityWarnings: []
    }
  }
});

assert.equal(selected.status, "available");
assert.equal(selected.routeId, route.routeId);
assert.equal(selected.matcherVersion, null);
assert.equal(
  selected.catalogTaxonomyVersion,
  null,
  "Gate A must not claim a catalog taxonomy version before any catalog read/match occurs"
);

const byKey = new Map(
  selected.slots.map((slot) => [slot.slotKey, slot])
);

for (const expected of [
  "hair_shape",
  "complexion_even",
  "eye_definition",
  "eye_color",
  "cheek_color",
  "brow_definition",
  "lip_color",
  "facial_hair_shape",
  "facial_frame",
  "face_accessory",
  "overall_palette"
]) {
  assert.ok(byKey.has(expected), `expected emitted slot: ${expected}`);
}

for (const reservedOnly of [
  "complexion_prepare",
  "complexion_finish",
  "face_shadow",
  "face_highlight",
  "lash_definition",
  "lip_finish",
  "iris_appearance",
  "hair_color"
]) {
  assert.equal(
    byKey.has(reservedOnly),
    false,
    `slot must not be emitted without explicit execution: ${reservedOnly}`
  );
}

for (const forbiddenCategoryAsSlot of [
  "base",
  "foundation",
  "eyeliner",
  "eyeshadow",
  "blush",
  "lip",
  "marketing_glitter_magic"
]) {
  assert.equal(
    byKey.has(forbiddenCategoryAsSlot),
    false,
    `product category/commerce label must not become an Appearance Slot: ${forbiddenCategoryAsSlot}`
  );
}

assert.equal(
  byKey.get("complexion_even").criteria.requiredAttributes.opacity,
  "light_to_medium"
);
assert.deepEqual(
  byKey.get("complexion_even").criteria.requiredAttributes.finish,
  ["natural", "satin"]
);
assert.deepEqual(
  byKey.get("complexion_even").criteria.excludedAttributes.constraints,
  ["avoid_heavy_coverage"]
);

assert.equal(
  byKey.get("eye_color").criteria.requiredAttributes.chroma,
  "medium_low"
);
assert.equal(
  byKey.get("overall_palette").criteria.preferredAttributes.temperatureDirection,
  "cooler"
);

const browSlot = byKey.get("brow_definition");
assert.deepEqual(
  new Set(browSlot.sourceDomains),
  new Set(["makeup", "grooming"])
);
assert.ok(
  browSlot.executionCues.direction.includes("brow edge cleanup")
);
assert.ok(
  browSlot.executionCues.direction.includes("controlled brow edge")
);

for (const slot of selected.slots) {
  assert.equal(slot.matchState.bindingState, "unbound");
  assert.deepEqual(slot.matchState.candidateRefs, []);
  assert.equal(slot.matchState.selectedEntityRef, null);
  assert.equal(slot.matchState.selectedVariantRef, null);
  assert.equal(slot.matchState.matcherVersion, null);
  assert.equal(slot.matchState.catalogTaxonomyVersion, null);
}

const singleRoute = buildFaceLabAppearanceHandoff({
  selectionState: "single_route_auto",
  route,
  hair: {
    status: "available",
    version: "hair-v-fixture",
    confidence: 0.72,
    value: {
      parting: [],
      fringe: [],
      crownVolume: [],
      sideVolume: [],
      layerDirection: ["light layers"],
      curvature: [],
      texture: [],
      silhouette: [],
      examples: [],
      avoidOrModerate: []
    }
  }
});

assert.equal(singleRoute.status, "available");
assert.deepEqual(
  singleRoute.slots.map((slot) => slot.slotKey),
  ["hair_shape"]
);

console.log(JSON.stringify({
  ok: true,
  capabilityVersion: FACE_LAB_STYLE_CAPABILITY_VERSION,
  slotVersion: FACE_LAB_APPEARANCE_SLOT_VERSION,
  handoffVersion: FACE_LAB_APPEARANCE_HANDOFF_VERSION,
  registeredSlotCount: EXPECTED_SLOT_KEYS.length,
  emittedSlotKeys: selected.slots.map((slot) => slot.slotKey)
}, null, 2));
