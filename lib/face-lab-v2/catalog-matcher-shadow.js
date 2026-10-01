import {
  evaluateFaceLabCandidateCapability
} from "./candidate-capability.js";
import {
  getFaceLabAppearanceSlotDefinition
} from "./appearance-registry.js";

export const FACE_LAB_CATALOG_MATCHER_SHADOW_VERSION =
  "face-lab-catalog-matcher-shadow-v1";

export const FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION =
  "face-lab-candidate-attribute-snapshot-v1";

export const FACE_LAB_MATCH_ATTRIBUTE_POLICIES = Object.freeze({
  hueFamily: "exact_or_member",
  undertone: "exact_or_member",
  depth: "exact_or_member",
  chroma: "exact_or_member",
  opacity: "exact_or_member",
  finish: "overlap_any",
  glossLevel: "exact_or_member",
  blurLevel: "exact_or_member",
  shimmerLevel: "exact_or_member",
  diffusion: "exact_or_member",
  buildability: "exact_or_member",
  temperatureDirection: "exact_or_member",
  depthDirection: "exact_or_member",
  chromaDirection: "exact_or_member",
  contrastDirection: "exact_or_member",
  styleKeys: "overlap_any",
  requiredParameters: "contains_all",
  preferredFamilies: "overlap_any"
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

function normalizeScalar(value) {
  if (typeof value === "string") {
    return cleanString(value);
  }
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function normalizeAttributeValue(value) {
  if (Array.isArray(value)) {
    const normalized = value
      .map(normalizeScalar)
      .filter((item) => item !== null);

    if (!normalized.length) return null;

    return [
      ...new Map(
        normalized.map((item) => [
          JSON.stringify(item),
          item
        ])
      ).values()
    ];
  }

  return normalizeScalar(value);
}

function normalizeEvidenceRefs(values) {
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

function matcherBase({
  status,
  reason,
  slotKey = null,
  candidateCount = 0,
  results = []
}) {
  return {
    matcherVersion:
      FACE_LAB_CATALOG_MATCHER_SHADOW_VERSION,
    mode: "shadow_only",
    publicActivation: false,
    rankingApplied: false,
    slotKey,
    status,
    reason,
    candidateCount,
    eligibleCandidateRefs: [],
    results,
    selectedEntityRef: null,
    selectedVariantRef: null,
    catalogTaxonomyVersion: null
  };
}

function invalidSnapshot(reason) {
  return {
    valid: false,
    reason,
    snapshot: null
  };
}

export function validateFaceLabCandidateAttributeSnapshot(
  snapshot
) {
  if (!isObject(snapshot)) {
    return invalidSnapshot(
      "attribute_snapshot_not_object"
    );
  }

  if (
    snapshot.snapshotVersion !==
    FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION
  ) {
    return invalidSnapshot(
      "attribute_snapshot_version_mismatch"
    );
  }

  if (!isObject(snapshot.attributes)) {
    return invalidSnapshot(
      "attribute_snapshot_attributes_not_object"
    );
  }

  if (!isObject(snapshot.evidenceRefsByAttribute)) {
    return invalidSnapshot(
      "attribute_snapshot_evidence_not_object"
    );
  }

  const attributes = {};
  const evidenceRefsByAttribute = {};

  for (
    const [key, rawValue] of
      Object.entries(snapshot.attributes)
  ) {
    if (
      !Object.prototype.hasOwnProperty.call(
        FACE_LAB_MATCH_ATTRIBUTE_POLICIES,
        key
      )
    ) {
      return invalidSnapshot(
        "attribute_snapshot_unknown_attribute"
      );
    }

    const value =
      normalizeAttributeValue(rawValue);

    if (value === null) {
      return invalidSnapshot(
        "attribute_snapshot_invalid_value"
      );
    }

    const refs = normalizeEvidenceRefs(
      snapshot.evidenceRefsByAttribute[key]
    );

    if (!refs.length) {
      return invalidSnapshot(
        "attribute_snapshot_missing_evidence"
      );
    }

    if (!refs.every(isNamespacedEvidenceRef)) {
      return invalidSnapshot(
        "attribute_snapshot_malformed_evidence_ref"
      );
    }

    attributes[key] = value;
    evidenceRefsByAttribute[key] = refs;
  }

  for (
    const evidenceKey of
      Object.keys(
        snapshot.evidenceRefsByAttribute
      )
  ) {
    if (
      !Object.prototype.hasOwnProperty.call(
        attributes,
        evidenceKey
      )
    ) {
      return invalidSnapshot(
        "attribute_snapshot_orphan_evidence"
      );
    }
  }

  return {
    valid: true,
    reason: null,
    snapshot: {
      snapshotVersion:
        FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
      sourceVersion:
        cleanString(snapshot.sourceVersion),
      attributes,
      evidenceRefsByAttribute
    }
  };
}

function asList(value) {
  return Array.isArray(value)
    ? value
    : [value];
}

function stableEqual(left, right) {
  return JSON.stringify(left) ===
    JSON.stringify(right);
}

function valueMatches(
  policy,
  requirement,
  candidateValue
) {
  const required = asList(requirement);
  const candidate = asList(candidateValue);

  if (policy === "exact_or_member") {
    if (required.length !== 1) {
      return required.some((item) =>
        candidate.some((value) =>
          stableEqual(item, value)
        )
      );
    }

    return candidate.some((value) =>
      stableEqual(required[0], value)
    );
  }

  if (policy === "overlap_any") {
    return required.some((item) =>
      candidate.some((value) =>
        stableEqual(item, value)
      )
    );
  }

  if (policy === "contains_all") {
    return required.every((item) =>
      candidate.some((value) =>
        stableEqual(item, value)
      )
    );
  }

  return false;
}

function emptyCriteriaDiagnostic() {
  return {
    matchedKeys: [],
    missingKeys: [],
    mismatchedKeys: [],
    unresolvedKeys: []
  };
}

function evaluateCriteriaGroup({
  group,
  criteria,
  attributes
}) {
  const diagnostic =
    emptyCriteriaDiagnostic();

  const entries = isObject(criteria)
    ? Object.entries(criteria)
    : [];

  for (
    const [key, rawRequirement] of entries
  ) {
    const policy =
      FACE_LAB_MATCH_ATTRIBUTE_POLICIES[key];

    if (!policy) {
      diagnostic.unresolvedKeys.push(key);
      continue;
    }

    const requirement =
      normalizeAttributeValue(rawRequirement);

    if (requirement === null) {
      diagnostic.unresolvedKeys.push(key);
      continue;
    }

    const hasCandidateValue =
      Object.prototype.hasOwnProperty.call(
        attributes,
        key
      );

    if (!hasCandidateValue) {
      if (group === "preferred") {
        diagnostic.missingKeys.push(key);
      } else if (group === "excluded") {
        diagnostic.unresolvedKeys.push(key);
      } else {
        diagnostic.missingKeys.push(key);
      }
      continue;
    }

    const matched = valueMatches(
      policy,
      requirement,
      attributes[key]
    );

    if (group === "excluded") {
      if (matched) {
        diagnostic.mismatchedKeys.push(key);
      } else {
        diagnostic.matchedKeys.push(key);
      }
      continue;
    }

    if (matched) {
      diagnostic.matchedKeys.push(key);
    } else {
      diagnostic.mismatchedKeys.push(key);
    }
  }

  return diagnostic;
}

function evidenceForKeys(snapshot, keys) {
  return [
    ...new Set(
      keys.flatMap(
        (key) =>
          snapshot
            .evidenceRefsByAttribute[key] ||
          []
      )
    )
  ];
}

function candidateResultBase({
  candidateRef,
  entityType,
  status,
  reason,
  capability
}) {
  return {
    candidateRef:
      cleanString(candidateRef),
    entityType:
      cleanString(entityType),
    status,
    reason,
    capability,
    required: emptyCriteriaDiagnostic(),
    excluded: emptyCriteriaDiagnostic(),
    preferred: emptyCriteriaDiagnostic(),
    evidenceRefs: []
  };
}

function matchCandidate({
  slot,
  record
}) {
  const candidate = record?.candidate;
  const capability =
    evaluateFaceLabCandidateCapability({
      slot,
      candidate
    });

  const base = candidateResultBase({
    candidateRef:
      candidate?.candidateRef,
    entityType:
      candidate?.entityType,
    status: "invalid",
    reason: null,
    capability
  });

  if (capability.status === "invalid") {
    return {
      ...base,
      status: "invalid",
      reason:
        "candidate_capability_invalid"
    };
  }

  if (capability.status !== "eligible") {
    return {
      ...base,
      status: "capability_ineligible",
      reason: capability.reason,
      evidenceRefs:
        capability.evidenceRefs || []
    };
  }

  const snapshotResult =
    validateFaceLabCandidateAttributeSnapshot(
      record?.attributeSnapshot
    );

  if (!snapshotResult.valid) {
    return {
      ...base,
      status: "invalid",
      reason: snapshotResult.reason,
      evidenceRefs:
        capability.evidenceRefs || []
    };
  }

  const snapshot =
    snapshotResult.snapshot;

  const required =
    evaluateCriteriaGroup({
      group: "required",
      criteria:
        slot.criteria?.requiredAttributes,
      attributes: snapshot.attributes
    });

  const excluded =
    evaluateCriteriaGroup({
      group: "excluded",
      criteria:
        slot.criteria?.excludedAttributes,
      attributes: snapshot.attributes
    });

  const preferred =
    evaluateCriteriaGroup({
      group: "preferred",
      criteria:
        slot.criteria?.preferredAttributes,
      attributes: snapshot.attributes
    });

  const hardKeys = [
    ...required.matchedKeys,
    ...required.missingKeys,
    ...required.mismatchedKeys,
    ...excluded.matchedKeys,
    ...excluded.mismatchedKeys
  ];

  const preferredEvidenceKeys = [
    ...preferred.matchedKeys,
    ...preferred.mismatchedKeys
  ];

  const evidenceRefs = [
    ...new Set([
      ...(capability.evidenceRefs || []),
      ...evidenceForKeys(
        snapshot,
        [
          ...hardKeys,
          ...preferredEvidenceKeys
        ]
      )
    ])
  ];

  const unresolved = [
    ...required.unresolvedKeys,
    ...excluded.unresolvedKeys
  ];

  if (unresolved.length) {
    return {
      ...base,
      status: "criteria_unresolved",
      reason: "criteria_unresolved",
      required,
      excluded,
      preferred,
      evidenceRefs
    };
  }

  if (required.missingKeys.length) {
    return {
      ...base,
      status: "criteria_ineligible",
      reason: "criteria_required_missing",
      required,
      excluded,
      preferred,
      evidenceRefs
    };
  }

  if (required.mismatchedKeys.length) {
    return {
      ...base,
      status: "criteria_ineligible",
      reason: "criteria_required_mismatch",
      required,
      excluded,
      preferred,
      evidenceRefs
    };
  }

  if (excluded.mismatchedKeys.length) {
    return {
      ...base,
      status: "criteria_ineligible",
      reason: "criteria_excluded_match",
      required,
      excluded,
      preferred,
      evidenceRefs
    };
  }

  return {
    ...base,
    status: "eligible",
    reason: "shadow_criteria_matched",
    required,
    excluded,
    preferred,
    evidenceRefs
  };
}

function resolveSlot(slot) {
  const slotKey =
    typeof slot === "string"
      ? cleanString(slot)
      : cleanString(slot?.slotKey);

  if (!slotKey) {
    return {
      valid: false,
      reason: "missing_slot_key",
      slot: null
    };
  }

  const definition =
    getFaceLabAppearanceSlotDefinition(
      slotKey
    );

  if (!definition) {
    return {
      valid: false,
      reason: "unknown_slot_key",
      slot: null
    };
  }

  if (!isObject(slot)) {
    return {
      valid: false,
      reason:
        "appearance_slot_instance_required",
      slot: null
    };
  }

  if (
    cleanString(slot.slotId) !==
    definition.slotId
  ) {
    return {
      valid: false,
      reason: "appearance_slot_id_mismatch",
      slot: null
    };
  }

  if (
    cleanString(slot.requiredCapability) !==
    definition.requiredCapability
  ) {
    return {
      valid: false,
      reason:
        "appearance_slot_capability_mismatch",
      slot: null
    };
  }

  return {
    valid: true,
    reason: null,
    slot
  };
}

export function matchFaceLabAppearanceSlotCandidatesShadow({
  slot,
  candidates
} = {}) {
  const slotResult = resolveSlot(slot);

  if (!slotResult.valid) {
    return matcherBase({
      status: "invalid_slot",
      reason: slotResult.reason
    });
  }

  if (!Array.isArray(candidates)) {
    return matcherBase({
      status: "invalid_input",
      reason: "candidate_collection_not_array",
      slotKey: slotResult.slot.slotKey
    });
  }

  const refs = candidates
    .map((record) =>
      cleanString(
        record?.candidate?.candidateRef
      )
    )
    .filter(Boolean);

  if (
    new Set(refs).size !== refs.length
  ) {
    return matcherBase({
      status: "invalid_input",
      reason: "duplicate_candidate_ref",
      slotKey: slotResult.slot.slotKey,
      candidateCount: candidates.length
    });
  }

  const results = candidates
    .map((record, index) => ({
      index,
      result: matchCandidate({
        slot: slotResult.slot,
        record
      })
    }))
    .sort((left, right) => {
      const leftRef =
        left.result.candidateRef || "";
      const rightRef =
        right.result.candidateRef || "";

      const compared =
        leftRef.localeCompare(rightRef);

      return compared || left.index - right.index;
    })
    .map((entry) => entry.result);

  const eligibleCandidateRefs =
    results
      .filter(
        (result) =>
          result.status === "eligible"
      )
      .map(
        (result) => result.candidateRef
      )
      .filter(Boolean);

  return {
    ...matcherBase({
      status:
        eligibleCandidateRefs.length
          ? "matched"
          : "no_eligible_candidates",
      reason:
        eligibleCandidateRefs.length
          ? "shadow_candidates_available"
          : "no_shadow_candidate_passed",
      slotKey:
        slotResult.slot.slotKey,
      candidateCount: candidates.length,
      results
    }),
    eligibleCandidateRefs
  };
}
