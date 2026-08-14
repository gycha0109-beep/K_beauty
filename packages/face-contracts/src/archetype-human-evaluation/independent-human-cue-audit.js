import {
  FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT,
  validateTargetAxisOperationalDefinitionContract
} from "./target-axis-operational-definitions.js";

export const INDEPENDENT_HUMAN_CUE_AUDIT_SCHEMA_VERSION =
  "face-lab-independent-human-cue-audit-protocol-v1";
export const INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION =
  "face-lab-independent-human-cue-audit-20260814-v1";
export const INDEPENDENT_HUMAN_CUE_REVIEW_SCHEMA_VERSION =
  "face-lab-independent-human-cue-review-v1";
export const INDEPENDENT_HUMAN_CUE_REVIEW_TEMPLATE_SCHEMA_VERSION =
  "face-lab-independent-human-cue-review-template-v1";
export const INDEPENDENT_HUMAN_CUE_DEFINITION_PACKET_SCHEMA_VERSION =
  "face-lab-independent-human-cue-definition-packet-v1";

export const INDEPENDENT_HUMAN_CUE_CONFIDENCE_VALUES = Object.freeze([
  "low",
  "medium",
  "high",
  "not_applicable"
]);

export const INDEPENDENT_HUMAN_CUE_NOT_ASSESSABLE_REASON_CODES = Object.freeze([
  "pose",
  "occlusion",
  "crop",
  "image_quality",
  "expression",
  "lighting",
  "makeup",
  "perspective",
  "editing_or_filter",
  "axis_specific_limitation",
  "insufficient_visible_evidence"
]);

export const INDEPENDENT_HUMAN_CUE_AGREEMENT_STATES = Object.freeze([
  "unanimous_concrete",
  "majority_concrete",
  "all_uncertain_or_not_assessable",
  "no_unique_mode",
  "insufficient_completed_reviewers"
]);

const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

const PRIMARY_AXES = Object.freeze([
  "observations.outline.faceShape",
  "observations.outline.jawlineAngularity",
  "observations.vertical.faceLengthBalance",
  "observations.eyes.eyeDirection",
  "observations.eyes.eyeOpenness",
  "observations.featureLayout.featureScale",
  "observations.featureLayout.featureConcentration",
  "observations.visualLanguage.straightCurveBalance"
]);

const VALIDATION_ONLY_AXES = Object.freeze([
  "observations.eyes.eyeLength",
  "observations.visualLanguage.contourDefinition"
]);

const EXCLUDED_DIRECT_AXES = Object.freeze([
  "observations.visualLanguage.featureContrast"
]);

const REQUIRED_INDEPENDENCE_ATTESTATION = Object.freeze({
  generationTargetKnown: false,
  generationPromptSeen: false,
  subtleModerateConditionKnown: false,
  archetypeTargetKnown: false,
  visionObservationSeen: false,
  shadowScoringSeen: false,
  peerJudgmentsSeen: false,
  consensusSeen: false
});

