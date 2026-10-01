import assert from "node:assert/strict";
import {
  FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
  FACE_LAB_CATALOG_MATCHER_SHADOW_VERSION,
  FACE_LAB_MATCH_ATTRIBUTE_POLICIES,
  matchFaceLabAppearanceSlotCandidatesShadow,
  validateFaceLabCandidateAttributeSnapshot
} from "../lib/face-lab-v2/catalog-matcher-shadow.js";

assert.equal(
  FACE_LAB_CATALOG_MATCHER_SHADOW_VERSION,
  "face-lab-catalog-matcher-shadow-v1"
);
assert.equal(
  FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
  "face-lab-candidate-attribute-snapshot-v1"
);
assert.equal(
  FACE_LAB_MATCH_ATTRIBUTE_POLICIES.finish,
  "overlap_any"
);
assert.equal(
  FACE_LAB_MATCH_ATTRIBUTE_POLICIES.requiredParameters,
  "contains_all"
);

const lipSlot = {
  slotId: "face-lab-appearance-slot:lip_color",
  slotKey: "lip_color",
  requiredCapability: "lip_color",
  acceptedEntityTypes: ["product", "service"],
  sourceDomains: ["makeup"],
  sourceRefs: ["fixture"],
  criteria: {
    requiredAttributes: {
      chroma: "medium",
      opacity: "buildable",
      finish: ["satin", "soft_matte"]
    },
    preferredAttributes: {
      glossLevel: "medium"
    },
    excludedAttributes: {
      undertone: "cool"
    }
  },
  executionCues: {
    placement: ["full lip"],
    direction: ["controlled boundary"],
    intensity: "moderate",
    notes: []
  }
};

function capabilityClaim(overrides = {}) {
  return {
    capabilityKey: "lip_color",
    supportState: "supported",
    proofClass:
      "governed_catalog_attribute_mapping",
    proofVersion:
      "catalog-attribute-mapping-v1",
    evidenceRefs: [
      "catalog_attribute_review:lip-capability"
    ],
    ...overrides
  };
}

function productVariant({
  ref,
  variantId,
  claims = [capabilityClaim()]
}) {
  return {
    candidateRef: ref,
    entityType: "product_variant",
    entityId: "fixture-lip",
    variantId,
    capabilityClaims: claims,
    metadata: {
      category: "lip_color"
    }
  };
}

function snapshot(
  attributes,
  evidencePrefix = "catalog_attribute_review"
) {
  return {
    snapshotVersion:
      FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
    sourceVersion:
      "fixture-attribute-source-v1",
    attributes,
    evidenceRefsByAttribute:
      Object.fromEntries(
        Object.keys(attributes).map(
          (key) => [
            key,
            [
              `${evidencePrefix}:${key}`
            ]
          ]
        )
      )
  };
}

const preferredMatch = {
  candidate: productVariant({
    ref: "product_variant:z-preferred:rose",
    variantId: "rose"
  }),
  attributeSnapshot: snapshot({
    chroma: "medium",
    opacity: "buildable",
    finish: "satin",
    undertone: "warm",
    glossLevel: "medium"
  })
};

const preferredMissing = {
  candidate: productVariant({
    ref: "product_variant:a-basic:rose",
    variantId: "rose-basic"
  }),
  attributeSnapshot: snapshot({
    chroma: "medium",
    opacity: "buildable",
    finish: "soft_matte",
    undertone: "warm"
  })
};

const matched =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: lipSlot,
    candidates: [
      preferredMatch,
      preferredMissing
    ]
  });

assert.equal(matched.status, "matched");
assert.equal(matched.mode, "shadow_only");
assert.equal(matched.publicActivation, false);
assert.equal(matched.rankingApplied, false);
assert.equal(matched.selectedEntityRef, null);
assert.equal(matched.selectedVariantRef, null);
assert.equal(matched.catalogTaxonomyVersion, null);
assert.deepEqual(
  matched.eligibleCandidateRefs,
  [
    "product_variant:a-basic:rose",
    "product_variant:z-preferred:rose"
  ],
  "stable output order must be candidateRef order, not preferred-match ranking"
);

const basicResult = matched.results.find(
  (item) =>
    item.candidateRef ===
    "product_variant:a-basic:rose"
);
const preferredResult = matched.results.find(
  (item) =>
    item.candidateRef ===
    "product_variant:z-preferred:rose"
);

assert.equal(basicResult.status, "eligible");
assert.deepEqual(
  basicResult.preferred.missingKeys,
  ["glossLevel"]
);
assert.equal(preferredResult.status, "eligible");
assert.deepEqual(
  preferredResult.preferred.matchedKeys,
  ["glossLevel"]
);

