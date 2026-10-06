import {
  FACE_LAB_IDENTITY_LOCK,
  FACE_LAB_RENDER_SPEC_VERSION
} from "./render-adapter.js";

export const FACE_LAB_SIMULATION_INSTRUCTION_VERSION =
  "face-lab-simulation-instruction-v2";

const SOURCE_MODES = new Set([
  "execution_only",
  "candidate_bound"
]);

const COLOR_FIDELITY_STATES = new Set([
  "applied_reference",
  "swatch_reference",
  "semantic_only",
  "none"
]);

const PRESENTATION_PREFERENCES =
  new Set([
    "masculine_examples",
    "feminine_examples",
    "neutral_examples"
  ]);

function presentationInstruction(
  value
) {
  if (
    value ===
      "masculine_examples"
  ) {
    return [
      "Presentation preference: masculine.",
      "Express the committed target style through masculine styling cues.",
      "Soft, clear, playful, polished, or statement qualities must not by themselves feminize the person's presentation.",
      "Preserve masculine presentation while applying only the committed styling operations."
    ].join(" ");
  }

  if (
    value ===
      "feminine_examples"
  ) {
    return [
      "Presentation preference: feminine.",
      "Express the committed target style through feminine styling cues.",
      "Preserve feminine presentation while applying only the committed styling operations."
    ].join(" ");
  }

  if (
    value ===
      "neutral_examples"
  ) {
    return [
      "Presentation preference: neutral.",
      "Do not impose additional masculine or feminine styling cues beyond the committed operations.",
      "Keep gender-coded presentation changes out of unlisted styling areas."
    ].join(" ");
  }

  return null;
}

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function cleanString(value, maxLength = 480) {
  if (typeof value !== "string") return null;

  const normalized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  return normalized.slice(0, maxLength);
}

function cleanStringList(values, {
  maxItems = 24,
  maxLength = 240
} = {}) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .slice(0, maxItems)
        .map((value) =>
          cleanString(value, maxLength)
        )
        .filter(Boolean)
    )
  ];
}

function stableValue(value, depth = 0) {
  if (depth > 4) return null;

  if (Array.isArray(value)) {
    return value
      .slice(0, 24)
      .map((item) =>
        stableValue(item, depth + 1)
      )
      .filter(
        (item) =>
          item !== null &&
          item !== undefined
      );
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .slice(0, 40)
        .map((key) => [
          cleanString(key, 80),
          stableValue(
            value[key],
            depth + 1
          )
        ])
        .filter(
          ([key, item]) =>
            key &&
            item !== null &&
            item !== undefined
        )
    );
  }

  if (typeof value === "string") {
    return cleanString(value, 240);
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return Number(value.toFixed(4));
  }

  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function serializeStructured(value) {
  const normalized =
    stableValue(value);

  if (
    normalized === null ||
    normalized === undefined
  ) {
    return null;
  }

  if (
    isObject(normalized) &&
    Object.keys(normalized).length === 0
  ) {
    return null;
  }

  if (
    Array.isArray(normalized) &&
    normalized.length === 0
  ) {
    return null;
  }

  return JSON.stringify(normalized);
}

function colorAnchorText(anchor) {
  if (!isObject(anchor)) return null;

  const role =
    cleanString(anchor.role, 64);
  const colorSpace =
    cleanString(
      anchor.colorSpace,
      64
    );
  const anchorId =
    cleanString(anchor.anchorId, 160);

  if (
    !role ||
    !colorSpace ||
    !anchorId
  ) {
    return null;
  }

  if (
    colorSpace === "srgb_hex" &&
    typeof anchor.value === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(
      anchor.value
    )
  ) {
    return `${role} color anchor ${anchorId}: sRGB HEX ${anchor.value.toUpperCase()}`;
  }

  if (
    colorSpace === "cie_lab" &&
    isObject(anchor.value) &&
    Number.isFinite(
      Number(anchor.value.l)
    ) &&
    Number.isFinite(
      Number(anchor.value.a)
    ) &&
    Number.isFinite(
      Number(anchor.value.b)
    )
  ) {
    return [
      `${role} color anchor ${anchorId}: CIE Lab`,
      `L=${Number(anchor.value.l).toFixed(2)}`,
      `a=${Number(anchor.value.a).toFixed(2)}`,
      `b=${Number(anchor.value.b).toFixed(2)}`
    ].join(" ");
  }

  return null;
}