const PROTOCOL_WITHOUT_DIGEST = {
  schemaVersion: INDEPENDENT_HUMAN_CUE_AUDIT_SCHEMA_VERSION,
  protocolVersion: INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION,
  status: "packet_ready_not_executed",
  purpose: "synthetic_target_axis_disambiguation",
  definitionContractVersion: FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT.contractVersion,
  definitionContractDigest: FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT.contractDigest,
  evidenceClass: "controlled_synthetic_human_cue_review",
  plannedReviewerSlots: 3,
  reviewerSlotIds: ["R01", "R02", "R03"],
  reviewerIndependence: {
    requiredAttestation: REQUIRED_INDEPENDENCE_ATTESTATION,
    currentOperatorEligible: false,
    currentConversationEligible: false,
    reviewerIdentityBindingPhase: "D2D-X",
    independentReviewerRequired: true
  },
  primaryAxes: PRIMARY_AXES,
  validationOnlyAxes: VALIDATION_ONLY_AXES,
  excludedDirectAxes: EXCLUDED_DIRECT_AXES,
  excludedDirectAxisRelation: "NOT_COMPARABLE_CONTRACT_DECOMPOSITION",
  responseSchema: {
    submittedSchemaVersion: INDEPENDENT_HUMAN_CUE_REVIEW_SCHEMA_VERSION,
    blankTemplateSchemaVersion: INDEPENDENT_HUMAN_CUE_REVIEW_TEMPLATE_SCHEMA_VERSION,
    judgmentFields: [
      "reviewItemId",
      "axisPath",
      "response",
      "confidence",
      "evidenceTags",
      "notAssessableReasonCodes"
    ],
    responseExtensions: ["uncertain", "not_assessable"],
    freeTextRequired: false,
    concreteResponseConfidence: ["low", "medium", "high"],
    uncertainResponseConfidence: ["low", "medium"],
    notAssessableResponseConfidence: "not_applicable",
    submittedAtRequiredOnlyOnExecution: true,
    responseDigestRequiredOnlyOnExecution: true
  },
  confidenceValues: INDEPENDENT_HUMAN_CUE_CONFIDENCE_VALUES,
  notAssessableReasonCodes: INDEPENDENT_HUMAN_CUE_NOT_ASSESSABLE_REASON_CODES,
  blindingRequirements: {
    reviewerHidden: [
      "generation target",
      "generation prompt",
      "generation condition",
      "source cohort",
      "candidate identity",
      "Vision observation",
      "shadow scoring",
      "peer judgment",
      "consensus",
      "historical diagnostic result"
    ],
    revealAfter: [
      "all required Session-A reviewer responses sealed",
      "Human aggregation artifact sealed"
    ],
    sameAxisSetForEveryImage: true,
    deterministicOpaqueOrder: true
  },
  reviewerVisibleFields: [
    "opaque review item identifier",
    "packet-local image asset",
    "axis path",
    "enum options",
    "observable target",
    "reference frame",
    "value definitions",
    "neighbor contrasts",
    "ambiguity rules",
    "not-assessable conditions",
    "image-condition warnings",
    "reviewer instruction",
    "allowed evidence tags",
    "uncertain",
    "not_assessable",
    "confidence"
  ],
  reviewerHiddenFields: [
    "candidateId",
    "canonical asset hash",
    "source cohort",
    "source ordinal",
    "generation metadata",
    "intended cue",
    "Archetype target",
    "Vision metadata",
    "scorer metadata",
    "private map"
  ],
  aggregationPolicy: {
    status: "descriptive_policy_frozen_not_executed",
    preserveIndividualResponses: true,
    outputsPerImageAxis: [
      "responseFrequencyMap",
      "assessableReviewerCount",
      "uncertainCount",
      "notAssessableCount",
      "concreteModalValueIfUnique",
      "agreementState"
    ],
    agreementStates: INDEPENDENT_HUMAN_CUE_AGREEMENT_STATES,
    modalValueIsGroundTruth: false,
    primaryAndValidationDenominatorsSeparate: true,
    consensusComputed: false
  },
  revealPolicy: {
    generationIntentHiddenUntilAggregationSealed: true,
    visionObservationHiddenFromReviewers: true,
    joinHumanVisionIntentPhase: "D2D-R",
    revealExecuted: false
  },
  productionConsumption: false,
  w2Status: "locked",
  executionCounters: {
    providerCalls: 0,
    observationCalls: 0,
    generationCalls: 0,
    humanJudgments: 0,
    consensus: 0,
    hostedWrites: 0
  }
};

export const FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL = deepFreeze({
  ...PROTOCOL_WITHOUT_DIGEST,
  protocolDigest: "a32dd94dfbd8e090363ae0d662d51174eeab05796ccad5a8b2ad4c303d886b77"
});

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) => isObject(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const unique = (items) => Array.isArray(items) && new Set(items).size === items.length;

export function canonicalizeIndependentHumanCueAuditProtocol(value) {
  if (!isObject(value)) return null;
  const semantic = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "protocolDigest"));
  const sort = (item) => Array.isArray(item)
    ? item.map(sort)
    : isObject(item)
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])]))
      : item;
  return JSON.stringify(sort(semantic));
}

