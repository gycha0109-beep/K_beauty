import {
  ARCHETYPE_ADJUDICATION_OUTCOMES,
  ARCHETYPE_ADJUDICATION_REASON_CODES,
  ARCHETYPE_ADJUDICATION_SCHEMA_VERSION,
  ARCHETYPE_ANNOTATION_SET_SCHEMA_VERSION,
  ARCHETYPE_ASSESSABILITY_REASON_CODES,
  ARCHETYPE_ASSESSABILITY_STATES,
  ARCHETYPE_CONFIDENCE_VALUES,
  ARCHETYPE_CONSENSUS_POLICY_STATES,
  ARCHETYPE_CONSENSUS_SCHEMA_VERSION,
  ARCHETYPE_CONSENSUS_STATES,
  ARCHETYPE_DATASET_MANIFEST_SCHEMA_VERSION,
  ARCHETYPE_EVIDENCE_CLASSES,
  ARCHETYPE_EVIDENCE_TAG_REGISTRY_VERSION,
  ARCHETYPE_EVIDENCE_TAGS,
  ARCHETYPE_HUMAN_ANNOTATION_SCHEMA_VERSION,
  ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION,
  ARCHETYPE_LABEL_STATES,
  ARCHETYPE_REQUIRED_BLIND_STATE,
  ARCHETYPE_REVIEW_ITEM_SCHEMA_VERSION,
  ARCHETYPE_REVIEW_SESSION_SCHEMA_VERSION,
  ARCHETYPE_SESSION_STATES,
  ARCHETYPE_SPLIT_ROLES,
  ARCHETYPE_TAXONOMY_KEYS,
  ARCHETYPE_WITHDRAWAL_STATES
} from "./constants.js";

const HEX64 = /^[a-f0-9]{64}$/;
const TOKEN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const REVIEW_ITEM_ID = /^flri_[a-f0-9]{24}$/;
const SESSION_ID = /^flrs_[a-f0-9]{24}$/;
const ANNOTATION_ID = /^flann_[a-f0-9]{24}$/;
const ANNOTATION_SET_ID = /^flaset_[a-f0-9]{24}$/;
const CONSENSUS_ID = /^flcon_[a-f0-9]{24}$/;
const ADJUDICATION_ID = /^fladj_[a-f0-9]{24}$/;
const REVIEWER_ID = /^reviewer_[a-z0-9][a-z0-9._-]{2,63}$/;
const SUBJECT_ID = /^flsub_[a-f0-9]{24}$/;
const GROUP_ID = /^flgrp_[a-f0-9]{24}$/;
const IMAGE_ID = /^flimg_[a-f0-9]{24}$/;
const OPAQUE_ASSET_REF = /^asset_[a-f0-9]{24,64}$/;
const CONSENT_RECORD_ID = /^consent_[a-f0-9]{24,64}$/;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function uniqueEnumArray(value, allowed, { allowEmpty = true } = {}) {
  return Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.every((item) => allowed.includes(item)) &&
    new Set(value).size === value.length;
}

function uniqueMatchingArray(value, pattern, { allowEmpty = true } = {}) {
  return Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.every((item) => typeof item === "string" && pattern.test(item)) &&
    new Set(value).size === value.length;
}

function error(code, path, detail = null) {
  return Object.freeze({ code, path, detail });
}

function result(errors) {
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function validToken(value) {
  return typeof value === "string" && TOKEN.test(value);
}

function validDigest(value) {
  return typeof value === "string" && HEX64.test(value);
}

function followsRegistryOrder(values, registry) {
  const positions = values.map((value) => registry.indexOf(value));
  return positions.every((position) => position >= 0) && positions.every((position, index) => index === 0 || positions[index - 1] < position);
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
}

export function canonicalizeArchetypeHumanEvaluationArtifact(value, digestKey) {
  if (!isObject(value) || typeof digestKey !== "string" || !Object.hasOwn(value, digestKey)) return null;
  const semantic = Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestKey));
  return JSON.stringify(sortKeys(semantic));
}

export function verifyArchetypeHumanEvaluationDigest(value, digestKey, sha256Hex) {
  const payload = canonicalizeArchetypeHumanEvaluationArtifact(value, digestKey);
  return payload !== null && validDigest(value?.[digestKey]) && typeof sha256Hex === "function" && sha256Hex(payload) === value[digestKey];
}

export function verifyArchetypeDatasetManifestDigests(value, sha256Hex) {
  if (!validateArchetypeDatasetManifest(value).ok || typeof sha256Hex !== "function") return false;
  const splitsValid = value.splits.every((split) => {
    const { splitDigest, ...semantic } = split;
    return sha256Hex(JSON.stringify(sortKeys(semantic))) === splitDigest;
  });
  return splitsValid && verifyArchetypeHumanEvaluationDigest(value, "datasetManifestDigest", sha256Hex);
}

function validateConsentAuthority(value, errors, path, { requireActive = false } = {}) {
  if (!exactKeys(value, ["consentRecordId", "consentPolicyVersion", "retentionPolicyVersion", "withdrawalState"]) ||
      !CONSENT_RECORD_ID.test(value?.consentRecordId || "") ||
      !validToken(value?.consentPolicyVersion) ||
      !validToken(value?.retentionPolicyVersion) ||
      !ARCHETYPE_WITHDRAWAL_STATES.includes(value?.withdrawalState) ||
      (requireActive && value?.withdrawalState !== "active")) {
    errors.push(error("archetype_consent_authority_invalid", path));
  }
}