function validateRenderSpec(renderSpec) {
  if (!isObject(renderSpec)) {
    return {
      valid: false,
      reason: "render_spec_not_object"
    };
  }

  if (
    renderSpec.renderSpecVersion !==
    FACE_LAB_RENDER_SPEC_VERSION
  ) {
    return {
      valid: false,
      reason:
        "render_spec_version_mismatch"
    };
  }

  if (
    renderSpec.status !== "ready" ||
    !cleanString(renderSpec.routeId) ||
    !cleanString(renderSpec.lookId)
  ) {
    return {
      valid: false,
      reason: "render_spec_not_ready"
    };
  }

  const presentationPreference =
    cleanString(
      renderSpec
        .presentationPreference,
      80
    );

  if (
    presentationPreference &&
    !PRESENTATION_PREFERENCES.has(
      presentationPreference
    )
  ) {
    return {
      valid: false,
      reason:
        "render_spec_presentation_preference_invalid"
    };
  }

  if (
    renderSpec.providerPayload !== null ||
    renderSpec.imageModelInvoked !== false
  ) {
    return {
      valid: false,
      reason:
        "render_spec_provider_boundary_invalid"
    };
  }

  const identityLock =
    cleanStringList(
      renderSpec.identityLock,
      {
        maxItems: 32,
        maxLength: 80
      }
    );

  if (
    identityLock.length !==
      FACE_LAB_IDENTITY_LOCK.length ||
    FACE_LAB_IDENTITY_LOCK.some(
      (value) =>
        !identityLock.includes(value)
    )
  ) {
    return {
      valid: false,
      reason:
        "render_spec_identity_lock_mismatch"
    };
  }

  if (
    !Array.isArray(
      renderSpec.operations
    ) ||
    !renderSpec.operations.length ||
    renderSpec.operations.length > 24
  ) {
    return {
      valid: false,
      reason:
        "render_spec_operations_invalid"
    };
  }

  const slotKeys = new Set();

  for (
    const operation of
      renderSpec.operations
  ) {
    if (!isObject(operation)) {
      return {
        valid: false,
        reason:
          "render_operation_not_object"
      };
    }

    const slotKey =
      cleanString(
        operation.slotKey,
        80
      );

    if (
      !slotKey ||
      slotKeys.has(slotKey)
    ) {
      return {
        valid: false,
        reason:
          "render_operation_slot_invalid"
      };
    }

    slotKeys.add(slotKey);

    if (
      !SOURCE_MODES.has(
        operation.sourceMode
      )
    ) {
      return {
        valid: false,
        reason:
          "render_operation_source_mode_invalid"
      };
    }

    if (
      !Array.isArray(
        operation.targetRegions
      ) ||
      !operation.targetRegions.length
    ) {
      return {
        valid: false,
        reason:
          "render_operation_regions_invalid"
      };
    }

    if (
      operation.sourceMode ===
        "execution_only" &&
      (
        operation.candidateRef !== null ||
        operation.variantId !== null
      )
    ) {
      return {
        valid: false,
        reason:
          "execution_only_candidate_leak"
      };
    }

    if (
      operation.sourceMode ===
        "candidate_bound" &&
      !cleanString(
        operation.candidateRef,
        240
      )
    ) {
      return {
        valid: false,
        reason:
          "candidate_bound_identity_missing"
      };
    }

    if (
      !isObject(
        operation.colorAuthority
      ) ||
      !COLOR_FIDELITY_STATES.has(
        operation.colorAuthority
          .fidelityState
      ) ||
      operation.colorAuthority
        .renderGuarantee !==
        "not_pixel_exact"
    ) {
      return {
        valid: false,
        reason:
          "render_operation_color_authority_invalid"
      };
    }
  }

  return {
    valid: true,
    reason: null
  };
}

