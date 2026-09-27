export const FACE_LAB_V2_EVALUATION_CONTRACT_VERSION =
  "face-lab-v2-recommendation-evaluation-contract-v7";

export const FACE_LAB_V2_LOCKED_COHORT_VERSION =
  "face-lab-v2-locked-regression-cohort-v1";

export const FACE_LAB_V2_LOCKED_COHORT_SEED =
  "face-lab-v2-eval-v1";

export const FACE_LAB_V2_LOCKED_COHORT_SIZE = 96;

export const FACE_LAB_V2_LOCKED_COHORT_HASH =
  "41753671c096f134dffdbbea7af27b7bb5c1267d7358dc32ee65ceddbe697723";

export const FACE_LAB_V2_COVERAGE_COHORT_VERSION =
  "face-lab-v2-coverage-cohort-v1";

export const FACE_LAB_V2_COVERAGE_COHORT_SEED =
  "face-lab-v2-coverage-v1";

export const FACE_LAB_V2_COVERAGE_COHORT_SIZE = 96;

export const FACE_LAB_V2_ADVERSARIAL_COHORT_VERSION =
  "face-lab-v2-adversarial-cohort-v1";

export const FACE_LAB_V2_ADVERSARIAL_COHORT_SEED =
  "face-lab-v2-adversarial-v1";

export const FACE_LAB_V2_ADVERSARIAL_COHORT_SIZE = 32;

export const FACE_LAB_V2_TARGET_SWEEP_COHORT_VERSION =
  "face-lab-v2-target-sweep-cohort-v1";

export const FACE_LAB_V2_TARGET_SWEEP_SEED =
  "face-lab-v2-target-sweep-v1";

export const FACE_LAB_V2_TARGET_SWEEP_FACE_COUNT = 8;

export const FACE_LAB_V2_TARGET_SWEEP_COHORT_HASH =
  "02747b9fa85f1086b0de1503297b5f4cb9c693074e2f03e6c40e789aa3bb5236";

export const FACE_LAB_V2_TARGET_CONTRAST_PAIRS = Object.freeze([
  Object.freeze(["natural", "sophisticated"]),
  Object.freeze(["soft", "chic"]),
  Object.freeze(["cute_playful", "mature_calm"]),
  Object.freeze(["minimal", "statement_glam"]),
  Object.freeze(["classic", "trendy"]),
  Object.freeze(["clear_soft", "defined"])
]);

export const FACE_LAB_V2_NO_ROUTE_CLASSIFICATIONS = Object.freeze([
  "EXPECTED_CONSTRAINT_BOUNDED_NO_ROUTE",
  "EXPECTED_NO_ACTIONABLE_STYLE_DELTA",
  "UNEXPECTED_ROUTE_GENERATION_GAP"
]);

export const FACE_LAB_V2_EXECUTION_DOMAIN_MAP = Object.freeze({
  hair: "hair",
  makeup: "makeup",
  color: "color",
  eyewear: "eyewear",
  accessories: "accessories"
});

export const FACE_LAB_V2_HARD_EXCLUSION_BY_DOMAIN = Object.freeze({
  hair: "hair_disabled",
  makeup: "makeup_disabled",
  brow_grooming: "brow_grooming_disabled",
  eyewear: "eyewear_disabled",
  accessories: "accessories_disabled",
  facial_hair: "facial_hair_disabled"
});

export const FACE_LAB_V2_METAMORPHIC_RELATIONS = Object.freeze([
  Object.freeze({
    relationId: "FL-MR-001",
    name: "presentation_preference_semantic_invariance",
    category: "semantic_invariant",
    severity: "hard",
    inputDimension: "presentationPreference",
    controlledChange: "rotate visible example preference",
    expectedInvariantOrDirection:
      "current face, style delta, routes, execution, look and product semantics remain unchanged",
    authoritySource: "Face Lab V2 product contract",
    knownExceptions: [
      "presentation-only labels, imagery and copy may change outside canonical recommendation semantics"
    ]
  }),
  Object.freeze({
    relationId: "FL-MR-002",
    name: "target_edit_current_face_invariance",
    category: "state_invariant",
    severity: "hard",
    inputDimension: "targetSelections",
    controlledChange: "replace confirmed target while reusing the same structured face observation",
    expectedInvariantOrDirection:
      "currentFaceProfile remains unchanged while target style authority changes",
    authoritySource: "Face Lab V2 target-edit contract",
    knownExceptions: []
  }),
  Object.freeze({
    relationId: "FL-MR-003",
    name: "hard_exclusion_removes_domain_execution",
    category: "constraint_monotonicity",
    severity: "hard",
    inputDimension: "constraints.hardExclusions",
    controlledChange: "add one whole-domain hard exclusion",
    expectedInvariantOrDirection:
      "excluded domain cannot survive in route actions or domain execution",
    authoritySource: "Face Lab V2 hard-exclusion contract",
    knownExceptions: [
      "grooming top-level remains requested when its other subdomain is still allowed"
    ]
  }),
  Object.freeze({
    relationId: "FL-MR-004",
    name: "minimal_change_caps_route_strength",
    category: "constraint_monotonicity",
    severity: "hard",
    inputDimension: "changeTolerance",
    controlledChange: "set changeTolerance to minimal",
    expectedInvariantOrDirection:
      "generated routes use low change magnitude and light action strength only",
    authoritySource: "Face Lab V2 route-generator contract",
    knownExceptions: []
  })
]);

export function getFaceLabV2MetamorphicRelation(relationId) {
  return FACE_LAB_V2_METAMORPHIC_RELATIONS.find(
    (item) => item.relationId === relationId
  ) || null;
}
