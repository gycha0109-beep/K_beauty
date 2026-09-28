export const FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION =
  "face-lab-v2-recommendation-human-pairwise-v1";

export const FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_ITEM_SCHEMA =
  "face-lab-v2-human-pairwise-review-item-v1";

export const FACE_LAB_V2_HUMAN_PAIRWISE_JUDGMENT_SCHEMA =
  "face-lab-v2-human-pairwise-judgment-v1";

export const FACE_LAB_V2_HUMAN_PAIRWISE_REVEAL_SCHEMA =
  "face-lab-v2-human-pairwise-reveal-v1";

export const FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS = Object.freeze([
  "target_fit",
  "specificity",
  "evidence_action_linkage"
]);

export const FACE_LAB_V2_HUMAN_PAIRWISE_VERDICTS = Object.freeze([
  "A",
  "B",
  "tie",
  "uncertain",
  "not_assessable"
]);

export const FACE_LAB_V2_HUMAN_PAIRWISE_ASSESSABILITY = Object.freeze([
  "assessable",
  "uncertain_assessability",
  "not_assessable"
]);

export const FACE_LAB_V2_HUMAN_PAIRWISE_ASSESSABILITY_REASONS = Object.freeze([
  "context_insufficient",
  "recommendation_missing",
  "recommendations_indistinguishable",
  "rubric_ambiguous",
  "other_contract_defined_reason"
]);

export const FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE = Object.freeze({
  engineRoleHidden: true,
  engineVersionHidden: true,
  pairMappingHidden: true,
  priorHumanJudgmentsHidden: true,
  llmJudgmentHidden: true,
  aggregateResultHidden: true
});

const HEX64 = /^[a-f0-9]{64}$/;
const PAIR_ID = /^flhp_[a-f0-9]{24}$/;
const JUDGMENT_ID = /^flhj_[a-f0-9]{24}$/;
const REVEAL_ID = /^flhr_[a-f0-9]{24}$/;
const REVIEWER_ID = /^reviewer_[a-z0-9][a-z0-9._-]{2,63}$/;
const TOKEN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

function isIso(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function validDigest(value) {
  return typeof value === "string" && HEX64.test(value);
}

function validToken(value) {
  return typeof value === "string" && TOKEN.test(value);
}

function uniqueStrings(value, { allowEmpty = true } = {}) {
  return Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.every((item) => typeof item === "string" && item.length > 0) &&
    new Set(value).size === value.length;
}

function error(code, path, detail = null) {
  return Object.freeze({ code, path, detail });
}

function result(errors) {
  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors)
  });
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

export function canonicalizeFaceLabV2HumanPairwiseArtifact(value, digestKey) {
  if (
    !isObject(value) ||
    typeof digestKey !== "string" ||
    !Object.hasOwn(value, digestKey)
  ) {
    return null;
  }

  return JSON.stringify(stableValue(
    Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== digestKey)
    )
  ));
}

export function verifyFaceLabV2HumanPairwiseDigest(
  value,
  digestKey,
  sha256Hex
) {
  const payload = canonicalizeFaceLabV2HumanPairwiseArtifact(
    value,
    digestKey
  );

  return payload !== null &&
    validDigest(value?.[digestKey]) &&
    typeof sha256Hex === "function" &&
    sha256Hex(payload) === value[digestKey];
}

function validateTargetVector(value) {
  const keys = [
    "softSharp",
    "naturalPolished",
    "playfulMature",
    "minimalStatement",
    "warmCool",
    "classicTrendy"
  ];

  return exactKeys(value, keys) &&
    keys.every((key) =>
      typeof value[key] === "number" &&
      Number.isFinite(value[key]) &&
      value[key] >= 0 &&
      value[key] <= 1
    );
}

function validateCurrentFaceFeatures(value) {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) =>
      exactKeys(item, ["key", "direction", "evidence"]) &&
      validToken(item.key) &&
      validToken(item.direction) &&
      uniqueStrings(item.evidence, { allowEmpty: false })
    );
}

