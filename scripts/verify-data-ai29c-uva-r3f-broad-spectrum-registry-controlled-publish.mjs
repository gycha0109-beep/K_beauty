#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3e = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3e-broad-spectrum-registry-publish-preflight-v1.json",
  "utf8",
));
const r3f = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3f-broad-spectrum-registry-controlled-publish-v1.json",
  "utf8",
));

assert.equal(r3e.decision, "UVA_R3E_BROAD_SPECTRUM_REGISTRY_PUBLISH_PREFLIGHT_PASS");
assert.equal(r3f.stage, "DATA-AI29C-UVA-R3F");
assert.equal(r3f.track, "taxonomy-ai");
assert.equal(r3f.registryPublish.publishedRegistryVersion, "product-fact-registry-cross-category-v2");
assert.equal(r3f.registryPublish.definitionCount, 21);
assert.equal(r3f.registryPublish.carriedForwardDefinitionCount, 20);
assert.equal(r3f.registryPublish.newDefinitionCount, 1);
assert.equal(r3f.registryPublish.newFactKey, "broad_spectrum");
assert.equal(r3f.registryPublish.registryChecksum, r3e.candidateSnapshot.registryChecksum);
assert.equal(r3f.registryPublish.broadSpectrumDefinitionChecksum, r3e.candidateSnapshot.broadSpectrumDefinitionChecksum);
assert.equal(r3f.registryPublish.committed, true);
assert.equal(r3f.registryPublish.latestRegistryAfterCommit, "product-fact-registry-cross-category-v2");
assert.deepEqual(r3f.broadSpectrumWritePolicy, {
  registryVersion: "product-fact-registry-cross-category-v2",
  factKey: "broad_spectrum",
  policyState: "active",
  newLineageAllowed: true,
  existingLineageAllowed: true,
  policyVersion: "data-ai29c-uva-r3f-broad-spectrum-v1",
  authorizedPhase: "DATA-AI29C-UVA-R3F",
  policyDigest: "98d43d2a8d34704423e893b36d1433c8b7a02c0aa1c1394b13ef5ce3ec6b6361",
});
assert.deepEqual(r3f.failClosedControls.v2SpfValue, {
  newLineageAllowed: false,
  reason: "POLICY_MISSING",
});
assert.equal(r3f.failClosedControls.v2CarriedForwardPolicyRowCount, 0);
assert.deepEqual(r3f.failClosedControls.v1SpfValue, {
  newLineageAllowed: true,
  reason: "ALLOWED",
});
assert.equal(r3f.productionReadback.registryVersionCount, 2);
assert.equal(r3f.productionReadback.latestRegistryVersion, "product-fact-registry-cross-category-v2");
assert.equal(r3f.productionReadback.v2DefinitionCount, 21);
assert.equal(r3f.productionReadback.writePolicyRowCount, 21);
assert.equal(r3f.productionReadback.v1WritePolicyRowCount, 20);
assert.equal(r3f.productionReadback.v2WritePolicyRowCount, 1);
assert.equal(r3f.productionReadback.v2NonBroadPolicyRowCount, 0);
assert.equal(r3f.productionReadback.currentFactCount, 92);
assert.equal(r3f.productionReadback.broadSpectrumCurrentFactCount, 0);
assert.equal(r3f.productionReadback.currentWaterFactCount, 2);
assert.deepEqual(r3f.productionReadback.activeV1ResearchLineage, {
  EVIDENCE_CANDIDATE: 28,
  REVIEW_REQUIRED: 343,
  total: 371,
});
assert.equal(r3f.productionReadback.spfAuthenticatedBeta.enabled, true);
assert.equal(r3f.productionReadback.spfAuthenticatedBeta.authorizedPhase, "DATA-AI29C-D5D");
assert.equal(r3f.recommendationBoundary.broadSpectrumConsumed, false);
assert.equal(r3f.recommendationBoundary.sunscreenProtectionReaderChanged, false);
assert.equal(r3f.recommendationBoundary.sunscreenProtectionProjectionChanged, false);
assert.equal(r3f.recommendationBoundary.rankingChanged, false);
assert.equal(r3f.recommendationBoundary.productionCutoverAuthorized, false);
assert.equal(r3f.recommendationBoundary.outdoorRankableSignalAuthorized, false);
assert.equal(r3f.recommendationBoundary.publicActivation, false);
assert.equal(r3f.productFactBoundary.broadSpectrumFactWritten, false);
assert.equal(r3f.productFactBoundary.currentFactCountChanged, false);
assert.equal(r3f.productFactBoundary.existingProtectionFactsMigratedToV2, false);
assert.equal(r3f.decision, "UVA_R3F_BROAD_SPECTRUM_REGISTRY_CONTROLLED_PUBLISH_PASS");
assert.equal(r3f.nextGate, "DATA-AI29C-UVA-R3G_DAY_DEW_BROAD_SPECTRUM_GOVERNED_FACT_PILOT");

console.log(JSON.stringify({
  status: "PASS",
  stage: r3f.stage,
  registryVersions: r3f.productionReadback.registryVersionCount,
  latestRegistry: r3f.productionReadback.latestRegistryVersion,
  broadSpectrumCurrentFacts: r3f.productionReadback.broadSpectrumCurrentFactCount,
  decision: r3f.decision,
}));