export function validateIndependentHumanCueAuditProtocol(value) {
  const expectedKeys = [
    "schemaVersion", "protocolVersion", "status", "purpose", "definitionContractVersion",
    "definitionContractDigest", "evidenceClass", "plannedReviewerSlots", "reviewerSlotIds",
    "reviewerIndependence", "primaryAxes", "validationOnlyAxes", "excludedDirectAxes",
    "excludedDirectAxisRelation", "responseSchema", "confidenceValues",
    "notAssessableReasonCodes", "blindingRequirements", "reviewerVisibleFields",
    "reviewerHiddenFields", "aggregationPolicy", "revealPolicy", "productionConsumption",
    "w2Status", "executionCounters", "protocolDigest"
  ];
  const errors = [];
  if (!exactKeys(value, expectedKeys)) return { ok: false, errors: ["protocol_shape_invalid"] };
  if (value.schemaVersion !== INDEPENDENT_HUMAN_CUE_AUDIT_SCHEMA_VERSION ||
      value.protocolVersion !== INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION ||
      value.status !== "packet_ready_not_executed" ||
      value.purpose !== "synthetic_target_axis_disambiguation" ||
      !/^[a-f0-9]{64}$/.test(value.protocolDigest || "")) errors.push("protocol_identity_invalid");
  if (value.definitionContractDigest !== FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT.contractDigest ||
      value.definitionContractVersion !== FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT.contractVersion) {
    errors.push("definition_authority_invalid");
  }
  if (value.plannedReviewerSlots !== 3 ||
      JSON.stringify(value.reviewerSlotIds) !== JSON.stringify(["R01", "R02", "R03"])) {
    errors.push("reviewer_panel_invalid");
  }
  const allAxes = [...value.primaryAxes, ...value.validationOnlyAxes, ...value.excludedDirectAxes];
  if (value.primaryAxes.length !== 8 || value.validationOnlyAxes.length !== 2 ||
      value.excludedDirectAxes.length !== 1 || !unique(allAxes) || allAxes.length !== 11) {
    errors.push("axis_partition_invalid");
  }
  if (value.excludedDirectAxisRelation !== "NOT_COMPARABLE_CONTRACT_DECOMPOSITION") {
    errors.push("excluded_axis_relation_invalid");
  }
  if (value.productionConsumption !== false || value.w2Status !== "locked" ||
      Object.values(value.executionCounters).some((count) => count !== 0)) {
    errors.push("execution_boundary_invalid");
  }
  if (!unique(value.confidenceValues) || !unique(value.notAssessableReasonCodes) ||
      JSON.stringify(value.confidenceValues) !== JSON.stringify(INDEPENDENT_HUMAN_CUE_CONFIDENCE_VALUES) ||
      JSON.stringify(value.notAssessableReasonCodes) !== JSON.stringify(INDEPENDENT_HUMAN_CUE_NOT_ASSESSABLE_REASON_CODES)) {
    errors.push("response_registry_invalid");
  }
  if (Object.values(value.reviewerIndependence.requiredAttestation).some((flag) => flag !== false) ||
      value.reviewerIndependence.currentOperatorEligible !== false ||
      value.reviewerIndependence.currentConversationEligible !== false) {
    errors.push("reviewer_independence_invalid");
  }
  return { ok: errors.length === 0, errors };
}

export function projectIndependentHumanCueDefinitions(
  part,
  definitionContract = FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT
) {
  if (!validateTargetAxisOperationalDefinitionContract(definitionContract).ok || !["A", "B"].includes(part)) return null;
  const selected = new Set(part === "A" ? PRIMARY_AXES : VALIDATION_ONLY_AXES);
  return deepFreeze({
    schemaVersion: INDEPENDENT_HUMAN_CUE_DEFINITION_PACKET_SCHEMA_VERSION,
    protocolVersion: INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION,
    definitionContractVersion: definitionContract.contractVersion,
    part,
    responseExtensions: ["uncertain", "not_assessable"],
    axes: definitionContract.axes.filter((axis) => selected.has(axis.axisPath)).map((axis) => ({
      axisPath: axis.axisPath,
      enumOptions: [...axis.currentEnumValues],
      observableTarget: axis.observableTarget,
      referenceFrame: axis.referenceFrame,
      valueDefinitions: structuredClone(axis.valueDefinitions),
      neighborContrasts: [...axis.neighborContrasts],
      ambiguityRules: [...axis.ambiguityRules],
      notAssessableConditions: [...axis.notAssessableConditions],
      imageConditionWarnings: [...axis.imageConditionWarnings],
      humanReviewerInstruction: axis.humanReviewerInstruction,
      allowedEvidenceTags: [...axis.evidenceTags]
    }))
  });
}

