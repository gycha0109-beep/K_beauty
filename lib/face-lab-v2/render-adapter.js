import {
  matchFaceLabAppearanceSlotCandidatesShadow
} from "./catalog-matcher-shadow.js";
import {
  FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
  FACE_LAB_SHADE_PROFILE_VERSION,
  validateFaceLabShadeProfile
} from "./product-variant-authority.js";

export const FACE_LAB_RENDER_SPEC_VERSION =
  "face-lab-render-spec-v1";

export const FACE_LAB_RENDER_ADAPTER_VERSION =
  "face-lab-render-adapter-v1";

export const FACE_LAB_IDENTITY_LOCK = Object.freeze([
  "identity",
  "facial_geometry",
  "eye_anatomy",
  "nose_geometry",
  "jaw_chin_geometry",
  "ear_geometry",
  "head_pose",
  "camera_perspective",
  "expression",
  "background",
  "lighting_direction"
]);

const SLOT_TARGET_REGIONS = Object.freeze({
  complexion_prepare: Object.freeze([
    "face_skin_surface"
  ]),
  complexion_even: Object.freeze([
    "face_skin_surface"
  ]),
  complexion_correct: Object.freeze([
    "face_skin_surface"
  ]),
  complexion_finish: Object.freeze([
    "face_skin_surface"
  ]),
  cheek_color: Object.freeze([
    "cheeks"
  ]),
  face_shadow: Object.freeze([
    "facial_shadow_regions"
  ]),
  face_highlight: Object.freeze([
    "facial_highlight_regions"
  ]),
  eye_color: Object.freeze([
    "eyelids"
  ]),
  eye_definition: Object.freeze([
    "lash_line",
    "outer_eye"
  ]),
  lash_definition: Object.freeze([
    "lashes"
  ]),
  brow_definition: Object.freeze([
    "brows"
  ]),
  lip_color: Object.freeze([
    "lips"
  ]),
  lip_finish: Object.freeze([
    "lips"
  ]),
  iris_appearance: Object.freeze([
    "irises"
  ]),
  facial_frame: Object.freeze([
    "eyewear_region"
  ]),
  hair_shape: Object.freeze([
    "hair"
  ]),
  hair_color: Object.freeze([
    "hair"
  ]),
  facial_hair_shape: Object.freeze([
    "facial_hair"
  ]),
  face_accessory: Object.freeze([
    "face_adjacent_accessory"
  ]),
  overall_palette: Object.freeze([
    "rendered_style_elements"
  ])
});

const COLOR_ATTRIBUTE_KEYS = new Set([
  "hueFamily",
  "undertone",
  "depth",
  "chroma",
  "opacity",
  "finish",
  "glossLevel",
  "shimmerLevel",
  "temperatureDirection",
  "depthDirection",
  "chromaDirection",
  "contrastDirection",
  "preferredFamilies"
]);

const COLOR_ANCHOR_ROLE_PRIORITY =
  Object.freeze({
    applied_reference: 0,
    brand_swatch: 1,
    merchant_swatch: 2
  });

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function cloneObject(value) {
  return isObject(value)
    ? structuredClone(value)
    : {};
}

function cleanStringList(values) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .map(cleanString)
        .filter(Boolean)
    )
  ];
}

function invalid(reason, details = {}) {
  return {
    adapterVersion:
      FACE_LAB_RENDER_ADAPTER_VERSION,
    renderSpecVersion:
      FACE_LAB_RENDER_SPEC_VERSION,
    status: "invalid",
    reason,
    routeId: null,
    lookId: null,
    identityLock:
      [...FACE_LAB_IDENTITY_LOCK],
    operations: [],
    conflictsResolved: [],
    remainingTradeoffs: [],
    providerPayload: null,
    imageModelInvoked: false,
    ...details
  };
}

