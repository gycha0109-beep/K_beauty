#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3a = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3a-broad-spectrum-semantic-contract-v1.json",
    "utf8",
  ),
);
const r3b = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3b-registry-compatibility-audit-v1.json",
    "utf8",
  ),
);
const protectionReaderMigration = fs.readFileSync(
  "supabase/migrations/20260929083000_data_ai29c_sunscreen_protection_authority_v1.sql",
  "utf8",
);
const authorityContract = fs.readFileSync(
  "lib/recommendation-sunscreen-protection-authority-contract.mjs",
  "utf8",
);

assert.equal(r3a.decision, "BROAD_SPECTRUM_SEPARATE_FACT_SEMANTICS_PASS");
assert.equal(r3b.stage, "DATA-AI29C-UVA-R3B");
assert.equal(r3b.track, "taxonomy-ai");

assert.equal(r3b.productionRegistryState.registryVersionCount, 1);
assert.equal(
  r3b.productionRegistryState.currentRegistryVersion,
  "product-fact-registry-cross-category-v1",
);
assert.equal(r3b.productionRegistryState.activeDefinitionCount, 20);
assert.equal(r3b.productionRegistryState.currentFactCount, 92);
assert.equal(r3b.productionRegistryState.openReviewAssignmentCount, 0);
assert.deepEqual(r3b.productionRegistryState.activeResearchLineage, {
  EVIDENCE_CANDIDATE: 28,
  REVIEW_REQUIRED: 343,
  total: 371,
});

assert.equal(
  r3b.latestRegistrySelection.immediatePublishWithNullEffectiveAtBecomesLatest,
  true,
);
assert.equal(
  r3b.latestRegistrySelection.futureEffectiveAtDefersLatestUntilEffectiveTime,
  true,
);

assert.deepEqual(
  r3b.latestRegistryCoupledWritePaths.map((row) => row.function).sort(),
  [
    "admin_prepare_product_fact_review_v1",
    "product_fact_controlled_build_preflight_v1",
    "trust_phase4_build_adoption_plan_v1",
    "trust_phase8e_build_revalidation_plan_legacy_v1",
  ].sort(),
);

assert.deepEqual(r3b.sunscreenRecommendationReader.consumedFactKeys, [
  "spf_value",
  "uva_label",
  "water_resistance_duration",
]);
assert.equal(r3b.sunscreenRecommendationReader.broadSpectrumConsumed, false);
assert.equal(
  r3b.sunscreenRecommendationReader.requiresSingleRegistryAcrossConsumedFacts,
  true,
);
assert.equal(
  r3b.sunscreenRecommendationReader.mixedConsumedRegistryFailureReason,
  "CURRENT_PROTECTION_FACT_REGISTRY_AMBIGUOUS",
);
assert.equal(
  r3b.sunscreenRecommendationReader.broadSpectrumV2FactAloneWouldBeIgnoredByCurrentReader,
  true,
);

const scenarios = new Map(
  r3b.riskScenarios.map((row) => [row.scenario, row]),
);
assert.equal(scenarios.get("PUBLISH_V2_EFFECTIVE_NOW").safe, false);
assert.equal(scenarios.get("PUBLISH_V2_FUTURE_EFFECTIVE_AT").safe, false);
assert.equal(
  scenarios.get("MIGRATE_ONLY_ONE_EXISTING_PROTECTION_FACT_TO_V2").safe,
  false,
);
assert.equal(
  scenarios.get("ADD_BROAD_SPECTRUM_AS_V2_FACT_ONLY_WITH_READER_UNCHANGED").safe,
  "CONDITIONALLY_SEMANTICALLY_SAFE_BUT_NOT_OPERATIONALLY_WRITABLE_YET",
);

assert.ok(
  protectionReaderMigration.includes("'spf_value'") &&
    protectionReaderMigration.includes("'uva_label'") &&
    protectionReaderMigration.includes("'water_resistance_duration'"),
);
assert.ok(
  protectionReaderMigration.includes(
    "'CURRENT_PROTECTION_FACT_REGISTRY_AMBIGUOUS'",
  ),
);
assert.equal(
  protectionReaderMigration.includes("'broad_spectrum'"),
  false,
);
assert.equal(authorityContract.includes('"broad_spectrum"'), false);

assert.equal(r3b.prohibitedActions.publishV2Now, true);
assert.equal(r3b.prohibitedActions.publishV2WithFutureDateAsIfProblemSolved, true);
assert.equal(r3b.prohibitedActions.mutateV1Definitions, true);
assert.equal(r3b.prohibitedActions.directInsertBroadSpectrumIntoV1, true);
assert.equal(r3b.prohibitedActions.createBroadSpectrumProductFact, true);
assert.equal(r3b.prohibitedActions.migrateExistingProtectionFactsToV2, true);
assert.equal(r3b.prohibitedActions.changeRecommendationProtectionReader, true);
assert.equal(r3b.prohibitedActions.changeRecommendationProjection, true);
assert.equal(r3b.prohibitedActions.productionRankingChanged, false);
assert.equal(r3b.prohibitedActions.productionCutoverAuthorized, false);
assert.equal(r3b.prohibitedActions.outdoorRankableSignalAuthorized, false);
assert.equal(r3b.prohibitedActions.publicActivation, false);

assert.equal(
  r3b.allowedNextPaths.find((row) => row.path === "REGISTRY_COEXISTENCE_REDESIGN")
    ?.preferred,
  true,
);

assert.equal(
  r3b.decision,
  "UVA_R3B_HOLD_V2_PUBLISH_ACTIVE_V1_LINEAGE_AND_LATEST_REGISTRY_COUPLING",
);
assert.equal(
  r3b.nextGate,
  "DATA-AI29C-UVA-R3C_REGISTRY_EVOLUTION_COEXISTENCE_DESIGN",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: r3b.stage,
    activeV1Lineage: r3b.productionRegistryState.activeResearchLineage.total,
    latestRegistryCoupledWritePaths:
      r3b.latestRegistryCoupledWritePaths.length,
    v2PublishAllowed: false,
    preferredNextPath: "REGISTRY_COEXISTENCE_REDESIGN",
    decision: r3b.decision,
  }),
);