function validateReviewContext(value) {
  return exactKeys(value, [
    "targetLabel",
    "targetVector",
    "currentFaceFeatures",
    "stylingScope",
    "constraints"
  ]) &&
    typeof value.targetLabel === "string" &&
    value.targetLabel.trim().length > 0 &&
    validateTargetVector(value.targetVector) &&
    validateCurrentFaceFeatures(value.currentFaceFeatures) &&
    uniqueStrings(value.stylingScope, { allowEmpty: false }) &&
    isObject(value.constraints);
}

function validateVisibleAction(value) {
  return exactKeys(value, [
    "domain",
    "parameter",
    "direction",
    "strength",
    "reason",
    "evidence",
    "explanation"
  ]) &&
    validToken(value.domain) &&
    validToken(value.parameter) &&
    validToken(value.direction) &&
    validToken(value.strength) &&
    validToken(value.reason) &&
    uniqueStrings(value.evidence) &&
    typeof value.explanation === "string" &&
    value.explanation.trim().length > 0;
}

function validateVisibleOption(value) {
  return exactKeys(value, [
    "recommendationDigest",
    "routeStrategy",
    "actions"
  ]) &&
    validDigest(value.recommendationDigest) &&
    validToken(value.routeStrategy) &&
    Array.isArray(value.actions) &&
    value.actions.length > 0 &&
    value.actions.every(validateVisibleAction);
}

function validateBlindState(value) {
  return exactKeys(
    value,
    Object.keys(FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE)
  ) &&
    Object.entries(FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE)
      .every(([key, expected]) => value?.[key] === expected);
}

export function validateFaceLabV2HumanPairwiseReviewItem(value) {
  const errors = [];
  const keys = [
    "schemaVersion",
    "contractVersion",
    "pairId",
    "evaluationCaseRef",
    "context",
    "options",
    "blindState",
    "createdAt",
    "itemDigest"
  ];

  if (!exactKeys(value, keys)) {
    return result([error("human_pairwise_review_item_invalid", "$")]);
  }

  if (
    value.schemaVersion !==
      FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_ITEM_SCHEMA ||
    value.contractVersion !==
      FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION ||
    !PAIR_ID.test(value.pairId || "") ||
    !validToken(value.evaluationCaseRef) ||
    !validateReviewContext(value.context) ||
    !exactKeys(value.options, ["A", "B"]) ||
    !validateVisibleOption(value.options?.A) ||
    !validateVisibleOption(value.options?.B) ||
    !validateBlindState(value.blindState) ||
    !isIso(value.createdAt) ||
    !validDigest(value.itemDigest)
  ) {
    errors.push(error("human_pairwise_review_item_invalid", "$"));
  }

  return result(errors);
}

function validateDimensionVerdicts(value, assessability, errors) {
  if (!exactKeys(value, FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS)) {
    errors.push(error("human_pairwise_dimensions_invalid", "dimensions"));
    return;
  }

  for (const dimension of FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS) {
    if (!FACE_LAB_V2_HUMAN_PAIRWISE_VERDICTS.includes(value[dimension])) {
      errors.push(
        error(
          "human_pairwise_dimension_verdict_invalid",
          "dimensions." + dimension
        )
      );
    }
  }

  const verdicts = Object.values(value);

  if (
    assessability === "not_assessable" &&
    verdicts.some((verdict) => verdict !== "not_assessable")
  ) {
    errors.push(
      error(
        "human_pairwise_not_assessable_forced_verdict",
        "dimensions"
      )
    );
  }

  if (
    assessability === "uncertain_assessability" &&
    !verdicts.some((verdict) => verdict === "uncertain")
  ) {
    errors.push(
      error(
        "human_pairwise_uncertain_assessability_requires_uncertain",
        "dimensions"
      )
    );
  }

  if (
    assessability === "assessable" &&
    verdicts.some((verdict) => verdict === "not_assessable")
  ) {
    errors.push(
      error(
        "human_pairwise_assessable_not_assessable_verdict",
        "dimensions"
      )
    );
  }
}

