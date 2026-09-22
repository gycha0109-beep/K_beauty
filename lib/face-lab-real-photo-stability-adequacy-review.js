import { createHash } from "node:crypto";

export const REAL_PHOTO_STABILITY_ADEQUACY_REVIEW_SCHEMA_VERSION =
  "face-lab-real-photo-stability-adequacy-review-v1";

function stableJson(value) {
  if (Array.isArray(value)) {
    return "[" + value.map((item) => stableJson(item)).join(",") + "]";
  }
  if (value !== null && typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stableJson(value[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return (
    sorted[lower] +
    (sorted[upper] - sorted[lower]) * (position - lower)
  );
}

function summarize(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("face_lab_adequacy_review_empty_distribution");
  }
  return {
    count: values.length,
    min: Math.min(...values),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    p25: quantile(values, 0.25),
    median: quantile(values, 0.5),
    p75: quantile(values, 0.75),
    p90: quantile(values, 0.9),
    p95: quantile(values, 0.95),
    max: Math.max(...values)
  };
}

export function buildRealPhotoStabilityAdequacyReview(reviewPacket) {
  if (
    reviewPacket?.schemaVersion !==
      "face-lab-real-photo-stability-review-packet-v0" ||
    reviewPacket?.status !== "manual_review_packet_ready" ||
    reviewPacket?.sourceReportCount !== 488 ||
    !Array.isArray(reviewPacket?.observations) ||
    reviewPacket.observations.length !== 488
  ) {
    throw new Error("face_lab_adequacy_review_packet_invalid");
  }

  const requiredNuisanceClasses = [
    "expression",
    "head_pitch",
    "head_roll",
    "head_yaw"
  ];
  const covered = [...new Set(
    reviewPacket.observations.map((item) => item.nuisanceClass)
  )].sort();
  if (
    JSON.stringify(covered) !== JSON.stringify(requiredNuisanceClasses)
  ) {
    throw new Error("face_lab_adequacy_review_nuisance_coverage_invalid");
  }

  for (const observation of reviewPacket.observations) {
    if (
      !observation?.subjectLinkage?.evidenceRef ||
      !observation?.executionProvenance?.runManifestDigest ||
      observation?.diagnostics?.thresholdsApplied !== false ||
      !Array.isArray(observation?.dimensions)
    ) {
      throw new Error(
        "face_lab_adequacy_review_observation_invalid:" +
          String(observation?.pairGroupId || "unknown")
      );
    }
  }

  const nuisanceClasses = requiredNuisanceClasses.map((nuisanceClass) => {
    const observations = reviewPacket.observations.filter(
      (item) => item.nuisanceClass === nuisanceClass
    );
    const dimensionIds = [...new Set(
      observations.flatMap((item) =>
        item.dimensions.map((dimension) => dimension.id)
      )
    )].sort();

    const dimensions = dimensionIds.map((id) => {
      const rows = observations.map((observation) => {
        const dimension = observation.dimensions.find(
          (item) => item.id === id
        );
        if (!dimension) {
          throw new Error(
            "face_lab_adequacy_review_dimension_missing:" +
              nuisanceClass +
              ":" +
              id
          );
        }
        return { observation, dimension };
      });
      const absoluteValues = rows.map(
        ({ dimension }) => dimension.absoluteDifference
      );
      const relativeValues = rows
        .map(({ dimension }) => dimension.relativeDifference)
        .filter((value) => Number.isFinite(value));
      const maximum = rows.reduce((current, row) =>
        row.dimension.absoluteDifference >
        current.dimension.absoluteDifference
          ? row
          : current
      );

      return {
        id,
        unit: maximum.dimension.unit,
        absoluteDifference: summarize(absoluteValues),
        relativeDifference:
          relativeValues.length > 0 ? summarize(relativeValues) : null,
        maximumObservedDifference: {
          value: maximum.dimension.absoluteDifference,
          pairGroupId: maximum.observation.pairGroupId,
          runManifestDigest:
            maximum.observation.executionProvenance.runManifestDigest
        }
      };
    });

    return {
      nuisanceClass,
      reportCount: observations.length,
      subjectLinkageEvidenceRefCount: new Set(
        observations.map((item) => item.subjectLinkage.evidenceRef)
      ).size,
      distributionalInterpretation:
        nuisanceClass === "head_roll"
          ? "limited_single_subject_two_observations"
          : "descriptive_only",
      dimensions
    };
  });

  const review = {
    schemaVersion: REAL_PHOTO_STABILITY_ADEQUACY_REVIEW_SCHEMA_VERSION,
    reviewVersion: "real-photo-stability-adequacy-review-v1",
    status: "descriptive_review_complete_decision_separate",
    boundEvidence: {
      sourceCollectionSchemaVersion:
        reviewPacket.sourceCollectionSchemaVersion,
      collectionFingerprint:
        reviewPacket.sourceCollectionFingerprint,
      sourceReviewPacketSchemaVersion: reviewPacket.schemaVersion,
      sourceReviewPacketVersion: reviewPacket.packetVersion,
      reviewPacketFingerprint: reviewPacket.reviewPacketFingerprint,
      sourceReportCount: reviewPacket.sourceReportCount,
      sourceRunManifestDigests: reviewPacket.sourceRunManifestDigests
    },
    coverage: {
      coveredNuisanceClasses: reviewPacket.sourceCoveredNuisanceClasses,
      missingNuisanceClasses: [],
      completeNuisanceCoverage: true,
      reportCountByNuisance: Object.fromEntries(
        nuisanceClasses.map((item) => [
          item.nuisanceClass,
          item.reportCount
        ])
      )
    },
    driftAnalysis: {
      quantileMethod:
        "linear_interpolation_over_sorted_observations",
      nuisanceClasses
    },
    provenanceReview: {
      subjectLinkageProvenancePresent: true,
      runnerManifestDigestPresent: true,
      exactCollectionFingerprintBound: true,
      exactReviewPacketFingerprintBound: true
    },
    evidenceLimitations: [
      "Head roll evidence contains two same-session observations from one subject; it demonstrates technical measurability but does not establish population-level roll stability.",
      "Observed drift is descriptive and uncalibrated; no numeric adequacy threshold is applied or implied.",
      "Cross-provider semantic alignment is outside this adequacy review; existing semantic holds, including chin_height_ratio and nose_width_ratio, remain unresolved."
    ],
    reviewSemantics: {
      descriptiveOnly: true,
      thresholdsApplied: false,
      automaticPassFail: false,
      automaticRanking: false,
      adequacyDecisionIncluded: false
    },
    privacy: {
      sourceImagePersisted: false,
      rawLandmarksPersisted: false,
      identityEmbeddingCreated: false,
      biometricIdentityMatchPerformed: false,
      localImagePathsIncluded: false
    },
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false,
      populationAuthority: false,
      adequacyDecisionAuthority: false
    }
  };

  review.analysisFingerprint =
    "sha256:" +
    createHash("sha256")
      .update(stableJson(review))
      .digest("hex");

  return review;
}