export function validateArchetypeReviewItem(value) {
  const errors = [];
  const keys = [
    "schemaVersion", "reviewItemId", "datasetId", "datasetVersion", "splitId", "splitRole",
    "evidenceClass", "subjectId", "subjectGroupId", "leakageGroupId", "imageId", "opaqueAssetRef",
    "taxonomyVersion", "registryVersion", "observationSchemaVersion", "consentAuthority", "createdAt",
    "reviewItemDigest"
  ];
  if (!exactKeys(value, keys)) return result([error("archetype_review_item_invalid", "$")]);
  if (value.schemaVersion !== ARCHETYPE_REVIEW_ITEM_SCHEMA_VERSION ||
      !REVIEW_ITEM_ID.test(value.reviewItemId || "") ||
      ![value.datasetId, value.datasetVersion, value.splitId, value.taxonomyVersion, value.registryVersion, value.observationSchemaVersion].every(validToken) ||
      !ARCHETYPE_SPLIT_ROLES.includes(value.splitRole) ||
      !ARCHETYPE_EVIDENCE_CLASSES.includes(value.evidenceClass) ||
      !SUBJECT_ID.test(value.subjectId || "") ||
      !GROUP_ID.test(value.subjectGroupId || "") ||
      !GROUP_ID.test(value.leakageGroupId || "") ||
      !IMAGE_ID.test(value.imageId || "") ||
      !OPAQUE_ASSET_REF.test(value.opaqueAssetRef || "") ||
      !isIso(value.createdAt) || !validDigest(value.reviewItemDigest)) {
    errors.push(error("archetype_review_item_invalid", "$"));
  }
  validateConsentAuthority(value.consentAuthority, errors, "consentAuthority");
  return result(errors);
}

function validateReviewItemRefs(value, errors, path) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) =>
    !exactKeys(item, ["reviewItemId", "reviewItemDigest"]) ||
    !REVIEW_ITEM_ID.test(item.reviewItemId || "") || !validDigest(item.reviewItemDigest)
  )) {
    errors.push(error("archetype_review_item_refs_invalid", path));
    return;
  }
  if (new Set(value.map((item) => item.reviewItemId)).size !== value.length ||
      new Set(value.map((item) => item.reviewItemDigest)).size !== value.length) {
    errors.push(error("archetype_review_item_refs_duplicate", path));
  }
}

export function validateArchetypeReviewSession(value) {
  const errors = [];
  const keys = [
    "schemaVersion", "reviewSessionId", "datasetId", "splitId", "taxonomyVersion", "registryVersion",
    "annotationContractVersion", "reviewerId", "reviewerPolicyVersion", "reviewItemRefs", "blindState",
    "sessionState", "issuedAt", "sealedAt", "sessionDigest"
  ];
  if (!exactKeys(value, keys)) return result([error("archetype_review_session_invalid", "$")]);
  if (value.schemaVersion !== ARCHETYPE_REVIEW_SESSION_SCHEMA_VERSION ||
      !SESSION_ID.test(value.reviewSessionId || "") ||
      ![value.datasetId, value.splitId, value.taxonomyVersion, value.registryVersion, value.reviewerPolicyVersion].every(validToken) ||
      value.annotationContractVersion !== ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION ||
      !REVIEWER_ID.test(value.reviewerId || "") ||
      !ARCHETYPE_SESSION_STATES.includes(value.sessionState) || !isIso(value.issuedAt) ||
      !((value.sessionState === "issued" && value.sealedAt === null) || (value.sessionState === "sealed" && isIso(value.sealedAt))) ||
      !validDigest(value.sessionDigest)) {
    errors.push(error("archetype_review_session_invalid", "$"));
  }
  if (!exactKeys(value.blindState, Object.keys(ARCHETYPE_REQUIRED_BLIND_STATE)) ||
      Object.entries(ARCHETYPE_REQUIRED_BLIND_STATE).some(([key, expected]) => value.blindState?.[key] !== expected)) {
    errors.push(error("archetype_blind_state_invalid", "blindState"));
  }
  validateReviewItemRefs(value.reviewItemRefs, errors, "reviewItemRefs");
  return result(errors);
}

function validateAssessability(value, errors) {
  if (!exactKeys(value, ["state", "reasonCodes"]) ||
      !ARCHETYPE_ASSESSABILITY_STATES.includes(value?.state) ||
      !uniqueEnumArray(value?.reasonCodes, ARCHETYPE_ASSESSABILITY_REASON_CODES)) {
    errors.push(error("archetype_assessability_invalid", "assessability"));
    return;
  }
  if (value.state !== "assessable" && value.reasonCodes.length === 0) {
    errors.push(error("archetype_assessability_reason_required", "assessability.reasonCodes"));
  }
}

function validateAnnotationLabel(value, assessability, errors) {
  if (!exactKeys(value, ["state", "top1", "rankedAlternatives", "ambiguityCandidates", "confidence"]) ||
      !ARCHETYPE_LABEL_STATES.includes(value?.state) ||
      !ARCHETYPE_CONFIDENCE_VALUES.includes(value?.confidence) ||
      !uniqueEnumArray(value?.rankedAlternatives, ARCHETYPE_TAXONOMY_KEYS) ||
      !uniqueEnumArray(value?.ambiguityCandidates, ARCHETYPE_TAXONOMY_KEYS)) {
    errors.push(error("archetype_annotation_label_invalid", "label"));
    return;
  }
  const top1Valid = value.top1 === null || ARCHETYPE_TAXONOMY_KEYS.includes(value.top1);
  const allRanked = value.top1 === null ? value.rankedAlternatives : [value.top1, ...value.rankedAlternatives];
  if (!top1Valid || new Set(allRanked).size !== allRanked.length) {
    errors.push(error("archetype_annotation_rank_invalid", "label"));
  }
  if (value.state === "ranked") {
    if (value.top1 === null || value.ambiguityCandidates.length !== 0 || value.confidence === "not_applicable") {
      errors.push(error("archetype_ranked_label_invalid", "label"));
    }
  } else if (value.state === "ambiguous") {
    const sameCandidates = value.rankedAlternatives.length >= 2 &&
      value.ambiguityCandidates.length === value.rankedAlternatives.length &&
      value.ambiguityCandidates.every((item) => value.rankedAlternatives.includes(item));
    if (value.top1 !== null || !sameCandidates || value.confidence === "not_applicable") {
      errors.push(error("archetype_ambiguous_label_invalid", "label"));
    }
  } else if (value.state === "uncertain") {
    if (value.top1 !== null || value.rankedAlternatives.length !== 0 || value.ambiguityCandidates.length !== 0 || value.confidence !== "low") {
      errors.push(error("archetype_uncertain_label_invalid", "label"));
    }
  } else if (value.top1 !== null || value.rankedAlternatives.length !== 0 || value.ambiguityCandidates.length !== 0 || value.confidence !== "not_applicable") {
    errors.push(error("archetype_not_assessable_label_invalid", "label"));
  }
  if (assessability?.state === "not_assessable" && value.state !== "not_assessable") {
    errors.push(error("archetype_forced_label_invalid", "label.state"));
  }
  if (assessability?.state === "uncertain_assessability" && value.state !== "uncertain") {
    errors.push(error("archetype_uncertain_assessability_label_invalid", "label.state"));
  }
  if (assessability?.state === "assessable" && value.state === "not_assessable") {
    errors.push(error("archetype_assessable_label_invalid", "label.state"));
  }
}

