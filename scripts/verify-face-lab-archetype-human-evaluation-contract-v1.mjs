import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  ARCHETYPE_ADJUDICATION_SCHEMA_VERSION,
  ARCHETYPE_ANNOTATION_SET_SCHEMA_VERSION,
  ARCHETYPE_CONSENSUS_SCHEMA_VERSION,
  ARCHETYPE_DATASET_MANIFEST_SCHEMA_VERSION,
  ARCHETYPE_EVIDENCE_TAG_REGISTRY_VERSION,
  ARCHETYPE_HUMAN_ANNOTATION_SCHEMA_VERSION,
  ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION,
  ARCHETYPE_REQUIRED_BLIND_STATE,
  ARCHETYPE_REVIEW_ITEM_SCHEMA_VERSION,
  ARCHETYPE_REVIEW_SESSION_SCHEMA_VERSION,
  canonicalizeArchetypeHumanEvaluationArtifact,
  validateArchetypeAdjudication,
  validateArchetypeAdjudicationBindings,
  validateArchetypeAnnotationBindings,
  validateArchetypeAnnotationSet,
  validateArchetypeAnnotationSetBindings,
  validateArchetypeConsensus,
  validateArchetypeConsensusBindings,
  validateArchetypeDatasetManifest,
  validateArchetypeDatasetManifestBindings,
  validateArchetypeHumanAnnotation,
  validateArchetypeHumanEvaluationArtifact,
  validateArchetypeReviewItem,
  validateArchetypeReviewSession,
  verifyArchetypeDatasetManifestDigests,
  verifyArchetypeHumanEvaluationDigest
} from "@bejewely/face-contracts";

