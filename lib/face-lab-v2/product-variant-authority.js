import {
  FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
  validateFaceLabCandidateAttributeSnapshot
} from "./catalog-matcher-shadow.js";
import {
  validateFaceLabCandidateCapabilityCandidate
} from "./candidate-capability.js";

export const FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION =
  "face-lab-product-variant-authority-v1";

export const FACE_LAB_SHADE_PROFILE_VERSION =
  "face-lab-shade-profile-v1";

export const FACE_LAB_SHADE_ATTRIBUTE_KEYS = Object.freeze([
  "hueFamily",
  "undertone",
  "depth",
  "chroma",
  "opacity",
  "finish",
  "glossLevel",
  "shimmerLevel"
]);

export const FACE_LAB_COLOR_ANCHOR_ROLES = Object.freeze([
  "brand_swatch",
  "merchant_swatch",
  "applied_reference"
]);

export const FACE_LAB_COLOR_SPACES = Object.freeze([
  "srgb_hex",
  "cie_lab"
]);

const IDENTITY_STATES = new Set([
  "resolved",
  "ambiguous",
  "unresolved"
]);

const LIFECYCLE_STATES = new Set([
  "active",
  "retired"
]);

const SHADE_ATTRIBUTES =
  new Set(FACE_LAB_SHADE_ATTRIBUTE_KEYS);
const COLOR_ANCHOR_ROLES =
  new Set(FACE_LAB_COLOR_ANCHOR_ROLES);
const COLOR_SPACES =
  new Set(FACE_LAB_COLOR_SPACES);

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

function cleanEvidenceRefs(values) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .map(cleanString)
        .filter(Boolean)
    )
  ];
}

function isNamespacedEvidenceRef(value) {
  const normalized = cleanString(value);
  return Boolean(
    normalized &&
    /^[a-z0-9][a-z0-9._-]*:[^\s]+$/i.test(
      normalized
    )
  );
}

function validInternalKey(value) {
  const normalized = cleanString(value);
  return Boolean(
    normalized &&
    /^[a-z0-9][a-z0-9._-]{0,159}$/.test(
      normalized
    )
  );
}

function validProductId(value) {
  const normalized = cleanString(value);
  return Boolean(
    normalized &&
    normalized.length <= 160 &&
    !/\s/.test(normalized) &&
    !normalized.includes(":")
  );
}

function normalizeVariantAxes(value) {
  if (!isObject(value)) return null;

  const entries = Object.entries(value);

  if (!entries.length) return null;

  const result = {};

  for (const [rawKey, rawValue] of entries) {
    const key = cleanString(rawKey);
    const axisValue = cleanString(rawValue);

    if (
      !key ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(key) ||
      !axisValue ||
      axisValue.length > 160
    ) {
      return null;
    }

    result[key] = axisValue;
  }

  return result;
}

function invalid(reason, details = {}) {
  return {
    valid: false,
    status: "invalid",
    reason,
    variant: null,
    ...details
  };
}

function buildVariantRef(productId, variantId) {
  return `product_variant:${productId}:${variantId}`;
}

export function createFaceLabProductVariantRef({
  productId,
  variantId
} = {}) {
  if (
    !validProductId(productId) ||
    !validInternalKey(variantId)
  ) {
    return null;
  }

  return buildVariantRef(
    cleanString(productId),
    cleanString(variantId)
  );
}

function normalizeCieLab(value) {
  if (!isObject(value)) return null;

  const keys = Object.keys(value).sort();
  if (
    JSON.stringify(keys) !==
    JSON.stringify(["a", "b", "l"])
  ) {
    return null;
  }

  const l = Number(value.l);
  const a = Number(value.a);
  const b = Number(value.b);

  if (
    !Number.isFinite(l) ||
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    l < 0 ||
    l > 100 ||
    a < -128 ||
    a > 127 ||
    b < -128 ||
    b > 127
  ) {
    return null;
  }

  return { l, a, b };
}

