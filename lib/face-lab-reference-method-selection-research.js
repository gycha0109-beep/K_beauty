import {
  validateFaceSpaceReferenceStatisticsMethodDecision
} from "./face-lab-face-space-normalization-research.js";

export const FACE_SPACE_REFERENCE_METHOD_SELECTION_SCHEMA_VERSION =
  "face-space-reference-method-selection-v0";

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256Reference(value) {
  return (
    typeof value === "string" &&
    /^sha256:[a-f0-9]{64}$/.test(value)
  );
}

export function buildFaceSpaceReferenceMethodSelectionDecision({
  comparison,
  selectedMethodId,
  decisionVersion,
  evidenceRef,
  selectionRationale
} = {}) {
  if (
    comparison?.schemaVersion !==
      "face-space-reference-method-comparison-v0" ||
    comparison?.status !== "descriptive_comparison_only" ||
    comparison?.referenceSplitOnly !== true ||
    comparison?.authority?.productionAuthority !== false ||
    comparison?.authority?.normalizationAuthority !== false ||
    comparison?.authority?.methodSelectionAuthority !== false ||
    comparison?.authority?.rankingAuthority !== false ||
    !sha256Reference(comparison?.sourceReferenceSplitFingerprint) ||
    !sha256Reference(comparison?.packetFingerprint) ||
    !nonEmpty(comparison?.comparisonVersion) ||
    !Array.isArray(comparison?.profiles)
  ) {
    throw new Error("face_space_reference_method_selection_comparison_invalid");
  }

  if (
    !nonEmpty(selectedMethodId) ||
    !nonEmpty(decisionVersion) ||
    !nonEmpty(evidenceRef) ||
    !nonEmpty(selectionRationale)
  ) {
    throw new Error("face_space_reference_method_selection_input_invalid");
  }

  const matches = comparison.profiles.filter(
    (profile) => profile.methodId === selectedMethodId
  );
  if (matches.length !== 1) {
    throw new Error("face_space_reference_method_selection_method_invalid");
  }
  const selected = matches[0];

  const decision = validateFaceSpaceReferenceStatisticsMethodDecision({
    schemaVersion: "face-space-reference-statistics-method-decision-v0",
    status: "selected_for_research_candidate",
    decisionVersion,
    scope: "same_provider",
    referenceCorpusSummarySchemaVersion:
      comparison.sourceReferenceCorpusSummarySchemaVersion,
    centerMethod: selected.centerMethod,
    scaleMethod: selected.scaleMethod,
    percentileMethod: null,
    thresholdMethod: null,
    sourceReferenceSplitFingerprint:
      comparison.sourceReferenceSplitFingerprint,
    comparisonPacketFingerprint: comparison.packetFingerprint,
    comparisonVersion: comparison.comparisonVersion,
    evidenceRef,
    selectionRationale,
    holdoutUsedForSelection: false,
    automaticWinnerSelected: false,
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false
  });

  return {
    schemaVersion: FACE_SPACE_REFERENCE_METHOD_SELECTION_SCHEMA_VERSION,
    status: "explicit_research_decision",
    selectedMethodId,
    decision,
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      automaticSelectionAuthority: false,
      holdoutSelectionAuthority: false,
      researchDecisionOnly: true
    }
  };
}
