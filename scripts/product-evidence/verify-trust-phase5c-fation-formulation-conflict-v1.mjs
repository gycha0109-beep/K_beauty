#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const path =
  "evidence/product-fact-subject-coverage-v1/trust-phase5c-fation-formulation-conflict-v1.json";
const evidence = JSON.parse(fs.readFileSync(path, "utf8"));

const digest = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");

assert.equal(
  evidence.schema_version,
  "trust_phase5c_fation_formulation_conflict_v1"
);
assert.equal(evidence.snapshot_date, "2026-09-19");

const production = evidence.production;
assert.equal(production.project_id, "bygrczggxfuisupcevaz");
assert.equal(
  production.product_id,
  "da5df70c-8cdd-4eb2-93b6-ede46c2f171d"
);
assert.equal(
  production.intake_id,
  "15566618-d039-44c5-ad45-6413ee399db3"
);
assert.equal(
  production.source_candidate_id,
  "6a9627b6-a5da-458f-84f7-3a40f91453be"
);
assert.equal(production.market, "KR");
assert.equal(
  production.intake_identity_state,
  "SUBJECT_CREATION_REQUIRED"
);
assert.equal(production.trust_state, "REVIEW_REQUIRED");
assert.equal(production.research_task_count, 3);
assert.equal(
  production.research_task_blocker,
  "SUBJECT_CREATION_REQUIRED"
);
assert.equal(production.product_fact_subject_count, 0);
assert.equal(production.current_kr_subject_count, 0);
assert.equal(production.candidate_review_status, "promoted");
assert.equal(production.candidate_identity_state, "resolved");
assert.equal(production.catalog_product_fact_write_allowed, false);

const identity = evidence.identity_convergence;
assert.equal(identity.state, "PRODUCT_PRESENTATION_CONVERGED");
assert.equal(identity.product_name_ko, "파티온 노스카나인 트러블 세럼");
assert.equal(identity.product_name_en, "FATION NOSCA9 TROUBLE SERUM");
assert.equal(identity.presentation, "30 ml / 1.01 fl. oz.");
assert.equal(identity.manufacturer, "코스맥스㈜");
assert.equal(identity.responsible_seller, "동아제약㈜");
assert.equal(identity.country, "대한민국");

const firstParty = evidence.first_party_observations;
assert.ok(Array.isArray(firstParty));
assert.ok(firstParty.length >= 4);

const product329 = firstParty.find(
  (source) => source.source_id === "fation_product_329"
);
const try332 = firstParty.find(
  (source) => source.source_id === "fation_try_332"
);
const set613 = firstParty.find(
  (source) => source.source_id === "fation_set_613"
);
const donga = firstParty.find(
  (source) => source.source_id === "donga_product_NNTS20"
);

assert.ok(product329);
assert.ok(try332);
assert.ok(set613);
assert.ok(donga);
assert.equal(product329.publisher, "FATION");
assert.equal(product329.source_kind, "official_product_page");
assert.equal(product329.presentation, "30 ml / 1.01 fl. oz.");
assert.equal(product329.ingredient_order_class, "water_first");
assert.equal(try332.ingredient_order_class, "water_first");
assert.equal(set613.publisher, "FATION");
assert.equal(set613.presentation, "30 ml");
assert.equal(set613.ingredient_order_class, "mugwort_first");
assert.equal(donga.publisher, "동아제약");
assert.equal(donga.ingredient_order_class, "mugwort_first");

for (const source of [product329, try332, set613, donga]) {
  assert.ok(source.url.startsWith("https://"));
  assert.ok(Array.isArray(source.ingredients));
  assert.equal(digest(source.ingredients), source.ingredients_sha256);
}

assert.equal(
  product329.ingredients_sha256,
  "6eeed9473eaaee36bd09a73fb7b9ac1ddd4b7761c9fe21ae57070c9bc0484334"
);
assert.equal(
  set613.ingredients_sha256,
  "2c0cd6fc3765c9b59baf72b6f34abd4ad905e94c07a49c3c7c5c4facbf977d20"
);
assert.equal(
  product329.ingredients_sha256,
  try332.ingredients_sha256
);
assert.equal(set613.ingredients_sha256, donga.ingredients_sha256);
assert.notEqual(
  product329.ingredients_sha256,
  set613.ingredients_sha256
);

const waterSet = [...new Set(product329.ingredients)].sort();
const mugwortSet = [...new Set(set613.ingredients)].sort();
assert.deepEqual(
  waterSet,
  mugwortSet,
  "the conflict is ordering, not a different frozen ingredient set"
);
assert.notDeepEqual(
  product329.ingredients,
  set613.ingredients,
  "the two first-party orderings must remain distinct"
);
assert.equal(product329.ingredients[0], "정제수");
assert.equal(set613.ingredients[0], "쑥잎추출물");

const retail = evidence.current_retail_context;
assert.ok(Array.isArray(retail));
const dutyFree = retail.find(
  (source) => source.source_id === "ssg_dutyfree_30ml"
);
const current50 = retail.find(
  (source) => source.source_id === "oliveyoung_50ml_index"
);
assert.ok(dutyFree);
assert.ok(current50);
assert.equal(dutyFree.presentation, "30 ml / 1.01 fl. oz.");
assert.equal(dutyFree.ingredient_order_class, "mugwort_first");
assert.equal(dutyFree.authority, "context_only_not_first_party");
assert.equal(current50.ingredient_order_class, "water_first");
assert.equal(
  current50.authority,
  "context_only_different_presentation"
);

const conflict = evidence.conflict;
assert.equal(conflict.state, "FORMULATION_CONFLICT");
assert.equal(conflict.same_ingredient_set, true);
assert.equal(conflict.same_ingredient_order, false);
assert.equal(conflict.resolution, "HOLD");
assert.equal(
  conflict.water_first_sha256,
  product329.ingredients_sha256
);
assert.equal(
  conflict.mugwort_first_sha256,
  set613.ingredients_sha256
);

const provisional = evidence.provisional_subject_identity;
assert.equal(
  provisional.variant_key,
  "NOSCA9_TROUBLE_SERUM_KR_30ML"
);
assert.equal(
  provisional.variant_key_status,
  "PROVISIONAL_NOT_AUTHORIZED"
);
assert.equal(provisional.formulation_revision_key, null);
assert.equal(provisional.subject_semantic_key, null);
assert.equal(provisional.registration_allowed, false);

assert.equal(
  evidence.required_next_authority.state,
  "EXTERNAL_FORMULATION_AUTHORITY_REQUIRED"
);
assert.ok(
  evidence.required_next_authority.acceptable_examples.length >= 2
);

for (const [key, value] of Object.entries(evidence.authorized_deltas)) {
  assert.equal(value, 0, `authorized delta must remain zero: ${key}`);
}

const serialized = JSON.stringify(evidence);
for (const forbidden of [
  '"registration_allowed":true',
  '"formulation_revision_key":"trust-p24',
  '"subject_semantic_key":"',
  '"product_fact_subjects":1',
  '"product_fact_evidence":1',
  '"product_fact_confirmations":1',
  '"recommendations":1',
  '"product_source_bindings":1'
]) {
  assert.equal(
    serialized.includes(forbidden),
    false,
    `zero-write HOLD artifact contains forbidden authority: ${forbidden}`
  );
}

console.log(
  JSON.stringify({
    status: "PASS",
    decision: conflict.state,
    resolution: conflict.resolution,
    water_first_sha256: conflict.water_first_sha256,
    mugwort_first_sha256: conflict.mugwort_first_sha256,
    registration_allowed: provisional.registration_allowed
  })
);
