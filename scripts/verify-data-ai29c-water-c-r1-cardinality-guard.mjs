#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath =
  "supabase/migrations/20261001090000_data_ai29c_water_c_r1_cardinality_guard_v1.sql";
const sql = fs.readFileSync(migrationPath, "utf8");

assert.ok(sql.includes("product_fact_current_cardinality_guard_v1"));
assert.ok(
  sql.includes(
    "'bejewely_product_fact_current_cardinality:' ||",
  ),
  "cardinality semantic-slot advisory lock is required",
);
assert.ok(
  sql.includes("definition.definition ->> 'cardinality'"),
  "registry cardinality must drive the guard",
);
assert.ok(
  sql.includes("v_cardinality <> 'one'"),
  "non-cardinality-one definitions must remain unaffected",
);
assert.ok(
  sql.includes("current_row.proposition_key <> new.proposition_key"),
  "same proposition replay/update must not self-conflict",
);
assert.ok(
  sql.includes("product_fact_current_cardinality_one_conflict"),
  "different Current proposition must fail closed",
);
assert.ok(
  sql.includes("'trust-phase8f-revalidation-replacement-v1'"),
  "explicit governed replacement policy exception must remain bounded",
);
assert.ok(
  sql.includes("old_assignment.operational_state = 're_review_required'"),
  "replacement exception requires governed old-assignment state",
);
assert.ok(
  sql.includes("new_assignment.operational_state = 'ready_for_confirm'"),
  "replacement exception requires governed new-assignment state",
);
assert.ok(
  sql.includes("before insert or update of fact_instance_id, subject_id, proposition_key"),
  "guard must sit on the Product Fact Current write boundary",
);
assert.ok(
  sql.includes(
    "revoke all on function public.product_fact_current_cardinality_guard_v1()",
  ),
  "trigger function must not become a new callable public API",
);

const waterC = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-c-anessa-controlled-adoption-v1.json",
    "utf8",
  ),
);

assert.equal(
  waterC.parallelDuplicateRemediation.currentWaterFactCountAfterRemediation,
  1,
);
assert.equal(
  waterC.parallelDuplicateRemediation.duplicateFinalAssignmentState,
  "superseded",
);
assert.equal(
  waterC.parallelDuplicateRemediation.currentMappingRemoved,
  true,
);
assert.equal(waterC.limits.waterAxisActivated, false);
assert.equal(waterC.limits.productionRankingChanged, false);
assert.equal(waterC.limits.publicActivation, false);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-WATER-C-R1",
    semanticSlotLock: true,
    cardinalityOneFailClosed: true,
    explicitReplacementException: true,
    waterAxisActivated: false,
    decision: "WATER_C_R1_CARDINALITY_GUARD_STATIC_PASS",
  }),
);
