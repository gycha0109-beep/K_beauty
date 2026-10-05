#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidencePath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-controlled-subject-registration-closeout-v1.json";
const migrationPath =
  "supabase/migrations/20261005044500_v21_8h_r11b_identity_authority_preservation_fix_v1.sql";

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const migration = fs.readFileSync(migrationPath, "utf8");

assert.equal(evidence.stage, "V2.1-8H-R11B");
assert.equal(
  evidence.primary_terminal_outcome,
  "BARRIER_SUPPORT_P0_READY3_CONTROLLED_SUBJECT_REGISTRATION_PASS"
);
assert.equal(
  evidence.authority.registry_version,
  "product-fact-registry-cross-category-v1"
);
assert.equal(
  evidence.authority.subject_identity_serializer_version,
  "product-fact-subject-identity-v1"
);
assert.equal(
  evidence.authority.identity_resolution_version,
  "v21-8h-r10-official-identity-v1"
);
assert.equal(
  evidence.authority.post_registration_reprocess,
  "process_catalog_trust_product_v3(uuid,text)"
);

assert.deepEqual(evidence.production_poststate, {
  product_fact_subject_total: 50,
  product_fact_current: 101,
  fact_instances: 102,
  confirmations: 102,
  ready3_subject_count: 3,
  ready3_research_pending_task_count: 6,
  ready3_subject_creation_required_task_count: 0
});

assert.equal(evidence.function_readback.nested_identity_authority_supported, true);
assert.equal(evidence.function_readback.anon_execute, false);
assert.equal(evidence.function_readback.authenticated_execute, false);
assert.equal(evidence.function_readback.service_role_execute, true);

for (const key of [
  "evidence_writes_observed",
  "product_fact_instance_writes_observed",
  "product_fact_current_writes_observed",
  "confirmation_writes_observed"
]) {
  assert.equal(evidence.authority_boundary[key], 0, key);
}
for (const key of [
  "automatic_evidence_adoption",
  "automatic_fact_confirmation",
  "recommendation_mutation",
  "public_activation"
]) {
  assert.equal(evidence.authority_boundary[key], false, key);
}

const expected = new Map([
  [
    "06d1ad4b-2291-4b73-8bf4-f1f3c0226fea",
    {
      subjectId: "f8e92b1d-6586-430c-88e2-03763dbd6777",
      semanticKey:
        "9d756f9088eae3572db9d75eb3f654424db7ac01cbb0b6b4d3ada389dc3bf9d6",
      formulationKey:
        "v21-8h-r10:e769b508ecdcf0f6f652a00da3434867364ef5d04cc627c9bec65163b641e4de",
      digest:
        "e769b508ecdcf0f6f652a00da3434867364ef5d04cc627c9bec65163b641e4de",
      taskIds: new Set([
        "02b9ba0a-207c-4d23-b522-853bd45ff815",
        "e08b1e23-771d-4c0b-8263-8ca02fa687f6"
      ])
    }
  ],
  [
    "b1f6b527-679f-48f3-9b58-5d28ec095f2f",
    {
      subjectId: "84beae6f-72c8-424e-b561-c2c067fef9e0",
      semanticKey:
        "028945101121562f1f5470a44fd1a7974477a7c8a50cd6954102993fb087650d",
      formulationKey:
        "v21-8h-r10:a8a01568cf96737549c033542599a2d94e843367d0c876774262f0b409125327",
      digest:
        "a8a01568cf96737549c033542599a2d94e843367d0c876774262f0b409125327",
      taskIds: new Set([
        "0d0cee84-f218-40bb-9dd3-4b2b00078259",
        "39449932-6c41-4762-bf39-e6848c9ad09a"
      ])
    }
  ],
  [
    "e15a1f7e-29b3-49fd-aae4-297bf9ada4ed",
    {
      subjectId: "9ef1863e-b16c-414b-88ae-d686fc4fda33",
      semanticKey:
        "facb3e2bb9ebd6768b71dbf076dfd7b9ebd3bbbef8cd3fb401603ddba08a65f2",
      formulationKey:
        "v21-8h-r10:c48757c1795e8fc7afe01fb3d479c7ff3c87753ab20e28e51894dee04fbd4a60",
      digest:
        "c48757c1795e8fc7afe01fb3d479c7ff3c87753ab20e28e51894dee04fbd4a60",
      taskIds: new Set([
        "6955dada-e845-4a53-a44a-0cdc53dd9ad8",
        "7cf58ffe-88c1-4f11-9f7a-905513cc6917"
      ])
    }
  ]
]);

