import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildGroupedOfficialSourceRelocationConfirmationRequest,
} from "../lib/trust/official-source-grouped-relocation-confirmation-request.mjs";

const fixture = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8i4-grouped-relocation-synthetic-fixture-v1.json",
    "utf8",
  ),
);
const contract = fs.readFileSync(
  "docs/evidence/trust-phase8i4-grouped-relocation-confirmation-contract-v1.md",
  "utf8",
);
const implementation = fs.readFileSync(
  "lib/trust/official-source-grouped-relocation-confirmation-request.mjs",
  "utf8",
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const request =
  buildGroupedOfficialSourceRelocationConfirmationRequest(fixture);

assert.equal(
  request.contract,
  "trust-phase8i4-grouped-relocation-confirmation-request-v1",
);
assert.equal(
  request.authority,
  "ADMIN_GROUPED_CONFIRMATION_REQUEST_REQUIRES_DATABASE_REVALIDATION",
);
assert.equal(
  request.preflight_authority,
  "PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_GROUPED_CONFIRMATION",
);
assert.equal(
  request.qualified_historical_source_id,
  "4f74de41-9515-495c-8c93-19ab1cd3cf6d",
);
assert.equal(request.historical_source_ids.length, 3);
assert.equal(request.incident_ids.length, 3);
assert.ok(
  request.historical_source_ids.includes(
    request.qualified_historical_source_id,
  ),
);
assert.match(request.expected_group_prestate_digest, /^[0-9a-f]{64}$/);
assert.match(request.group_plan_digest, /^[0-9a-f]{64}$/);
assert.match(
  request.replacement.external_id,
  /^official-url-sha256:[0-9a-f]{64}$/,
);
assert.equal(
  request.replacement.source_url,
  fixture.evaluation.candidate_locator,
);
assert.deepEqual(request.mutation_scope, [
  "CREATE_OR_REUSE_REPLACEMENT_PRODUCT_SOURCE_BINDING",
  "CREATE_OR_REUSE_REPLACEMENT_OFFICIAL_SOURCE_REVIEW",
  "RETIRE_OLD_REVIEWED_BINDING_ONCE",
  "APPEND_SINGLE_RELOCATION_AUTHORITY_ROW",
  "APPEND_GROUPED_RELOCATION_HEADER",
  "APPEND_COMPLETE_GROUPED_SOURCE_LINEAGE",
  "APPEND_COMPLETE_GROUPED_INCIDENT_LINEAGE",
  "APPEND_ADMIN_AUDIT_EVENT",
]);
assert.ok(request.forbidden_mutations.includes("PRODUCT_FACT_CURRENT"));
assert.ok(
  request.forbidden_mutations.includes(
    "SEMANTIC_SAME_CHANGED_RESOLUTION",
  ),
);

const reordered = clone(fixture);
reordered.case.historical_source_ids.reverse();
reordered.case.incident_ids.reverse();
reordered.historical_sources.reverse();
const reorderedRequest =
  buildGroupedOfficialSourceRelocationConfirmationRequest(reordered);
assert.deepEqual(
  reorderedRequest.historical_source_ids,
  request.historical_source_ids,
);
assert.deepEqual(reorderedRequest.incident_ids, request.incident_ids);
assert.equal(
  reorderedRequest.expected_group_prestate_digest,
  request.expected_group_prestate_digest,
);
assert.equal(reorderedRequest.group_plan_digest, request.group_plan_digest);

for (const mutate of [
  (value) => {
    value.evaluation.result_kind = "HOLD";
  },
  (value) => {
    value.historical_sources.pop();
  },
  (value) => {
    value.evaluation.qualified_historical_source_id =
      "11111111-1111-4111-8111-111111111111";
  },
  (value) => {
    value.replacement.source_url =
      "https://beautyofjoseon.com/products/tampered-successor";
  },
  (value) => {
    value.historical_sources[0].reviewed_binding_id =
      "11111111-1111-4111-8111-111111111111";
  },
]) {
  const value = clone(fixture);
  mutate(value);
  assert.throws(
    () => buildGroupedOfficialSourceRelocationConfirmationRequest(value),
    /TRUST_PHASE8I4_GROUPED_CONFIRMATION_REQUIRES_READY_PREFLIGHT/,
  );
}

for (const required of [
  "qualified_historical_source_id",
  "ADMIN_GROUPED_CONFIRMATION_REQUEST_REQUIRES_DATABASE_REVALIDATION",
  "RETIRE_OLD_REVIEWED_BINDING_ONCE",
  "APPEND_SINGLE_RELOCATION_AUTHORITY_ROW",
  "APPEND_COMPLETE_GROUPED_SOURCE_LINEAGE",
  "APPEND_COMPLETE_GROUPED_INCIDENT_LINEAGE",
  "PRODUCT_FACT_CURRENT",
  "SEMANTIC_SAME_CHANGED_RESOLUTION",
  "old_binding_id UNIQUE",
]) {
  assert.ok(contract.includes(required), "confirmation contract missing: " + required);
}

for (const forbidden of [
  "@supabase/supabase-js",
  ".from(",
  ".rpc(",
  "admin_confirm_trust_official_source_relocation_v1",
  "admin_confirm_trust_official_source_grouped_relocation_v1",
]) {
  assert.equal(
    implementation.includes(forbidden),
    false,
    "confirmation request builder must remain database-free: " + forbidden,
  );
}

console.log(
  JSON.stringify(
    {
      contract:
        "trust-phase8i4-grouped-relocation-confirmation-request-verification-v1",
      result: "PASS",
      qualified_historical_source_id:
        request.qualified_historical_source_id,
      historical_source_count: request.historical_source_ids.length,
      incident_count: request.incident_ids.length,
      expected_group_prestate_digest:
        request.expected_group_prestate_digest,
      group_plan_digest: request.group_plan_digest,
      authority: request.authority,
    },
    null,
    2,
  ),
);
