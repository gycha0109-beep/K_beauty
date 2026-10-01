import {
  getFaceLabAppearanceSlotDefinition,
  isFaceLabStyleCapability
} from "./appearance-registry.js";

export const FACE_LAB_CANDIDATE_CAPABILITY_CONTRACT_VERSION =
  "face-lab-candidate-capability-contract-v1";

export const FACE_LAB_CANDIDATE_ENTITY_TYPES = Object.freeze([
  "product",
  "product_variant",
  "style_reference",
  "service",
  "color_palette"
]);

export const FACE_LAB_CANDIDATE_SUPPORT_STATES = Object.freeze([
  "supported",
  "unsupported"
]);

export const FACE_LAB_CANDIDATE_PROOF_CLASSES = Object.freeze([
  "governed_product_fact_mapping",
  "governed_catalog_attribute_mapping",
  "curated_capability_mapping",
  "style_reference_definition",
  "service_definition",
  "palette_definition"
]);

export const FACE_LAB_FORBIDDEN_CANDIDATE_PROOF_CLASSES = Object.freeze([
  "category_inference",
  "commerce_label_inference",
  "marketing_copy_inference"
]);

const ENTITY_TYPES = new Set(FACE_LAB_CANDIDATE_ENTITY_TYPES);
const SUPPORT_STATES = new Set(FACE_LAB_CANDIDATE_SUPPORT_STATES);
const PROOF_CLASSES = new Set(FACE_LAB_CANDIDATE_PROOF_CLASSES);
const FORBIDDEN_PROOF_CLASSES =
  new Set(FACE_LAB_FORBIDDEN_CANDIDATE_PROOF_CLASSES);

