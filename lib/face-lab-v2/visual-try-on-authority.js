import {
  getFaceLabAppearanceSlotDefinition
} from "./appearance-registry.js";
import {
  buildFaceLabRenderSpec
} from "./render-adapter.js";
import {
  FACE_LAB_VISUAL_TRY_ON_REFERENCE_ROLES,
  FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS,
  getFaceLabVisualTryOnSlotSupport
} from "./visual-try-on-registry.js";

export const FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION =
  "face-lab-visual-try-on-authority-v2";

const REFERENCE_ROLES =
  new Set(
    FACE_LAB_VISUAL_TRY_ON_REFERENCE_ROLES
  );

const MAX_SELECTIONS =
  FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS
    .length;

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
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

function validNamespacedRef(value) {
  const normalized =
    cleanString(value);

  return Boolean(
    normalized &&
    /^[a-z0-9][a-z0-9._-]*:[^\s]+$/i.test(
      normalized
    )
  );
}

function invalid(reason, details = {}) {
  return {
    authorityVersion:
      FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION,
    status: "invalid",
    reason,
    sessionId: null,
    routeId: null,
    lookId: null,
    selections: [],
    referenceAssets: [],
    renderSpec: null,
    providerPayload: null,
    imageModelInvoked: false,
    ...details
  };
}

function normalizeApplication(
  slotSupport,
  value
) {
  const fallback =
    slotSupport
      ?.defaultApplication;

  if (!fallback) return null;

  if (value === undefined) {
    return {
      placement:
        [...fallback.placement],
      direction:
        [...fallback.direction],
      intensity:
        fallback.intensity,
      notes:
        [...fallback.notes]
    };
  }

  if (!isObject(value)) {
    return null;
  }

  return {
    placement:
      cleanStringList(
        value.placement
      ),
    direction:
      cleanStringList(
        value.direction
      ),
    intensity:
      cleanString(
        value.intensity
      ) ||
      fallback.intensity,
    notes:
      cleanStringList(
        value.notes
      )
  };
}

function normalizeReferenceAssets(
  assets,
  slotKey,
  candidateRef
) {
  if (assets === undefined) {
    return {
      valid: true,
      assets: []
    };
  }

  if (!Array.isArray(assets)) {
    return {
      valid: false,
      reason:
        "reference_assets_not_array",
      assets: []
    };
  }

  if (assets.length > 8) {
    return {
      valid: false,
      reason:
        "reference_asset_limit_exceeded",
      assets: []
    };
  }

  const normalized = [];
  const assetRefs = new Set();

  for (const raw of assets) {
    if (!isObject(raw)) {
      return {
        valid: false,
        reason:
          "reference_asset_not_object",
        assets: []
      };
    }

    const assetRef =
      cleanString(raw.assetRef);
    const role =
      cleanString(raw.role);
    const evidenceRef =
      cleanString(raw.evidenceRef);

    if (
      !validNamespacedRef(assetRef)
    ) {
      return {
        valid: false,
        reason:
          "reference_asset_ref_invalid",
        assets: []
      };
    }

    if (
      !role ||
      !REFERENCE_ROLES.has(role)
    ) {
      return {
        valid: false,
        reason:
          "reference_asset_role_invalid",
        assets: []
      };
    }

    if (
      !validNamespacedRef(
        evidenceRef
      )
    ) {
      return {
        valid: false,
        reason:
          "reference_asset_evidence_invalid",
        assets: []
      };
    }

    if (assetRefs.has(assetRef)) {
      return {
        valid: false,
        reason:
          "reference_asset_duplicate_ref",
        assets: []
      };
    }

    assetRefs.add(assetRef);

    normalized.push({
      assetRef,
      role,
      evidenceRef,
      slotKey,
      candidateRef
    });
  }

  return {
    valid: true,
    assets: normalized
  };
}

function cloneAttributes(binding) {
  return isObject(
    binding?.attributeSnapshot
      ?.attributes
  )
    ? structuredClone(
        binding
          .attributeSnapshot
          .attributes
      )
    : null;
}

