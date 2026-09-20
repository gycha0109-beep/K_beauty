import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyFaceSpaceNormalizationCandidate,
  buildFaceSpaceNormalizationCandidate,
  evaluateFaceSpaceNormalizationReadiness
} from "../lib/face-lab-face-space-normalization-research.js";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

const semanticContract = readJson(
  "evidence/facelab/structural-measurement/v0/semantic-contract.json"
);
const stabilitySummary = readJson(
  "evidence/facelab/photo-geometry/v0/photo-geometry-stability-evidence-summary.json"
);
const readinessContract = readJson(
  "evidence/facelab/face-space-normalization/v0/readiness.contract.json"
);

assert.equal(readinessContract.productionAuthority, false);
assert.equal(readinessContract.status, "not_ready");
assert.equal(
  readinessContract.referenceStatistics.centerValuesDefined,
  false
);
assert.equal(
  readinessContract.referenceStatistics.scaleValuesDefined,
  false
);

const currentReadiness = evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary,
  scope: "same_provider",
  evidence: {
    multiSubjectCoverage: false,
    generalFaceCoverage: false,
    referenceDistribution: false,
    realPoseStability: false,
    realExpressionStability: false,
    providerCorrespondence: false
  }
});

assert.equal(currentReadiness.status, "not_ready");
for (const blocker of readinessContract.currentBlockers) {
  assert.ok(
    currentReadiness.blockers.includes(blocker),
    "missing readiness blocker: " + blocker
  );
}
assert.equal(currentReadiness.readyDimensionCount, 0);
assert.equal(
  currentReadiness.dimensions.every(
    (dimension) => dimension.normalizationStatus === "not_ready"
  ),
  true
);
assert.throws(
  () =>
    buildFaceSpaceNormalizationCandidate({
      readiness: currentReadiness,
      referenceStatistics: {
        version: "must_not_be_used",
        dimensions: [
          {
            id: "lower_face_width_ratio",
            unit: "ratio",
            center: 0.75,
            scale: 0.05
          }
        ]
      }
    }),
  /normalization_not_ready/
);

const completeStabilitySummary = {
  ...stabilitySummary,
  fixture: {
    ...stabilitySummary.fixture,
    distinctSubjectCount: 12,
    sameSourceImageTransformOnly: false
  },
  unresolvedEvidence: []
};
const completeEvidence = {
  multiSubjectCoverage: true,
  generalFaceCoverage: true,
  referenceDistribution: true,
  realPoseStability: true,
  realExpressionStability: true,
  providerCorrespondence: false
};

const sameProviderReady = evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary: completeStabilitySummary,
  scope: "same_provider",
  evidence: completeEvidence
});
assert.equal(sameProviderReady.status, "provisional_candidate_ready");
assert.equal(
  sameProviderReady.readyDimensionCount,
  semanticContract.dimensions.length
);
assert.equal(
  sameProviderReady.dimensions.every(
    (dimension) =>
      dimension.normalizationStatus === "ready_for_provisional_candidate"
  ),
  true
);

const crossProviderHeld = evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary: completeStabilitySummary,
  scope: "cross_provider",
  evidence: completeEvidence
});
assert.equal(crossProviderHeld.status, "not_ready");
assert.equal(crossProviderHeld.readyDimensionCount, 0);
assert.deepEqual(
  crossProviderHeld.dimensions
    .filter(
      (dimension) =>
        dimension.normalizationStatus === "provider_semantic_hold"
    )
    .map((dimension) => dimension.id)
    .sort(),
  ["chin_height_ratio", "nose_width_ratio"]
);
assert.deepEqual(
  crossProviderHeld.dimensions
    .filter(
      (dimension) =>
        dimension.normalizationStatus ===
        "provider_semantic_unvalidated"
    )
    .map((dimension) => dimension.id)
    .sort(),
  [
    "eye_spacing_ratio",
    "eye_tilt",
    "eye_width_ratio",
    "lower_face_width_ratio"
  ]
);

const crossProviderReady = evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary: completeStabilitySummary,
  scope: "cross_provider",
  evidence: {
    ...completeEvidence,
    providerCorrespondence: true
  }
});
assert.equal(crossProviderReady.status, "provisional_candidate_ready");
assert.equal(
  crossProviderReady.readyDimensionCount,
  semanticContract.dimensions.length
);

const candidate = buildFaceSpaceNormalizationCandidate({
  readiness: sameProviderReady,
  referenceStatistics: {
    version: "synthetic-verifier-only-v0",
    dimensions: [
      {
        id: "lower_face_width_ratio",
        unit: "ratio",
        center: 0.75,
        scale: 0.05
      },
      {
        id: "eye_tilt",
        unit: "degree",
        center: 0,
        scale: 2
      }
    ]
  }
});
assert.equal(candidate.authority.productionAuthority, false);
assert.equal(candidate.authority.provisionalResearchOnly, true);
assert.equal(candidate.dimensions.length, 2);

assert.throws(
  () =>
    buildFaceSpaceNormalizationCandidate({
      readiness: sameProviderReady,
      referenceStatistics: {
        version: "bad-unit",
        dimensions: [
          {
            id: "eye_tilt",
            unit: "ratio",
            center: 0,
            scale: 1
          }
        ]
      }
    }),
  /reference_unit_mismatch:eye_tilt/
);

assert.throws(
  () =>
    buildFaceSpaceNormalizationCandidate({
      readiness: sameProviderReady,
      referenceStatistics: {
        version: "duplicate-id",
        dimensions: [
          {
            id: "eye_tilt",
            unit: "degree",
            center: 0,
            scale: 1
          },
          {
            id: "eye_tilt",
            unit: "degree",
            center: 0,
            scale: 1
          }
        ]
      }
    }),
  /reference_dimension_duplicate:eye_tilt/
);

const normalized = applyFaceSpaceNormalizationCandidate({
  measurement: {
    schemaVersion: "face-space-structural-measurement-v0",
    sampleId: "synthetic_verifier_only",
    dimensions: [
      {
        id: "lower_face_width_ratio",
        value: 0.8,
        unit: "ratio"
      },
      {
        id: "eye_tilt",
        value: 1,
        unit: "degree"
      }
    ]
  },
  candidate
});
assert.equal(normalized.authority.productionAuthority, false);
assert.equal(normalized.authority.provisionalResearchOnly, true);
assert.equal(normalized.dimensions.length, 2);
assert.ok(
  Math.abs(normalized.dimensions[0].value - 1) < 1e-12
);
assert.ok(
  Math.abs(normalized.dimensions[1].value - 0.5) < 1e-12
);

assert.throws(
  () =>
    evaluateFaceSpaceNormalizationReadiness({
      semanticContract,
      stabilitySummary,
      scope: "invalid_scope",
      evidence: {}
    }),
  /normalization_scope_invalid/
);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  current: {
    status: currentReadiness.status,
    blockers: currentReadiness.blockers,
    readyDimensionCount: currentReadiness.readyDimensionCount
  },
  simulatedFutureGate: {
    sameProviderStatus: sameProviderReady.status,
    crossProviderWithoutCorrespondence: crossProviderHeld.status,
    crossProviderWithCorrespondence: crossProviderReady.status
  },
  invariants: {
    currentSingleFixtureCannotNormalize: true,
    referenceStatsMustBeExplicit: true,
    providerEquivalenceScopedToCrossProvider: true,
    provisionalCandidateResearchOnly: true,
    noArchetypeAuthority: true,
    noStyleRecommendationAuthority: true
  }
}, null, 2));