function colorSemanticAttributes(value) {
  if (!isObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) =>
        COLOR_ATTRIBUTE_KEYS.has(key)
      )
      .map(([key, rawValue]) => [
        key,
        structuredClone(rawValue)
      ])
  );
}

function sortColorAnchors(anchors) {
  return [...anchors].sort((left, right) => {
    const leftRank =
      COLOR_ANCHOR_ROLE_PRIORITY[
        left.role
      ] ?? 99;
    const rightRank =
      COLOR_ANCHOR_ROLE_PRIORITY[
        right.role
      ] ?? 99;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return String(left.anchorId)
      .localeCompare(
        String(right.anchorId)
      );
  });
}

function validateBoundRenderHints({
  candidate,
  attributeSnapshot,
  renderHints
}) {
  if (renderHints == null) {
    return {
      valid: true,
      reason: null,
      colorAnchors: [],
      shadeKey: null,
      displayLabel: null
    };
  }

  if (
    candidate?.entityType !==
    "product_variant"
  ) {
    return {
      valid: false,
      reason:
        "render_hints_require_product_variant"
    };
  }

  if (
    candidate?.metadata
      ?.variantAuthorityVersion !==
    FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION
  ) {
    return {
      valid: false,
      reason:
        "render_hints_variant_authority_missing"
    };
  }

  if (!isObject(renderHints)) {
    return {
      valid: false,
      reason: "render_hints_not_object"
    };
  }

  const profile =
    validateFaceLabShadeProfile({
      profileVersion:
        attributeSnapshot?.sourceVersion,
      shadeKey:
        renderHints.shadeKey,
      displayLabel:
        renderHints.displayLabel,
      attributes:
        attributeSnapshot?.attributes,
      evidenceRefsByAttribute:
        attributeSnapshot
          ?.evidenceRefsByAttribute,
      colorAnchors:
        renderHints.colorAnchors
    });

  if (!profile.valid) {
    return {
      valid: false,
      reason:
        `render_hints_${profile.reason}`
    };
  }

  if (
    profile.profile.profileVersion !==
    FACE_LAB_SHADE_PROFILE_VERSION
  ) {
    return {
      valid: false,
      reason:
        "render_hints_shade_profile_version_mismatch"
    };
  }

  return {
    valid: true,
    reason: null,
    colorAnchors:
      profile.profile.colorAnchors,
    shadeKey:
      profile.profile.shadeKey,
    displayLabel:
      profile.profile.displayLabel
  };
}

function buildColorAuthority({
  slot,
  candidateAttributes,
  colorAnchors
}) {
  const requestedSemanticAttributes =
    colorSemanticAttributes(
      slot?.criteria?.requiredAttributes
    );

  const preferredSemanticAttributes =
    colorSemanticAttributes(
      slot?.criteria?.preferredAttributes
    );

  const candidateSemanticAttributes =
    colorSemanticAttributes(
      candidateAttributes
    );

  const orderedAnchors =
    sortColorAnchors(
      Array.isArray(colorAnchors)
        ? colorAnchors
        : []
    );

  const primaryAnchor =
    orderedAnchors[0] || null;
  const alternateAnchors =
    orderedAnchors.slice(1);

  let fidelityState = "none";

  if (
    primaryAnchor?.role ===
    "applied_reference"
  ) {
    fidelityState =
      "applied_reference";
  } else if (
    primaryAnchor?.role ===
      "brand_swatch" ||
    primaryAnchor?.role ===
      "merchant_swatch"
  ) {
    fidelityState =
      "swatch_reference";
  } else if (
    Object.keys(
      candidateSemanticAttributes
    ).length ||
    Object.keys(
      requestedSemanticAttributes
    ).length ||
    Object.keys(
      preferredSemanticAttributes
    ).length
  ) {
    fidelityState =
      "semantic_only";
  }

  return {
    fidelityState,
    renderGuarantee:
      "not_pixel_exact",
    primaryAnchor:
      primaryAnchor
        ? structuredClone(primaryAnchor)
        : null,
    alternateAnchors:
      structuredClone(
        alternateAnchors
      ),
    candidateSemanticAttributes,
    requestedSemanticAttributes,
    preferredSemanticAttributes
  };
}