export function validateFaceLabV2HumanPairwiseJudgment(value) {
  const errors = [];
  const keys = [
    "schemaVersion",
    "contractVersion",
    "judgmentId",
    "pairId",
    "reviewItemDigest",
    "reviewerId",
    "assessability",
    "assessabilityReasonCodes",
    "dimensions",
    "rationale",
    "submittedAt",
    "sealState",
    "judgmentDigest"
  ];

  if (!exactKeys(value, keys)) {
    return result([error("human_pairwise_judgment_invalid", "$")]);
  }

  const assessabilityValid =
    FACE_LAB_V2_HUMAN_PAIRWISE_ASSESSABILITY.includes(
      value.assessability
    );

  const reasonCodesValid =
    Array.isArray(value.assessabilityReasonCodes) &&
    value.assessabilityReasonCodes.every((reason) =>
      FACE_LAB_V2_HUMAN_PAIRWISE_ASSESSABILITY_REASONS.includes(reason)
    ) &&
    new Set(value.assessabilityReasonCodes).size ===
      value.assessabilityReasonCodes.length;

  if (
    value.schemaVersion !==
      FACE_LAB_V2_HUMAN_PAIRWISE_JUDGMENT_SCHEMA ||
    value.contractVersion !==
      FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION ||
    !JUDGMENT_ID.test(value.judgmentId || "") ||
    !PAIR_ID.test(value.pairId || "") ||
    !validDigest(value.reviewItemDigest) ||
    !REVIEWER_ID.test(value.reviewerId || "") ||
    !assessabilityValid ||
    !reasonCodesValid ||
    typeof value.rationale !== "string" ||
    value.rationale.length > 1200 ||
    !isIso(value.submittedAt) ||
    value.sealState !== "sealed" ||
    !validDigest(value.judgmentDigest)
  ) {
    errors.push(error("human_pairwise_judgment_invalid", "$"));
  }

  if (
    value.assessability !== "assessable" &&
    value.assessabilityReasonCodes.length === 0
  ) {
    errors.push(
      error(
        "human_pairwise_assessability_reason_required",
        "assessabilityReasonCodes"
      )
    );
  }

  validateDimensionVerdicts(
    value.dimensions,
    value.assessability,
    errors
  );

  return result(errors);
}

function validateRevealOption(value) {
  return exactKeys(value, [
    "role",
    "engineVersion",
    "recommendationDigest"
  ]) &&
    ["current", "candidate"].includes(value.role) &&
    validToken(value.engineVersion) &&
    validDigest(value.recommendationDigest);
}

export function validateFaceLabV2HumanPairwiseReveal(value) {
  const errors = [];
  const keys = [
    "schemaVersion",
    "contractVersion",
    "revealId",
    "pairId",
    "reviewItemDigest",
    "mapping",
    "humanJudgmentDigests",
    "revealState",
    "revealedAt",
    "revealDigest"
  ];

  if (!exactKeys(value, keys)) {
    return result([error("human_pairwise_reveal_invalid", "$")]);
  }

  const mappingValid =
    exactKeys(value.mapping, ["A", "B"]) &&
    validateRevealOption(value.mapping?.A) &&
    validateRevealOption(value.mapping?.B) &&
    new Set([
      value.mapping?.A?.role,
      value.mapping?.B?.role
    ]).size === 2;

  const judgmentDigestsValid =
    Array.isArray(value.humanJudgmentDigests) &&
    value.humanJudgmentDigests.length > 0 &&
    value.humanJudgmentDigests.every(validDigest) &&
    new Set(value.humanJudgmentDigests).size ===
      value.humanJudgmentDigests.length;

  if (
    value.schemaVersion !==
      FACE_LAB_V2_HUMAN_PAIRWISE_REVEAL_SCHEMA ||
    value.contractVersion !==
      FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION ||
    !REVEAL_ID.test(value.revealId || "") ||
    !PAIR_ID.test(value.pairId || "") ||
    !validDigest(value.reviewItemDigest) ||
    !mappingValid ||
    !judgmentDigestsValid ||
    value.revealState !== "revealed_after_human_seal" ||
    !isIso(value.revealedAt) ||
    !validDigest(value.revealDigest)
  ) {
    errors.push(error("human_pairwise_reveal_invalid", "$"));
  }

  return result(errors);
}

