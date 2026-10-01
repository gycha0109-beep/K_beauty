#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3b = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3b-registry-compatibility-audit-v1.json",
    "utf8",
  ),
);
const r3c = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3c-registry-coexistence-design-v1.json",
    "utf8",
  ),
);

assert.equal(
  r3b.decision,
  "UVA_R3B_HOLD_V2_PUBLISH_ACTIVE_V1_LINEAGE_AND_LATEST_REGISTRY_COUPLING",
);
assert.equal(r3c.stage, "DATA-AI29C-UVA-R3C");
assert.equal(r3c.track, "taxonomy-ai");
assert.equal(r3c.problem.globalLatestRegistryGate, true);
assert.equal(r3c.problem.activeV1ResearchLineage, 371);
assert.equal(r3c.problem.currentCardinalityGuardIncludesRegistryVersion, true);

assert.equal(
  r3c.proposedPolicyTable.name,
  "product_fact_registry_fact_write_policy_v1",
);
assert.deepEqual(r3c.proposedPolicyTable.primaryKey, [
  "registry_version",
  "fact_key",
]);
assert.equal(
  r3c.proposedPolicyTable.invariant,
  "At most one registry_version can have new_lineage_allowed=true for the same fact_key at a time.",
);

assert.equal(
  r3c.proposedAdmissibilityHelper.name,
  "product_fact_controlled_registry_write_admissibility_v2",
);
assert.deepEqual(r3c.proposedAdmissibilityHelper.lineageKinds, [
  "new",
  "existing",
]);

assert.deepEqual(
  r3c.writePathChanges.map((row) => row.function).sort(),
  [
    "admin_prepare_product_fact_review_v1",
    "product_fact_controlled_build_preflight_v1",
    "trust_phase4_build_adoption_plan_v1",
    "trust_phase8e_build_revalidation_plan_legacy_v1",
  ].sort(),
);

assert.equal(
  r3c.publicationSemantics.adminPublishProductFactRegistryV1RemainsImmutable,
  true,
);
assert.equal(
  r3c.publicationSemantics.registryEffectiveAtDoesNotGrantWriteAuthority,
  true,
);
assert.equal(
  r3c.publicationSemantics.publishAndWriteAuthorityAreSeparateAdminActions,
  true,
);
assert.equal(
  r3c.publicationSemantics.writePathsMustNotUseGlobalLatestAsSoleAuthority,
  true,
);

assert.equal(r3c.initialPolicySeed.v1.existingFactKeyCount, 20);
assert.equal(
  r3c.initialPolicySeed.futureV2.writePolicy.broad_spectrum.new_lineage_allowed,
  true,
);
assert.equal(
  r3c.initialPolicySeed.futureV2.writePolicy.broad_spectrum.existing_lineage_allowed,
  true,
);
assert.equal(
  r3c.initialPolicySeed.futureV2.writePolicy.existingV1FactKeys.new_lineage_allowed,
  false,
);
assert.equal(
  r3c.initialPolicySeed.futureV2.writePolicy.existingV1FactKeys.existing_lineage_allowed,
  false,
);

assert.equal(r3c.sameFactKeyMigrationProtocol.broadSpectrumNeedsMigration, false);
assert.equal(
  r3c.cardinalityBoundary.currentGuard,
  "product_fact_current_cardinality_guard_v1",
);
assert.equal(
  r3c.cardinalityBoundary.currentSlot,
  "subject_id + registry_version + fact_key",
);

assert.deepEqual(r3c.recommendationBoundary.currentReaderFactKeys, [
  "spf_value",
  "uva_label",
  "water_resistance_duration",
]);
assert.equal(r3c.recommendationBoundary.broadSpectrumConsumed, false);
assert.equal(r3c.recommendationBoundary.broadSpectrumRankingBucket, null);
assert.equal(
  r3c.recommendationBoundary.currentReaderMustRemainUnchangedDuringCoexistenceImplementation,
  true,
);
assert.equal(
  r3c.recommendationBoundary.existingProtectionFactMigrationForbidden,
  true,
);

assert.equal(r3c.limits.productionSchemaChanged, false);
assert.equal(r3c.limits.registryPublished, false);
assert.equal(r3c.limits.productFactWritten, false);
assert.equal(r3c.limits.recommendationAuthorityChanged, false);
assert.equal(r3c.limits.recommendationProjectionChanged, false);
assert.equal(r3c.limits.productionRankingChanged, false);
assert.equal(r3c.limits.productionCutoverAuthorized, false);
assert.equal(r3c.limits.outdoorRankableSignalAuthorized, false);
assert.equal(r3c.limits.publicActivation, false);

assert.equal(
  r3c.decision,
  "UVA_R3C_REGISTRY_COEXISTENCE_DESIGN_PASS_IMPLEMENTATION_REQUIRED",
);
assert.equal(
  r3c.nextGate,
  "DATA-AI29C-UVA-R3D_REGISTRY_COEXISTENCE_IMPLEMENTATION",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: r3c.stage,
    policyTable: r3c.proposedPolicyTable.name,
    writePathsToChange: r3c.writePathChanges.length,
    existingV1FactKeys: r3c.initialPolicySeed.v1.existingFactKeyCount,
    broadSpectrumNeedsMigration:
      r3c.sameFactKeyMigrationProtocol.broadSpectrumNeedsMigration,
    registryPublished: r3c.limits.registryPublished,
    decision: r3c.decision,
  }),
);
