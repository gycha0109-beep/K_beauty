#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3a = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3a-broad-spectrum-semantic-contract-v1.json",
    "utf8",
  ),
);
const r3d = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3d-registry-coexistence-implementation-v1.json",
    "utf8",
  ),
);
const r3e = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3e-broad-spectrum-registry-publish-preflight-v1.json",
    "utf8",
  ),
);

assert.equal(r3a.decision, "BROAD_SPECTRUM_SEPARATE_FACT_SEMANTICS_PASS");
assert.equal(r3d.decision, "UVA_R3D_REGISTRY_COEXISTENCE_IMPLEMENTATION_PASS");
assert.equal(r3e.stage, "DATA-AI29C-UVA-R3E");
assert.equal(r3e.track, "taxonomy-ai");
assert.equal(r3e.candidateRegistryVersion, "product-fact-registry-cross-category-v2");
assert.equal(r3e.candidateSnapshot.definitionCount, 21);
assert.equal(r3e.candidateSnapshot.carriedForwardDefinitionCount, 20);
assert.equal(r3e.candidateSnapshot.newDefinitionCount, 1);
assert.equal(r3e.candidateSnapshot.newFactKey, "broad_spectrum");
assert.equal(
  r3e.candidateSnapshot.broadSpectrumDefinitionChecksum,
  "c888474e8970f787dee3f71bdcc505a779400b0ebf438901bbc5fd7f2dc32dc9",
);
assert.equal(
  r3e.candidateSnapshot.registryChecksum,
  "923256ca2468b2af31e1b7026655739408035daf62d3ff40a7132eca22afddd7",
);
assert.equal(r3e.rollbackPublishPreflight.passed, true);
assert.equal(r3e.rollbackPublishPreflight.registryPublishedInsideTransaction, true);
assert.equal(r3e.rollbackPublishPreflight.publishedDefinitionCount, 21);
assert.equal(r3e.rollbackPublishPreflight.candidateBecameGlobalLatestInsideTransaction, true);
assert.equal(r3e.rollbackPublishPreflight.broadSpectrumDefinitionMatchedFrozenR3A, true);
assert.deepEqual(r3e.rollbackPublishPreflight.broadSpectrumPolicySetInsideTransaction, {
  policy_state: "active",
  new_lineage_allowed: true,
  existing_lineage_allowed: true,
});
assert.equal(r3e.rollbackPublishPreflight.broadSpectrumNewReviewPrepared, true);
assert.deepEqual(r3e.rollbackPublishPreflight.v2SpfNewLineage, {
  allowed: false,
  reason: "POLICY_MISSING",
});
assert.equal(r3e.rollbackPublishPreflight.v1SpfNewLineageStillAllowed, true);
assert.equal(r3e.rollbackPublishPreflight.rolledBack, true);
assert.equal(r3e.productionReadbackAfterRollback.registryVersionCount, 1);
assert.equal(r3e.productionReadbackAfterRollback.candidateV2Count, 0);
assert.equal(r3e.productionReadbackAfterRollback.writePolicyRowCount, 20);
assert.equal(r3e.productionReadbackAfterRollback.currentFactCount, 92);
assert.equal(r3e.productionReadbackAfterRollback.broadSpectrumDefinitionPublished, false);
assert.equal(r3e.productionReadbackAfterRollback.broadSpectrumFactWritten, false);
assert.equal(r3e.advisorReadback.relevantSecurityWarnCount, 0);
assert.equal(r3e.advisorReadback.relevantPerformanceWarnCount, 0);
assert.deepEqual(r3e.controlledPublishPlan.atomicSteps, [
  "publish complete v2 Registry snapshot with 21 definitions",
  "set v2 broad_spectrum write policy active for new and existing lineage",
  "leave all carried-forward v2 fact keys without write policy so they remain fail-closed",
  "verify v1 policies remain unchanged and active",
  "verify Recommendation readers and ranking remain unchanged",
]);
assert.equal(r3e.controlledPublishPlan.postPublishExpectedState.registryVersionCount, 2);
assert.equal(r3e.controlledPublishPlan.postPublishExpectedState.v1WritePolicyRowCount, 20);
assert.equal(r3e.controlledPublishPlan.postPublishExpectedState.v2BroadSpectrumPolicyRowCount, 1);
assert.equal(r3e.controlledPublishPlan.postPublishExpectedState.v2CarriedForwardPolicyRowCount, 0);
for (const [key, value] of Object.entries(r3e.boundaries)) {
  assert.equal(value, false, `boundary must remain false: ${key}`);
}
assert.equal(r3e.decision, "UVA_R3E_BROAD_SPECTRUM_REGISTRY_PUBLISH_PREFLIGHT_PASS");
assert.equal(r3e.nextGate, "DATA-AI29C-UVA-R3F_BROAD_SPECTRUM_REGISTRY_CONTROLLED_PUBLISH");

console.log(JSON.stringify({
  status: "PASS",
  stage: r3e.stage,
  candidateRegistry: r3e.candidateRegistryVersion,
  definitionCount: r3e.candidateSnapshot.definitionCount,
  rollbackPublishPreflight: r3e.rollbackPublishPreflight.passed,
  productionV2Count: r3e.productionReadbackAfterRollback.candidateV2Count,
  decision: r3e.decision,
}));