function normalizeColorAnchor(anchor) {
  if (!isObject(anchor)) {
    return {
      valid: false,
      reason: "color_anchor_not_object"
    };
  }

  const anchorId = cleanString(anchor.anchorId);
  const role = cleanString(anchor.role);
  const colorSpace = cleanString(anchor.colorSpace);
  const evidenceRefs =
    cleanEvidenceRefs(anchor.evidenceRefs);

  if (!validInternalKey(anchorId)) {
    return {
      valid: false,
      reason: "color_anchor_id_invalid"
    };
  }

  if (!role || !COLOR_ANCHOR_ROLES.has(role)) {
    return {
      valid: false,
      reason: "color_anchor_role_invalid"
    };
  }

  if (
    !colorSpace ||
    !COLOR_SPACES.has(colorSpace)
  ) {
    return {
      valid: false,
      reason: "color_anchor_space_invalid"
    };
  }

  if (
    !evidenceRefs.length ||
    !evidenceRefs.every(
      isNamespacedEvidenceRef
    )
  ) {
    return {
      valid: false,
      reason: "color_anchor_evidence_invalid"
    };
  }

  let value = null;

  if (colorSpace === "srgb_hex") {
    const normalized =
      cleanString(anchor.value);

    if (
      !normalized ||
      !/^#[0-9a-fA-F]{6}$/.test(normalized)
    ) {
      return {
        valid: false,
        reason: "color_anchor_value_invalid"
      };
    }

    value = normalized.toUpperCase();
  } else if (colorSpace === "cie_lab") {
    value = normalizeCieLab(anchor.value);

    if (!value) {
      return {
        valid: false,
        reason: "color_anchor_value_invalid"
      };
    }
  }

  return {
    valid: true,
    reason: null,
    anchor: {
      anchorId,
      role,
      colorSpace,
      value,
      evidenceRefs
    }
  };
}

export function validateFaceLabShadeProfile(
  profile
) {
  if (!isObject(profile)) {
    return {
      valid: false,
      reason: "shade_profile_not_object",
      profile: null
    };
  }

  if (
    profile.profileVersion !==
    FACE_LAB_SHADE_PROFILE_VERSION
  ) {
    return {
      valid: false,
      reason: "shade_profile_version_mismatch",
      profile: null
    };
  }

  const shadeKey = cleanString(profile.shadeKey);
  const displayLabel =
    cleanString(profile.displayLabel);

  if (!validInternalKey(shadeKey)) {
    return {
      valid: false,
      reason: "shade_key_invalid",
      profile: null
    };
  }

  if (
    !displayLabel ||
    displayLabel.length > 240
  ) {
    return {
      valid: false,
      reason: "shade_display_label_invalid",
      profile: null
    };
  }

  if (!isObject(profile.attributes)) {
    return {
      valid: false,
      reason: "shade_attributes_not_object",
      profile: null
    };
  }

  for (
    const key of
      Object.keys(profile.attributes)
  ) {
    if (!SHADE_ATTRIBUTES.has(key)) {
      return {
        valid: false,
        reason: "shade_attribute_unknown",
        profile: null
      };
    }
  }

  const snapshotValidation =
    validateFaceLabCandidateAttributeSnapshot({
      snapshotVersion:
        FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
      sourceVersion:
        FACE_LAB_SHADE_PROFILE_VERSION,
      attributes: profile.attributes,
      evidenceRefsByAttribute:
        profile.evidenceRefsByAttribute
    });

  if (!snapshotValidation.valid) {
    return {
      valid: false,
      reason:
        `shade_${snapshotValidation.reason}`,
      profile: null
    };
  }

  const rawAnchors = Array.isArray(
    profile.colorAnchors
  )
    ? profile.colorAnchors
    : profile.colorAnchors === undefined
      ? []
      : null;

  if (rawAnchors === null) {
    return {
      valid: false,
      reason: "color_anchors_not_array",
      profile: null
    };
  }

  const colorAnchors = [];
  const anchorIds = new Set();

  for (const rawAnchor of rawAnchors) {
    const normalized =
      normalizeColorAnchor(rawAnchor);

    if (!normalized.valid) {
      return {
        valid: false,
        reason: normalized.reason,
        profile: null
      };
    }

    if (
      anchorIds.has(
        normalized.anchor.anchorId
      )
    ) {
      return {
        valid: false,
        reason: "color_anchor_duplicate_id",
        profile: null
      };
    }

    anchorIds.add(
      normalized.anchor.anchorId
    );
    colorAnchors.push(
      normalized.anchor
    );
  }

  if (
    Object.keys(
      snapshotValidation.snapshot.attributes
    ).length === 0 &&
    colorAnchors.length === 0
  ) {
    return {
      valid: false,
      reason: "shade_profile_empty",
      profile: null
    };
  }

  return {
    valid: true,
    reason: null,
    profile: {
      profileVersion:
        FACE_LAB_SHADE_PROFILE_VERSION,
      shadeKey,
      displayLabel,
      attributes:
        snapshotValidation.snapshot.attributes,
      evidenceRefsByAttribute:
        snapshotValidation.snapshot
          .evidenceRefsByAttribute,
      colorAnchors
    }
  };
}

