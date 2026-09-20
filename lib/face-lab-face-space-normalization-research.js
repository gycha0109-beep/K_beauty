import {
  summarizeRealPhotoStabilityCollection
} from "./face-lab-real-photo-stability-evidence.js";

import {
  validateFaceSpaceReferenceCorpus
} from "./face-lab-face-space-reference-corpus.js";

export const FACE_SPACE_NORMALIZATION_READINESS_SCHEMA_VERSION =
  "face-space-normalization-readiness-v0";

export const FACE_SPACE_NORMALIZATION_CANDIDATE_SCHEMA_VERSION =
  "face-space-normalization-candidate-v0";

export const FACE_SPACE_REFERENCE_STATISTICS_METHOD_DECISION_SCHEMA_VERSION =
  "face-space-reference-statistics-method-decision-v0";

const SUPPORTED_CENTER_METHODS = new Set(["mean", "median"]);
const SUPPORTED_SCALE_METHODS = new Set([
  "standard_deviation",
  "mad_scaled_consistent"
]);

const REQUIRED_STABILITY_EVIDENCE = Object.freeze([
  "head_yaw_real_same_subject_pair",
  "head_pitch_real_same_subject_pair",
  "head_roll_real_same_subject_pair",
  "expression_real_same_subject_pair",
  "general_face_coverage",
  "population_or_reference_distribution"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256Reference(value) {
  return (
    typeof value === "string" &&
    /^sha256:[a-f0-9]{64}$/.test(value)
  );
}


function semanticDimensions(semanticContract) {
  if (
    !isObject(semanticContract) ||
    semanticContract.schemaVersion !==
      "face-space-structural-measurement-semantics-v0" ||
    semanticContract.productionAuthority !== false ||
    !Array.isArray(semanticContract.dimensions)
  ) {
    throw new Error("face_space_normalization_semantic_contract_invalid");
  }

  const result = new Map();
  for (const dimension of semanticContract.dimensions) {
    if (!nonEmpty(dimension?.id) || !nonEmpty(dimension?.unit)) {
      throw new Error(
        "face_space_normalization_semantic_dimension_invalid:" +
          String(dimension?.id || "unknown")
      );
    }
    result.set(dimension.id, dimension);
  }
  return result;
}

function validateStabilitySummary(summary) {
  if (
    !isObject(summary) ||
    summary.schemaVersion !==
      "face-lab-photo-geometry-stability-evidence-v0"
  ) {
    throw new Error("face_space_normalization_stability_summary_invalid");
  }
  if (summary.interpretation?.productionAuthority !== false) {
    throw new Error(
      "face_space_normalization_stability_production_authority_forbidden"
    );
  }
  if (summary.interpretation?.nuisanceThresholdsApplied !== false) {
    throw new Error(
      "face_space_normalization_stability_threshold_authority_forbidden"
    );
  }
  if (!Array.isArray(summary.unresolvedEvidence)) {
    throw new Error(
      "face_space_normalization_unresolved_evidence_invalid"
    );
  }
}

function normalizeReferenceCorpusEvidence(referenceCorpusManifest) {
  if (
    referenceCorpusManifest === undefined ||
    referenceCorpusManifest === null
  ) {
    return {
      referenceCorpusManifestPresent: false,
      referenceCorpusSummarySchemaVersion: null,
      referenceSplitFingerprint: null,
      referenceCorpusSamplingFrameProvenanceRef: null,
      referenceCorpusProvider: null,
      multiSubjectCoverage: false,
      generalFaceCoverage: false,
      referenceDistribution: false,
      lockedHoldoutPresent: false
    };
  }

  const referenceCorpusSummary =
    validateFaceSpaceReferenceCorpus(referenceCorpusManifest);
  const evidenceState = referenceCorpusSummary.evidenceState;
  const lockedHoldoutPresent = evidenceState.lockedHoldoutPresent === true;

  return {
    referenceCorpusManifestPresent: true,
    referenceCorpusSummarySchemaVersion:
      referenceCorpusSummary.schemaVersion,
    referenceSplitFingerprint:
      referenceCorpusSummary.referenceSplitFingerprint,
    referenceCorpusSamplingFrameProvenanceRef:
      referenceCorpusSummary.samplingFrameProvenanceRef,
    referenceCorpusProvider: {
      source: referenceCorpusSummary.provider.source,
      sourceVersion: referenceCorpusSummary.provider.sourceVersion,
      adapterId: referenceCorpusSummary.provider.adapterId
    },
    multiSubjectCoverage: evidenceState.multiSubjectCoverage === true,
    generalFaceCoverage: evidenceState.generalFaceSamplingFrame === true,
    referenceDistribution:
      evidenceState.referenceDistributionReadyForMethodSelection === true &&
      lockedHoldoutPresent,
    lockedHoldoutPresent
  };
}

function normalizeEvidenceState(
  evidence = {},
  referenceCorpusManifest,
  realPhotoStabilityReports
) {
  const corpusEvidence = normalizeReferenceCorpusEvidence(
    referenceCorpusManifest
  );
  const realPhotoCollection = Array.isArray(realPhotoStabilityReports)
    ? summarizeRealPhotoStabilityCollection(realPhotoStabilityReports)
    : null;
  const realPoseEvidenceKind =
    realPhotoCollection?.readinessContribution?.realPoseEvidenceKind || null;
  const realExpressionEvidenceKind =
    realPhotoCollection?.readinessContribution?.realExpressionEvidenceKind ||
    null;

  return {
    referenceCorpusManifestPresent:
      corpusEvidence.referenceCorpusManifestPresent,
    referenceCorpusSummarySchemaVersion:
      corpusEvidence.referenceCorpusSummarySchemaVersion,
    referenceSplitFingerprint:
      corpusEvidence.referenceSplitFingerprint,
    referenceCorpusSamplingFrameProvenanceRef:
      corpusEvidence.referenceCorpusSamplingFrameProvenanceRef,
    referenceCorpusProvider:
      corpusEvidence.referenceCorpusProvider,
    multiSubjectCoverage: corpusEvidence.multiSubjectCoverage,
    generalFaceCoverage: corpusEvidence.generalFaceCoverage,
    referenceDistribution: corpusEvidence.referenceDistribution,
    lockedHoldoutPresent: corpusEvidence.lockedHoldoutPresent,
    claimedMultiSubjectCoverage: evidence.multiSubjectCoverage === true,
    claimedGeneralFaceCoverage: evidence.generalFaceCoverage === true,
    claimedReferenceDistribution: evidence.referenceDistribution === true,
    claimedRealPoseStability: evidence.realPoseStability === true,
    claimedRealExpressionStability:
      evidence.realExpressionStability === true,
    realPhotoStabilityReportCount:
      realPhotoCollection?.reportCount || 0,
    realPhotoStabilityCoverage:
      realPhotoCollection?.realPhotoPoseAndExpressionCoverage || "incomplete",
    realPoseEvidenceKind,
    realExpressionEvidenceKind,
    realPoseStability:
      realPoseEvidenceKind === "real_photo_same_subject",
    realExpressionStability:
      realExpressionEvidenceKind === "real_photo_same_subject",
    controlled3dPoseStress:
      evidence.controlled3dPoseStress === true,
    controlled3dExpressionStress:
      evidence.controlled3dExpressionStress === true,
    providerCorrespondence: evidence.providerCorrespondence === true
  };
}

export function evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary,
  evidence,
  referenceCorpusManifest,
  referenceCorpusSummary,
  realPhotoStabilityReports,
  scope
} = {}) {
  if (referenceCorpusSummary !== undefined && referenceCorpusSummary !== null) {
    throw new Error(
      "face_space_normalization_reference_corpus_summary_input_forbidden"
    );
  }
  const semantics = semanticDimensions(semanticContract);
  validateStabilitySummary(stabilitySummary);
  if (!["same_provider", "cross_provider"].includes(scope)) {
    throw new Error("face_space_normalization_scope_invalid");
  }
  const state = normalizeEvidenceState(
    evidence,
    referenceCorpusManifest,
    realPhotoStabilityReports
  );

  const blockers = [];
  if (stabilitySummary.fixture?.distinctSubjectCount === 1) {
    blockers.push("single_fixture_only");
  }
  if (!state.multiSubjectCoverage) blockers.push("multi_subject_coverage_missing");
  if (!state.generalFaceCoverage) blockers.push("general_face_coverage_missing");
  if (!state.referenceDistribution) {
    blockers.push("reference_distribution_missing");
  }
  if (!state.realPoseStability) blockers.push("real_pose_stability_missing");
  if (!state.realExpressionStability) {
    blockers.push("real_expression_stability_missing");
  }

  const unresolved = new Set(stabilitySummary.unresolvedEvidence);
  for (const requirement of REQUIRED_STABILITY_EVIDENCE) {
    if (unresolved.has(requirement)) {
      blockers.push("unresolved:" + requirement);
    }
  }

  const dimensions = [...semantics.values()].map((dimension) => {
    const providerHold =
      scope === "cross_provider" &&
      dimension.providerAnchorEquivalence === "hold" &&
      !state.providerCorrespondence;
    const providerUnvalidated =
      scope === "cross_provider" &&
      dimension.providerAnchorEquivalence === "unvalidated" &&
      !state.providerCorrespondence;

    return {
      id: dimension.id,
      unit: dimension.unit,
      providerAnchorEquivalence:
        dimension.providerAnchorEquivalence || "unvalidated",
      normalizationStatus:
        blockers.length > 0
          ? "not_ready"
          : providerHold
            ? "provider_semantic_hold"
            : providerUnvalidated
              ? "provider_semantic_unvalidated"
              : "ready_for_provisional_candidate",
      blockers: [
        ...blockers,
        ...(providerHold ? ["provider_anchor_equivalence_hold"] : []),
        ...(providerUnvalidated
          ? ["provider_anchor_equivalence_unvalidated"]
          : [])
      ]
    };
  });

  const readyDimensions = dimensions.filter(
    (dimension) =>
      dimension.normalizationStatus === "ready_for_provisional_candidate"
  );

  return {
    schemaVersion: FACE_SPACE_NORMALIZATION_READINESS_SCHEMA_VERSION,
    normalizationVersion: "face-space-normalization-research-v0",
    scope,
    status:
      blockers.length === 0 && readyDimensions.length > 0
        ? "provisional_candidate_ready"
        : "not_ready",
    blockers: [...new Set(blockers)],
    evidenceState: state,
    dimensions,
    readyDimensionCount: readyDimensions.length,
    authority: {
      productionAuthority: false,
      thresholdAuthority: false,
      referenceStatisticsAuthority: false,
      archetypeAuthority: false,
      styleRecommendationAuthority: false
    }
  };
}