export function validateFaceLabV2HumanPairwiseBindings({
  reviewItem,
  judgments,
  reveal,
  sha256Hex
}) {
  const errors = [];

  if (
    !validateFaceLabV2HumanPairwiseReviewItem(reviewItem).ok ||
    !verifyFaceLabV2HumanPairwiseDigest(
      reviewItem,
      "itemDigest",
      sha256Hex
    )
  ) {
    errors.push(
      error("human_pairwise_binding_invalid", "reviewItem")
    );
  }

  if (
    !Array.isArray(judgments) ||
    judgments.length === 0 ||
    new Set(judgments.map((item) => item?.reviewerId)).size !==
      judgments.length
  ) {
    errors.push(
      error("human_pairwise_binding_invalid", "judgments")
    );
  }

  for (const judgment of judgments || []) {
    const valid =
      validateFaceLabV2HumanPairwiseJudgment(judgment).ok &&
      verifyFaceLabV2HumanPairwiseDigest(
        judgment,
        "judgmentDigest",
        sha256Hex
      ) &&
      judgment.pairId === reviewItem?.pairId &&
      judgment.reviewItemDigest === reviewItem?.itemDigest &&
      Date.parse(judgment.submittedAt) >=
        Date.parse(reviewItem?.createdAt || "") &&
      Date.parse(judgment.submittedAt) <=
        Date.parse(reveal?.revealedAt || "");

    if (!valid) {
      errors.push(
        error(
          "human_pairwise_binding_invalid",
          "judgments." + (judgment?.judgmentId || "unknown")
        )
      );
    }
  }

  const judgmentDigests = new Set(
    (judgments || []).map((item) => item?.judgmentDigest)
  );

  const revealValid =
    validateFaceLabV2HumanPairwiseReveal(reveal).ok &&
    verifyFaceLabV2HumanPairwiseDigest(
      reveal,
      "revealDigest",
      sha256Hex
    ) &&
    reveal?.pairId === reviewItem?.pairId &&
    reveal?.reviewItemDigest === reviewItem?.itemDigest &&
    reveal?.humanJudgmentDigests?.length === judgmentDigests.size &&
    reveal?.humanJudgmentDigests?.every((digest) =>
      judgmentDigests.has(digest)
    ) &&
    reveal?.mapping?.A?.recommendationDigest ===
      reviewItem?.options?.A?.recommendationDigest &&
    reveal?.mapping?.B?.recommendationDigest ===
      reviewItem?.options?.B?.recommendationDigest;

  if (!revealValid) {
    errors.push(
      error("human_pairwise_binding_invalid", "reveal")
    );
  }

  return result(errors);
}

export function validateFaceLabV2HumanPairwiseArtifact(value) {
  if (
    value?.schemaVersion ===
    FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_ITEM_SCHEMA
  ) {
    return validateFaceLabV2HumanPairwiseReviewItem(value);
  }

  if (
    value?.schemaVersion ===
    FACE_LAB_V2_HUMAN_PAIRWISE_JUDGMENT_SCHEMA
  ) {
    return validateFaceLabV2HumanPairwiseJudgment(value);
  }

  if (
    value?.schemaVersion ===
    FACE_LAB_V2_HUMAN_PAIRWISE_REVEAL_SCHEMA
  ) {
    return validateFaceLabV2HumanPairwiseReveal(value);
  }

  return result([
    error(
      "human_pairwise_schema_unsupported",
      "schemaVersion"
    )
  ]);
}