const hex = (seed) => createHash("sha256").update(seed).digest("hex");
const id = (prefix, seed) => `${prefix}_${hex(seed).slice(0, 24)}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const iso = "2026-08-13T00:00:00.000Z";

function seal(value, digestKey) {
  const draft = { ...value, [digestKey]: hex("placeholder") };
  return { ...value, [digestKey]: hex(canonicalizeArchetypeHumanEvaluationArtifact(draft, digestKey)) };
}

function reviewItem(seed = "one", overrides = {}) {
  return seal({
    schemaVersion: ARCHETYPE_REVIEW_ITEM_SCHEMA_VERSION,
    reviewItemId: id("flri", seed),
    datasetId: "face-lab-real-eval",
    datasetVersion: "v1",
    splitId: "development-v1",
    splitRole: "development",
    evidenceClass: "human_annotated_real",
    subjectId: id("flsub", `subject-${seed}`),
    subjectGroupId: id("flgrp", `subject-group-${seed}`),
    leakageGroupId: id("flgrp", `leakage-${seed}`),
    imageId: id("flimg", seed),
    opaqueAssetRef: `asset_${hex(`asset-${seed}`).slice(0, 32)}`,
    taxonomyVersion: "face-lab-archetype-taxonomy-v1",
    registryVersion: "face-lab-archetype-rubric-20260727",
    observationSchemaVersion: "face-lab-observation-v1",
    consentAuthority: {
      consentRecordId: `consent_${hex(`consent-${seed}`).slice(0, 32)}`,
      consentPolicyVersion: "evaluation-consent-v1",
      retentionPolicyVersion: "evaluation-retention-v1",
      withdrawalState: "active"
    },
    createdAt: iso,
    ...overrides
  }, "reviewItemDigest");
}

function session(item, seed = "one", overrides = {}) {
  return seal({
    schemaVersion: ARCHETYPE_REVIEW_SESSION_SCHEMA_VERSION,
    reviewSessionId: id("flrs", seed),
    datasetId: item.datasetId,
    splitId: item.splitId,
    taxonomyVersion: item.taxonomyVersion,
    registryVersion: item.registryVersion,
    annotationContractVersion: ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION,
    reviewerId: `reviewer_${seed}_alpha`,
    reviewerPolicyVersion: "independent-blind-review-v1",
    reviewItemRefs: [{ reviewItemId: item.reviewItemId, reviewItemDigest: item.reviewItemDigest }],
    blindState: { ...ARCHETYPE_REQUIRED_BLIND_STATE },
    sessionState: "sealed",
    issuedAt: iso,
    sealedAt: "2026-08-13T00:05:00.000Z",
    ...overrides
  }, "sessionDigest");
}

function annotation(item, reviewSession, seed = "one", labelOverrides = {}, overrides = {}) {
  return seal({
    schemaVersion: ARCHETYPE_HUMAN_ANNOTATION_SCHEMA_VERSION,
    annotationContractVersion: ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION,
    annotationId: id("flann", seed),
    reviewSessionId: reviewSession.reviewSessionId,
    sessionDigest: reviewSession.sessionDigest,
    reviewItemId: item.reviewItemId,
    reviewItemDigest: item.reviewItemDigest,
    reviewerId: reviewSession.reviewerId,
    taxonomyVersion: item.taxonomyVersion,
    registryVersion: item.registryVersion,
    evidenceTagRegistryVersion: ARCHETYPE_EVIDENCE_TAG_REGISTRY_VERSION,
    assessability: { state: "assessable", reasonCodes: [] },
    label: {
      state: "ranked",
      top1: "cat",
      rankedAlternatives: ["wolf", "deer"],
      ambiguityCandidates: [],
      confidence: "medium",
      ...labelOverrides
    },
    evidenceTags: ["eyes.direction", "feature_layout.concentration"],
    supersedesAnnotationDigest: null,
    submittedAt: "2026-08-13T00:04:00.000Z",
    sealState: "sealed",
    ...overrides
  }, "annotationDigest");
}

function annotationSet(item, annotations) {
  return seal({
    schemaVersion: ARCHETYPE_ANNOTATION_SET_SCHEMA_VERSION,
    annotationSetId: id("flaset", item.reviewItemId),
    reviewItemId: item.reviewItemId,
    reviewItemDigest: item.reviewItemDigest,
    taxonomyVersion: item.taxonomyVersion,
    annotationContractVersion: ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION,
    sourceAnnotations: annotations.map(({ annotationId, annotationDigest, reviewerId }) => ({ annotationId, annotationDigest, reviewerId })),
    independentReviewConfirmed: true,
    sealedAt: "2026-08-13T00:06:00.000Z"
  }, "annotationSetDigest");
}

function consensus(item, set, annotations, overrides = {}) {
  return seal({
    schemaVersion: ARCHETYPE_CONSENSUS_SCHEMA_VERSION,
    consensusId: id("flcon", item.reviewItemId),
    annotationSetId: set.annotationSetId,
    annotationSetDigest: set.annotationSetDigest,
    reviewItemId: item.reviewItemId,
    reviewItemDigest: item.reviewItemDigest,
    taxonomyVersion: item.taxonomyVersion,
    consensusContractVersion: ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION,
    consensusAlgorithm: { id: "fixture-consensus", version: "v1", policyStatus: "specified" },
    sourceAnnotations: set.sourceAnnotations,
    assessableAnnotationCount: annotations.length,
    annotationStateCounts: { ranked: annotations.length, ambiguous: 0, uncertain: 0, not_assessable: 0 },
    top1Distribution: [{ archetype: "cat", count: annotations.length }],
    rankedAlternativeDistribution: [
      { archetype: "wolf", appearanceCount: annotations.length },
      { archetype: "deer", appearanceCount: annotations.length }
    ],
    ambiguity: { present: false, candidates: [] },
    confidenceDistribution: {
      low: annotations.filter((annotation) => annotation.label.confidence === "low").length,
      medium: annotations.filter((annotation) => annotation.label.confidence === "medium").length,
      high: annotations.filter((annotation) => annotation.label.confidence === "high").length,
      not_applicable: annotations.filter((annotation) => annotation.label.confidence === "not_applicable").length
    },
    evidenceTagAgreement: [
      { tag: "eyes.direction", reviewerCount: annotations.length },
      { tag: "feature_layout.concentration", reviewerCount: annotations.length }
    ],
    disagreement: { present: false, distinctRankedTop1Count: 1, unresolved: false },
    status: "clear_consensus",
    consensusLabel: "cat",
    consensusAt: "2026-08-13T00:07:00.000Z",
    ...overrides
  }, "consensusDigest");
}

const item = reviewItem();
const reviewSession = session(item);
const first = annotation(item, reviewSession);
const secondSession = session(item, "two");
const second = annotation(item, secondSession, "two", { confidence: "high" });
const set = annotationSet(item, [first, second]);
const agreed = consensus(item, set, [first, second]);

assert.equal(validateArchetypeReviewItem(item).ok, true);
assert.equal(validateArchetypeReviewSession(reviewSession).ok, true);
assert.equal(validateArchetypeHumanAnnotation(first).ok, true);
assert.equal(validateArchetypeAnnotationBindings({ annotation: first, session: reviewSession, reviewItem: item, sha256Hex: hex }).ok, true);
assert.equal(validateArchetypeAnnotationSet(set).ok, true);
assert.equal(validateArchetypeAnnotationSetBindings({ annotationSet: set, annotations: [first, second], sha256Hex: hex }).ok, true);
assert.equal(validateArchetypeConsensus(agreed).ok, true);
assert.equal(validateArchetypeConsensusBindings({ consensus: agreed, annotationSet: set, annotations: [first, second], sha256Hex: hex }).ok, true);

for (const [artifact, validator, digestKey] of [
  [item, validateArchetypeReviewItem, "reviewItemDigest"],
  [reviewSession, validateArchetypeReviewSession, "sessionDigest"],
  [first, validateArchetypeHumanAnnotation, "annotationDigest"],
  [set, validateArchetypeAnnotationSet, "annotationSetDigest"],
  [agreed, validateArchetypeConsensus, "consensusDigest"]
]) {
  assert.equal(validator(artifact).ok, true);
  assert.equal(verifyArchetypeHumanEvaluationDigest(artifact, digestKey, hex), true);
  assert.equal(validateArchetypeHumanEvaluationArtifact(artifact).ok, true);
  const tampered = clone(artifact);
  tampered[digestKey] = hex("wrong");
  assert.equal(verifyArchetypeHumanEvaluationDigest(tampered, digestKey, hex), false);
}

const unknownField = { ...first, engineTopCandidate: "cat" };
assert.equal(validateArchetypeHumanAnnotation(unknownField).ok, false);

const invalidTaxonomy = seal({ ...first, label: { ...first.label, top1: "fox" } }, "annotationDigest");
assert.equal(validateArchetypeHumanAnnotation(invalidTaxonomy).ok, false);

const duplicateRank = seal({ ...first, label: { ...first.label, rankedAlternatives: ["wolf", "wolf"] } }, "annotationDigest");
assert.equal(validateArchetypeHumanAnnotation(duplicateRank).ok, false);

const top1RankContradiction = seal({ ...first, label: { ...first.label, rankedAlternatives: ["cat"] } }, "annotationDigest");
assert.equal(validateArchetypeHumanAnnotation(top1RankContradiction).ok, false);

const noForcedTop1 = annotation(item, reviewSession, "ambiguous", {
  state: "ambiguous",
  top1: null,
  rankedAlternatives: ["cat", "wolf"],
  ambiguityCandidates: ["wolf", "cat"],
  confidence: "low"
});
assert.equal(validateArchetypeHumanAnnotation(noForcedTop1).ok, true);

const uncertain = annotation(item, reviewSession, "uncertain", {
  state: "uncertain",
  top1: null,
  rankedAlternatives: [],
  ambiguityCandidates: [],
  confidence: "low"
}, {
  assessability: { state: "uncertain_assessability", reasonCodes: ["insufficient_visible_evidence"] },
  evidenceTags: []
});
assert.equal(validateArchetypeHumanAnnotation(uncertain).ok, true);

const notAssessable = annotation(item, reviewSession, "not-assessable", {
  state: "not_assessable",
  top1: null,
  rankedAlternatives: [],
  ambiguityCandidates: [],
  confidence: "not_applicable"
}, {
  assessability: { state: "not_assessable", reasonCodes: ["face_not_reviewable"] },
  evidenceTags: []
});
assert.equal(validateArchetypeHumanAnnotation(notAssessable).ok, true);
const forced = seal({ ...notAssessable, label: { ...first.label } }, "annotationDigest");
assert.equal(validateArchetypeHumanAnnotation(forced).ok, false);

const blindLeak = seal({ ...reviewSession, blindState: { ...reviewSession.blindState, engineOutputHidden: false } }, "sessionDigest");
assert.equal(validateArchetypeReviewSession(blindLeak).ok, false);
const publicPath = seal({ ...item, opaqueAssetRef: "C:/Users/real/person.png" }, "reviewItemDigest");
assert.equal(validateArchetypeReviewItem(publicPath).ok, false);
const withdrawnItem = seal({ ...item, consentAuthority: { ...item.consentAuthority, withdrawalState: "withdrawn" } }, "reviewItemDigest");
assert.equal(validateArchetypeReviewItem(withdrawnItem).ok, true);
assert.equal(validateArchetypeAnnotationBindings({ annotation: first, session: reviewSession, reviewItem: withdrawnItem, sha256Hex: hex }).ok, false);

const duplicateReviewerSet = seal({
  ...set,
  sourceAnnotations: [set.sourceAnnotations[0], { ...set.sourceAnnotations[1], reviewerId: set.sourceAnnotations[0].reviewerId }]
}, "annotationSetDigest");
assert.equal(validateArchetypeAnnotationSet(duplicateReviewerSet).ok, false);
const duplicatedDigestSet = seal({
  ...set,
  sourceAnnotations: [set.sourceAnnotations[0], { ...set.sourceAnnotations[1], annotationDigest: set.sourceAnnotations[0].annotationDigest }]
}, "annotationSetDigest");
assert.equal(validateArchetypeAnnotationSet(duplicatedDigestSet).ok, false);

const foreignBinding = { ...second, reviewItemDigest: hex("foreign") };
assert.equal(validateArchetypeAnnotationSetBindings({ annotationSet: set, annotations: [first, foreignBinding], sha256Hex: hex }).ok, false);
const foreignConsensus = { ...agreed, annotationSetDigest: hex("foreign") };
assert.equal(validateArchetypeConsensusBindings({ consensus: foreignConsensus, annotationSet: set, annotations: [first, second], sha256Hex: hex }).ok, false);
const forgedSummary = seal({ ...agreed, confidenceDistribution: { low: 0, medium: 2, high: 0, not_applicable: 0 } }, "consensusDigest");
assert.equal(validateArchetypeConsensusBindings({ consensus: forgedSummary, annotationSet: set, annotations: [first, second], sha256Hex: hex }).ok, false);

const amended = annotation(item, secondSession, "amended", { confidence: "high" }, { supersedesAnnotationDigest: first.annotationDigest });
const conflictingHistorySet = annotationSet(item, [first, amended]);
assert.equal(validateArchetypeAnnotationSetBindings({ annotationSet: conflictingHistorySet, annotations: [first, amended], sha256Hex: hex }).ok, false);

const ambiguousConsensus = consensus(item, set, [first, second], {
  top1Distribution: [{ archetype: "wolf", count: 1 }, { archetype: "cat", count: 1 }],
  ambiguity: { present: true, candidates: ["cat", "wolf"] },
  disagreement: { present: true, distinctRankedTop1Count: 2, unresolved: true },
  status: "ambiguous_consensus",
  consensusLabel: null
});
assert.equal(validateArchetypeConsensus(ambiguousConsensus).ok, true);
const forcedConsensus = seal({ ...ambiguousConsensus, consensusLabel: "cat" }, "consensusDigest");
assert.equal(validateArchetypeConsensus(forcedConsensus).ok, false);

const adjudication = seal({
  schemaVersion: ARCHETYPE_ADJUDICATION_SCHEMA_VERSION,
  adjudicationId: id("fladj", "one"),
  consensusId: ambiguousConsensus.consensusId,
  consensusDigest: ambiguousConsensus.consensusDigest,
  annotationSetDigest: set.annotationSetDigest,
  reviewItemId: item.reviewItemId,
  reviewItemDigest: item.reviewItemDigest,
  adjudicatorId: "reviewer_adjudicator_one",
  adjudicationPolicyVersion: "human-adjudication-v1",
  engineOutputUsed: false,
  outcome: "retain_ambiguity",
  resolvedLabel: null,
  reasonCodes: ["ambiguity_preserved"],
  adjudicatedAt: "2026-08-13T00:08:00.000Z"
}, "adjudicationDigest");
assert.equal(validateArchetypeAdjudication(adjudication).ok, true);
assert.equal(validateArchetypeAdjudicationBindings({ adjudication, consensus: ambiguousConsensus, annotationSet: set, sha256Hex: hex }).ok, true);
const engineLeakedAdjudication = seal({ ...adjudication, engineOutputUsed: true }, "adjudicationDigest");
assert.equal(validateArchetypeAdjudication(engineLeakedAdjudication).ok, false);
assert.equal(validateArchetypeAdjudicationBindings({ adjudication: { ...adjudication, consensusDigest: hex("foreign") }, consensus: ambiguousConsensus, annotationSet: set, sha256Hex: hex }).ok, false);

function manifestEntry(entryItem, entrySet = set, consensusArtifact = agreed) {
  return {
    subjectId: entryItem.subjectId,
    subjectGroupId: entryItem.subjectGroupId,
    leakageGroupId: entryItem.leakageGroupId,
    imageId: entryItem.imageId,
    reviewItemId: entryItem.reviewItemId,
    reviewItemDigest: entryItem.reviewItemDigest,
    annotationSetId: entrySet.annotationSetId,
    annotationSetDigest: entrySet.annotationSetDigest,
    consensusArtifactId: consensusArtifact.consensusId,
    consensusDigest: consensusArtifact.consensusDigest,
    consentRecordId: entryItem.consentAuthority.consentRecordId,
    withdrawalState: "active",
    included: true
  };
}

const validationItem = reviewItem("validation", { splitId: "validation-v1", splitRole: "validation" });
const validationSessionOne = session(validationItem, "validation-one");
const validationSessionTwo = session(validationItem, "validation-two");
const validationFirst = annotation(validationItem, validationSessionOne, "validation-one");
const validationSecond = annotation(validationItem, validationSessionTwo, "validation-two");
const validationSet = annotationSet(validationItem, [validationFirst, validationSecond]);
const validationConsensus = consensus(validationItem, validationSet, [validationFirst, validationSecond]);
const manifest = seal({
  schemaVersion: ARCHETYPE_DATASET_MANIFEST_SCHEMA_VERSION,
  datasetId: item.datasetId,
  datasetVersion: "v1",
  evidenceClass: "human_annotated_real",
  taxonomyVersion: item.taxonomyVersion,
  registryVersion: item.registryVersion,
  annotationContractVersion: ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION,
  consensusContractVersion: ARCHETYPE_HUMAN_EVALUATION_CONTRACT_VERSION,
  consentPolicyVersion: "evaluation-consent-v1",
  retentionPolicyVersion: "evaluation-retention-v1",
  splits: [
    seal({ splitId: "development-v1", splitRole: "development", splitVersion: "v1", entries: [manifestEntry(item)] }, "splitDigest"),
    seal({ splitId: "validation-v1", splitRole: "validation", splitVersion: "v1", entries: [manifestEntry(validationItem, validationSet, validationConsensus)] }, "splitDigest")
  ],
  createdAt: iso
}, "datasetManifestDigest");
assert.equal(validateArchetypeDatasetManifest(manifest).ok, true);
assert.equal(verifyArchetypeDatasetManifestDigests(manifest, hex), true);
assert.equal(validateArchetypeDatasetManifestBindings({
  manifest,
  reviewItems: [item, validationItem],
  annotationSets: [set, validationSet],
  consensuses: [agreed, validationConsensus],
  sha256Hex: hex
}).ok, true);
assert.equal(validateArchetypeDatasetManifestBindings({
  manifest,
  reviewItems: [item, validationItem],
  annotationSets: [set, validationSet],
  consensuses: [agreed, { ...validationConsensus, reviewItemDigest: hex("foreign") }],
  sha256Hex: hex
}).ok, false);
assert.equal(validateArchetypeDatasetManifestBindings({
  manifest,
  reviewItems: [item, validationItem],
  annotationSets: [set, validationSet],
  consensuses: [agreed, validationConsensus, { ...validationConsensus, consensusId: id("flcon", "undeclared-extra") }],
  sha256Hex: hex
}).ok, false);

const subjectLeak = clone(manifest);
subjectLeak.splits[1].entries[0].subjectId = subjectLeak.splits[0].entries[0].subjectId;
subjectLeak.datasetManifestDigest = hex(canonicalizeArchetypeHumanEvaluationArtifact(subjectLeak, "datasetManifestDigest"));
assert.equal(validateArchetypeDatasetManifest(subjectLeak).ok, false);
const lineageLeak = clone(manifest);
lineageLeak.splits[1].entries[0].leakageGroupId = lineageLeak.splits[0].entries[0].leakageGroupId;
lineageLeak.datasetManifestDigest = hex(canonicalizeArchetypeHumanEvaluationArtifact(lineageLeak, "datasetManifestDigest"));
assert.equal(validateArchetypeDatasetManifest(lineageLeak).ok, false);
const withdrawnIncluded = clone(manifest);
withdrawnIncluded.splits[0].entries[0].withdrawalState = "withdrawn";
withdrawnIncluded.datasetManifestDigest = hex(canonicalizeArchetypeHumanEvaluationArtifact(withdrawnIncluded, "datasetManifestDigest"));
assert.equal(validateArchetypeDatasetManifest(withdrawnIncluded).ok, false);
const forgedSplitDigest = clone(manifest);
forgedSplitDigest.splits[0].splitDigest = hex("forged-split");
forgedSplitDigest.datasetManifestDigest = hex(canonicalizeArchetypeHumanEvaluationArtifact(forgedSplitDigest, "datasetManifestDigest"));
assert.equal(verifyArchetypeDatasetManifestDigests(forgedSplitDigest, hex), false);

console.log("[verify-face-lab-archetype-human-evaluation-contract-v1] PASS");
