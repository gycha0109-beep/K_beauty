import {
  validateFaceSpaceReferenceCorpus
} from "./face-lab-face-space-reference-corpus.js";
import {
  validateFaceSpaceReferenceStatisticsMethodDecision
} from "./face-lab-face-space-normalization-research.js";

export const FACE_SPACE_REFERENCE_STATISTICS_SCHEMA_VERSION =
  "face-space-reference-statistics-v0";

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationStandardDeviation(values, center) {
  const variance =
    values.reduce((sum, value) => sum + (value - center) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function madScaledConsistent(values, center) {
  return median(values.map((value) => Math.abs(value - center))) * 1.4826;
}

function dimensionMap(measurement) {
  return new Map(measurement.dimensions.map((dimension) => [dimension.id, dimension]));
}

export function estimateFaceSpaceReferenceStatistics({
  manifest,
  methodDecision,
  version
} = {}) {
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new Error("face_space_reference_statistics_version_invalid");
  }

  const summary = validateFaceSpaceReferenceCorpus(manifest);
  const decision =
    validateFaceSpaceReferenceStatisticsMethodDecision(methodDecision);

  if (decision.scope !== "same_provider") {
    throw new Error("face_space_reference_statistics_scope_invalid");
  }
  if (
    decision.referenceCorpusSummarySchemaVersion !== summary.schemaVersion
  ) {
    throw new Error(
      "face_space_reference_statistics_corpus_summary_schema_mismatch"
    );
  }

  const referenceRecords = manifest.records.filter(
    (record) => record.split === "reference"
  );
  const holdoutRecords = manifest.records.filter(
    (record) => record.split === "holdout"
  );

  if (referenceRecords.length < 2) {
    throw new Error(
      "face_space_reference_statistics_reference_sample_count_insufficient"
    );
  }
  if (holdoutRecords.length === 0) {
    throw new Error("face_space_reference_statistics_holdout_missing");
  }

  const dimensions = summary.dimensionIds.map((id) => {
    const entries = referenceRecords.map((record) => {
      const dimension = dimensionMap(record.measurement).get(id);
      if (!dimension) {
        throw new Error(
          "face_space_reference_statistics_dimension_missing:" + id
        );
      }
      return dimension;
    });

    const unit = entries[0].unit;
    if (entries.some((entry) => entry.unit !== unit)) {
      throw new Error(
        "face_space_reference_statistics_unit_inconsistent:" + id
      );
    }

    const values = entries.map((entry) => entry.value);
    const center =
      decision.centerMethod === "mean" ? mean(values) : median(values);
    const scale =
      decision.scaleMethod === "standard_deviation"
        ? populationStandardDeviation(values, center)
        : madScaledConsistent(values, center);

    if (
      !Number.isFinite(center) ||
      !Number.isFinite(scale) ||
      scale <= 0
    ) {
      throw new Error(
        "face_space_reference_statistics_degenerate_scale:" + id
      );
    }

    return {
      id,
      unit,
      center,
      scale,
      referenceSampleCount: values.length
    };
  });

  return {
    schemaVersion: FACE_SPACE_REFERENCE_STATISTICS_SCHEMA_VERSION,
    version,
    methodDecisionVersion: decision.decisionVersion,
    sourceReferenceCorpusSummarySchemaVersion: summary.schemaVersion,
    samplingFrameKind: summary.samplingFrameKind,
    referenceSplitOnly: true,
    referenceSampleCount: referenceRecords.length,
    holdoutSampleCountExcluded: holdoutRecords.length,
    centerMethod: decision.centerMethod,
    scaleMethod: decision.scaleMethod,
    dimensions,
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false,
      referenceStatisticsResearchOnly: true
    }
  };
}
