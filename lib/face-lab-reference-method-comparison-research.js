import { createHash } from "node:crypto";
import {
  validateFaceSpaceReferenceCorpus
} from "./face-lab-face-space-reference-corpus.js";

export const FACE_SPACE_REFERENCE_METHOD_COMPARISON_SCHEMA_VERSION =
  "face-space-reference-method-comparison-v0";

const METHODS = Object.freeze([
  ["mean", "standard_deviation"],
  ["mean", "mad_scaled_consistent"],
  ["median", "standard_deviation"],
  ["median", "mad_scaled_consistent"]
]);

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function standardDeviation(values) {
  const arithmeticMean = mean(values);
  const variance =
    values.reduce(
      (sum, value) => sum + (value - arithmeticMean) ** 2,
      0
    ) / values.length;
  return Math.sqrt(variance);
}

function madScaledConsistent(values, center) {
  return median(values.map((value) => Math.abs(value - center))) * 1.4826;
}

function dimensionMap(measurement) {
  return new Map(
    measurement.dimensions.map((dimension) => [dimension.id, dimension])
  );
}

export function buildFaceSpaceReferenceMethodComparison({
  manifest,
  comparisonVersion
} = {}) {
  if (
    typeof comparisonVersion !== "string" ||
    comparisonVersion.trim().length === 0
  ) {
    throw new Error("face_space_reference_method_comparison_version_invalid");
  }

  const summary = validateFaceSpaceReferenceCorpus(manifest);
  const referenceRecords = manifest.records.filter(
    (record) => record.split === "reference"
  );
  const holdoutRecords = manifest.records.filter(
    (record) => record.split === "holdout"
  );

  if (referenceRecords.length < 3) {
    throw new Error(
      "face_space_reference_method_comparison_reference_count_insufficient"
    );
  }

  const profiles = METHODS.map(([centerMethod, scaleMethod]) => {
    const dimensions = summary.dimensionIds.map((id) => {
      const entries = referenceRecords.map((record) => {
        const dimension = dimensionMap(record.measurement).get(id);
        if (!dimension) {
          throw new Error(
            "face_space_reference_method_comparison_dimension_missing:" + id
          );
        }
        return dimension;
      });
      const unit = entries[0].unit;
      if (entries.some((entry) => entry.unit !== unit)) {
        throw new Error(
          "face_space_reference_method_comparison_unit_inconsistent:" + id
        );
      }

      const values = entries.map((entry) => entry.value);
      const center =
        centerMethod === "mean" ? mean(values) : median(values);
      const scale =
        scaleMethod === "standard_deviation"
          ? standardDeviation(values)
          : madScaledConsistent(values, center);

      if (
        !Number.isFinite(center) ||
        !Number.isFinite(scale) ||
        scale <= 0
      ) {
        throw new Error(
          "face_space_reference_method_comparison_degenerate_scale:" + id
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
      methodId: centerMethod + "__" + scaleMethod,
      centerMethod,
      scaleMethod,
      dimensions
    };
  });

  const packetFingerprint =
    "sha256:" +
    createHash("sha256")
      .update(
        JSON.stringify({
          sourceReferenceSplitFingerprint: summary.referenceSplitFingerprint,
          profiles
        })
      )
      .digest("hex");

  return {
    schemaVersion: FACE_SPACE_REFERENCE_METHOD_COMPARISON_SCHEMA_VERSION,
    comparisonVersion,
    status: "descriptive_comparison_only",
    sourceReferenceSplitFingerprint: summary.referenceSplitFingerprint,
    sourceReferenceCorpusSummarySchemaVersion: summary.schemaVersion,
    sourceSamplingFrameProvenanceRef: summary.samplingFrameProvenanceRef,
    sourceProvider: summary.provider,
    referenceSplitOnly: true,
    referenceSampleCount: referenceRecords.length,
    holdoutSampleCountExcluded: holdoutRecords.length,
    profiles,
    packetFingerprint,
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      methodSelectionAuthority: false,
      rankingAuthority: false,
      thresholdAuthority: false,
      archetypeAuthority: false,
      styleRecommendationAuthority: false
    }
  };
}

export const FACE_SPACE_REFERENCE_METHOD_COMPARISON_METHODS = METHODS;