export function validateFaceLabProductVariantAuthority(
  variant
) {
  if (!isObject(variant)) {
    return invalid(
      "product_variant_not_object"
    );
  }

  const productId = cleanString(
    variant.productId
  );
  const variantId = cleanString(
    variant.variantId
  );
  const identityVersion = cleanString(
    variant.identityVersion
  );
  const identityState = cleanString(
    variant.identityState
  );
  const lifecycleState = cleanString(
    variant.lifecycleState
  );

  if (!validProductId(productId)) {
    return invalid("product_id_invalid");
  }

  if (!validInternalKey(variantId)) {
    return invalid("variant_id_invalid");
  }

  if (
    !identityVersion ||
    identityVersion.length > 160
  ) {
    return invalid(
      "variant_identity_version_invalid"
    );
  }

  if (
    !identityState ||
    !IDENTITY_STATES.has(identityState)
  ) {
    return invalid(
      "variant_identity_state_invalid"
    );
  }

  if (
    !lifecycleState ||
    !LIFECYCLE_STATES.has(lifecycleState)
  ) {
    return invalid(
      "variant_lifecycle_state_invalid"
    );
  }

  const variantAxes =
    normalizeVariantAxes(
      variant.variantAxes
    );

  if (!variantAxes) {
    return invalid("variant_axes_invalid");
  }

  const identityEvidenceRefs =
    cleanEvidenceRefs(
      variant.identityEvidenceRefs
    );

  if (
    !identityEvidenceRefs.length ||
    !identityEvidenceRefs.every(
      isNamespacedEvidenceRef
    )
  ) {
    return invalid(
      "variant_identity_evidence_invalid"
    );
  }

  const canonicalRef =
    buildVariantRef(
      productId,
      variantId
    );

  if (
    variant.variantRef !== undefined &&
    cleanString(variant.variantRef) !==
      canonicalRef
  ) {
    return invalid(
      "variant_ref_mismatch"
    );
  }

  const sourceVariantRefs =
    cleanEvidenceRefs(
      variant.sourceVariantRefs
    );

  if (
    sourceVariantRefs.some(
      (value) =>
        !isNamespacedEvidenceRef(value)
    )
  ) {
    return invalid(
      "source_variant_ref_invalid"
    );
  }

  if (identityState !== "resolved") {
    return invalid(
      "variant_identity_not_resolved",
      {
        identityState
      }
    );
  }

  let shadeProfile = null;

  if (variant.shadeProfile !== undefined) {
    const shadeValidation =
      validateFaceLabShadeProfile(
        variant.shadeProfile
      );

    if (!shadeValidation.valid) {
      return invalid(
        shadeValidation.reason
      );
    }

    shadeProfile =
      shadeValidation.profile;

    if (
      cleanString(variantAxes.shade) !==
      shadeProfile.shadeKey
    ) {
      return invalid(
        "variant_shade_axis_mismatch"
      );
    }
  }

  const normalizedVariant = {
    authorityVersion:
      FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
    variantRef: canonicalRef,
    productId,
    variantId,
    identityVersion,
    identityState,
    lifecycleState,
    variantAxes,
    identityEvidenceRefs,
    sourceVariantRefs,
    shadeProfile
  };

  if (lifecycleState === "retired") {
    return {
      valid: true,
      status: "inactive",
      reason: "variant_retired",
      variant: normalizedVariant
    };
  }

  return {
    valid: true,
    status: shadeProfile
      ? "ready"
      : "identity_only",
    reason: shadeProfile
      ? "variant_and_shade_authorized"
      : "variant_identity_authorized",
    variant: normalizedVariant
  };
}