export function validateFaceSpaceReferenceStatisticsMethodDecision(
  decision = {}
) {
  if (
    !isObject(decision) ||
    decision.schemaVersion !==
      FACE_SPACE_REFERENCE_STATISTICS_METHOD_DECISION_SCHEMA_VERSION ||
    decision.status !== "selected_for_research_candidate" ||
    decision.scope !== "same_provider" ||
    !nonEmpty(decision.decisionVersion) ||
    decision.referenceCorpusSummarySchemaVersion !==
      "face-space-reference-corpus-summary-v0" ||
    !SUPPORTED_CENTER_METHODS.has(decision.centerMethod) ||
    !SUPPORTED_SCALE_METHODS.has(decision.scaleMethod) ||
    decision.percentileMethod !== null ||
    decision.thresholdMethod !== null ||
    !sha256Reference(decision.sourceReferenceSplitFingerprint) ||
    !sha256Reference(decision.comparisonPacketFingerprint) ||
    !nonEmpty(decision.comparisonVersion) ||
    !nonEmpty(decision.evidenceRef) ||
    !nonEmpty(decision.selectionRationale) ||
    decision.holdoutUsedForSelection !== false ||
    decision.automaticWinnerSelected !== false ||
    decision.productionAuthority !== false ||
    decision.normalizationAuthority !== false ||
    decision.thresholdAuthority !== false
  ) {
    throw new Error(
      "face_space_reference_statistics_method_decision_invalid"
    );
  }

  return {
    schemaVersion:
      FACE_SPACE_REFERENCE_STATISTICS_METHOD_DECISION_SCHEMA_VERSION,
    status: decision.status,
    decisionVersion: decision.decisionVersion,
    scope: decision.scope,
    referenceCorpusSummarySchemaVersion:
      decision.referenceCorpusSummarySchemaVersion,
    centerMethod: decision.centerMethod,
    scaleMethod: decision.scaleMethod,
    percentileMethod: null,
    thresholdMethod: null,
    sourceReferenceSplitFingerprint:
      decision.sourceReferenceSplitFingerprint,
    comparisonPacketFingerprint: decision.comparisonPacketFingerprint,
    comparisonVersion: decision.comparisonVersion,
    evidenceRef: decision.evidenceRef,
    selectionRationale: decision.selectionRationale,
    holdoutUsedForSelection: false,
    automaticWinnerSelected: false,
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false,
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false,
      researchMethodSelectionOnly: true
    }
  };
}