const PROOF_CLASSES_BY_ENTITY_TYPE = Object.freeze({
  product: new Set([
    "governed_product_fact_mapping",
    "governed_catalog_attribute_mapping",
    "curated_capability_mapping"
  ]),
  product_variant: new Set([
    "governed_product_fact_mapping",
    "governed_catalog_attribute_mapping",
    "curated_capability_mapping"
  ]),
  style_reference: new Set([
    "style_reference_definition",
    "curated_capability_mapping"
  ]),
  service: new Set([
    "service_definition",
    "curated_capability_mapping"
  ]),
  color_palette: new Set([
    "palette_definition",
    "curated_capability_mapping"
  ])
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

function isNamespacedEvidenceRef(value) {
  const normalized = cleanString(value);
  if (!normalized) return false;
  return /^[a-z0-9][a-z0-9._-]*:[^\s]+$/i.test(normalized);
}

function compatibilityEntityType(entityType) {
  return entityType === "product_variant"
    ? "product"
    : entityType;
}

function invalidCandidate(reason, details = {}) {
  return {
    valid: false,
    reason,
    candidate: null,
    ...details
  };
}

function validCandidate(candidate) {
  return {
    valid: true,
    reason: null,
    candidate
  };
}

function normalizeClaim(claim) {
  if (!isObject(claim)) {
    return {
      valid: false,
      reason: "claim_not_object",
      claim: null
    };
  }

  const capabilityKey = cleanString(claim.capabilityKey);
  const supportState = cleanString(claim.supportState);
  const proofClass = cleanString(claim.proofClass);
  const proofVersion = cleanString(claim.proofVersion);
  const evidenceRefs = cleanStringList(claim.evidenceRefs);

  if (!capabilityKey || !isFaceLabStyleCapability(capabilityKey)) {
    return {
      valid: false,
      reason: "unknown_capability_key",
      claim: null
    };
  }

  if (!supportState || !SUPPORT_STATES.has(supportState)) {
    return {
      valid: false,
      reason: "invalid_support_state",
      claim: null
    };
  }

  if (!proofClass) {
    return {
      valid: false,
      reason: "missing_proof_class",
      claim: null
    };
  }

  if (FORBIDDEN_PROOF_CLASSES.has(proofClass)) {
    return {
      valid: false,
      reason: "forbidden_proof_class",
      claim: null
    };
  }

  if (!PROOF_CLASSES.has(proofClass)) {
    return {
      valid: false,
      reason: "unknown_proof_class",
      claim: null
    };
  }

  if (!proofVersion) {
    return {
      valid: false,
      reason: "missing_proof_version",
      claim: null
    };
  }

  if (!evidenceRefs.length) {
    return {
      valid: false,
      reason: "missing_capability_evidence",
      claim: null
    };
  }

  if (!evidenceRefs.every(isNamespacedEvidenceRef)) {
    return {
      valid: false,
      reason: "malformed_capability_evidence_ref",
      claim: null
    };
  }

  return {
    valid: true,
    reason: null,
    claim: {
      capabilityKey,
      supportState,
      proofClass,
      proofVersion,
      evidenceRefs,
      qualifiers: isObject(claim.qualifiers)
        ? structuredClone(claim.qualifiers)
        : {}
    }
  };
}

export function validateFaceLabCandidateCapabilityCandidate(candidate) {
  if (!isObject(candidate)) {
    return invalidCandidate("candidate_not_object");
  }

  const candidateRef = cleanString(candidate.candidateRef);
  const entityType = cleanString(candidate.entityType);
  const entityId = cleanString(candidate.entityId);
  const variantId = cleanString(candidate.variantId);

  if (!candidateRef) {
    return invalidCandidate("missing_candidate_ref");
  }

  if (!entityType || !ENTITY_TYPES.has(entityType)) {
    return invalidCandidate("unknown_entity_type");
  }

  if (!entityId) {
    return invalidCandidate("missing_entity_id");
  }

  if (entityType === "product_variant" && !variantId) {
    return invalidCandidate("missing_variant_id");
  }

  if (entityType !== "product_variant" && variantId) {
    return invalidCandidate("variant_id_without_product_variant");
  }

  const rawClaims = Array.isArray(candidate.capabilityClaims)
    ? candidate.capabilityClaims
    : [];

  const claims = [];

  for (const rawClaim of rawClaims) {
    const normalized = normalizeClaim(rawClaim);

    if (!normalized.valid) {
      return invalidCandidate(
        normalized.reason,
        {
          invalidCapabilityClaim: structuredClone(rawClaim)
        }
      );
    }

    const permitted =
      PROOF_CLASSES_BY_ENTITY_TYPE[entityType];

    if (!permitted?.has(normalized.claim.proofClass)) {
      return invalidCandidate(
        "proof_class_entity_type_mismatch",
        {
          invalidCapabilityClaim: normalized.claim
        }
      );
    }

    claims.push(normalized.claim);
  }

  return validCandidate({
    candidateRef,
    entityType,
    entityId,
    variantId:
      entityType === "product_variant"
        ? variantId
        : null,
    compatibilityEntityType:
      compatibilityEntityType(entityType),
    capabilityClaims: claims,
    metadata: isObject(candidate.metadata)
      ? structuredClone(candidate.metadata)
      : {}
  });
}

function evaluationBase({
  status,
  reason,
  slotKey = null,
  requiredCapability = null,
  candidateRef = null,
  entityType = null
}) {
  return {
    contractVersion:
      FACE_LAB_CANDIDATE_CAPABILITY_CONTRACT_VERSION,
    status,
    reason,
    slotKey,
    requiredCapability,
    candidateRef,
    entityType,
    proofClasses: [],
    proofVersions: [],
    evidenceRefs: []
  };
}

function resolveSlot(slot) {
  const slotKey =
    typeof slot === "string"
      ? cleanString(slot)
      : cleanString(slot?.slotKey);

  if (!slotKey) {
    return {
      definition: null,
      reason: "missing_slot_key"
    };
  }

  const definition =
    getFaceLabAppearanceSlotDefinition(slotKey);

  if (!definition) {
    return {
      definition: null,
      reason: "unknown_slot_key"
    };
  }

  return {
    definition,
    reason: null
  };
}

export function evaluateFaceLabCandidateCapability({
  slot,
  candidate
} = {}) {
  const slotResult = resolveSlot(slot);

  if (!slotResult.definition) {
    return evaluationBase({
      status: "invalid",
      reason: slotResult.reason
    });
  }

  const definition = slotResult.definition;
  const candidateResult =
    validateFaceLabCandidateCapabilityCandidate(candidate);

  if (!candidateResult.valid) {
    return {
      ...evaluationBase({
        status: "invalid",
        reason: candidateResult.reason,
        slotKey: definition.slotKey,
        requiredCapability:
          definition.requiredCapability,
        candidateRef:
          cleanString(candidate?.candidateRef),
        entityType:
          cleanString(candidate?.entityType)
      }),
      invalidCapabilityClaim:
        candidateResult.invalidCapabilityClaim || null
    };
  }

  const normalized = candidateResult.candidate;
  const acceptedEntityTypes =
    new Set(definition.acceptedEntityTypes);

  if (
    !acceptedEntityTypes.has(
      normalized.compatibilityEntityType
    )
  ) {
    return evaluationBase({
      status: "ineligible",
      reason: "entity_type_not_accepted",
      slotKey: definition.slotKey,
      requiredCapability:
        definition.requiredCapability,
      candidateRef: normalized.candidateRef,
      entityType: normalized.entityType
    });
  }

  const relevantClaims =
    normalized.capabilityClaims.filter(
      (claim) =>
        claim.capabilityKey ===
        definition.requiredCapability
    );

  if (!relevantClaims.length) {
    return evaluationBase({
      status: "ineligible",
      reason: "capability_claim_missing",
      slotKey: definition.slotKey,
      requiredCapability:
        definition.requiredCapability,
      candidateRef: normalized.candidateRef,
      entityType: normalized.entityType
    });
  }

  const states =
    new Set(
      relevantClaims.map(
        (claim) => claim.supportState
      )
    );

  if (
    states.has("supported") &&
    states.has("unsupported")
  ) {
    return evaluationBase({
      status: "ineligible",
      reason: "capability_claim_conflict",
      slotKey: definition.slotKey,
      requiredCapability:
        definition.requiredCapability,
      candidateRef: normalized.candidateRef,
      entityType: normalized.entityType
    });
  }

  if (states.has("unsupported")) {
    return evaluationBase({
      status: "ineligible",
      reason: "capability_explicitly_unsupported",
      slotKey: definition.slotKey,
      requiredCapability:
        definition.requiredCapability,
      candidateRef: normalized.candidateRef,
      entityType: normalized.entityType
    });
  }

  const supportedClaims =
    relevantClaims.filter(
      (claim) =>
        claim.supportState === "supported"
    );

  const proofClasses = [
    ...new Set(
      supportedClaims.map(
        (claim) => claim.proofClass
      )
    )
  ];

  const proofVersions = [
    ...new Set(
      supportedClaims.map(
        (claim) => claim.proofVersion
      )
    )
  ];

  const evidenceRefs = [
    ...new Set(
      supportedClaims.flatMap(
        (claim) => claim.evidenceRefs
      )
    )
  ];

  return {
    ...evaluationBase({
      status: "eligible",
      reason: "capability_supported",
      slotKey: definition.slotKey,
      requiredCapability:
        definition.requiredCapability,
      candidateRef: normalized.candidateRef,
      entityType: normalized.entityType
    }),
    proofClasses,
    proofVersions,
    evidenceRefs
  };
}