assert.equal(evidence.products.length, 3);

for (const product of evidence.products) {
  const exp = expected.get(product.product_id);
  assert.ok(exp, `unexpected product: ${product.product_id}`);
  assert.equal(product.subject_id, exp.subjectId);
  assert.equal(product.subject_semantic_key, exp.semanticKey);
  assert.equal(product.formulation_revision_key, exp.formulationKey);
  assert.equal(product.variant_key, null);
  assert.equal(product.market, "KR");
  assert.equal(product.identity_status, "resolved");
  assert.equal(product.current_state, "current");
  assert.equal(product.intake_identity_state, "EXACT_SUBJECT_FOUND");
  assert.equal(product.intake_trust_state, "RESEARCH_PENDING");
  assert.equal(
    product.identity_authority.authority_kind,
    "admin_identity_authority"
  );
  assert.equal(product.identity_authority.market, "KR");
  assert.equal(
    product.identity_authority.source_content_digest,
    exp.digest
  );
  assert.equal(
    product.identity_authority.authority_resolution_version,
    "v21-8h-r10-official-identity-v1"
  );
  assert.match(
    product.identity_authority.official_source_locator,
    /^https:\/\//
  );
  assert.equal(product.tasks.length, 2);
  assert.deepEqual(
    new Set(product.tasks.map((task) => task.id)),
    exp.taskIds
  );
  for (const task of product.tasks) {
    assert.equal(task.state, "RESEARCH_PENDING");
    assert.equal(task.blocker_code, null);
    assert.equal(task.attempt_count, 0);
  }
  assert.equal(product.subject_fact_instances, 0);
  assert.equal(product.subject_current_facts, 0);
}

assert.deepEqual(
  evidence.hold_products_excluded.map((item) => item.reason_code).sort(),
  [
    "BUNDLE_PRESENTATION_SCOPE_UNRESOLVED",
    "FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED"
  ].sort()
);

assert.equal(
  evidence.next_gate.stage,
  "V2.1-8H-R12_READY3_BARRIER_SUPPORT_OFFICIAL_EVIDENCE_RESEARCH"
);
assert.equal(evidence.next_gate.status, "NOT_EXECUTED");

for (const token of [
  "identity_resolution_detail -> 'identity_authority'",
  "jsonb_typeof",
  "admin_identity_authority",
  "authority_resolution_version",
  "process_catalog_trust_product_v2",
  "from public, anon, authenticated, service_role",
  "to service_role"
]) {
  assert.ok(
    migration.includes(token),
    `authority preservation migration token missing: ${token}`
  );
}

for (const forbidden of [
  /insert\s+into\s+public\.product_fact_instances/i,
  /update\s+public\.product_fact_current/i,
  /insert\s+into\s+public\.product_fact_confirmations/i,
  /update\s+public\.recommendation/i,
  /insert\s+into\s+public\.recommendation/i
]) {
  assert.equal(
    forbidden.test(migration),
    false,
    `forbidden Product Fact/Recommendation mutation present: ${forbidden}`
  );
}

console.log(
  JSON.stringify({
    status: "PASS",
    stage: evidence.stage,
    terminal: evidence.primary_terminal_outcome,
    subjects: evidence.production_poststate.product_fact_subject_total,
    ready3_subjects: evidence.production_poststate.ready3_subject_count,
    ready3_tasks:
      evidence.production_poststate.ready3_research_pending_task_count
  })
);
