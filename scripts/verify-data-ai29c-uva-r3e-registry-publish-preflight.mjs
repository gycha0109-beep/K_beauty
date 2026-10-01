#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3d = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3d-registry-coexistence-implementation-v1.json",
    "utf8",
  ),
);
const r3e = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3e-registry-publish-preflight-v1.json",
    "utf8",
  ),
);
const protectionReader = fs.readFileSync(
  "lib/recommendation-sunscreen-protection-authority-contract.mjs",
  "utf8",
);

assert.equal(
  r3d.decision,
  "UVA_R3D_REGISTRY_COEXISTENCE_IMPLEMENTATION_PASS",
);
assert.equal(r3e.stage, "DATA-AI29C-UVA-R3E");
assert.equal(r3e.track, "taxonomy-ai");

assert.equal(
  r3e.prospectiveRegistry.registryVersion,
  "product-fact-registry-cross-category-v2",
);
assert.equal(
  r3e.prospectiveRegistry.identitySerializerVersion,
  "product-fact-subject-identity-v1",
);
assert.equal(r3e.prospectiveRegistry.definitionCount, 21);
assert.equal(r3e.prospectiveRegistry.clonedV1DefinitionCount, 20);
assert.equal(r3e.prospectiveRegistry.addedFactKey, "broad_spectrum");
assert.equal(
  r3e.prospectiveRegistry.registryChecksum,
  "453b8523bfeae634e0d8467d9eb69dcdc301626d9c6b27c6abd13fa3f974e696",
);
assert.equal(
  r3e.prospectiveRegistry.broadSpectrumDefinitionChecksum,
  "59f6d5e5232f8603f66091f5a1d641ce9f056fec20413370a470fa61dca703d9",
);
assert.equal(
  r3e.prospectiveRegistry.existingSemanticsOnlyRegistryVersionChanged,
  true,
);

const broad = r3e.prospectiveRegistry.broadSpectrumDefinition;
assert.equal(broad.fact_key, "broad_spectrum");
assert.equal(broad.registry_version, "product-fact-registry-cross-category-v2");
assert.equal(broad.value_type, "boolean");
assert.equal(broad.cardinality, "one");
assert.deepEqual(broad.domain_scope, ["sunscreen"]);
assert.deepEqual(broad.scope_schema.required_fields, ["market"]);
assert.deepEqual(broad.permitted_evidence_classes, ["product_claim"]);
assert.equal(broad.negative_evidence_requirement, "explicit_negative_only");

assert.equal(
  r3e.prospectiveWriteAuthority.v1ExistingKeys.factKeyCount,
  20,
);
assert.equal(
  r3e.prospectiveWriteAuthority.v1ExistingKeys.policyChangeRequired,
  false,
);
assert.equal(
  r3e.prospectiveWriteAuthority.v2BroadSpectrum.newLineageAllowed,
  true,
);
assert.equal(
  r3e.prospectiveWriteAuthority.v2ClonedExistingKeys.policyRowsRequired,
  0,
);
assert.equal(
  r3e.prospectiveWriteAuthority.v2ClonedExistingKeys.failureReason,
  "POLICY_MISSING",
);

for (const value of [
  r3e.rollbackPreflight.publishInitialPassed,
  r3e.rollbackPreflight.publishReplayIdempotentPassed,
  r3e.rollbackPreflight.v2BecameGlobalLatestInsideTransaction,
  r3e.rollbackPreflight.v1SpfNewLineageRemainedAllowed,
  r3e.rollbackPreflight.v1SpfExistingLineageRemainedAllowed,
  r3e.rollbackPreflight.v2BroadSpectrumNewLineageAllowed,
  r3e.rollbackPreflight.v2SpfNewLineageBlocked,
  r3e.rollbackPreflight.v2BroadSpectrumReviewPreparationPassed,
  r3e.rollbackPreflight.v2SpfReviewPreparationBlocked,
  r3e.rollbackPreflight.rolledBack,
]) {
  assert.equal(value, true);
}

assert.deepEqual(r3e.rollbackPreflight.transactionState, {
  registryVersionCount: 2,
  v2DefinitionCount: 21,
  v2PolicyCount: 1,
  currentFactCount: 92,
  v2CurrentFactCount: 0,
});

assert.deepEqual(r3e.postRollbackProductionReadback, {
  registryVersionCount: 1,
  v2RegistryCount: 0,
  v2DefinitionCount: 0,
  v2PolicyCount: 0,
  v2ReviewAssignmentCount: 0,
  currentFactCount: 92,
  v2CurrentFactCount: 0,
  v1PolicyRowCount: 20,
});

assert.deepEqual(r3e.recommendationBoundary.currentProtectionReaderFactKeys, [
  "spf_value",
  "uva_label",
  "water_resistance_duration",
]);
assert.equal(protectionReader.includes('"broad_spectrum"'), false);
for (const value of Object.values(r3e.recommendationBoundary).filter(
  (value) => typeof value === "boolean",
)) {
  assert.equal(value, false);
}

for (const value of Object.values(r3e.authorizationBoundary)) {
  assert.equal(value, false);
}

assert.equal(
  r3e.decision,
  "UVA_R3E_BROAD_SPECTRUM_REGISTRY_PUBLISH_PREFLIGHT_PASS_NO_PERSISTENT_PUBLISH",
);
assert.equal(
  r3e.nextGate,
  "DATA-AI29C-UVA-R3F_BROAD_SPECTRUM_REGISTRY_CONTROLLED_PUBLISH",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: r3e.stage,
    registryVersion: r3e.prospectiveRegistry.registryVersion,
    definitionCount: r3e.prospectiveRegistry.definitionCount,
    registryChecksum: r3e.prospectiveRegistry.registryChecksum,
    rolledBack: r3e.rollbackPreflight.rolledBack,
    persistentV2Registry: r3e.postRollbackProductionReadback.v2RegistryCount,
    decision: r3e.decision,
  }),
);
