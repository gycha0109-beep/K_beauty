import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateFaceSpaceReferenceStatisticsMethodDecision
} from "../lib/face-lab-face-space-normalization-research.js";

const contract = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/reference-statistics-method.contract.json",
    "utf8"
  )
);
const selection = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-method-selection.json",
    "utf8"
  )
);

assert.equal(
  contract.schemaVersion,
  "face-space-reference-statistics-method-decision-v0"
);
assert.equal(contract.status, "selected_for_research_candidate");
assert.equal(contract.productionAuthority, false);
assert.equal(contract.normalizationAuthority, false);
assert.equal(contract.thresholdAuthority, false);
assert.equal(
  contract.decisionVersion,
  "london-set-v5-reference-method-selection-v1"
);
assert.equal(contract.selectedMethod.centerMethod, "median");
assert.equal(
  contract.selectedMethod.scaleMethod,
  "mad_scaled_consistent"
);
assert.equal(contract.selectedMethod.percentileMethod, null);
assert.equal(contract.selectedMethod.thresholdMethod, null);
assert.equal(
  contract.selectionEvidence.comparisonPacketFingerprint,
  "sha256:76f346b6b284b32af63db3171f654e12cf70d91470b18e34502a199d2d5a3726"
);
assert.equal(
  contract.selectionEvidence.sourceReferenceSplitFingerprint,
  "sha256:6f9a051dd204db73e35a2866aebdeb49f83a8e0ad557d97c3036427af5d44ccf"
);
const validatedCurrentDecision =
  validateFaceSpaceReferenceStatisticsMethodDecision(selection.decision);
assert.equal(validatedCurrentDecision.centerMethod, "median");
assert.equal(
  validatedCurrentDecision.scaleMethod,
  "mad_scaled_consistent"
);
assert.equal(validatedCurrentDecision.holdoutUsedForSelection, false);
assert.equal(validatedCurrentDecision.automaticWinnerSelected, false);
assert.equal(
  validatedCurrentDecision.authority.researchMethodSelectionOnly,
  true
);
assert.equal(
  contract.prerequisites.structurallyValidReferenceCorpusRequired,
  true
);
assert.equal(contract.prerequisites.lockedHoldoutRequired, true);

for (const centerMethod of contract.supportedResearchMethods.center) {
  for (const scaleMethod of contract.supportedResearchMethods.scale) {
    const selected =
      validateFaceSpaceReferenceStatisticsMethodDecision({
        schemaVersion: contract.schemaVersion,
        status: "selected_for_research_candidate",
        decisionVersion:
          "synthetic-verifier-" + centerMethod + "-" + scaleMethod,
        scope: contract.scope,
        referenceCorpusSummarySchemaVersion:
          contract.referenceCorpusSummarySchemaVersion,
        centerMethod,
        scaleMethod,
        percentileMethod: null,
        thresholdMethod: null,
        sourceReferenceSplitFingerprint:
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        comparisonPacketFingerprint:
          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        comparisonVersion: "synthetic-verifier-comparison-v0",
        evidenceRef: "synthetic-verifier-only:method-selection",
        selectionRationale:
          "Synthetic verifier exercises supported method-decision shapes only.",
        holdoutUsedForSelection: false,
        automaticWinnerSelected: false,
        productionAuthority: false,
        normalizationAuthority: false,
        thresholdAuthority: false
      });
    assert.equal(
      selected.authority.researchMethodSelectionOnly,
      true
    );
    assert.equal(selected.authority.normalizationAuthority, false);
  }
}

console.log(JSON.stringify({
  ok: true,
  currentStatus: contract.status,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false,
  selectedMethodId: "median__mad_scaled_consistent",
  explicitResearchSelectionPresent: true,
  holdoutExcludedFromMethodFitting: true,
  comparisonEvidenceRequiredForSelection: true,
  automaticWinnerSelectionForbidden: true
}, null, 2));
