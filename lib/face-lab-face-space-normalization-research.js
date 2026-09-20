export const FACE_SPACE_NORMALIZATION_READINESS_SCHEMA_VERSION =
  "face-space-normalization-readiness-v0";

export const FACE_SPACE_NORMALIZATION_CANDIDATE_SCHEMA_VERSION =
  "face-space-normalization-candidate-v0";

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

function normalizeEvidenceState(evidence = {}) {
  return {
    multiSubjectCoverage: evidence.multiSubjectCoverage === true,
    generalFaceCoverage: evidence.generalFaceCoverage === true,
    referenceDistribution: evidence.referenceDistribution === true,
    realPoseStability: evidence.realPoseStability === true,
    realExpressionStability: evidence.realExpressionStability === true,
    providerCorrespondence: evidence.providerCorrespondence === true
  };
}

export function evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary,
  evidence,
  scope
} = {}) {
  const semantics = semanticDimensions(semanticContract);
  validateStabilitySummary(stabilitySummary);
  if (!["same_provider", "cross_provider"].includes(scope)) {
    throw new Error("face_space_normalization_scope_invalid");
  }
  const state = normalizeEvidenceState(evidence);

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
      archetypeAuthority: false,
      styleRecommendationAuthority: false
    }
  };
}

export function buildFaceSpaceNormalizationCandidate({
  readiness,
  referenceStatistics
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
  if (
    !isObject(referenceStatistics) ||
    !nonEmpty(referenceStatistics.version) ||
    !Array.isArray(referenceStatistics.dimensions)
  ) {
    throw new Error(
      "face_space_normalization_reference_statistics_invalid"
    );
  }

  const ready = new Set(
    readiness.dimensions
      .filter(
        (dimension) =>
          dimension.normalizationStatus ===
          "ready_for_provisional_candidate"
      )
      .map((dimension) => dimension.id)
  );

  const dimensions = referenceStatistics.dimensions.map((dimension) => {
    if (!ready.has(dimension.id)) {
      throw new Error(
        "face_space_normalization_dimension_not_ready:" + dimension.id
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
      if (!source || source.unit !== dimension.unit) {
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
