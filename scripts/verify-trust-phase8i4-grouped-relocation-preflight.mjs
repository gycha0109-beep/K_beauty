import assert from "node:assert/strict";
import fs from "node:fs";
import {
  preflightGroupedOfficialSourceRelocation,
} from "../lib/trust/official-source-grouped-relocation-preflight.mjs";

const fixturePath =
  "docs/evidence/trust-phase8i4-grouped-relocation-synthetic-fixture-v1.json";
const contractPath =
  "docs/evidence/trust-phase8i4-grouped-relocation-contract-v1.md";
const blueprintPath =
  "docs/evidence/trust-phase8i4-grouped-relocation-db-blueprint-v1.sql";
const implementationPath =
  "lib/trust/official-source-grouped-relocation-preflight.mjs";

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const contract = fs.readFileSync(contractPath, "utf8");
const blueprint = fs.readFileSync(blueprintPath, "utf8");
const implementation = fs.readFileSync(implementationPath, "utf8");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const ready = preflightGroupedOfficialSourceRelocation(fixture);
assert.equal(ready.contract, "trust-phase8i4-grouped-relocation-preflight-v1");
assert.equal(ready.status, "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION");
assert.deepEqual(ready.blockers, []);
assert.equal(
  ready.authority,
  "PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_GROUPED_CONFIRMATION",
);
assert.equal(
  ready.mutation_policy,
  "READ_ONLY_GROUPED_PREFLIGHT_NO_PRODUCTION_WRITE",
);
assert.equal(ready.historical_source_ids.length, 3);
assert.equal(ready.incident_ids.length, 3);
assert.equal(ready.old_binding_id, "0dae6fce-111e-4d5b-9b6e-d87f95e9a40c");
assert.equal(
  ready.qualified_historical_source_id,
  "4f74de41-9515-495c-8c93-19ab1cd3cf6d",
);
assert.match(ready.group_prestate_digest, /^[0-9a-f]{64}$/);
assert.match(ready.group_plan_digest, /^[0-9a-f]{64}$/);

const reordered = clone(fixture);
reordered.case.historical_source_ids.reverse();
reordered.case.incident_ids.reverse();
reordered.historical_sources.reverse();
const reorderedResult = preflightGroupedOfficialSourceRelocation(reordered);
assert.equal(reorderedResult.status, "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION");
assert.equal(reorderedResult.group_prestate_digest, ready.group_prestate_digest);
assert.equal(reorderedResult.group_plan_digest, ready.group_plan_digest);

const missingSource = clone(fixture);
missingSource.historical_sources.pop();
const missingSourceResult = preflightGroupedOfficialSourceRelocation(missingSource);
assert.equal(missingSourceResult.status, "HOLD");
assert.ok(missingSourceResult.blockers.includes("HISTORICAL_SOURCE_SET_MISMATCH"));

const duplicateCaseSource = clone(fixture);
duplicateCaseSource.case.historical_source_ids.push(
  duplicateCaseSource.case.historical_source_ids[0],
);
const duplicateCaseSourceResult =
  preflightGroupedOfficialSourceRelocation(duplicateCaseSource);
assert.equal(duplicateCaseSourceResult.status, "HOLD");
assert.ok(
  duplicateCaseSourceResult.blockers.includes(
    "CASE_HISTORICAL_SOURCE_IDS_DUPLICATE",
  ),
);

const mixedBinding = clone(fixture);
mixedBinding.historical_sources[1].reviewed_binding_id =
  "11111111-1111-4111-8111-111111111111";
const mixedBindingResult =
  preflightGroupedOfficialSourceRelocation(mixedBinding);
assert.equal(mixedBindingResult.status, "HOLD");
assert.ok(
  mixedBindingResult.blockers.includes(
    "HISTORICAL_SOURCE_REVIEWED_BINDING_MISMATCH",
  ),
);

const holdEvaluation = clone(fixture);
holdEvaluation.evaluation.result_kind = "HOLD";
const holdEvaluationResult =
  preflightGroupedOfficialSourceRelocation(holdEvaluation);
assert.equal(holdEvaluationResult.status, "HOLD");
assert.ok(
  holdEvaluationResult.blockers.includes("EVALUATION_NOT_READY_FOR_8I4"),
);

const missingQualifiedAnchor = clone(fixture);
delete missingQualifiedAnchor.evaluation.qualified_historical_source_id;
const missingQualifiedAnchorResult =
  preflightGroupedOfficialSourceRelocation(missingQualifiedAnchor);
assert.equal(missingQualifiedAnchorResult.status, "HOLD");
assert.ok(
  missingQualifiedAnchorResult.blockers.includes(
    "QUALIFIED_HISTORICAL_SOURCE_ID_REQUIRED",
  ),
);