function normalizeSelection(
  rawSelection
) {
  if (!isObject(rawSelection)) {
    return {
      valid: false,
      reason:
        "selection_not_object"
    };
  }

  const slotKey =
    cleanString(
      rawSelection.slotKey
    );

  const slotSupport =
    slotKey
      ? getFaceLabVisualTryOnSlotSupport(
          slotKey
        )
      : null;

  if (
    !slotKey ||
    !slotSupport ||
    slotSupport.supportState !==
      "supported"
  ) {
    return {
      valid: false,
      reason:
        "selection_slot_not_supported"
    };
  }

  const definition =
    getFaceLabAppearanceSlotDefinition(
      slotKey
    );

  if (!definition) {
    return {
      valid: false,
      reason:
        "selection_slot_definition_missing"
    };
  }

  const binding =
    rawSelection.binding;

  if (
    !isObject(binding) ||
    !isObject(binding.candidate) ||
    !isObject(
      binding.attributeSnapshot
    )
  ) {
    return {
      valid: false,
      reason:
        "selection_binding_invalid"
    };
  }

  const candidateRef =
    cleanString(
      binding.candidate
        .candidateRef
    );

  if (!candidateRef) {
    return {
      valid: false,
      reason:
        "selection_candidate_ref_missing"
    };
  }

  const requiredAttributes =
    cloneAttributes(binding);

  if (requiredAttributes === null) {
    return {
      valid: false,
      reason:
        "selection_attribute_snapshot_invalid"
    };
  }

  const application =
    normalizeApplication(
      slotSupport,
      rawSelection.application
    );

  if (!application) {
    return {
      valid: false,
      reason:
        "selection_application_invalid"
    };
  }

  const references =
    normalizeReferenceAssets(
      rawSelection.referenceAssets,
      slotKey,
      candidateRef
    );

  if (!references.valid) {
    return {
      valid: false,
      reason:
        references.reason
    };
  }

  return {
    valid: true,
    selection: {
      slotKey,
      categoryKey:
        slotSupport.categoryKey,
      group:
        slotSupport.group,
      rolloutStage:
        slotSupport.rolloutStage,
      definition,
      binding:
        structuredClone(binding),
      application,
      referenceAssets:
        references.assets,
      requiredAttributes
    }
  };
}

export function buildFaceLabVisualTryOnAuthority({
  sessionId,
  selections,
  presentationPreference = null
} = {}) {
  const normalizedSessionId =
    cleanString(sessionId);

  if (
    !normalizedSessionId ||
    normalizedSessionId.length > 160
  ) {
    return invalid(
      "session_id_invalid"
    );
  }

  if (
    !Array.isArray(selections) ||
    !selections.length
  ) {
    return invalid(
      "selections_missing"
    );
  }

  if (
    selections.length >
    MAX_SELECTIONS
  ) {
    return invalid(
      "selection_limit_exceeded",
      {
        maxSelections:
          MAX_SELECTIONS
      }
    );
  }

  const normalizedSelections = [];
  const seenSlotKeys = new Set();

  for (
    const rawSelection of selections
  ) {
    const normalized =
      normalizeSelection(
        rawSelection
      );

    if (!normalized.valid) {
      return invalid(
        normalized.reason
      );
    }

    const selection =
      normalized.selection;

    if (
      seenSlotKeys.has(
        selection.slotKey
      )
    ) {
      return invalid(
        "duplicate_selection_slot",
        {
          invalidSlotKey:
            selection.slotKey
        }
      );
    }

    seenSlotKeys.add(
      selection.slotKey
    );
    normalizedSelections.push(
      selection
    );
  }

  const routeId =
    `visual-try-on:${normalizedSessionId}`;
  const lookId =
    `visual-try-on-look:${normalizedSessionId}`;

  const appearanceHandoff = {
    status: "available",
    routeId,
    slots:
      normalizedSelections.map(
        (selection) => ({
          slotId:
            selection.definition
              .slotId,
          slotKey:
            selection.slotKey,
          requiredCapability:
            selection.definition
              .requiredCapability,
          criteria: {
            requiredAttributes:
              structuredClone(
                selection
                  .requiredAttributes
              ),
            preferredAttributes: {},
            excludedAttributes: {}
          },
          executionCues:
            structuredClone(
              selection.application
            )
        })
      )
  };

  const look = {
    lookId,
    routeId,
    conflictsResolved: [],
    remainingTradeoffs: []
  };

  const bindingsBySlot =
    Object.fromEntries(
      normalizedSelections.map(
        (selection) => [
          selection.slotKey,
          structuredClone(
            selection.binding
          )
        ]
      )
    );

  const renderSpec =
    buildFaceLabRenderSpec({
      appearanceHandoff,
      look,
      bindingsBySlot,
      presentationPreference
    });

  if (
    renderSpec?.status !==
    "ready"
  ) {
    return invalid(
      "render_spec_unavailable",
      {
        renderSpecReason:
          renderSpec?.reason ||
          null
      }
    );
  }

  const referenceAssets =
    normalizedSelections
      .flatMap(
        (selection) =>
          selection
            .referenceAssets
      )
      .sort(
        (left, right) =>
          left.slotKey.localeCompare(
            right.slotKey
          ) ||
          left.role.localeCompare(
            right.role
          ) ||
          left.assetRef.localeCompare(
            right.assetRef
          )
      );

  return {
    authorityVersion:
      FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION,
    status: "ready",
    reason:
      "visual_try_on_authority_built",
    sessionId:
      normalizedSessionId,
    routeId,
    lookId,
    selections:
      normalizedSelections.map(
        (selection) => ({
          slotKey:
            selection.slotKey,
          categoryKey:
            selection.categoryKey,
          group:
            selection.group,
          rolloutStage:
            selection.rolloutStage,
          candidateRef:
            selection.binding
              .candidate
              .candidateRef,
          variantId:
            selection.binding
              .candidate
              .variantId ||
            null,
          application:
            structuredClone(
              selection.application
            ),
          referenceAssetRefs:
            selection.referenceAssets
              .map(
                (asset) =>
                  asset.assetRef
              )
        })
      ),
    referenceAssets,
    renderSpec,
    providerPayload: null,
    imageModelInvoked: false
  };
}
