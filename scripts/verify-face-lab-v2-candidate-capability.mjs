import assert from "node:assert/strict";
import {
  FACE_LAB_CANDIDATE_CAPABILITY_CONTRACT_VERSION,
  FACE_LAB_CANDIDATE_ENTITY_TYPES,
  FACE_LAB_CANDIDATE_PROOF_CLASSES,
  FACE_LAB_FORBIDDEN_CANDIDATE_PROOF_CLASSES,
  evaluateFaceLabCandidateCapability,
  validateFaceLabCandidateCapabilityCandidate
} from "../lib/face-lab-v2/candidate-capability.js";

assert.equal(
  FACE_LAB_CANDIDATE_CAPABILITY_CONTRACT_VERSION,
  "face-lab-candidate-capability-contract-v1"
);

assert.deepEqual(
  FACE_LAB_CANDIDATE_ENTITY_TYPES,
  [
    "product",
    "product_variant",
    "style_reference",
    "service",
    "color_palette"
  ]
);

assert.ok(
  FACE_LAB_CANDIDATE_PROOF_CLASSES.includes(
    "governed_product_fact_mapping"
  )
);
assert.ok(
  FACE_LAB_CANDIDATE_PROOF_CLASSES.includes(
    "style_reference_definition"
  )
);
assert.ok(
  FACE_LAB_FORBIDDEN_CANDIDATE_PROOF_CLASSES.includes(
    "category_inference"
  )
);

function claim({
  capabilityKey,
  supportState = "supported",
  proofClass = "curated_capability_mapping",
  proofVersion = "fixture-proof-v1",
  evidenceRefs = ["curated_mapping:fixture-1"]
}) {
  return {
    capabilityKey,
    supportState,
    proofClass,
    proofVersion,
    evidenceRefs
  };
}

function candidate(overrides = {}) {
  return {
    candidateRef: "product:fixture-product",
    entityType: "product",
    entityId: "fixture-product",
    capabilityClaims: [],
    metadata: {},
    ...overrides
  };
}

const lipVariant = candidate({
  candidateRef:
    "product_variant:fixture-lip:rosewood",
  entityType: "product_variant",
  entityId: "fixture-lip",
  variantId: "rosewood",
  capabilityClaims: [
    claim({
      capabilityKey: "lip_color",
      proofClass:
        "governed_catalog_attribute_mapping",
      proofVersion:
        "catalog-attribute-mapping-v1",
      evidenceRefs: [
        "catalog_attribute_review:fixture-lip-rosewood"
      ]
    })
  ],
  metadata: {
    category: "lip_color",
    storefrontLabel: "Rosewood Glow"
  }
});

const lipEligibility =
  evaluateFaceLabCandidateCapability({
    slot: "lip_color",
    candidate: lipVariant
  });

assert.deepEqual(
  {
    status: lipEligibility.status,
    reason: lipEligibility.reason,
    slotKey: lipEligibility.slotKey,
    requiredCapability:
      lipEligibility.requiredCapability,
    candidateRef: lipEligibility.candidateRef,
    entityType: lipEligibility.entityType
  },
  {
    status: "eligible",
    reason: "capability_supported",
    slotKey: "lip_color",
    requiredCapability: "lip_color",
    candidateRef:
      "product_variant:fixture-lip:rosewood",
    entityType: "product_variant"
  },
  "product_variant must inherit product slot compatibility without losing variant identity"
);
assert.deepEqual(
  lipEligibility.evidenceRefs,
  [
    "catalog_attribute_review:fixture-lip-rosewood"
  ]
);
assert.deepEqual(
  lipEligibility.proofClasses,
  ["governed_catalog_attribute_mapping"]
);

const missingClaim =
  evaluateFaceLabCandidateCapability({
    slot: "eye_color",
    candidate: lipVariant
  });
assert.equal(missingClaim.status, "ineligible");
assert.equal(
  missingClaim.reason,
  "capability_claim_missing"
);