export function validateArchetypeHumanAnnotation(value) {
  const errors = [];
  const keys = [
    "schemaVersion", "annotationContractVersion", "annotationId", "reviewSessionId", "sessionDigest",
    "reviewItemId", "reviewItemDigest", "reviewerId", "taxonomyVersion", "registryVersion",
    "evidenceTagRegistryVersion", "assessability", "label", "evidenceTags", "supersedesAnnotationDigest",
    "submittedAt", "sealState", "annotationDigest"
  ];
  if (!exactKeys(value, keys)) return result([error("archetype_human_annotation_invalid", "$")]);
  if (value.schemaVersion !== ARCHETYPE_HUMAN_ANNOTATION_SCHEMA_VERSION ||
      value.annotationContractVersion !== ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION ||
      !ANNOTATION_ID.test(value.annotationId || "") || !SESSION_ID.test(value.reviewSessionId || "") ||
      !validDigest(value.sessionDigest) || !REVIEW_ITEM_ID.test(value.reviewItemId || "") ||
      !validDigest(value.reviewItemDigest) || !REVIEWER_ID.test(value.reviewerId || "") ||
      !validToken(value.taxonomyVersion) || !validToken(value.registryVersion) ||
      value.evidenceTagRegistryVersion !== ARCHETYPE_EVIDENCE_TAG_REGISTRY_VERSION ||
      !(value.supersedesAnnotationDigest === null || validDigest(value.supersedesAnnotationDigest)) ||
      !isIso(value.submittedAt) || value.sealState !== "sealed" || !validDigest(value.annotationDigest)) {
    errors.push(error("archetype_human_annotation_invalid", "$"));
  }
  validateAssessability(value.assessability, errors);
  validateAnnotationLabel(value.label, value.assessability, errors);
  if (!uniqueEnumArray(value.evidenceTags, ARCHETYPE_EVIDENCE_TAGS) ||
      (["ranked", "ambiguous"].includes(value.label?.state) && value.evidenceTags.length === 0)) {
    errors.push(error("archetype_evidence_tags_invalid", "evidenceTags"));
  }
  return result(errors);
}

function validateAnnotationRefs(value, errors, path) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) =>
    !exactKeys(item, ["annotationId", "annotationDigest", "reviewerId"]) ||
    !ANNOTATION_ID.test(item.annotationId || "") || !validDigest(item.annotationDigest) ||
    !REVIEWER_ID.test(item.reviewerId || "")
  )) {
    errors.push(error("archetype_annotation_refs_invalid", path));
    return;
  }
  for (const key of ["annotationId", "annotationDigest", "reviewerId"]) {
    if (new Set(value.map((item) => item[key])).size !== value.length) {
      errors.push(error("archetype_annotation_refs_duplicate", `${path}.${key}`));
    }
  }
}

export function validateArchetypeAnnotationSet(value) {
  const errors = [];
  const keys = [
    "schemaVersion", "annotationSetId", "reviewItemId", "reviewItemDigest", "taxonomyVersion",
    "annotationContractVersion", "sourceAnnotations", "independentReviewConfirmed", "sealedAt", "annotationSetDigest"
  ];
  if (!exactKeys(value, keys)) return result([error("archetype_annotation_set_invalid", "$")]);
  if (value.schemaVersion !== ARCHETYPE_ANNOTATION_SET_SCHEMA_VERSION ||
      !ANNOTATION_SET_ID.test(value.annotationSetId || "") || !REVIEW_ITEM_ID.test(value.reviewItemId || "") ||
      !validDigest(value.reviewItemDigest) || !validToken(value.taxonomyVersion) ||
      value.annotationContractVersion !== ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION ||
      value.independentReviewConfirmed !== true || !isIso(value.sealedAt) || !validDigest(value.annotationSetDigest)) {
    errors.push(error("archetype_annotation_set_invalid", "$"));
  }
  validateAnnotationRefs(value.sourceAnnotations, errors, "sourceAnnotations");
  return result(errors);
}

