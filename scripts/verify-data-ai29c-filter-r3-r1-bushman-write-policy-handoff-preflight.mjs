#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const r3 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r3-bushman-uv-filter-recovery-preflight-v1.json",
  "utf8",
));
const r3d = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3d-registry-coexistence-implementation-v1.json",
  "utf8",
));
const r31 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r3-r1-bushman-write-policy-handoff-preflight-v1.json",
  "utf8",
));

assert.equal(
  r3.decision,
  "FILTER_R3_BUSHMAN_HYBRID_RECOVERY_PREFLIGHT_PASS_WRITE_NOT_AUTHORIZED",
);
assert.equal(
  r3d.decision,
  "UVA_R3D_REGISTRY_COEXISTENCE_IMPLEMENTATION_PASS",
);
assert.equal(
  r31.decision,
  "FILTER_R3_R1_POLICY_MISSING_FAIL_CLOSED_HANDOFF_PREFLIGHT_PASS",
);
assert.equal(r31.mode, "ZERO_WRITE_POLICY_HANDOFF_PREFLIGHT");
assert.equal(r31.productionPrestate.targetUvFilterCurrent, 0);
assert.equal(r31.productionPrestate.targetOpenUvFilterAssignments, 0);
assert.equal(r31.policyPrestate.v1.policyState, "active");
assert.equal(r31.policyPrestate.v1.newLineageAllowed, true);
assert.equal(r31.policyPrestate.v1.existingLineageAllowed, true);
assert.equal(r31.policyPrestate.v2, null);
assert.equal(r31.policyPrestate.v2NewLineageAdmissibility.allowed, false);
assert.equal(
  r31.policyPrestate.v2NewLineageAdmissibility.reason,
  "POLICY_MISSING",
);
assert.equal(r31.policyPrestate.dualNewWriterForbidden, true);

assert.equal(r31.v1UvFilterImpact.currentCount, 18);
assert.equal(r31.v1UvFilterImpact.currentV2Count, 0);
assert.equal(r31.v1UvFilterImpact.researchTasks.EVIDENCE_CANDIDATE, 12);
assert.equal(r31.v1UvFilterImpact.openReviewAssignments, 0);
assert.equal(r31.v1UvFilterImpact.drainingPreservesExistingLineage, true);

assert.equal(
  r31.frozenCompositionAuthority.propositionKey,
  "717e0e0eb6b8f5575ac20f0189878bd5af4195bda7da19f427670b12ca95200f",
);
assert.equal(
  r31.frozenCompositionAuthority.sourceDigest,
  "3a9fbcb280935133e95a0f7f19bfff20157258b4dc17b8dce4d601e40f6681a9",
);
assert.equal(
  r31.frozenCompositionAuthority.canonicalEvidenceDigest,
  "e33410c566219ed28795cd3474abcc5752226b3a7cc8b931f5f0302ffab9bb3f",
);
assert.equal(r31.frozenCompositionAuthority.evidenceClass, "composition_identity");
assert.equal(r31.frozenCompositionAuthority.authority, "product_specific_primary");
assert.equal(r31.frozenCompositionAuthority.confidence, "high");

const handoff = r31.plannedPolicyHandoff;
assert.equal(handoff.atomicTransactionRequired, true);
assert.equal(handoff.step1.registryVersion, "product-fact-registry-cross-category-v1");
assert.equal(handoff.step1.policyState, "draining");
assert.equal(handoff.step1.newLineageAllowed, false);
assert.equal(handoff.step1.existingLineageAllowed, true);
assert.equal(handoff.step2.registryVersion, "product-fact-registry-cross-category-v2");
assert.equal(handoff.step2.policyState, "active");
assert.equal(handoff.step2.newLineageAllowed, true);
assert.equal(handoff.step2.existingLineageAllowed, true);
assert.equal(handoff.sourceEvidenceFactWritesInPolicyStage, 0);
assert.equal(
  handoff.expectedAfter.singleNewWriterRegistry,
  "product-fact-registry-cross-category-v2",
);

for (const value of Object.values(r31.writeBoundary)) assert.equal(value, false);

assert.equal(
  r31.nextGate,
  "DATA-AI29C-FILTER-R3-R2_UV_FILTER_REGISTRY_WRITE_AUTHORITY_HANDOFF",
);
assert.equal(
  r31.followingGateOnPass,
  "DATA-AI29C-FILTER-R3-R3_BUSHMAN_GOVERNED_SOURCE_REFRESH_AND_CONFIRMATION",
);

console.log(JSON.stringify({
  status:"PASS",
  stage:r31.stage,
  decision:r31.decision,
  policyReason:r31.policyPrestate.v2NewLineageAdmissibility.reason,
  oldRegistryNextState:handoff.step1.policyState,
  newRegistryNextState:handoff.step2.policyState,
  followingGate:r31.followingGateOnPass,
}, null, 2));
