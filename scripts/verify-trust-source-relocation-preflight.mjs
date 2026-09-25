import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  preflightOfficialSourceRelocation,
  RELOCATION_PREFLIGHT_CONTRACT,
} from "../lib/trust/official-source-relocation-preflight.mjs";

const fixturePath = new URL("../docs/evidence/trust-phase8h-dermafactory-relocation-preflight-v1.json", import.meta.url);
const enginePath = new URL("../lib/trust/official-source-relocation-preflight.mjs", import.meta.url);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const engineSource = await readFile(enginePath, "utf8");

assert.equal(fixture.contract, RELOCATION_PREFLIGHT_CONTRACT);

const ready = preflightOfficialSourceRelocation(fixture);
assert.equal(ready.status, "READY_FOR_ADMIN_RELOCATION_CONFIRMATION");
assert.deepEqual(ready.blockers, []);
assert.equal(ready.mutation_policy, "READ_ONLY_PREFLIGHT_NO_PRODUCTION_WRITE");
assert.equal(ready.authority, "PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_CONFIRMATION");
assert.match(ready.prestate_digest, /^[0-9a-f]{64}$/);
assert.match(ready.relocation_plan_digest, /^[0-9a-f]{64}$/);
assert.match(ready.replacement_external_id, /^official-url-sha256:[0-9a-f]{64}$/);
assert.notEqual(ready.old_locator, ready.replacement_locator);

function expectHold(mutator, blocker) {
  const input = structuredClone(fixture);
  mutator(input);
  const result = preflightOfficialSourceRelocation(input);
  assert.equal(result.status, "HOLD");
  assert.ok(result.blockers.includes(blocker), `missing blocker ${blocker}: ${JSON.stringify(result.blockers)}`);
  assert.equal(result.authority, "NON_AUTHORITATIVE_HOLD");
}

expectHold((x) => { x.qualification.disposition = "AMBIGUOUS_IDENTITY"; }, "QUALIFICATION_NOT_EXACT");
expectHold((x) => { x.qualification.qualification_digest = "bad"; }, "QUALIFICATION_DIGEST_INVALID");
expectHold((x) => { x.historical_subject_binding.binding_state = "equivalent_presentation_match"; }, "HISTORICAL_BINDING_NOT_EXACT");
expectHold((x) => { x.governed_subject.current_state = "superseded"; }, "GOVERNED_SUBJECT_NOT_CURRENT");
expectHold((x) => { x.current_reviewed_binding.binding_method = "manual_patch"; }, "REVIEWED_BINDING_METHOD_INVALID");
expectHold((x) => { x.current_reviewed_binding.review_formulation_revision_key = "other"; }, "REVIEW_RECORD_FORMULATION_MISMATCH");
expectHold((x) => { x.replacement.source_url = x.historical_source.canonical_locator; }, "REPLACEMENT_LOCATOR_UNCHANGED");
expectHold((x) => { x.replacement.source_url = "http://example.com/product"; }, "REPLACEMENT_HTTPS_REQUIRED");
expectHold((x) => { x.replacement.market_code = "GLOBAL"; }, "REPLACEMENT_MARKET_MISMATCH");
expectHold((x) => { x.replacement.external_type = "brand_official_faq"; }, "REPLACEMENT_SOURCE_KIND_MISMATCH");
expectHold((x) => { x.qualification.candidate_locator = "https://example.com/other"; }, "REPLACEMENT_CANDIDATE_MISMATCH");

for (const forbidden of [
  "createClient(",
  ".rpc(",
  ".insert(",
  ".update(",
  ".delete(",
  "apply_migration",
]) {
  assert.equal(engineSource.includes(forbidden), false, `preflight engine must stay read-only: ${forbidden}`);
}

for (const brandSpecific of [
  "Derma Factory",
  "Beauty of Joseon",
  "f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b",
]) {
  assert.equal(engineSource.includes(brandSpecific), false, `engine must remain data-volume/brand independent: ${brandSpecific}`);
}

console.log(JSON.stringify({
  contract: ready.contract,
  status: ready.status,
  prestate_digest: ready.prestate_digest,
  relocation_plan_digest: ready.relocation_plan_digest,
  replacement_external_id: ready.replacement_external_id,
  mutation_policy: ready.mutation_policy,
}, null, 2));