export function validateArchetypeAnnotationBindings({ annotation, session, reviewItem, sha256Hex }) {
  const errors = [];
  if (!validateArchetypeHumanAnnotation(annotation).ok) errors.push(error("archetype_annotation_binding_invalid", "annotation"));
  if (!validateArchetypeReviewSession(session).ok || session?.sessionState !== "sealed") errors.push(error("archetype_annotation_binding_invalid", "session"));
  if (!validateArchetypeReviewItem(reviewItem).ok) errors.push(error("archetype_annotation_binding_invalid", "reviewItem"));
  const sessionRef = session?.reviewItemRefs?.find((item) => item.reviewItemId === annotation?.reviewItemId);
  const bound = annotation?.reviewSessionId === session?.reviewSessionId &&
    annotation?.sessionDigest === session?.sessionDigest &&
    annotation?.reviewerId === session?.reviewerId &&
    annotation?.reviewItemId === reviewItem?.reviewItemId &&
    annotation?.reviewItemDigest === reviewItem?.reviewItemDigest &&
    sessionRef?.reviewItemDigest === reviewItem?.reviewItemDigest &&
    annotation?.taxonomyVersion === reviewItem?.taxonomyVersion &&
    annotation?.registryVersion === reviewItem?.registryVersion &&
    session?.datasetId === reviewItem?.datasetId &&
    session?.splitId === reviewItem?.splitId &&
    session?.taxonomyVersion === reviewItem?.taxonomyVersion &&
    session?.registryVersion === reviewItem?.registryVersion &&
    reviewItem?.consentAuthority?.withdrawalState === "active" &&
    Date.parse(annotation?.submittedAt) >= Date.parse(session?.issuedAt) &&
    Date.parse(annotation?.submittedAt) <= Date.parse(session?.sealedAt) &&
    verifyArchetypeHumanEvaluationDigest(reviewItem, "reviewItemDigest", sha256Hex) &&
    verifyArchetypeHumanEvaluationDigest(session, "sessionDigest", sha256Hex) &&
    verifyArchetypeHumanEvaluationDigest(annotation, "annotationDigest", sha256Hex);
  if (!bound) errors.push(error("archetype_annotation_binding_invalid", "$"));
  return result(errors);
}

export function validateArchetypeAnnotationSetBindings({ annotationSet, annotations, sha256Hex }) {
  const errors = [];
  if (!validateArchetypeAnnotationSet(annotationSet).ok ||
      !verifyArchetypeHumanEvaluationDigest(annotationSet, "annotationSetDigest", sha256Hex)) {
    errors.push(error("archetype_annotation_set_binding_invalid", "annotationSet"));
  }
  if (!Array.isArray(annotations) || annotations.length !== annotationSet?.sourceAnnotations?.length) {
    errors.push(error("archetype_annotation_set_binding_invalid", "annotations"));
    return result(errors);
  }
  const byId = new Map(annotations.map((annotation) => [annotation?.annotationId, annotation]));
  if (byId.size !== annotations.length) errors.push(error("archetype_annotation_set_binding_invalid", "annotations"));
  const sourceDigests = new Set(annotations.map((annotation) => annotation?.annotationDigest));
  for (const ref of annotationSet.sourceAnnotations || []) {
    const annotation = byId.get(ref.annotationId);
    if (!annotation || !validateArchetypeHumanAnnotation(annotation).ok ||
        !verifyArchetypeHumanEvaluationDigest(annotation, "annotationDigest", sha256Hex) ||
        annotation.annotationDigest !== ref.annotationDigest || annotation.reviewerId !== ref.reviewerId ||
        annotation.reviewItemId !== annotationSet.reviewItemId || annotation.reviewItemDigest !== annotationSet.reviewItemDigest ||
        annotation.taxonomyVersion !== annotationSet.taxonomyVersion ||
        annotation.annotationContractVersion !== annotationSet.annotationContractVersion || annotation.sealState !== "sealed") {
      errors.push(error("archetype_annotation_set_binding_invalid", `sourceAnnotations.${ref.annotationId}`));
    }
    if (annotation?.supersedesAnnotationDigest !== null && sourceDigests.has(annotation?.supersedesAnnotationDigest)) {
      errors.push(error("archetype_annotation_set_supersession_conflict", `sourceAnnotations.${ref.annotationId}`));
    }
  }
  return result(errors);
}

function validateDistribution(value, countKey, allowed, errors, path) {
  if (!Array.isArray(value) || value.some((item) =>
    !exactKeys(item, ["archetype", countKey]) || !allowed.includes(item.archetype) ||
    !Number.isInteger(item[countKey]) || item[countKey] < 0
  ) || new Set(value.map((item) => item.archetype)).size !== value.length) {
    errors.push(error("archetype_distribution_invalid", path));
  }
}