const foreignQualifiedAnchor = clone(fixture);
foreignQualifiedAnchor.evaluation.qualified_historical_source_id =
  "11111111-1111-4111-8111-111111111111";
const foreignQualifiedAnchorResult =
  preflightGroupedOfficialSourceRelocation(foreignQualifiedAnchor);
assert.equal(foreignQualifiedAnchorResult.status, "HOLD");
assert.ok(
  foreignQualifiedAnchorResult.blockers.includes(
    "QUALIFIED_HISTORICAL_SOURCE_NOT_IN_CASE",
  ),
);
assert.ok(
  foreignQualifiedAnchorResult.blockers.includes(
    "QUALIFIED_HISTORICAL_SOURCE_NOT_IN_GROUP",
  ),
);

const missingExactPayload = clone(fixture);
delete missingExactPayload.evaluation.qualified_exact;
const missingExactPayloadResult =
  preflightGroupedOfficialSourceRelocation(missingExactPayload);
assert.equal(missingExactPayloadResult.status, "HOLD");
assert.ok(
  missingExactPayloadResult.blockers.includes(
    "QUALIFIED_EXACT_PAYLOAD_REQUIRED",
  ),
);

const mismatchedExactDigest = clone(fixture);
mismatchedExactDigest.evaluation.qualified_exact.qualification_digest =
  "f".repeat(64);
const mismatchedExactDigestResult =
  preflightGroupedOfficialSourceRelocation(mismatchedExactDigest);
assert.equal(mismatchedExactDigestResult.status, "HOLD");
assert.ok(
  mismatchedExactDigestResult.blockers.includes(
    "QUALIFIED_EXACT_DIGEST_MISMATCH",
  ),
);

const invalidSourceDigest = clone(fixture);
invalidSourceDigest.historical_sources[0].content_digest = "not-a-digest";
const invalidSourceDigestResult =
  preflightGroupedOfficialSourceRelocation(invalidSourceDigest);
assert.equal(invalidSourceDigestResult.status, "HOLD");
assert.ok(
  invalidSourceDigestResult.blockers.includes(
    "HISTORICAL_SOURCE_CONTENT_DIGEST_INVALID",
  ),
);

const staleSubject = clone(fixture);
staleSubject.governed_subject.current_state = "superseded";
const staleSubjectResult =
  preflightGroupedOfficialSourceRelocation(staleSubject);
assert.equal(staleSubjectResult.status, "HOLD");
assert.ok(staleSubjectResult.blockers.includes("SUBJECT_NOT_CURRENT"));

const replacementMismatch = clone(fixture);
replacementMismatch.replacement.source_url =
  "https://beautyofjoseon.com/products/another-synthetic-successor";
const replacementMismatchResult =
  preflightGroupedOfficialSourceRelocation(replacementMismatch);
assert.equal(replacementMismatchResult.status, "HOLD");
assert.ok(
  replacementMismatchResult.blockers.includes("REPLACEMENT_CANDIDATE_MISMATCH"),
);

for (const required of [
  "READY_FOR_8I4",
  "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION",
  "old_binding_id UNIQUE",
  "historical_source_ids",
  "incident_ids",
  "qualified_historical_source_id",
  "qualified_exact",
  "READ_ONLY_GROUPED_PREFLIGHT_NO_PRODUCTION_WRITE",
  "PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_GROUPED_CONFIRMATION",
]) {
  assert.ok(contract.includes(required), "contract missing: " + required);
}

for (const required of [
  "trust_official_source_relocation_groups",
  "trust_official_source_relocation_group_sources",
  "trust_official_source_relocation_group_incidents",
  "enable row level security",
  "revoke all on table",
  "grant select on table",
  "admin_preflight_trust_official_source_grouped_relocation_v1",
  "admin_confirm_trust_official_source_grouped_relocation_v1",
]) {
  assert.ok(blueprint.includes(required), "blueprint missing: " + required);
}

for (const forbidden of [
  "@supabase/supabase-js",
  ".from(",
  ".rpc(",
  "admin_confirm_trust_official_source_relocation_v1",
  "admin_confirm_trust_official_source_grouped_relocation_v1",
  "product_fact_current",
  "product_fact_instances",
]) {
  assert.equal(
    implementation.includes(forbidden),
    false,
    "read-only preflight implementation contains forbidden database path: " +
      forbidden,
  );
}

console.log(
  JSON.stringify(
    {
      contract: "trust-phase8i4-grouped-relocation-preflight-verification-v1",
      result: "PASS",
      historical_source_count: ready.historical_source_ids.length,
      incident_count: ready.incident_ids.length,
      qualified_historical_source_id:
        ready.qualified_historical_source_id,
      group_prestate_digest: ready.group_prestate_digest,
      group_plan_digest: ready.group_plan_digest,
      authority: ready.authority,
      mutation_policy: ready.mutation_policy,
    },
    null,
    2,
  ),
);
