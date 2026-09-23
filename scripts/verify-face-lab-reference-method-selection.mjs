import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  buildFaceSpaceReferenceMethodComparison
} from "../lib/face-lab-reference-method-comparison-research.js";
import {
  buildFaceSpaceReferenceMethodSelectionDecision
} from "../lib/face-lab-reference-method-selection-research.js";

const dimensions = [
  ["lower_face_width_ratio", "ratio"],
  ["chin_height_ratio", "ratio"],
  ["eye_spacing_ratio", "ratio"],
  ["eye_width_ratio", "ratio"],
  ["eye_tilt", "degree"],
  ["nose_width_ratio", "ratio"]
];

function measurement(sampleId, offset) {
  return {
    schemaVersion: "face-space-structural-measurement-v0",
    sampleId,
    source: "mediapipe_face_landmarker_metric_geometry",
    sourceVersion: "0.10.35",
    adapterId: "mediapipe_metric_geometry_v0",
    dimensions: dimensions.map(([id, unit], index) => ({
      id,
      unit,
      value: 0.2 + index * 0.1 + offset
    })),
    privacy: {
      sourceImagePersisted: false,
      identityEmbeddingCreated: false
    }
  };
}

function record(sampleId, subjectGroupId, split, offset, familyId) {
  return {
    sampleId,
    subjectGroupId,
    nearDuplicateFamilyId: familyId,
    provenanceRef: "synthetic-verifier-only:" + sampleId,
    split,
    archetypeGroundTruth: null,
    identityEmbeddingCreated: false,
    biometricIdentityMatchPerformed: false,
    rawImagePersistedInPacket: false,
    eligibilityQuality: {
      eligible: true,
      qualityStatus: "synthetic_verifier_only"
    },
    measurement: measurement(sampleId, offset)
  };
}

const manifest = {
  schemaVersion: "face-space-reference-corpus-v0",
  productionAuthority: false,
  normalizationAuthority: false,
  samplingFrame: {
    kind: "consented_general_face_corpus",
    provenanceRef: "synthetic-verifier-only",
    archetypeSeeded: false,
    generalFaceIntent: true
  },
  provider: {
    source: "mediapipe_face_landmarker_metric_geometry",
    sourceVersion: "0.10.35",
    adapterId: "mediapipe_metric_geometry_v0"
  },
  records: [
    record("ref_a", "subject_a", "reference", 0.00, "family_a"),
    record("ref_b", "subject_b", "reference", 0.02, "family_b"),
    record("ref_c", "subject_c", "reference", 0.05, "family_c"),
    record("holdout_d", "subject_d", "holdout", 100, "family_d")
  ]
};

const comparison = buildFaceSpaceReferenceMethodComparison({
  manifest,
  comparisonVersion: "synthetic-verifier-selection-comparison-v0"
});

const selection = buildFaceSpaceReferenceMethodSelectionDecision({
  comparison,
  selectedMethodId: "median__mad_scaled_consistent",
  decisionVersion: "synthetic-verifier-selection-v0",
  evidenceRef: "synthetic-verifier-only:explicit-research-decision",
  selectionRationale:
    "Synthetic verifier explicitly selects a supported profile only to test governed lineage."
});

assert.equal(
  selection.schemaVersion,
  "face-space-reference-method-selection-v0"
);
assert.equal(selection.status, "explicit_research_decision");
assert.equal(selection.selectedMethodId, "median__mad_scaled_consistent");
assert.equal(selection.authority.productionAuthority, false);
assert.equal(selection.authority.normalizationAuthority, false);
assert.equal(selection.authority.automaticSelectionAuthority, false);
assert.equal(selection.authority.holdoutSelectionAuthority, false);

assert.equal(
  selection.decision.sourceReferenceSplitFingerprint,
  comparison.sourceReferenceSplitFingerprint
);
assert.equal(
  selection.decision.comparisonPacketFingerprint,
  comparison.packetFingerprint
);
assert.equal(
  selection.decision.comparisonVersion,
  comparison.comparisonVersion
);
assert.equal(selection.decision.holdoutUsedForSelection, false);
assert.equal(selection.decision.automaticWinnerSelected, false);

assert.throws(
  () =>
    buildFaceSpaceReferenceMethodSelectionDecision({
      comparison,
      selectedMethodId: "not_a_method",
      decisionVersion: "invalid-method",
      evidenceRef: "synthetic",
      selectionRationale: "invalid"
    }),
  /method_selection_method_invalid/
);

assert.throws(
  () =>
    buildFaceSpaceReferenceMethodSelectionDecision({
      comparison: {
        ...comparison,
        authority: {
          ...comparison.authority,
          rankingAuthority: true
        }
      },
      selectedMethodId: "median__mad_scaled_consistent",
      decisionVersion: "invalid-comparison",
      evidenceRef: "synthetic",
      selectionRationale: "invalid"
    }),
  /method_selection_comparison_invalid/
);

const actualComparison = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-method-comparison.json",
    "utf8"
  )
);
const actualSelection = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-method-selection.json",
    "utf8"
  )
);
const rebuiltActualSelection = buildFaceSpaceReferenceMethodSelectionDecision({
  comparison: actualComparison,
  selectedMethodId: "median__mad_scaled_consistent",
  decisionVersion: "london-set-v5-reference-method-selection-v1",
  evidenceRef:
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-method-selection.json",
  selectionRationale:
    "Select median center with MAD scaled-consistent scale for the same-provider research candidate because both estimators are robust to isolated distribution tails and outliers in the bounded reference split. The descriptive comparison only establishes that all four supported profiles are finite and non-degenerate; this is an explicit methodological choice, not an automatic winner. The locked holdout is excluded from selection and remains reserved for later diagnostics."
});
assert.deepEqual(actualSelection, rebuiltActualSelection);
assert.equal(actualSelection.decision.centerMethod, "median");
assert.equal(actualSelection.decision.scaleMethod, "mad_scaled_consistent");
assert.equal(actualSelection.decision.holdoutUsedForSelection, false);
assert.equal(actualSelection.decision.automaticWinnerSelected, false);
assert.equal(actualSelection.authority.productionAuthority, false);
assert.equal(actualSelection.authority.normalizationAuthority, false);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  automaticSelectionAuthority: false,
  holdoutSelectionAuthority: false,
  selectionRequiresComparisonPacket: true,
  selectionRequiresExactReferenceFingerprint: true,
  noAutomaticWinner: true,
  actualMethodSelected: true,
  actualSelectedMethodId: actualSelection.selectedMethodId,
  actualDecisionVersion: actualSelection.decision.decisionVersion
}, null, 2));