export function validateArchetypeConsensus(value) {
  const errors = [];
  const keys = [
    "schemaVersion", "consensusId", "annotationSetId", "annotationSetDigest", "reviewItemId",
    "reviewItemDigest", "taxonomyVersion", "consensusContractVersion", "consensusAlgorithm",
    "sourceAnnotations", "assessableAnnotationCount", "annotationStateCounts", "top1Distribution", "rankedAlternativeDistribution",
    "ambiguity", "confidenceDistribution", "evidenceTagAgreement", "disagreement", "status",
    "consensusLabel", "consensusAt", "consensusDigest"
  ];
  if (!exactKeys(value, keys)) return result([error("archetype_consensus_invalid", "$")]);
  if (value.schemaVersion !== ARCHETYPE_CONSENSUS_SCHEMA_VERSION || !CONSENSUS_ID.test(value.consensusId || "") ||
      !ANNOTATION_SET_ID.test(value.annotationSetId || "") || !validDigest(value.annotationSetDigest) ||
      !REVIEW_ITEM_ID.test(value.reviewItemId || "") || !validDigest(value.reviewItemDigest) ||
      !validToken(value.taxonomyVersion) || value.consensusContractVersion !== ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION ||
      !ARCHETYPE_CONSENSUS_STATES.includes(value.status) ||
      !(value.consensusLabel === null || ARCHETYPE_TAXONOMY_KEYS.includes(value.consensusLabel)) ||
      !isIso(value.consensusAt) || !validDigest(value.consensusDigest)) {
    errors.push(error("archetype_consensus_invalid", "$"));
  }
  if (!exactKeys(value.consensusAlgorithm, ["id", "version", "policyStatus"]) ||
      !validToken(value.consensusAlgorithm?.id) || !validToken(value.consensusAlgorithm?.version) ||
      !ARCHETYPE_CONSENSUS_POLICY_STATES.includes(value.consensusAlgorithm?.policyStatus)) {
    errors.push(error("archetype_consensus_algorithm_invalid", "consensusAlgorithm"));
  }
  validateAnnotationRefs(value.sourceAnnotations, errors, "sourceAnnotations");
  if (!Number.isInteger(value.assessableAnnotationCount) || value.assessableAnnotationCount < 0 || value.assessableAnnotationCount > (value.sourceAnnotations?.length || 0)) {
    errors.push(error("archetype_consensus_denominator_invalid", "assessableAnnotationCount"));
  }
  if (!exactKeys(value.annotationStateCounts, ARCHETYPE_LABEL_STATES) ||
      Object.values(value.annotationStateCounts || {}).some((count) => !Number.isInteger(count) || count < 0) ||
      Object.values(value.annotationStateCounts || {}).reduce((sum, count) => sum + count, 0) !== (value.sourceAnnotations?.length || 0)) {
    errors.push(error("archetype_consensus_annotation_states_invalid", "annotationStateCounts"));
  }
  validateDistribution(value.top1Distribution, "count", ARCHETYPE_TAXONOMY_KEYS, errors, "top1Distribution");
  validateDistribution(value.rankedAlternativeDistribution, "appearanceCount", ARCHETYPE_TAXONOMY_KEYS, errors, "rankedAlternativeDistribution");
  if (Array.isArray(value.top1Distribution) && !followsRegistryOrder(value.top1Distribution.map((item) => item.archetype), ARCHETYPE_TAXONOMY_KEYS)) {
    errors.push(error("archetype_distribution_order_invalid", "top1Distribution"));
  }
  if (Array.isArray(value.rankedAlternativeDistribution) && !followsRegistryOrder(value.rankedAlternativeDistribution.map((item) => item.archetype), ARCHETYPE_TAXONOMY_KEYS)) {
    errors.push(error("archetype_distribution_order_invalid", "rankedAlternativeDistribution"));
  }
  if (Array.isArray(value.top1Distribution) && value.top1Distribution.reduce((sum, item) => sum + item.count, 0) > value.assessableAnnotationCount) {
    errors.push(error("archetype_consensus_denominator_invalid", "top1Distribution"));
  }
  if (!exactKeys(value.ambiguity, ["present", "candidates"]) || typeof value.ambiguity?.present !== "boolean" ||
      !uniqueEnumArray(value.ambiguity?.candidates, ARCHETYPE_TAXONOMY_KEYS) ||
      (value.ambiguity?.present ? value.ambiguity.candidates.length < 2 : value.ambiguity?.candidates.length !== 0)) {
    errors.push(error("archetype_consensus_ambiguity_invalid", "ambiguity"));
  }
  if (!exactKeys(value.confidenceDistribution, ARCHETYPE_CONFIDENCE_VALUES) ||
      Object.values(value.confidenceDistribution || {}).some((count) => !Number.isInteger(count) || count < 0) ||
      Object.values(value.confidenceDistribution || {}).reduce((sum, count) => sum + count, 0) !== (value.sourceAnnotations?.length || 0)) {
    errors.push(error("archetype_consensus_confidence_invalid", "confidenceDistribution"));
  }
  if (!Array.isArray(value.evidenceTagAgreement) || value.evidenceTagAgreement.some((item) =>
    !exactKeys(item, ["tag", "reviewerCount"]) || !ARCHETYPE_EVIDENCE_TAGS.includes(item.tag) ||
    !Number.isInteger(item.reviewerCount) || item.reviewerCount < 0 || item.reviewerCount > (value.sourceAnnotations?.length || 0)
  ) || new Set(value.evidenceTagAgreement.map((item) => item.tag)).size !== value.evidenceTagAgreement.length) {
    errors.push(error("archetype_consensus_evidence_invalid", "evidenceTagAgreement"));
  }
  if (Array.isArray(value.evidenceTagAgreement) && !followsRegistryOrder(value.evidenceTagAgreement.map((item) => item.tag), ARCHETYPE_EVIDENCE_TAGS)) {
    errors.push(error("archetype_consensus_evidence_order_invalid", "evidenceTagAgreement"));
  }
  if (!exactKeys(value.disagreement, ["present", "distinctRankedTop1Count", "unresolved"]) ||
      typeof value.disagreement?.present !== "boolean" || typeof value.disagreement?.unresolved !== "boolean" ||
      !Number.isInteger(value.disagreement?.distinctRankedTop1Count) || value.disagreement.distinctRankedTop1Count < 0 ||
      value.disagreement.present !== (value.disagreement.distinctRankedTop1Count > 1)) {
    errors.push(error("archetype_consensus_disagreement_invalid", "disagreement"));
  }
  const statusLabelValid = value.status === "clear_consensus"
    ? value.consensusLabel !== null && value.ambiguity?.present === false
    : value.consensusLabel === null;
  if (!statusLabelValid || (value.status === "ambiguous_consensus" && value.ambiguity?.present !== true) ||
      (value.status === "not_assessable" && value.assessableAnnotationCount !== 0)) {
    errors.push(error("archetype_consensus_state_invalid", "status"));
  }
  return result(errors);
}