export function buildFaceSpaceNormalizationCandidate({
  readiness,
  referenceStatistics,
  methodDecision
} = {}) {
  if (
    !isObject(readiness) ||
    readiness.schemaVersion !==
      FACE_SPACE_NORMALIZATION_READINESS_SCHEMA_VERSION
  ) {
    throw new Error("face_space_normalization_readiness_invalid");
  }
  if (readiness.status !== "provisional_candidate_ready") {
    throw new Error("face_space_normalization_not_ready");
  }
  const validatedMethodDecision =
    validateFaceSpaceReferenceStatisticsMethodDecision(methodDecision);
  if (
    !isObject(referenceStatistics) ||
    referenceStatistics.schemaVersion !==
      "face-space-reference-statistics-v0" ||
    !nonEmpty(referenceStatistics.version) ||
    referenceStatistics.methodDecisionVersion !==
      validatedMethodDecision.decisionVersion ||
    referenceStatistics.sourceReferenceCorpusSummarySchemaVersion !==
      validatedMethodDecision.referenceCorpusSummarySchemaVersion ||
    referenceStatistics.sourceReferenceSplitFingerprint !==
      validatedMethodDecision.sourceReferenceSplitFingerprint ||
    referenceStatistics.methodComparisonPacketFingerprint !==
      validatedMethodDecision.comparisonPacketFingerprint ||
    referenceStatistics.methodComparisonVersion !==
      validatedMethodDecision.comparisonVersion ||
    !nonEmpty(referenceStatistics.sourceReferenceSplitFingerprint) ||
    !nonEmpty(referenceStatistics.sourceSamplingFrameProvenanceRef) ||
    !isObject(referenceStatistics.sourceProvider) ||
    !nonEmpty(referenceStatistics.sourceProvider.source) ||
    !nonEmpty(referenceStatistics.sourceProvider.sourceVersion) ||
    !nonEmpty(referenceStatistics.sourceProvider.adapterId) ||
    referenceStatistics.referenceSplitOnly !== true ||
    referenceStatistics.authority?.productionAuthority !== false ||
    referenceStatistics.authority?.normalizationAuthority !== false ||
    referenceStatistics.authority?.thresholdAuthority !== false ||
    !Array.isArray(referenceStatistics.dimensions) ||
    referenceStatistics.dimensions.length === 0
  ) {
    throw new Error(
      "face_space_normalization_reference_statistics_invalid"
    );
  }

  if (
    readiness.evidenceState?.referenceCorpusManifestPresent !== true ||
    referenceStatistics.sourceReferenceSplitFingerprint !==
      readiness.evidenceState.referenceSplitFingerprint ||
    referenceStatistics.sourceSamplingFrameProvenanceRef !==
      readiness.evidenceState.referenceCorpusSamplingFrameProvenanceRef ||
    referenceStatistics.sourceProvider?.source !==
      readiness.evidenceState.referenceCorpusProvider?.source ||
    referenceStatistics.sourceProvider?.sourceVersion !==
      readiness.evidenceState.referenceCorpusProvider?.sourceVersion ||
    referenceStatistics.sourceProvider?.adapterId !==
      readiness.evidenceState.referenceCorpusProvider?.adapterId
  ) {
    throw new Error(
      "face_space_normalization_readiness_reference_lineage_mismatch"
    );
  }

  const ready = new Map(
    readiness.dimensions
      .filter(
        (dimension) =>
          dimension.normalizationStatus ===
          "ready_for_provisional_candidate"
      )
      .map((dimension) => [dimension.id, dimension])
  );
  const seen = new Set();

  const dimensions = referenceStatistics.dimensions.map((dimension) => {
    if (!nonEmpty(dimension?.id) || !nonEmpty(dimension?.unit)) {
      throw new Error("face_space_normalization_reference_dimension_invalid");
    }
    if (seen.has(dimension.id)) {
      throw new Error(
        "face_space_normalization_reference_dimension_duplicate:" +
          dimension.id
      );
    }
    seen.add(dimension.id);

    const readyDimension = ready.get(dimension.id);
    if (!readyDimension) {
      throw new Error(
        "face_space_normalization_dimension_not_ready:" + dimension.id
      );
    }
    if (readyDimension.unit !== dimension.unit) {
      throw new Error(
        "face_space_normalization_reference_unit_mismatch:" + dimension.id
      );
    }
    if (
      typeof dimension.center !== "number" ||
      !Number.isFinite(dimension.center) ||
      typeof dimension.scale !== "number" ||
      !Number.isFinite(dimension.scale) ||
      dimension.scale <= 0
    ) {
      throw new Error(
        "face_space_normalization_reference_stat_invalid:" + dimension.id
      );
    }
    return {
      id: dimension.id,
      unit: dimension.unit,
      center: dimension.center,
      scale: dimension.scale
    };
  });

  return {
    schemaVersion: FACE_SPACE_NORMALIZATION_CANDIDATE_SCHEMA_VERSION,
    normalizationVersion: readiness.normalizationVersion,
    referenceStatisticsVersion: referenceStatistics.version,
    methodDecisionVersion: validatedMethodDecision.decisionVersion,
    methodComparisonVersion: validatedMethodDecision.comparisonVersion,
    methodComparisonPacketFingerprint:
      validatedMethodDecision.comparisonPacketFingerprint,
    sourceReferenceCorpusSummarySchemaVersion:
      referenceStatistics.sourceReferenceCorpusSummarySchemaVersion,
    sourceReferenceSplitFingerprint:
      referenceStatistics.sourceReferenceSplitFingerprint,
    sourceSamplingFrameProvenanceRef:
      referenceStatistics.sourceSamplingFrameProvenanceRef,
    sourceProvider: {
      source: referenceStatistics.sourceProvider.source,
      sourceVersion: referenceStatistics.sourceProvider.sourceVersion,
      adapterId: referenceStatistics.sourceProvider.adapterId
    },
    referenceSplitOnly: true,
    centerMethod: validatedMethodDecision.centerMethod,
    scaleMethod: validatedMethodDecision.scaleMethod,
    transformFamily: "center_scale_research_candidate",
    dimensions,
    authority: {
      productionAuthority: false,
      provisionalResearchOnly: true,
      archetypeAuthority: false,
      styleRecommendationAuthority: false
    }
  };
}