function validateBinding({
  slot,
  binding
}) {
  if (!isObject(binding)) {
    return {
      valid: false,
      reason: "binding_not_object"
    };
  }

  if (
    !isObject(binding.candidate) ||
    !isObject(
      binding.attributeSnapshot
    )
  ) {
    return {
      valid: false,
      reason:
        "binding_candidate_or_snapshot_missing"
    };
  }

  const replay =
    matchFaceLabAppearanceSlotCandidatesShadow({
      slot,
      candidates: [
        {
          candidate:
            binding.candidate,
          attributeSnapshot:
            binding.attributeSnapshot
        }
      ]
    });

  if (
    replay.status !== "matched" ||
    replay.eligibleCandidateRefs.length !== 1 ||
    replay.eligibleCandidateRefs[0] !==
      binding.candidate.candidateRef
  ) {
    return {
      valid: false,
      reason: "binding_gate_c_replay_failed",
      replay
    };
  }

  const hints =
    validateBoundRenderHints({
      candidate:
        binding.candidate,
      attributeSnapshot:
        binding.attributeSnapshot,
      renderHints:
        binding.renderHints
    });

  if (!hints.valid) {
    return {
      valid: false,
      reason: hints.reason,
      replay
    };
  }

  return {
    valid: true,
    reason: null,
    replay,
    hints
  };
}

function buildOperation({
  slot,
  binding = null
}) {
  const targetRegions =
    SLOT_TARGET_REGIONS[
      slot.slotKey
    ];

  if (!targetRegions) {
    return {
      valid: false,
      reason:
        "render_target_region_unregistered"
    };
  }

  const application = {
    placement:
      cleanStringList(
        slot.executionCues?.placement
      ),
    direction:
      cleanStringList(
        slot.executionCues?.direction
      ),
    intensity:
      cleanString(
        slot.executionCues?.intensity
      ),
    notes:
      cleanStringList(
        slot.executionCues?.notes
      )
  };

  const criteria = {
    requiredAttributes:
      cloneObject(
        slot.criteria
          ?.requiredAttributes
      ),
    preferredAttributes:
      cloneObject(
        slot.criteria
          ?.preferredAttributes
      ),
    excludedAttributes:
      cloneObject(
        slot.criteria
          ?.excludedAttributes
      )
  };

  if (!binding) {
    return {
      valid: true,
      reason: null,
      operation: {
        operationId:
          `render-operation:${slot.slotKey}`,
        slotKey: slot.slotKey,
        sourceMode:
          "execution_only",
        targetRegions:
          [...targetRegions],
        candidateRef: null,
        entityType: null,
        variantId: null,
        criteria,
        candidateAttributes: {},
        application,
        colorAuthority:
          buildColorAuthority({
            slot,
            candidateAttributes: {},
            colorAnchors: []
          })
      }
    };
  }

  const validated =
    validateBinding({
      slot,
      binding
    });

  if (!validated.valid) {
    return {
      valid: false,
      reason: validated.reason,
      bindingReplay:
        validated.replay || null
    };
  }

  const candidateAttributes =
    cloneObject(
      binding.attributeSnapshot
        .attributes
    );

  return {
    valid: true,
    reason: null,
    operation: {
      operationId:
        `render-operation:${slot.slotKey}`,
      slotKey: slot.slotKey,
      sourceMode:
        "candidate_bound",
      targetRegions:
        [...targetRegions],
      candidateRef:
        binding.candidate
          .candidateRef,
      entityType:
        binding.candidate
          .entityType,
      variantId:
        cleanString(
          binding.candidate
            .variantId
        ),
      criteria,
      candidateAttributes,
      application,
      colorAuthority:
        buildColorAuthority({
          slot,
          candidateAttributes,
          colorAnchors:
            validated.hints
              .colorAnchors
        }),
      renderIdentity: {
        shadeKey:
          validated.hints
            .shadeKey,
        displayLabel:
          validated.hints
            .displayLabel
      }
    }
  };
}