const categoryOnly =
  evaluateFaceLabCandidateCapability({
    slot: "lip_color",
    candidate: candidate({
      metadata: {
        category: "lip_color",
        catalogTaxonomyCapability:
          "shade_variant"
      }
    })
  });

assert.equal(categoryOnly.status, "ineligible");
assert.equal(
  categoryOnly.reason,
  "capability_claim_missing",
  "catalog category/capability metadata must not manufacture Face Lab capability proof"
);

for (const forbiddenProofClass of [
  "category_inference",
  "commerce_label_inference",
  "marketing_copy_inference"
]) {
  const result =
    evaluateFaceLabCandidateCapability({
      slot: "lip_color",
      candidate: candidate({
        capabilityClaims: [
          claim({
            capabilityKey: "lip_color",
            proofClass: forbiddenProofClass
          })
        ]
      })
    });

  assert.equal(result.status, "invalid");
  assert.equal(
    result.reason,
    "forbidden_proof_class"
  );
}

const noEvidence =
  evaluateFaceLabCandidateCapability({
    slot: "lip_color",
    candidate: candidate({
      capabilityClaims: [
        claim({
          capabilityKey: "lip_color",
          evidenceRefs: []
        })
      ]
    })
  });

assert.equal(noEvidence.status, "invalid");
assert.equal(
  noEvidence.reason,
  "missing_capability_evidence"
);

const malformedEvidence =
  evaluateFaceLabCandidateCapability({
    slot: "lip_color",
    candidate: candidate({
      capabilityClaims: [
        claim({
          capabilityKey: "lip_color",
          evidenceRefs: ["not-namespaced"]
        })
      ]
    })
  });

assert.equal(malformedEvidence.status, "invalid");
assert.equal(
  malformedEvidence.reason,
  "malformed_capability_evidence_ref"
);

const explicitlyUnsupported =
  evaluateFaceLabCandidateCapability({
    slot: "lip_color",
    candidate: candidate({
      capabilityClaims: [
        claim({
          capabilityKey: "lip_color",
          supportState: "unsupported",
          evidenceRefs: [
            "curated_mapping:unsupported-lip"
          ]
        })
      ]
    })
  });

assert.equal(
  explicitlyUnsupported.status,
  "ineligible"
);
assert.equal(
  explicitlyUnsupported.reason,
  "capability_explicitly_unsupported"
);

const conflict =
  evaluateFaceLabCandidateCapability({
    slot: "lip_color",
    candidate: candidate({
      capabilityClaims: [
        claim({
          capabilityKey: "lip_color",
          supportState: "supported",
          evidenceRefs: [
            "curated_mapping:support-lip"
          ]
        }),
        claim({
          capabilityKey: "lip_color",
          supportState: "unsupported",
          evidenceRefs: [
            "curated_mapping:oppose-lip"
          ]
        })
      ]
    })
  });

assert.equal(conflict.status, "ineligible");
assert.equal(
  conflict.reason,
  "capability_claim_conflict"
);

const hairReference = candidate({
  candidateRef:
    "style_reference:soft-curve-layers",
  entityType: "style_reference",
  entityId: "soft-curve-layers",
  capabilityClaims: [
    claim({
      capabilityKey: "hair_shape",
      proofClass:
        "style_reference_definition",
      proofVersion:
        "style-reference-definition-v1",
      evidenceRefs: [
        "style_reference_definition:soft-curve-layers"
      ]
    })
  ]
});

const hairReferenceEligibility =
  evaluateFaceLabCandidateCapability({
    slot: "hair_shape",
    candidate: hairReference
  });
assert.equal(
  hairReferenceEligibility.status,
  "eligible"
);

const hairService = candidate({
  candidateRef: "service:soft-layer-cut",
  entityType: "service",
  entityId: "soft-layer-cut",
  capabilityClaims: [
    claim({
      capabilityKey: "hair_shape",
      proofClass: "service_definition",
      proofVersion: "service-definition-v1",
      evidenceRefs: [
        "service_definition:soft-layer-cut"
      ]
    })
  ]
});

assert.equal(
  evaluateFaceLabCandidateCapability({
    slot: "hair_shape",
    candidate: hairService
  }).status,
  "eligible"
);