for (const result of matched.results) {
  for (const forbidden of [
    "score",
    "rank",
    "selected",
    "bindingState",
    "selectedEntityRef",
    "selectedVariantRef"
  ]) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        result,
        forbidden
      ),
      false,
      `shadow candidate result must not expose ranking/binding field: ${forbidden}`
    );
  }
}

const missingRequired =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: lipSlot,
    candidates: [
      {
        candidate: productVariant({
          ref: "product_variant:missing:finish",
          variantId: "missing-finish"
        }),
        attributeSnapshot: snapshot({
          chroma: "medium",
          opacity: "buildable",
          undertone: "warm"
        })
      }
    ]
  });

assert.equal(
  missingRequired.results[0].status,
  "criteria_ineligible"
);
assert.equal(
  missingRequired.results[0].reason,
  "criteria_required_missing"
);
assert.deepEqual(
  missingRequired.results[0].required.missingKeys,
  ["finish"]
);

const requiredMismatch =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: lipSlot,
    candidates: [
      {
        candidate: productVariant({
          ref: "product_variant:mismatch:finish",
          variantId: "mismatch-finish"
        }),
        attributeSnapshot: snapshot({
          chroma: "medium",
          opacity: "buildable",
          finish: "glossy",
          undertone: "warm"
        })
      }
    ]
  });

assert.equal(
  requiredMismatch.results[0].status,
  "criteria_ineligible"
);
assert.equal(
  requiredMismatch.results[0].reason,
  "criteria_required_mismatch"
);
assert.deepEqual(
  requiredMismatch.results[0].required.mismatchedKeys,
  ["finish"]
);

const excludedMatch =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: lipSlot,
    candidates: [
      {
        candidate: productVariant({
          ref: "product_variant:excluded:cool",
          variantId: "excluded-cool"
        }),
        attributeSnapshot: snapshot({
          chroma: "medium",
          opacity: "buildable",
          finish: "satin",
          undertone: "cool"
        })
      }
    ]
  });

assert.equal(
  excludedMatch.results[0].status,
  "criteria_ineligible"
);
assert.equal(
  excludedMatch.results[0].reason,
  "criteria_excluded_match"
);
assert.deepEqual(
  excludedMatch.results[0].excluded.mismatchedKeys,
  ["undertone"]
);

const excludedUnknown =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: lipSlot,
    candidates: [
      {
        candidate: productVariant({
          ref: "product_variant:unknown:undertone",
          variantId: "unknown-undertone"
        }),
        attributeSnapshot: snapshot({
          chroma: "medium",
          opacity: "buildable",
          finish: "satin"
        })
      }
    ]
  });

assert.equal(
  excludedUnknown.results[0].status,
  "criteria_unresolved"
);
assert.equal(
  excludedUnknown.results[0].reason,
  "criteria_unresolved"
);
assert.deepEqual(
  excludedUnknown.results[0].excluded.unresolvedKeys,
  ["undertone"],
  "missing evidence for an exclusion must not be treated as proof that the candidate is safe"
);

const noCapability =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: lipSlot,
    candidates: [
      {
        candidate: productVariant({
          ref: "product_variant:no-capability:01",
          variantId: "no-capability",
          claims: []
        }),
        attributeSnapshot: snapshot({
          chroma: "medium",
          opacity: "buildable",
          finish: "satin",
          undertone: "warm"
        })
      }
    ]
  });

assert.equal(
  noCapability.results[0].status,
  "capability_ineligible"
);
assert.equal(
  noCapability.results[0].reason,
  "capability_claim_missing"
);

const unknownAttributeSnapshot =
  validateFaceLabCandidateAttributeSnapshot({
    snapshotVersion:
      FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
    attributes: {
      magicGlowScore: "extreme"
    },
    evidenceRefsByAttribute: {
      magicGlowScore: [
        "catalog_attribute_review:magic"
      ]
    }
  });

assert.equal(
  unknownAttributeSnapshot.valid,
  false
);
assert.equal(
  unknownAttributeSnapshot.reason,
  "attribute_snapshot_unknown_attribute"
);

const missingEvidenceSnapshot =
  validateFaceLabCandidateAttributeSnapshot({
    snapshotVersion:
      FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
    attributes: {
      finish: "satin"
    },
    evidenceRefsByAttribute: {}
  });

assert.equal(
  missingEvidenceSnapshot.valid,
  false
);
assert.equal(
  missingEvidenceSnapshot.reason,
  "attribute_snapshot_missing_evidence"
);

const malformedEvidenceSnapshot =
  validateFaceLabCandidateAttributeSnapshot({
    snapshotVersion:
      FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
    attributes: {
      finish: "satin"
    },
    evidenceRefsByAttribute: {
      finish: ["not-namespaced"]
    }
  });