function validateLook({
  appearanceHandoff,
  look
}) {
  if (!isObject(look)) {
    return {
      valid: false,
      reason: "look_not_object"
    };
  }

  const lookId =
    cleanString(look.lookId);
  const routeId =
    cleanString(look.routeId);

  if (!lookId || !routeId) {
    return {
      valid: false,
      reason:
        "look_identity_missing"
    };
  }

  if (
    routeId !==
    appearanceHandoff.routeId
  ) {
    return {
      valid: false,
      reason: "look_route_mismatch"
    };
  }

  return {
    valid: true,
    reason: null,
    lookId,
    routeId
  };
}

export function buildFaceLabRenderSpec({
  appearanceHandoff,
  look,
  bindingsBySlot = {}
} = {}) {
  if (
    !isObject(appearanceHandoff) ||
    appearanceHandoff.status !==
      "available" ||
    !cleanString(
      appearanceHandoff.routeId
    ) ||
    !Array.isArray(
      appearanceHandoff.slots
    ) ||
    !appearanceHandoff.slots.length
  ) {
    return invalid(
      "appearance_handoff_not_renderable"
    );
  }

  if (!isObject(bindingsBySlot)) {
    return invalid(
      "bindings_not_object"
    );
  }

  const lookValidation =
    validateLook({
      appearanceHandoff,
      look
    });

  if (!lookValidation.valid) {
    return invalid(
      lookValidation.reason
    );
  }

  const slotByKey =
    new Map(
      appearanceHandoff.slots
        .filter(isObject)
        .map((slot) => [
          cleanString(slot.slotKey),
          slot
        ])
        .filter(([key]) => key)
    );

  if (
    slotByKey.size !==
    appearanceHandoff.slots.length
  ) {
    return invalid(
      "appearance_handoff_slot_identity_invalid"
    );
  }

  for (
    const bindingKey of
      Object.keys(bindingsBySlot)
  ) {
    if (!slotByKey.has(bindingKey)) {
      return invalid(
        "binding_for_uncommitted_slot",
        {
          invalidBindingSlotKey:
            bindingKey
        }
      );
    }
  }

  const operations = [];

  for (
    const slotKey of
      [...slotByKey.keys()].sort()
  ) {
    const slot =
      slotByKey.get(slotKey);
    const hasBinding =
      Object.prototype
        .hasOwnProperty.call(
          bindingsBySlot,
          slotKey
        );

    const binding =
      hasBinding
        ? bindingsBySlot[slotKey]
        : null;

    if (
      hasBinding &&
      !isObject(binding)
    ) {
      return invalid(
        "binding_not_object",
        {
          invalidSlotKey: slotKey
        }
      );
    }

    const built =
      buildOperation({
        slot,
        binding
      });

    if (!built.valid) {
      return invalid(
        built.reason,
        {
          invalidSlotKey:
            slotKey,
          bindingReplay:
            built.bindingReplay ||
            null
        }
      );
    }

    operations.push(
      built.operation
    );
  }

  return {
    adapterVersion:
      FACE_LAB_RENDER_ADAPTER_VERSION,
    renderSpecVersion:
      FACE_LAB_RENDER_SPEC_VERSION,
    status: "ready",
    reason: "render_spec_built",
    routeId:
      lookValidation.routeId,
    lookId:
      lookValidation.lookId,
    identityLock:
      [...FACE_LAB_IDENTITY_LOCK],
    operations,
    conflictsResolved:
      cleanStringList(
        look.conflictsResolved
      ),
    remainingTradeoffs:
      cleanStringList(
        look.remainingTradeoffs
      ),
    providerPayload: null,
    imageModelInvoked: false
  };
}