export function validateArchetypeConsensusBindings({ consensus, annotationSet, annotations, sha256Hex }) {
  const errors = [];
  if (!validateArchetypeConsensus(consensus).ok ||
      !verifyArchetypeHumanEvaluationDigest(consensus, "consensusDigest", sha256Hex)) {
    errors.push(error("archetype_consensus_binding_invalid", "consensus"));
  }
  if (!validateArchetypeAnnotationSetBindings({ annotationSet, annotations, sha256Hex }).ok) errors.push(error("archetype_consensus_binding_invalid", "annotationSet"));
  const sourceRefsMatch = Array.isArray(consensus?.sourceAnnotations) &&
    consensus.sourceAnnotations.length === annotationSet?.sourceAnnotations?.length &&
    consensus.sourceAnnotations.every((ref) => annotationSet.sourceAnnotations.some((source) =>
      source.annotationId === ref.annotationId && source.annotationDigest === ref.annotationDigest && source.reviewerId === ref.reviewerId
    ));
  const assessed = annotations.filter((annotation) => annotation.assessability.state === "assessable");
  const counts = (values) => ARCHETYPE_TAXONOMY_KEYS
    .map((archetype) => ({ archetype, count: values.filter((value) => value === archetype).length }))
    .filter((item) => item.count > 0);
  const appearanceCounts = ARCHETYPE_TAXONOMY_KEYS
    .map((archetype) => ({
      archetype,
      appearanceCount: assessed.filter((annotation) => annotation.label.rankedAlternatives.includes(archetype)).length
    }))
    .filter((item) => item.appearanceCount > 0);
  const top1Distribution = counts(assessed.map((annotation) => annotation.label.top1).filter(Boolean));
  const annotationStateCounts = Object.fromEntries(ARCHETYPE_LABEL_STATES.map((state) => [
    state,
    annotations.filter((annotation) => annotation.label.state === state).length
  ]));
  const confidenceDistribution = Object.fromEntries(ARCHETYPE_CONFIDENCE_VALUES.map((confidence) => [
    confidence,
    annotations.filter((annotation) => annotation.label.confidence === confidence).length
  ]));
  const evidenceTagAgreement = ARCHETYPE_EVIDENCE_TAGS
    .map((tag) => ({ tag, reviewerCount: annotations.filter((annotation) => annotation.evidenceTags.includes(tag)).length }))
    .filter((item) => item.reviewerCount > 0);
  const distinctRankedTop1Count = new Set(assessed.map((annotation) => annotation.label.top1).filter(Boolean)).size;
  const factualSummariesMatch = JSON.stringify(sortKeys(consensus?.top1Distribution)) === JSON.stringify(sortKeys(top1Distribution)) &&
    JSON.stringify(sortKeys(consensus?.annotationStateCounts)) === JSON.stringify(sortKeys(annotationStateCounts)) &&
    JSON.stringify(sortKeys(consensus?.rankedAlternativeDistribution)) === JSON.stringify(sortKeys(appearanceCounts)) &&
    JSON.stringify(sortKeys(consensus?.confidenceDistribution)) === JSON.stringify(sortKeys(confidenceDistribution)) &&
    JSON.stringify(sortKeys(consensus?.evidenceTagAgreement)) === JSON.stringify(sortKeys(evidenceTagAgreement)) &&
    consensus?.assessableAnnotationCount === assessed.length &&
    consensus?.disagreement?.distinctRankedTop1Count === distinctRankedTop1Count &&
    consensus?.disagreement?.present === (distinctRankedTop1Count > 1);
  const bound = consensus?.annotationSetId === annotationSet?.annotationSetId &&
    consensus?.annotationSetDigest === annotationSet?.annotationSetDigest &&
    consensus?.reviewItemId === annotationSet?.reviewItemId &&
    consensus?.reviewItemDigest === annotationSet?.reviewItemDigest &&
    consensus?.taxonomyVersion === annotationSet?.taxonomyVersion && sourceRefsMatch && factualSummariesMatch;
  if (!bound) errors.push(error("archetype_consensus_binding_invalid", "$"));
  return result(errors);
}

export function validateArchetypeAdjudication(value) {
  const errors = [];
  const keys = [
    "schemaVersion", "adjudicationId", "consensusId", "consensusDigest", "annotationSetDigest",
    "reviewItemId", "reviewItemDigest", "adjudicatorId", "adjudicationPolicyVersion", "engineOutputUsed",
    "outcome", "resolvedLabel", "reasonCodes", "adjudicatedAt", "adjudicationDigest"
  ];
  if (!exactKeys(value, keys)) return result([error("archetype_adjudication_invalid", "$")]);
  if (value.schemaVersion !== ARCHETYPE_ADJUDICATION_SCHEMA_VERSION || !ADJUDICATION_ID.test(value.adjudicationId || "") ||
      !CONSENSUS_ID.test(value.consensusId || "") || !validDigest(value.consensusDigest) || !validDigest(value.annotationSetDigest) ||
      !REVIEW_ITEM_ID.test(value.reviewItemId || "") || !validDigest(value.reviewItemDigest) ||
      !REVIEWER_ID.test(value.adjudicatorId || "") || !validToken(value.adjudicationPolicyVersion) ||
      value.engineOutputUsed !== false || !ARCHETYPE_ADJUDICATION_OUTCOMES.includes(value.outcome) ||
      !(value.resolvedLabel === null || ARCHETYPE_TAXONOMY_KEYS.includes(value.resolvedLabel)) ||
      !uniqueEnumArray(value.reasonCodes, ARCHETYPE_ADJUDICATION_REASON_CODES, { allowEmpty: false }) ||
      !isIso(value.adjudicatedAt) || !validDigest(value.adjudicationDigest)) {
    errors.push(error("archetype_adjudication_invalid", "$"));
  }
  if ((value.outcome === "superseding_resolution") !== (value.resolvedLabel !== null)) {
    errors.push(error("archetype_adjudication_resolution_invalid", "resolvedLabel"));
  }
  return result(errors);
}

