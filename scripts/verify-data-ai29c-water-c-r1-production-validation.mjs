#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const validation = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-c-r1-production-validation-v1.json",
    "utf8",
  ),
);
const waterC = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-c-anessa-controlled-adoption-v1.json",
    "utf8",
  ),
);
const migration = fs.readFileSync(
  "supabase/migrations/20261001090000_data_ai29c_water_c_r1_cardinality_guard_v1.sql",
  "utf8",
);

assert.equal(
  validation.version,
  "data-ai29c-water-c-r1-production-validation-v1",
);
assert.equal(validation.migration.applied, true);
assert.equal(
  validation.migration.productionLedgerName,
  "data_ai29c_water_c_r1_cardinality_guard_v1",
);

assert.equal(validation.guard.triggerEnabled, true);
assert.equal(validation.guard.securityDefiner, true);
assert.deepEqual(validation.guard.functionAcl, ["postgres=X/postgres"]);
assert.deepEqual(validation.guard.semanticSlot, [
  "subject_id",
  "registry_version",
  "fact_key",
]);
assert.equal(
  validation.guard.cardinalityOneDifferentPropositionFailClosed,
  true,
);
assert.equal(validation.guard.samePropositionReplayAllowed, true);
assert.equal(
  validation.guard.governedReplacementExceptionPolicy,
  "trust-phase8f-revalidation-replacement-v1",
);

assert.equal(
  validation.anessa.canonical.propositionKey,
  waterC.confirmedFact.propositionKey,
);
assert.equal(
  validation.anessa.canonical.factInstanceId,
  waterC.confirmedFact.factInstanceId,
);
assert.equal(
  validation.anessa.canonical.confirmationId,
  waterC.confirmedFact.confirmationId,
);
assert.equal(validation.anessa.canonical.assignmentState, "confirmed");
assert.equal(
  validation.anessa.remediatedDuplicate.assignmentState,
  "superseded",
);
assert.equal(
  validation.anessa.remediatedDuplicate.immutableHistoryPreserved,
  true,
);

assert.equal(validation.liveRegression.duplicateReinsertAttempted, true);
assert.equal(validation.liveRegression.duplicateReinsertRejected, true);
assert.equal(validation.liveRegression.expectedSqlState, "23514");
assert.equal(
  validation.liveRegression.expectedMessage,
  "product_fact_current_cardinality_one_conflict",
);
assert.equal(validation.liveRegression.samePropositionReplayAllowed, true);
assert.equal(validation.liveRegression.finalCurrentWaterFactCount, 1);
assert.equal(validation.liveRegression.finalCanonicalCurrentCount, 1);
assert.equal(validation.liveRegression.finalDuplicateCurrentCount, 0);

assert.equal(validation.production.vercelState, "READY");
assert.equal(validation.production.vercelTarget, "production");
assert.equal(
  validation.production.vercelGitSha,
  validation.validatedAgainstMainSha,
);
assert.equal(validation.production.spfAuthenticatedBeta.enabled, true);
assert.equal(
  validation.production.spfAuthenticatedBeta.authorizedPhase,
  "DATA-AI29C-D5D",
);
assert.equal(validation.production.spfAuthenticatedBeta.unchanged, true);

assert.equal(validation.limits.waterAuthorityCoverage, "1/20");
assert.equal(validation.limits.waterAxisActivated, false);
assert.equal(validation.limits.protectionScorerWiredForWater, false);
assert.equal(validation.limits.productionRankingChangedByWater, false);
assert.equal(validation.limits.productionCutoverAuthorized, false);
assert.equal(validation.limits.outdoorRankableSignalAuthorized, false);
assert.equal(validation.limits.publicActivation, false);
assert.equal(validation.limits.spfProductionStateMutated, false);

assert.ok(
  migration.includes("product_fact_current_cardinality_one_conflict"),
);
assert.ok(
  migration.includes(
    "'bejewely_product_fact_current_cardinality:' ||",
  ),
);

assert.equal(
  validation.decision,
  "WATER_C_R1_PRODUCTION_CARDINALITY_GUARD_PASS",
);

console.log(JSON.stringify({
  status: "PASS",
  stage: validation.stage,
  productionGuard: true,
  currentWaterFactCount: validation.liveRegression.finalCurrentWaterFactCount,
  waterAuthorityCoverage: validation.limits.waterAuthorityCoverage,
  waterAxisActivated: validation.limits.waterAxisActivated,
  decision: validation.decision,
}));