export function applyFaceSpaceNormalizationCandidate({
  measurement,
  candidate
} = {}) {
  if (
    !isObject(candidate) ||
    candidate.schemaVersion !==
      FACE_SPACE_NORMALIZATION_CANDIDATE_SCHEMA_VERSION ||
    candidate.authority?.productionAuthority !== false ||
    candidate.authority?.provisionalResearchOnly !== true
  ) {
    throw new Error("face_space_normalization_candidate_invalid");
  }
  if (
    !isObject(measurement) ||
    measurement.schemaVersion !==
      "face-space-structural-measurement-v0" ||
    !Array.isArray(measurement.dimensions)
  ) {
    throw new Error("face_space_normalization_measurement_invalid");
  }

  const sourceById = new Map(
    measurement.dimensions.map((dimension) => [
      dimension.id,
      dimension
    ])
  );

  return {
    schemaVersion: "face-space-normalized-structural-vector-v0",
    normalizationVersion: candidate.normalizationVersion,
    sampleId: measurement.sampleId,
    dimensions: candidate.dimensions.map((dimension) => {
      const source = sourceById.get(dimension.id);
      if (
        !source ||
        source.unit !== dimension.unit ||
        typeof source.value !== "number" ||
        !Number.isFinite(source.value)
      ) {
        throw new Error(
          "face_space_normalization_measurement_dimension_invalid:" +
            dimension.id
        );
      }
      return {
        id: dimension.id,
        value:
          (source.value - dimension.center) / dimension.scale,
        unit: "standardized_research_v0"
      };
    }),
    authority: {
      productionAuthority: false,
      provisionalResearchOnly: true
    }
  };
}

export const FACE_SPACE_NORMALIZATION_REQUIRED_EVIDENCE =
  REQUIRED_STABILITY_EVIDENCE;