export function validateBlankIndependentHumanCueReviewTemplate(value, packetManifest, definitionPacket) {
  if (!isObject(value) || !isObject(packetManifest) || !isObject(definitionPacket)) return false;
  const topKeys = [
    "schemaVersion", "protocolVersion", "packetDigest", "reviewerSlot", "sessionId",
    "reviewerIndependenceAttestation", "judgments"
  ];
  if (!exactKeys(value, topKeys) ||
      value.schemaVersion !== INDEPENDENT_HUMAN_CUE_REVIEW_TEMPLATE_SCHEMA_VERSION ||
      value.protocolVersion !== INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION ||
      value.packetDigest !== packetManifest.packetDigest ||
      value.reviewerSlot !== packetManifest.reviewerSlot ||
      !/^hcs_[a-f0-9]{24}$/.test(value.sessionId || "")) return false;
  if (!exactKeys(value.reviewerIndependenceAttestation, Object.keys(REQUIRED_INDEPENDENCE_ATTESTATION)) ||
      Object.values(value.reviewerIndependenceAttestation).some((flag) => flag !== null)) return false;
  const expected = packetManifest.orderedReviewItems.length * definitionPacket.axes.length;
  if (!Array.isArray(value.judgments) || value.judgments.length !== expected) return false;
  const allowedItems = new Set(packetManifest.orderedReviewItems.map((item) => item.reviewItemId));
  const axes = new Map(definitionPacket.axes.map((axis) => [axis.axisPath, axis]));
  const seen = new Set();
  for (const judgment of value.judgments) {
    if (!exactKeys(judgment, [
      "reviewItemId", "axisPath", "response", "confidence", "evidenceTags", "notAssessableReasonCodes"
    ]) || !allowedItems.has(judgment.reviewItemId) || !axes.has(judgment.axisPath) ||
        judgment.response !== null || judgment.confidence !== null ||
        !Array.isArray(judgment.evidenceTags) || judgment.evidenceTags.length !== 0 ||
        !Array.isArray(judgment.notAssessableReasonCodes) || judgment.notAssessableReasonCodes.length !== 0) return false;
    const key = `${judgment.reviewItemId}|${judgment.axisPath}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return seen.size === expected;
}

export function validateIndependentHumanCueJudgment(judgment, axisDefinition) {
  if (!isObject(judgment) || !isObject(axisDefinition) || !exactKeys(judgment, [
    "reviewItemId", "axisPath", "response", "confidence", "evidenceTags", "notAssessableReasonCodes"
  ])) return false;
  const concrete = axisDefinition.enumOptions.includes(judgment.response);
  const uncertain = judgment.response === "uncertain";
  const notAssessable = judgment.response === "not_assessable";
  if (!concrete && !uncertain && !notAssessable) return false;
  if (concrete && !["low", "medium", "high"].includes(judgment.confidence)) return false;
  if (uncertain && !["low", "medium"].includes(judgment.confidence)) return false;
  if (notAssessable && judgment.confidence !== "not_applicable") return false;
  if (!unique(judgment.evidenceTags) || judgment.evidenceTags.some((tag) => !axisDefinition.allowedEvidenceTags.includes(tag))) return false;
  if (!unique(judgment.notAssessableReasonCodes) || judgment.notAssessableReasonCodes.some((code) => !INDEPENDENT_HUMAN_CUE_NOT_ASSESSABLE_REASON_CODES.includes(code))) return false;
  return notAssessable ? judgment.notAssessableReasonCodes.length > 0 : judgment.notAssessableReasonCodes.length === 0;
}
