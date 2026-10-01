#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3c = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3c-registry-coexistence-design-v1.json",
    "utf8",
  ),
);
const r3d = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3d-registry-coexistence-implementation-v1.json",
    "utf8",
  ),
);
const migration = fs.readFileSync(
  "supabase/migrations/20261001103000_data_ai29c_uva_r3d_registry_coexistence_v1.sql",
  "utf8",
);

assert.equal(
  r3c.decision,
  "UVA_R3C_REGISTRY_COEXISTENCE_DESIGN_PASS_IMPLEMENTATION_REQUIRED",
);
assert.equal(r3d.stage, "DATA-AI29C-UVA-R3D");
assert.equal(r3d.track, "taxonomy-ai");

assert.ok(
  migration.includes(
    "create table public.product_fact_registry_fact_write_policy_v1",
  ),
);
assert.ok(
  migration.includes(
    "product_fact_registry_fact_write_policy_v1_one_new_writer_idx",
  ),
);
assert.ok(
  migration.includes(
    "create or replace function public.product_fact_controlled_registry_write_admissibility_v2",
  ),
);
assert.ok(
  migration.includes(
    "create or replace function public.admin_set_product_fact_registry_fact_write_policy_v1",
  ),
);

for (const fn of [
  "admin_prepare_product_fact_review_v1",
  "product_fact_controlled_build_preflight_v1",
  "trust_phase4_build_adoption_plan_v1",
  "trust_phase8e_build_revalidation_plan_legacy_v1",
]) {
  assert.equal(
    migration.split(`create or replace function public.${fn}`).length - 1,
    1,
    `${fn}: implementation override must exist exactly once`,
  );
}

assert.equal(
  migration.includes("product_fact_review_prepare_registry_stale"),
  false,
);
assert.equal(
  migration.includes("product_fact_confirmation_registry_stale"),
  false,
);
assert.equal(
  migration.includes("trust_phase4_registry_not_current"),
  false,
);
assert.equal(
  migration.includes(
    "product_fact_revalidation_resolution_registry_stale",
  ),
  false,
);

assert.equal(
  migration.split("product_fact_controlled_latest_registry_v1()").length - 1,
  1,
  "latest Registry must remain diagnostic only in confirmation prestate",
);
assert.ok(migration.includes("'write_policy', v_registry_write_policy"));
assert.ok(
  migration.includes(
    "v_expected <> 20",
  ),
);
assert.equal(
  migration.includes("insert into public.product_fact_registry_versions"),
  false,
  "R3D must not publish a Registry version",
);
assert.equal(
  migration.includes("insert into public.product_fact_instances"),
  false,
  "R3D must not write Product Facts",
);
assert.equal(
  migration.includes("insert into public.product_fact_current"),
  false,
  "R3D must not mutate Product Fact Current",
);

assert.equal(r3d.migration.rollbackDryRunPassed, true);
assert.equal(r3d.migration.productionApplied, true);
assert.equal(r3d.migration.registryV2Published, false);
assert.equal(r3d.migration.broadSpectrumFactWritten, false);

assert.equal(r3d.policyStorage.seededFactKeyCount, 20);
assert.equal(r3d.productionReadback.policyRowCount, 20);
assert.equal(r3d.productionReadback.registryVersionCount, 1);
assert.equal(
  r3d.productionReadback.latestRegistryVersion,
  "product-fact-registry-cross-category-v1",
);
assert.equal(r3d.productionReadback.currentFactCount, 92);
assert.equal(r3d.productionReadback.currentWaterFactCount, 2);
assert.equal(r3d.productionReadback.testRegistryCount, 0);
assert.equal(r3d.productionReadback.dayDewSpfAssignmentState, "confirmed");
assert.deepEqual(r3d.productionReadback.activeV1ResearchLineage, {
  EVIDENCE_CANDIDATE: 28,
  REVIEW_REQUIRED: 343,
  total: 371,
});
assert.equal(r3d.productionReadback.spfAuthenticatedBetaEnabled, true);
assert.equal(r3d.productionReadback.spfAuthorizedPhase, "DATA-AI29C-D5D");

assert.equal(r3d.regressionTests.fakeV2LatestRollback.passed, true);
assert.equal(
  r3d.regressionTests.fakeV2LatestRollback.v1NewReviewPrepared,
  true,
);
assert.equal(
  r3d.regressionTests.fakeV2LatestRollback.v1ExistingConfirmationPreflightReady,
  true,
);
assert.equal(r3d.regressionTests.fakeV2LatestRollback.rolledBack, true);
assert.equal(r3d.regressionTests.dualWriterRollback.passed, true);
assert.equal(
  r3d.regressionTests.dualWriterRollback.failure,
  "product_fact_registry_write_policy_dual_writer_forbidden",
);
assert.equal(r3d.regressionTests.dualWriterRollback.rolledBack, true);

assert.equal(r3d.recommendationBoundary.sunscreenProtectionReaderChanged, false);
assert.equal(
  r3d.recommendationBoundary.sunscreenProtectionProjectionChanged,
  false,
);
assert.equal(r3d.recommendationBoundary.broadSpectrumConsumed, false);
assert.equal(r3d.recommendationBoundary.productionRankingChanged, false);
assert.equal(r3d.recommendationBoundary.productionCutoverAuthorized, false);
assert.equal(r3d.recommendationBoundary.outdoorRankableSignalAuthorized, false);
assert.equal(r3d.recommendationBoundary.publicActivation, false);

assert.equal(
  r3d.decision,
  "UVA_R3D_REGISTRY_COEXISTENCE_IMPLEMENTATION_PASS",
);
assert.equal(
  r3d.nextGate,
  "DATA-AI29C-UVA-R3E_BROAD_SPECTRUM_REGISTRY_PUBLISH_PREFLIGHT",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: r3d.stage,
    policyRows: r3d.productionReadback.policyRowCount,
    registryVersions: r3d.productionReadback.registryVersionCount,
    activeV1Lineage: r3d.productionReadback.activeV1ResearchLineage.total,
    fakeV2Regression:
      r3d.regressionTests.fakeV2LatestRollback.passed,
    dualWriterGuard: r3d.regressionTests.dualWriterRollback.passed,
    registryV2Published: r3d.migration.registryV2Published,
    decision: r3d.decision,
  }),
);