export function validateArchetypeAdjudicationBindings({ adjudication, consensus, annotationSet, sha256Hex }) {
  const errors = [];
  if (!validateArchetypeAdjudication(adjudication).ok ||
      !verifyArchetypeHumanEvaluationDigest(adjudication, "adjudicationDigest", sha256Hex)) {
    errors.push(error("archetype_adjudication_binding_invalid", "adjudication"));
  }
  if (!validateArchetypeConsensus(consensus).ok ||
      !verifyArchetypeHumanEvaluationDigest(consensus, "consensusDigest", sha256Hex)) {
    errors.push(error("archetype_adjudication_binding_invalid", "consensus"));
  }
  if (!validateArchetypeAnnotationSet(annotationSet).ok ||
      !verifyArchetypeHumanEvaluationDigest(annotationSet, "annotationSetDigest", sha256Hex)) {
    errors.push(error("archetype_adjudication_binding_invalid", "annotationSet"));
  }
  const bound = adjudication?.consensusId === consensus?.consensusId &&
    adjudication?.consensusDigest === consensus?.consensusDigest &&
    adjudication?.annotationSetDigest === annotationSet?.annotationSetDigest &&
    adjudication?.reviewItemId === consensus?.reviewItemId &&
    adjudication?.reviewItemId === annotationSet?.reviewItemId &&
    adjudication?.reviewItemDigest === consensus?.reviewItemDigest &&
    adjudication?.reviewItemDigest === annotationSet?.reviewItemDigest;
  if (!bound) errors.push(error("archetype_adjudication_binding_invalid", "$"));
  return result(errors);
}

function validateManifestEntry(value, errors, path) {
  const keys = [
    "subjectId", "subjectGroupId", "leakageGroupId", "imageId", "reviewItemId", "reviewItemDigest",
    "annotationSetId", "annotationSetDigest", "consensusArtifactId", "consensusDigest", "consentRecordId",
    "withdrawalState", "included"
  ];
  if (!exactKeys(value, keys) || !SUBJECT_ID.test(value?.subjectId || "") || !GROUP_ID.test(value?.subjectGroupId || "") ||
      !GROUP_ID.test(value?.leakageGroupId || "") || !IMAGE_ID.test(value?.imageId || "") ||
      !REVIEW_ITEM_ID.test(value?.reviewItemId || "") || !validDigest(value?.reviewItemDigest) ||
      !ANNOTATION_SET_ID.test(value?.annotationSetId || "") || !validDigest(value?.annotationSetDigest) ||
      !(value?.consensusArtifactId === null || CONSENSUS_ID.test(value.consensusArtifactId)) ||
      !(value?.consensusDigest === null || validDigest(value.consensusDigest)) ||
      (value?.consensusArtifactId === null) !== (value?.consensusDigest === null) ||
      !CONSENT_RECORD_ID.test(value?.consentRecordId || "") || !ARCHETYPE_WITHDRAWAL_STATES.includes(value?.withdrawalState) ||
      typeof value?.included !== "boolean" || value.included !== (value.withdrawalState === "active")) {
    errors.push(error("archetype_dataset_entry_invalid", path));
  }
}

export function validateArchetypeDatasetManifest(value) {
  const errors = [];
  const keys = [
    "schemaVersion", "datasetId", "datasetVersion", "evidenceClass", "taxonomyVersion", "registryVersion",
    "annotationContractVersion", "consensusContractVersion", "consentPolicyVersion", "retentionPolicyVersion",
    "splits", "createdAt", "datasetManifestDigest"
  ];
  if (!exactKeys(value, keys)) return result([error("archetype_dataset_manifest_invalid", "$")]);
  if (value.schemaVersion !== ARCHETYPE_DATASET_MANIFEST_SCHEMA_VERSION ||
      ![value.datasetId, value.datasetVersion, value.taxonomyVersion, value.registryVersion, value.consentPolicyVersion, value.retentionPolicyVersion].every(validToken) ||
      value.evidenceClass !== "human_annotated_real" ||
      value.annotationContractVersion !== ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION ||
      value.consensusContractVersion !== ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION ||
      !isIso(value.createdAt) || !validDigest(value.datasetManifestDigest)) {
    errors.push(error("archetype_dataset_manifest_invalid", "$"));
  }
  if (!Array.isArray(value.splits) || value.splits.length === 0 || value.splits.some((split) =>
    !exactKeys(split, ["splitId", "splitRole", "splitVersion", "entries", "splitDigest"]) ||
    !validToken(split.splitId) || !ARCHETYPE_SPLIT_ROLES.includes(split.splitRole) || !validToken(split.splitVersion) ||
    !Array.isArray(split.entries) || split.entries.length === 0 || !validDigest(split.splitDigest)
  )) {
    errors.push(error("archetype_dataset_splits_invalid", "splits"));
    return result(errors);
  }
  if (new Set(value.splits.map((split) => split.splitId)).size !== value.splits.length ||
      new Set(value.splits.map((split) => split.splitRole)).size !== value.splits.length) {
    errors.push(error("archetype_dataset_splits_duplicate", "splits"));
  }
  const protectedGroups = new Map();
  const reviewItems = new Set();
  for (const [splitIndex, split] of value.splits.entries()) {
    for (const [entryIndex, entry] of split.entries.entries()) {
      validateManifestEntry(entry, errors, `splits.${splitIndex}.entries.${entryIndex}`);
      if (reviewItems.has(entry.reviewItemId)) errors.push(error("archetype_dataset_review_item_duplicate", `splits.${splitIndex}.entries.${entryIndex}.reviewItemId`));
      reviewItems.add(entry.reviewItemId);
      for (const key of [entry.subjectId, entry.subjectGroupId, entry.leakageGroupId]) {
        const existingRole = protectedGroups.get(key);
        if (existingRole && existingRole !== split.splitRole) errors.push(error("archetype_dataset_cross_split_leakage", `splits.${splitIndex}.entries.${entryIndex}`));
        protectedGroups.set(key, split.splitRole);
      }
    }
  }
  return result(errors);
}

