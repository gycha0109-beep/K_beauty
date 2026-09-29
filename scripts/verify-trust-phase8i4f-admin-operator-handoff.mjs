import assert from "node:assert/strict";
import fs from "node:fs";
import {
  preflightGroupedOfficialSourceRelocation,
} from "../lib/trust/official-source-grouped-relocation-preflight.mjs";
import {
  buildGroupedOfficialSourceRelocationConfirmationRequest,
} from "../lib/trust/official-source-grouped-relocation-confirmation-request.mjs";
import {
  assertGroupedRelocationOperatorParity,
  buildGroupedRelocationOperatorPreflightHash,
} from "../lib/trust/official-source-grouped-relocation-operator-contract.mjs";

const fixture = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8i4-grouped-relocation-synthetic-fixture-v1.json",
    "utf8",
  ),
);
const contract = fs.readFileSync(
  "docs/evidence/trust-phase8i4f-admin-operator-handoff-v1.md",
  "utf8",
);
const adminService = fs.readFileSync(
  "lib/admin/trust-grouped-relocation.js",
  "utf8",
);
const preflightRoute = fs.readFileSync(
  "app/api/admin/trust/relocation/preflight/route.js",
  "utf8",
);
const confirmRoute = fs.readFileSync(
  "app/api/admin/trust/relocation/confirm/route.js",
  "utf8",
);
const workbench = fs.readFileSync(
  "app/admin/products/trust/relocations/TrustGroupedRelocationWorkbench.js",
  "utf8",
);
const page = fs.readFileSync(
  "app/admin/products/trust/relocations/page.js",
  "utf8",
);
const trustWorkflow = fs.readFileSync(
  ".github/workflows/trust-phase8h3-relocation-revalidation.yml",
  "utf8",
);

const jsPreflight = preflightGroupedOfficialSourceRelocation(fixture);
const confirmationRequest =
  buildGroupedOfficialSourceRelocationConfirmationRequest(fixture);

const dbReference = {
  status: "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION",
  case_id: "ed15edcf-505c-423f-a2d6-cc347625a042",
  evaluation_id: "00000000-0000-4000-8000-000000008104",
  product_id: "25b2763f-529f-4b2e-a436-2e0776279c55",
  subject_id: "0865df81-9cd9-438c-8167-380b932c1dc0",
  qualified_historical_source_id:
    "4f74de41-9515-495c-8c93-19ab1cd3cf6d",
  historical_source_ids: [
    "4f74de41-9515-495c-8c93-19ab1cd3cf6d",
    "60a55f19-a71d-4063-9ea5-13775193c940",
    "f55720c7-0252-49b8-967c-8d77f4dfe6d6",
  ],
  incident_ids: [
    "3911e772-c6c0-4697-af42-e5615faad49a",
    "9dffee1d-0937-4988-a1c5-0253c7db5686",
    "e00f274f-1d01-44ce-86a9-80249214b332",
  ],
  old_binding_id: "0dae6fce-111e-4d5b-9b6e-d87f95e9a40c",
  old_review_id: "4db8f51b-6fa2-48ba-853d-8d2e65c7bfda",
  old_locator:
    "https://beautyofjoseon.com/products/relief-sun-rice-probiotics",
  replacement_locator:
    "https://beautyofjoseon.com/products/synthetic-phase8i4-successor",
  replacement_external_id:
    "official-url-sha256:825faee4ff274396b69cbe1c799155cedca65aab46348687c16102025bed901e",
  qualification_digest: "a".repeat(64),
  group_prestate_digest:
    "4b6bf0acc21d075bbac23755b02ad885434b75d9d3b1aaa4e211a4f5e2795bf3",
  group_plan_digest:
    "5fc3be26367db6b60aaa002fe1bcd603c809b8c91575874686eafb6f3fdb6c43",
  phase8h_anchor_prestate_digest:
    "fa40bda730ad62717b9e2081699806516a4800b11bf2b570afbb76ac1bdd156f",
  phase8h_anchor_relocation_plan_digest:
    "7f369b364f2697a96b1e2950ed08fd32b3d77952ba8eeb28bc8bf55dc87cab7f",
};

const parity = assertGroupedRelocationOperatorParity({
  dbPreflight: dbReference,
  jsPreflight,
  confirmationRequest,
});
assert.equal(parity.result, "PASS");

assert.equal(
  jsPreflight.group_prestate_digest,
  dbReference.group_prestate_digest,
);
assert.equal(jsPreflight.group_plan_digest, dbReference.group_plan_digest);
assert.equal(
  confirmationRequest.phase8h_anchor_prestate_digest,
  dbReference.phase8h_anchor_prestate_digest,
);
assert.equal(
  confirmationRequest.phase8h_anchor_relocation_plan_digest,
  dbReference.phase8h_anchor_relocation_plan_digest,
);

