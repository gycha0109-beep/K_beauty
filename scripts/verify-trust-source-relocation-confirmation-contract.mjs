import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { preflightOfficialSourceRelocation } from "../lib/trust/official-source-relocation-preflight.mjs";
import {
  buildOfficialSourceRelocationConfirmationRequest,
  RELOCATION_CONFIRMATION_REQUEST_CONTRACT,
} from "../lib/trust/official-source-relocation-confirmation-request.mjs";

const source = JSON.parse(await readFile(
  new URL("../docs/evidence/trust-phase8h-dermafactory-relocation-preflight-v1.json", import.meta.url),
  "utf8",
));
const canary = JSON.parse(await readFile(
  new URL("../docs/evidence/trust-phase8h-dermafactory-relocation-confirmation-request-v1.json", import.meta.url),
  "utf8",
));
const implementationSource = await readFile(
  new URL("../lib/trust/official-source-relocation-confirmation-request.mjs", import.meta.url),
  "utf8",
);

const preflight = preflightOfficialSourceRelocation(source);
assert.equal(preflight.status, "READY_FOR_ADMIN_RELOCATION_CONFIRMATION");

const request = buildOfficialSourceRelocationConfirmationRequest(preflight, source);
assert.equal(canary.contract, RELOCATION_CONFIRMATION_REQUEST_CONTRACT);
assert.deepEqual(request, canary.payload);
assert.equal(request.replacement.external_id, "official-url-sha256:fd53d973c3e55d592b6244c2770c715196991b3105d1bfd1d88c656eab6b29d9");
assert.equal(request.expected_prestate_digest, "70aae88369b09d87e9a9a7153ad04af662f7fc069445204f2eafee0b6d5a745b");
assert.equal(request.relocation_plan_digest, "9cc3c864fdeea7dde6545b607f33a30654284e6d9fef86b958e07eb012805567");
assert.equal(request.forbidden_mutations.includes("PRODUCT_EVIDENCE_SOURCE_CANONICAL_LOCATOR"), true);
assert.equal(request.forbidden_mutations.includes("PRODUCT_FACT_CURRENT"), true);
assert.equal(request.mutation_scope.includes("RETIRE_OLD_REVIEWED_BINDING_IN_SAME_TRANSACTION"), true);

assert.throws(
  () => buildOfficialSourceRelocationConfirmationRequest({ ...preflight, status: "HOLD" }, source),
  /TRUST_PHASE8H_CONFIRMATION_PREFLIGHT_NOT_READY/,
);
assert.throws(
  () => buildOfficialSourceRelocationConfirmationRequest(
    { ...preflight, prestate_digest: "0".repeat(64) },
    source,
  ),
  /TRUST_PHASE8H_CONFIRMATION_EXTERNAL_ID_DIGEST_MISMATCH|TRUST_PHASE8H_CONFIRMATION/,
);

for (const forbidden of [
  "createClient(",
  ".rpc(",
  ".from(",
  ".insert(",
  ".update(",
  ".delete(",
  "apply_migration",
  "execute_sql",
]) {
  assert.equal(
    implementationSource.includes(forbidden),
    false,
    `confirmation request builder must stay database-free: ${forbidden}`,
  );
}

console.log(JSON.stringify({
  contract: request.contract,
  request_id: canary.request_id,
  expected_prestate_digest: request.expected_prestate_digest,
  relocation_plan_digest: request.relocation_plan_digest,
  replacement_external_id: request.replacement.external_id,
  authority: request.authority,
}, null, 2));