const palette = candidate({
  candidateRef: "color_palette:cool-clear-01",
  entityType: "color_palette",
  entityId: "cool-clear-01",
  capabilityClaims: [
    claim({
      capabilityKey: "overall_palette",
      proofClass: "palette_definition",
      proofVersion: "palette-definition-v1",
      evidenceRefs: [
        "palette_definition:cool-clear-01"
      ]
    })
  ]
});

assert.equal(
  evaluateFaceLabCandidateCapability({
    slot: "overall_palette",
    candidate: palette
  }).status,
  "eligible"
);

const styleReferenceForLip =
  evaluateFaceLabCandidateCapability({
    slot: "lip_color",
    candidate: candidate({
      candidateRef:
        "style_reference:lip-editorial-01",
      entityType: "style_reference",
      entityId: "lip-editorial-01",
      capabilityClaims: [
        claim({
          capabilityKey: "lip_color",
          proofClass:
            "style_reference_definition",
          proofVersion:
            "style-reference-definition-v1",
          evidenceRefs: [
            "style_reference_definition:lip-editorial-01"
          ]
        })
      ]
    })
  });

assert.equal(
  styleReferenceForLip.status,
  "ineligible"
);
assert.equal(
  styleReferenceForLip.reason,
  "entity_type_not_accepted"
);

const badVariant = validateFaceLabCandidateCapabilityCandidate(
  candidate({
    candidateRef:
      "product_variant:fixture-without-variant",
    entityType: "product_variant",
    entityId: "fixture-product",
    variantId: null
  })
);
assert.equal(badVariant.valid, false);
assert.equal(
  badVariant.reason,
  "missing_variant_id"
);

const variantLeak =
  validateFaceLabCandidateCapabilityCandidate(
    candidate({
      variantId: "should-not-exist"
    })
  );
assert.equal(variantLeak.valid, false);
assert.equal(
  variantLeak.reason,
  "variant_id_without_product_variant"
);

const wrongProofForService =
  evaluateFaceLabCandidateCapability({
    slot: "hair_shape",
    candidate: candidate({
      candidateRef: "service:fixture-service",
      entityType: "service",
      entityId: "fixture-service",
      capabilityClaims: [
        claim({
          capabilityKey: "hair_shape",
          proofClass:
            "governed_product_fact_mapping",
          proofVersion:
            "product-fact-mapping-v1",
          evidenceRefs: [
            "product_fact:fixture-service"
          ]
        })
      ]
    })
  });

assert.equal(wrongProofForService.status, "invalid");
assert.equal(
  wrongProofForService.reason,
  "proof_class_entity_type_mismatch"
);

const unknownCapability =
  evaluateFaceLabCandidateCapability({
    slot: "lip_color",
    candidate: candidate({
      capabilityClaims: [
        claim({
          capabilityKey:
            "magic_beauty_transformation"
        })
      ]
    })
  });

assert.equal(unknownCapability.status, "invalid");
assert.equal(
  unknownCapability.reason,
  "unknown_capability_key"
);

for (const result of [
  lipEligibility,
  hairReferenceEligibility
]) {
  for (const forbiddenField of [
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
        forbiddenField
      ),
      false,
      `Gate B eligibility must not create matcher/ranking/binding field: ${forbiddenField}`
    );
  }
}

console.log(JSON.stringify({
  ok: true,
  contractVersion:
    FACE_LAB_CANDIDATE_CAPABILITY_CONTRACT_VERSION,
  checked: [
    "product_variant_compatibility",
    "explicit_capability_proof",
    "category_authority_isolation",
    "forbidden_proof_shortcuts",
    "evidence_required",
    "evidence_ref_namespace",
    "unsupported_fail_closed",
    "claim_conflict_fail_closed",
    "entity_type_compatibility",
    "style_reference_authority",
    "service_authority",
    "palette_authority",
    "variant_identity_boundary",
    "proof_class_entity_boundary",
    "unknown_capability_fail_closed",
    "no_ranking_or_binding"
  ]
}, null, 2));
