#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TRUST_SUBJECT_REPROCESS_ORCHESTRATOR_VERSION,
  TRUST_SUBJECT_REPROCESS_REGISTRY_VERSION,
  TRUST_SUBJECT_REPROCESS_RPC,
  isTrustSubjectRegistryPinnedReprocessResult,
  runTrustSubjectRegistryPinnedReprocess
} from "../lib/admin/trust-subject-reprocess-contract.js";

const evidencePath =
  "evidence/recommendation-governance/v21-admission-g4-a-subject-registration-reprocess-contract-v1.json";
const g40Path =
  "evidence/recommendation-governance/v21-admission-g4-0-nonlegacy-frontier-design-v1.json";
const orchestrationPath = "lib/admin/trust-subject-registration.js";
const helperPath = "lib/admin/trust-subject-reprocess-contract.js";
const readback8g0Path =
  "evidence/product-fact-catalog-expansion-v1/v21-8g0-registry-pinned-reconciliation-production-readback-v1.json";
const readback8g1Path =
  "evidence/product-fact-catalog-expansion-v1/v21-8g1-wave1-subject-identity-production-readback-v1.json";

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const g40 = JSON.parse(fs.readFileSync(g40Path, "utf8"));
const orchestration = fs.readFileSync(orchestrationPath, "utf8");
const helper = fs.readFileSync(helperPath, "utf8");
const readback8g0 = JSON.parse(fs.readFileSync(readback8g0Path, "utf8"));
const readback8g1 = JSON.parse(fs.readFileSync(readback8g1Path, "utf8"));

assert.equal(evidence.stage, "V2.1-ADMISSION-G4-A");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_A_REPOSITORY_CONTRACT_READY"
);
assert.equal(evidence.production_writes, 0);
assert.equal(
  g40.next_gate,
  "V2.1-ADMISSION-G4-A_SUBJECT_REGISTRATION_REPROCESS_CONTRACT"
);

assert.equal(TRUST_SUBJECT_REPROCESS_RPC, "process_catalog_trust_product_v3");
assert.equal(
  TRUST_SUBJECT_REPROCESS_REGISTRY_VERSION,
  "product-fact-registry-cross-category-v1"
);
assert.equal(
  TRUST_SUBJECT_REPROCESS_ORCHESTRATOR_VERSION,
  "v21-8g1-identity-authority-preserving-v1"
);

const productId = "33333333-3333-4333-8333-333333333333";
const calls = [];
const validResult = {
  status: "processed",
  product_id: productId,
  registry_version: TRUST_SUBJECT_REPROCESS_REGISTRY_VERSION,
  registry_selection: "explicit",
  orchestrator_version: TRUST_SUBJECT_REPROCESS_ORCHESTRATOR_VERSION,
  tasks_touched: 3,
  already_covered: 0
};
const client = {
  async rpc(name, args) {
    calls.push({ name, args });
    return { data: validResult, error: null };
  }
};

const response = await runTrustSubjectRegistryPinnedReprocess(client, productId);
assert.equal(response.error, null);
assert.equal(calls.length, 1);
assert.deepEqual(calls[0], {
  name: "process_catalog_trust_product_v3",
  args: {
    p_product_id: productId,
    p_registry_version: "product-fact-registry-cross-category-v1"
  }
});
assert.equal(
  isTrustSubjectRegistryPinnedReprocessResult(response.data, productId),
  true
);

for (const invalid of [
  { ...validResult, registry_version: "product-fact-registry-cross-category-v2" },
  { ...validResult, registry_selection: "latest" },
  { ...validResult, orchestrator_version: "unexpected" },
  { ...validResult, product_id: "44444444-4444-4444-8444-444444444444" },
  { ...validResult, status: "blocked" },
  null
]) {
  assert.equal(
    isTrustSubjectRegistryPinnedReprocessResult(invalid, productId),
    false
  );
}

assert.ok(orchestration.includes("runTrustSubjectRegistryPinnedReprocess"));
assert.ok(orchestration.includes("isTrustSubjectRegistryPinnedReprocessResult"));
assert.ok(
  orchestration.includes(
    "trust_subject_registration_resolution_refresh_invalid_result"
  )
);
assert.ok(!orchestration.includes("process_catalog_trust_product_v1"));
assert.ok(helper.includes("process_catalog_trust_product_v3"));
assert.ok(helper.includes("product-fact-registry-cross-category-v1"));
assert.ok(helper.includes('value.registry_selection === "explicit"'));

for (const liveValue of [
  "da5df70c-8cdd-4eb2-93b6-ede46c2f171d",
  "6a9627b6-a5da-458f-84f7-3a40f91453be",
  "노스카나인 트러블 세럼",
  "FATION"
]) {
  assert.ok(
    !orchestration.includes(liveValue) && !helper.includes(liveValue),
    `runtime implementation must remain generic: ${liveValue}`
  );
}

assert.equal(
  readback8g0.runtime_probe.v1_explicit_registry_path_executable,
  true
);
assert.equal(readback8g0.runtime_probe.v1_probe_rolled_back, true);
assert.equal(
  readback8g0.deployed_function_contract.no_latest_registry_selection,
  true
);
assert.equal(
  readback8g1.production_readback.ready_exact_subject_intakes,
  8
);
assert.equal(
  readback8g1.production_readback.ready_research_pending_tasks,
  16
);
assert.equal(readback8g1.authority_boundary.evidence_writes, 0);
assert.equal(readback8g1.authority_boundary.fact_instance_writes, 0);
assert.equal(
  readback8g1.authority_boundary.product_fact_current_delta,
  0
);
assert.equal(readback8g1.authority_boundary.recommendation_changes, 0);

assert.equal(
  evidence.fation_expected_transition.current_state.review_required_tasks,
  3
);
assert.equal(
  evidence.fation_expected_transition.after_future_explicit_subject_registration
    .research_pending_tasks,
  3
);
assert.equal(evidence.fation_expected_transition.executed_in_g4_a, false);

for (const value of Object.values(evidence.authority_boundary)) {
  assert.equal(value, false);
}
assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-B_FATION_SUBJECT_REGISTRATION"
);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      stage: evidence.stage,
      rpc: TRUST_SUBJECT_REPROCESS_RPC,
      registry: TRUST_SUBJECT_REPROCESS_REGISTRY_VERSION,
      productionWrites: evidence.production_writes,
      nextGate: evidence.next_gate
    },
    null,
    2
  )
);