export function buildFaceLabProductVariantCandidateRecord({
  variant,
  capabilityClaims = []
} = {}) {
  const authority =
    validateFaceLabProductVariantAuthority(
      variant
    );

  if (!authority.valid) {
    return {
      authorityVersion:
        FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
      status: "invalid",
      reason: authority.reason,
      candidate: null,
      attributeSnapshot: null,
      renderHints: null
    };
  }

  if (authority.status === "inactive") {
    return {
      authorityVersion:
        FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
      status: "inactive",
      reason: authority.reason,
      candidate: null,
      attributeSnapshot: null,
      renderHints: null
    };
  }

  const normalized =
    authority.variant;

  const candidate = {
    candidateRef: normalized.variantRef,
    entityType: "product_variant",
    entityId: normalized.productId,
    variantId: normalized.variantId,
    capabilityClaims:
      Array.isArray(capabilityClaims)
        ? structuredClone(
            capabilityClaims
          )
        : capabilityClaims,
    metadata: {
      variantAuthorityVersion:
        FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
      identityVersion:
        normalized.identityVersion
    }
  };

  const candidateValidation =
    validateFaceLabCandidateCapabilityCandidate(
      candidate
    );

  if (!candidateValidation.valid) {
    return {
      authorityVersion:
        FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
      status: "invalid",
      reason:
        `candidate_${candidateValidation.reason}`,
      candidate: null,
      attributeSnapshot: null,
      renderHints: null
    };
  }

  const profile =
    normalized.shadeProfile;

  const attributeSnapshot = {
    snapshotVersion:
      FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
    sourceVersion: profile
      ? profile.profileVersion
      : normalized.identityVersion,
    attributes: profile
      ? structuredClone(
          profile.attributes
        )
      : {},
    evidenceRefsByAttribute: profile
      ? structuredClone(
          profile.evidenceRefsByAttribute
        )
      : {}
  };

  const snapshotValidation =
    validateFaceLabCandidateAttributeSnapshot(
      attributeSnapshot
    );

  if (!snapshotValidation.valid) {
    return {
      authorityVersion:
        FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
      status: "invalid",
      reason:
        `projected_${snapshotValidation.reason}`,
      candidate: null,
      attributeSnapshot: null,
      renderHints: null
    };
  }

  return {
    authorityVersion:
      FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
    status: authority.status,
    reason: authority.reason,
    candidate:
      candidateValidation.candidate,
    attributeSnapshot:
      snapshotValidation.snapshot,
    renderHints: profile
      ? {
          shadeKey:
            profile.shadeKey,
          displayLabel:
            profile.displayLabel,
          colorAnchors:
            structuredClone(
              profile.colorAnchors
            )
        }
      : null
  };
}
