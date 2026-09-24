import {
  validateFaceSpaceReferenceCorpus
} from "./face-lab-face-space-reference-corpus.js";
import {
  applyFaceSpaceNormalizationCandidate
} from "./face-lab-face-space-normalization-research.js";

export const FACE_SPACE_NORMALIZATION_HOLDOUT_DIAGNOSTIC_SCHEMA_VERSION =
  "face-space-normalization-holdout-diagnostic-v0";

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanAbsolute(values) {
  return values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length;
}

export function buildFaceSpaceNormalizationHoldoutDiagnostic({
  manifest,
  candidate
} = {}) {
  const summary = validateFaceSpaceReferenceCorpus(manifest);

  if (
    candidate?.schemaVersion !== "face-space-normalization-candidate-v0" ||
    candidate?.authority?.productionAuthority !== false ||
    candidate?.authority?.provisionalResearchOnly !== true ||
    candidate?.referenceSplitOnly !== true ||
    candidate?.sourceReferenceCorpusSummarySchemaVersion !== summary.schemaVersion ||
    candidate?.sourceReferenceSplitFingerprint !==
      summary.referenceSplitFingerprint ||
    candidate?.sourceSamplingFrameProvenanceRef !==
      summary.samplingFrameProvenanceRef ||
    candidate?.sourceProvider?.source !== summary.provider.source ||
    candidate?.sourceProvider?.sourceVersion !== summary.provider.sourceVersion ||
    candidate?.sourceProvider?.adapterId !== summary.provider.adapterId
  ) {
    throw new Error("face_space_normalization_holdout_candidate_invalid");
  }

  const holdoutRecords = manifest.records.filter(
    (record) => record.split === "holdout"
  );
  const referenceRecords = manifest.records.filter(
    (record) => record.split === "reference"
  );

  if (holdoutRecords.length === 0) {
    throw new Error("face_space_normalization_holdout_missing");
  }

  const normalized = holdoutRecords.map((record) =>
    applyFaceSpaceNormalizationCandidate({
      measurement: record.measurement,
      candidate
    })
  );

  const dimensions = candidate.dimensions.map((candidateDimension) => {
    const values = normalized.map((vector) => {
      const dimension = vector.dimensions.find(
        (item) => item.id === candidateDimension.id
      );
      if (!dimension || !Number.isFinite(dimension.value)) {
        throw new Error(
          "face_space_normalization_holdout_dimension_invalid:" +
            candidateDimension.id
        );
      }
      return dimension.value;
    });

    return {
      id: candidateDimension.id,
      unit: "standardized_research_v0",
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: mean(values),
      meanAbsolute: meanAbsolute(values)
    };
  });

  return {
    schemaVersion: FACE_SPACE_NORMALIZATION_HOLDOUT_DIAGNOSTIC_SCHEMA_VERSION,
    status: "research_diagnostic_only",
    normalizationVersion: candidate.normalizationVersion,
    referenceStatisticsVersion: candidate.referenceStatisticsVersion,
    methodDecisionVersion: candidate.methodDecisionVersion,
    sourceReferenceCorpusSummarySchemaVersion:
      candidate.sourceReferenceCorpusSummarySchemaVersion,
    sourceReferenceSplitFingerprint:
      candidate.sourceReferenceSplitFingerprint,
    sourceSamplingFrameProvenanceRef:
      candidate.sourceSamplingFrameProvenanceRef,
    sourceProvider: {
      source: candidate.sourceProvider.source,
      sourceVersion: candidate.sourceProvider.sourceVersion,
      adapterId: candidate.sourceProvider.adapterId
    },
    holdoutSplitOnly: true,
    holdoutSampleCount: holdoutRecords.length,
    referenceSampleCountExcluded: referenceRecords.length,
    dimensions,
    authority: {
      productionAuthority: false,
      normalizationActivationAuthority: false,
      acceptanceThresholdAuthority: false,
      archetypeAuthority: false,
      styleRecommendationAuthority: false,
      researchDiagnosticOnly: true
    }
  };
}