function operationLines(operation, index) {
  const lines = [];
  const slotKey =
    cleanString(
      operation.slotKey,
      80
    );
  const regions =
    cleanStringList(
      operation.targetRegions,
      {
        maxItems: 12,
        maxLength: 80
      }
    );
  const candidateRef =
    cleanString(
      operation.candidateRef,
      240
    );
  const variantId =
    cleanString(
      operation.variantId,
      160
    );

  lines.push(
    `${index + 1}. Slot ${slotKey}; edit only regions: ${regions.join(", ")}.`
  );

  if (
    operation.sourceMode ===
    "candidate_bound"
  ) {
    lines.push(
      `Source mode: candidate-bound. Preserve candidate identity ${candidateRef}${variantId ? `; variant ${variantId}` : ""}.`
    );
  } else {
    lines.push(
      "Source mode: execution-only. This is a general styling-direction visualization, not a claim that a specific commercial product is being reproduced."
    );
  }

  const application =
    isObject(operation.application)
      ? operation.application
      : {};

  const placement =
    cleanStringList(
      application.placement
    );
  const direction =
    cleanStringList(
      application.direction
    );
  const notes =
    cleanStringList(
      application.notes
    );
  const intensity =
    cleanString(
      application.intensity,
      80
    );

  if (placement.length) {
    lines.push(
      `Placement: ${placement.join(" | ")}.`
    );
  }

  if (direction.length) {
    lines.push(
      `Direction: ${direction.join(" | ")}.`
    );
  }

  if (intensity) {
    lines.push(
      `Intensity: ${intensity}.`
    );
  }

  if (notes.length) {
    lines.push(
      `Application notes: ${notes.join(" | ")}.`
    );
  }

  const criteriaText =
    serializeStructured(
      operation.criteria
    );

  if (criteriaText) {
    lines.push(
      `Face Lab criteria: ${criteriaText}.`
    );
  }

  const candidateAttributesText =
    serializeStructured(
      operation.candidateAttributes
    );

  if (candidateAttributesText) {
    lines.push(
      `Governed candidate attributes: ${candidateAttributesText}.`
    );
  }

  const colorAuthority =
    operation.colorAuthority;
  const fidelity =
    colorAuthority.fidelityState;

  lines.push(
    `Color fidelity input state: ${fidelity}; rendered output is not guaranteed pixel-exact.`
  );

  const primaryAnchor =
    colorAnchorText(
      colorAuthority.primaryAnchor
    );

  if (primaryAnchor) {
    const role =
      colorAuthority.primaryAnchor
        .role;

    if (
      role === "applied_reference"
    ) {
      lines.push(
        `Strongest color reference: ${primaryAnchor}. Use it as the closest governed applied-appearance reference while preserving natural integration with the original portrait.`
      );
    } else {
      lines.push(
        `Source swatch reference: ${primaryAnchor}. Use it only as an approximate source-color cue; do not assume it proves exact applied appearance on this person.`
      );
    }
  }

  const alternateAnchors =
    Array.isArray(
      colorAuthority
        .alternateAnchors
    )
      ? colorAuthority
          .alternateAnchors
          .filter(isObject)
      : [];

  const alternates =
    alternateAnchors
      .map(colorAnchorText)
      .filter(Boolean);

  if (alternates.length) {
    lines.push(
      `Secondary color references: ${alternates.join(" | ")}.`
    );

    if (
      alternateAnchors.some(
        (anchor) =>
          anchor.role ===
            "brand_swatch" ||
          anchor.role ===
            "merchant_swatch"
      )
    ) {
      lines.push(
        "Any brand_swatch or merchant_swatch reference above is only an approximate source-color cue; do not assume it proves exact applied appearance on this person."
      );
    }
  }

  const semanticText =
    serializeStructured({
      candidate:
        colorAuthority
          .candidateSemanticAttributes,
      requested:
        colorAuthority
          .requestedSemanticAttributes,
      preferred:
        colorAuthority
          .preferredSemanticAttributes
    });

  if (semanticText) {
    lines.push(
      `Semantic color/finish controls: ${semanticText}.`
    );
  }

  return lines;
}

export function compileFaceLabSimulationInstruction(
  renderSpec
) {
  const validation =
    validateRenderSpec(renderSpec);

  if (!validation.valid) {
    return {
      status: "invalid",
      reason: validation.reason,
      version:
        FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
      instruction: null,
      operationCount: 0
    };
  }

  const identityLock =
    cleanStringList(
      renderSpec.identityLock,
      {
        maxItems: 32,
        maxLength: 80
      }
    );

  const presentationLine =
    presentationInstruction(
      renderSpec
        .presentationPreference
    );

  const header = [
    "Edit the supplied portrait photo. Keep the exact same person and treat the source photo as the identity authority.",
    `Preserve these locked properties: ${identityLock.join(", ")}.`,
    presentationLine,
    "Do not globally beautify, reshape, age, de-age, slim, enlarge, shrink, or alter facial anatomy.",
    "Do not change any styling area that is not explicitly listed below.",
    "Keep the result photorealistic and naturally integrated with the original skin texture, pose, perspective, expression, background, and lighting direction.",
    "Do not add text, labels, borders, watermarks, comparison panels, or UI elements.",
    `Render route ${cleanString(renderSpec.routeId, 160)} and look ${cleanString(renderSpec.lookId, 160)} only.`,
    "Apply the following operations independently and then harmonize them without overriding stronger candidate-bound color references:"
  ];

  const normalizedHeader =
    header.filter(Boolean);

  const operations =
    renderSpec.operations.flatMap(
      (operation, index) =>
        operationLines(
          operation,
          index
        )
    );

  const conflicts =
    cleanStringList(
      renderSpec.conflictsResolved
    );

  const tradeoffs =
    cleanStringList(
      renderSpec.remainingTradeoffs
    );

  const footer = [
    conflicts.length
      ? `Already-resolved look constraints to preserve: ${conflicts.join(" | ")}.`
      : null,
    tradeoffs.length
      ? `Known tradeoffs; do not invent additional edits to compensate for them: ${tradeoffs.join(" | ")}.`
      : null,
    "Final check: the output must still unmistakably be the same person. Only the committed styling operations above may differ from the input portrait."
  ].filter(Boolean);

  const instruction =
    [
      ...normalizedHeader,
      ...operations,
      ...footer
    ].join("\n");

  if (
    instruction.length > 16000
  ) {
    return {
      status: "invalid",
      reason:
        "simulation_instruction_too_large",
      version:
        FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
      instruction: null,
      operationCount: 0
    };
  }

  return {
    status: "ready",
    reason:
      "simulation_instruction_compiled",
    version:
      FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
    instruction,
    operationCount:
      renderSpec.operations.length,
    routeId:
      renderSpec.routeId,
    lookId:
      renderSpec.lookId
  };
}