assert.equal(
  malformedEvidenceSnapshot.valid,
  false
);
assert.equal(
  malformedEvidenceSnapshot.reason,
  "attribute_snapshot_malformed_evidence_ref"
);

const orphanEvidenceSnapshot =
  validateFaceLabCandidateAttributeSnapshot({
    snapshotVersion:
      FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
    attributes: {
      finish: "satin"
    },
    evidenceRefsByAttribute: {
      finish: [
        "catalog_attribute_review:finish"
      ],
      chroma: [
        "catalog_attribute_review:orphan"
      ]
    }
  });

assert.equal(
  orphanEvidenceSnapshot.valid,
  false
);
assert.equal(
  orphanEvidenceSnapshot.reason,
  "attribute_snapshot_orphan_evidence"
);

const unknownCriterionSlot = {
  ...lipSlot,
  criteria: {
    ...lipSlot.criteria,
    requiredAttributes: {
      ...lipSlot.criteria.requiredAttributes,
      magicGlowScore: "extreme"
    }
  }
};

const unresolvedCriterion =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: unknownCriterionSlot,
    candidates: [preferredMatch]
  });

assert.equal(
  unresolvedCriterion.results[0].status,
  "criteria_unresolved"
);
assert.deepEqual(
  unresolvedCriterion.results[0].required.unresolvedKeys,
  ["magicGlowScore"]
);

const tamperedSlot =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: {
      ...lipSlot,
      requiredCapability: "hair_shape"
    },
    candidates: [preferredMatch]
  });

assert.equal(tamperedSlot.status, "invalid_slot");
assert.equal(
  tamperedSlot.reason,
  "appearance_slot_capability_mismatch"
);

const duplicateRef =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: lipSlot,
    candidates: [
      preferredMatch,
      structuredClone(preferredMatch)
    ]
  });

assert.equal(duplicateRef.status, "invalid_input");
assert.equal(
  duplicateRef.reason,
  "duplicate_candidate_ref"
);

const malformedCollection =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: lipSlot,
    candidates: {}
  });

assert.equal(
  malformedCollection.status,
  "invalid_input"
);
assert.equal(
  malformedCollection.reason,
  "candidate_collection_not_array"
);

const hairSlot = {
  slotId: "face-lab-appearance-slot:hair_shape",
  slotKey: "hair_shape",
  requiredCapability: "hair_shape",
  acceptedEntityTypes: [
    "product",
    "style_reference",
    "service"
  ],
  sourceDomains: ["hair"],
  sourceRefs: ["fixture"],
  criteria: {
    requiredAttributes: {},
    preferredAttributes: {
      styleKeys: ["soft-curve-layers"],
      requiredParameters: [
        "curvature",
        "light_layers"
      ]
    },
    excludedAttributes: {}
  },
  executionCues: {
    placement: [],
    direction: [],
    intensity: null,
    notes: []
  }
};

const hairReference = {
  candidate: {
    candidateRef:
      "style_reference:soft-curve-layers",
    entityType: "style_reference",
    entityId: "soft-curve-layers",
    capabilityClaims: [
      {
        capabilityKey: "hair_shape",
        supportState: "supported",
        proofClass:
          "style_reference_definition",
        proofVersion:
          "style-reference-definition-v1",
        evidenceRefs: [
          "style_reference_definition:soft-curve-layers"
        ]
      }
    ]
  },
  attributeSnapshot: snapshot({
    styleKeys: [
      "soft-curve-layers"
    ],
    requiredParameters: [
      "curvature",
      "light_layers",
      "side_volume"
    ]
  }, "style_reference_definition")
};

const hairMatched =
  matchFaceLabAppearanceSlotCandidatesShadow({
    slot: hairSlot,
    candidates: [hairReference]
  });

assert.equal(hairMatched.status, "matched");
assert.equal(
  hairMatched.results[0].status,
  "eligible"
);
assert.deepEqual(
  hairMatched.results[0].preferred.matchedKeys,
  ["styleKeys", "requiredParameters"]
);

console.log(JSON.stringify({
  ok: true,
  matcherVersion:
    FACE_LAB_CATALOG_MATCHER_SHADOW_VERSION,
  attributeSnapshotVersion:
    FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
  checked: [
    "capability_gate",
    "attribute_snapshot_authority",
    "unknown_attribute_fail_closed",
    "attribute_evidence_required",
    "required_missing_fail_closed",
    "required_mismatch_fail_closed",
    "excluded_match_fail_closed",
    "excluded_missing_unresolved",
    "preferred_diagnostic_only",
    "stable_non_ranked_order",
    "slot_registry_authority",
    "duplicate_candidate_fail_closed",
    "no_binding",
    "no_ranking",
    "style_reference_matching"
  ]
}, null, 2));