const preflightHash =
  buildGroupedRelocationOperatorPreflightHash(dbReference);
assert.match(preflightHash, /^[0-9a-f]{64}$/);

const reorderedReference = {
  ...dbReference,
  historical_source_ids: [...dbReference.historical_source_ids].reverse(),
  incident_ids: [...dbReference.incident_ids].reverse(),
};
assert.equal(
  buildGroupedRelocationOperatorPreflightHash(reorderedReference),
  preflightHash,
);

const tamperedReference = {
  ...dbReference,
  group_plan_digest: "f".repeat(64),
};
assert.throws(
  () =>
    assertGroupedRelocationOperatorParity({
      dbPreflight: tamperedReference,
      jsPreflight,
      confirmationRequest,
    }),
  /TRUST_PHASE8I4F_OPERATOR_PREFLIGHT_PARITY_MISMATCH/,
);

for (const required of [
  "admin.products.review",
  "same-origin Admin mutation policy",
  "caseId",
  "evaluationId",
  "preflightHash",
  "Dual-preflight parity",
  "Product Fact Current",
  "historical Evidence Source",
  "semantic SAME/CHANGED",
  "No scheduler or transport worker may call the grouped confirmation RPC",
]) {
  assert.ok(contract.includes(required), "8I-4F contract missing: " + required);
}

for (const required of [
  "admin_preflight_trust_official_source_grouped_relocation_v1",
  "admin_confirm_trust_official_source_grouped_relocation_v1",
  "get_trust_official_source_grouped_relocation_lineage_v1",
  "preflightGroupedOfficialSourceRelocation",
  "buildGroupedOfficialSourceRelocationConfirmationRequest",
  "assertGroupedRelocationOperatorParity",
  "buildGroupedRelocationOperatorPreflightHash",
  "delete item.preflightHash",
  "trust_grouped_relocation_stale_preflight",
  "productFactWrites: 0",
  "evidenceSourceWrites: 0",
  "recommendationWrites: 0",
  "semanticResolutionWrites: 0",
]) {
  assert.ok(
    adminService.includes(required),
    "8I-4F admin service missing: " + required,
  );
}

for (const route of [preflightRoute, confirmRoute]) {
  for (const required of [
    "isAllowedAdminMutationRequest",
    "ADMIN_CAPABILITIES.PRODUCTS_REVIEW",
    "requireAdminCapability",
    'Cache-Control": "private, no-store, max-age=0',
  ]) {
    assert.ok(route.includes(required), "8I-4F route missing: " + required);
  }
}

assert.ok(
  confirmRoute.includes("preflightHash: body?.preflightHash"),
  "confirm route must accept only the non-authoritative preflight hash",
);
assert.equal(
  confirmRoute.includes("p_payload"),
  false,
  "browser route must not accept a database confirmation payload",
);
assert.equal(
  confirmRoute.includes("confirmationRequest"),
  false,
  "browser route must not construct the authority payload",
);

for (const required of [
  "/api/admin/trust/relocation/preflight",
  "/api/admin/trust/relocation/confirm",
  "Preflight 다시 실행",
  "명시적으로 Official Source Relocation 확정",
  "Product Fact Current unchanged",
  "Evidence Source unchanged",
  "Semantic SAME/CHANGED 미판정",
]) {
  assert.ok(workbench.includes(required), "8I-4F workbench missing: " + required);
}

assert.ok(
  page.includes("ADMIN_CAPABILITIES.PRODUCTS_REVIEW"),
  "8I-4F page must require product review capability",
);
assert.ok(
  page.includes("loadTrustGroupedRelocationQueue"),
  "8I-4F page must load the governed grouped relocation queue",
);

assert.equal(
  trustWorkflow.includes(
    "admin_confirm_trust_official_source_grouped_relocation_v1",
  ),
  false,
  "scheduler/transport workflow must never invoke grouped confirmation",
);

console.log(
  JSON.stringify(
    {
      contract: "trust-phase8i4f-admin-operator-handoff-verification-v1",
      result: "PASS",
      group_prestate_digest: jsPreflight.group_prestate_digest,
      group_plan_digest: jsPreflight.group_plan_digest,
      phase8h_anchor_prestate_digest:
        confirmationRequest.phase8h_anchor_prestate_digest,
      phase8h_anchor_relocation_plan_digest:
        confirmationRequest.phase8h_anchor_relocation_plan_digest,
      operator_preflight_hash: preflightHash,
      browser_authority_payload: false,
      scheduler_confirmation_path: false,
    },
    null,
    2,
  ),
);