export function validateArchetypeDatasetManifestBindings({ manifest, reviewItems, annotationSets, consensuses, sha256Hex }) {
  const errors = [];
  if (!verifyArchetypeDatasetManifestDigests(manifest, sha256Hex)) {
    errors.push(error("archetype_dataset_binding_invalid", "manifest"));
  }
  if (!Array.isArray(reviewItems) || !Array.isArray(annotationSets) || !Array.isArray(consensuses)) {
    return result([...errors, error("archetype_dataset_binding_invalid", "sources")]);
  }
  const itemById = new Map(reviewItems.map((item) => [item?.reviewItemId, item]));
  const setById = new Map(annotationSets.map((set) => [set?.annotationSetId, set]));
  const consensusById = new Map(consensuses.map((consensus) => [consensus?.consensusId, consensus]));
  const entries = manifest?.splits?.flatMap((split) => split.entries.map((entry) => ({ split, entry }))) || [];
  const consensusEntryCount = entries.filter(({ entry }) => entry.consensusArtifactId !== null).length;
  if (itemById.size !== reviewItems.length || setById.size !== annotationSets.length || consensusById.size !== consensuses.length ||
      itemById.size !== entries.length || setById.size !== entries.length || consensusById.size !== consensusEntryCount) {
    errors.push(error("archetype_dataset_binding_invalid", "sources"));
  }
  for (const { split, entry } of entries) {
    const item = itemById.get(entry.reviewItemId);
    const set = setById.get(entry.annotationSetId);
    const consensus = entry.consensusArtifactId === null ? null : consensusById.get(entry.consensusArtifactId);
    const itemBound = item && validateArchetypeReviewItem(item).ok &&
      verifyArchetypeHumanEvaluationDigest(item, "reviewItemDigest", sha256Hex) &&
      item.reviewItemDigest === entry.reviewItemDigest && item.datasetId === manifest.datasetId &&
      item.datasetVersion === manifest.datasetVersion && item.splitId === split.splitId && item.splitRole === split.splitRole &&
      item.taxonomyVersion === manifest.taxonomyVersion && item.registryVersion === manifest.registryVersion &&
      item.subjectId === entry.subjectId && item.subjectGroupId === entry.subjectGroupId &&
      item.leakageGroupId === entry.leakageGroupId && item.imageId === entry.imageId &&
      item.consentAuthority.consentRecordId === entry.consentRecordId &&
      item.consentAuthority.consentPolicyVersion === manifest.consentPolicyVersion &&
      item.consentAuthority.retentionPolicyVersion === manifest.retentionPolicyVersion &&
      item.consentAuthority.withdrawalState === entry.withdrawalState;
    const setBound = set && validateArchetypeAnnotationSet(set).ok &&
      verifyArchetypeHumanEvaluationDigest(set, "annotationSetDigest", sha256Hex) &&
      set.annotationSetDigest === entry.annotationSetDigest && set.reviewItemId === entry.reviewItemId &&
      set.reviewItemDigest === entry.reviewItemDigest && set.taxonomyVersion === manifest.taxonomyVersion &&
      set.annotationContractVersion === manifest.annotationContractVersion;
    const consensusBound = entry.consensusArtifactId === null
      ? entry.consensusDigest === null
      : consensus && validateArchetypeConsensus(consensus).ok &&
        verifyArchetypeHumanEvaluationDigest(consensus, "consensusDigest", sha256Hex) &&
        consensus.consensusDigest === entry.consensusDigest && consensus.annotationSetId === entry.annotationSetId &&
        consensus.annotationSetDigest === entry.annotationSetDigest && consensus.reviewItemId === entry.reviewItemId &&
        consensus.reviewItemDigest === entry.reviewItemDigest && consensus.taxonomyVersion === manifest.taxonomyVersion &&
        consensus.consensusContractVersion === manifest.consensusContractVersion;
    if (!itemBound || !setBound || !consensusBound) {
      errors.push(error("archetype_dataset_binding_invalid", `splits.${split.splitId}.entries.${entry.reviewItemId}`));
    }
  }
  return result(errors);
}

const VALIDATORS = Object.freeze({
  [ARCHETYPE_REVIEW_ITEM_SCHEMA_VERSION]: validateArchetypeReviewItem,
  [ARCHETYPE_REVIEW_SESSION_SCHEMA_VERSION]: validateArchetypeReviewSession,
  [ARCHETYPE_HUMAN_ANNOTATION_SCHEMA_VERSION]: validateArchetypeHumanAnnotation,
  [ARCHETYPE_ANNOTATION_SET_SCHEMA_VERSION]: validateArchetypeAnnotationSet,
  [ARCHETYPE_CONSENSUS_SCHEMA_VERSION]: validateArchetypeConsensus,
  [ARCHETYPE_ADJUDICATION_SCHEMA_VERSION]: validateArchetypeAdjudication,
  [ARCHETYPE_DATASET_MANIFEST_SCHEMA_VERSION]: validateArchetypeDatasetManifest
});

export function validateArchetypeHumanEvaluationArtifact(value) {
  const validator = VALIDATORS[value?.schemaVersion];
  return validator ? validator(value) : result([error("archetype_human_evaluation_schema_unsupported", "schemaVersion")]);
}

export const archetypeHumanEvaluationContractInternals = Object.freeze({
  exactKeys,
  isIso,
  validDigest,
  REVIEW_ITEM_ID,
  SESSION_ID,
  ANNOTATION_ID,
  ANNOTATION_SET_ID,
  CONSENSUS_ID,
  ADJUDICATION_ID,
  REVIEWER_ID,
  SUBJECT_ID,
  GROUP_ID,
  IMAGE_ID,
  OPAQUE_ASSET_REF
});
