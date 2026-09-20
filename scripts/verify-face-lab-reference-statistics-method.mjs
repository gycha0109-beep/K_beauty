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

assert.equal(
  contract.schemaVersion,
  "face-space-reference-statistics-method-decision-v0"
);
assert.equal(contract.status, "not_selected");
assert.equal(contract.productionAuthority, false);
assert.equal(contract.normalizationAuthority, false);
assert.equal(contract.thresholdAuthority, false);
assert.equal(contract.decisionVersion, null);
assert.equal(contract.selectedMethod.centerMethod, null);
assert.equal(contract.selectedMethod.scaleMethod, null);
assert.equal(contract.selectedMethod.percentileMethod, null);
assert.equal(contract.selectedMethod.thresholdMethod, null);
assert.equal(
  contract.prerequisites.structurallyValidReferenceCorpusRequired,
  true
);
assert.equal(contract.prerequisites.lockedHoldoutRequired, true);

assert.throws(
  () => validateFaceSpaceReferenceStatisticsMethodDecision(contract),
  /method_decision_invalid/
);

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
  supportedResearchMethodsAreNotSelectedMethods: true,
  holdoutExcludedFromMethodFitting: true
}, null, 2));
