#!/usr/bin/env node

import fs from "node:fs";
import assert from "node:assert/strict";
import { extractStrictFactCandidate } from "./trust-research-worker.mjs";

const migration = fs.readFileSync(
  "supabase/migrations/20260930120500_data_ai29c_d1a_unresolved_fact_reresearch_v1.sql",
  "utf8",
);

for (const token of [
  "product_fact_unresolved_reresearch_requests",
  "admin_enqueue_unresolved_product_fact_reresearch_v1",
  "NEW_PRIMARY_EVIDENCE_AVAILABLE",
  "product-fact-required-reresearch-v1",
  "EVIDENCE_INSUFFICIENT",
  "SOURCE_BLOCKED",
  "EXACT_SUBJECT_FOUND",
  "exact_subject_match",
  "scope_relation = 'equivalent'",
  "source_name ~ '_official$'",
  "product_fact_authority_mutated",
  "recommendation_authority_mutated",
  "automatic_confirmation",
  "to service_role;",
]) {
  assert.ok(migration.includes(token), "D1A migration token missing: " + token);
}

assert.ok(
  migration.includes("v_source.created_at <= v_prior.updated_at"),
  "D1A must require source newer than terminal prior task",
);
assert.ok(
  migration.includes("direct_claim_fact_key"),
  "D1A must bind new direct claim to the exact fact key",
);
assert.ok(
  migration.includes("unresolved_product_fact_reresearch_current_fact_exists"),
  "D1A must fail if a Current fact already exists",
);
assert.ok(
  !migration.toLowerCase().includes("update public.product_fact_current"),
  "D1A enqueue must not mutate Current Product Fact",
);
assert.ok(
  !migration.toLowerCase().includes("insert into public.product_fact_instances"),
  "D1A enqueue must not create Product Fact instances",
);
assert.ok(
  !migration.toLowerCase().includes("update public.products"),
  "D1A enqueue must not mutate Product rows",
);

const directPhysical = extractStrictFactCandidate(
  "uv_filter_type",
  "닥터트럽 징크자차는 자외선차단 기능성을 더한 징크 물리적 자외선 차단제 입니다.",
);
assert.equal(directPhysical?.normalizedValue, "mineral");
assert.equal(
  directPhysical?.observedClaim?.extractor,
  "explicit-filter-system-claim-v1",
);

const directMineral = extractStrictFactCandidate(
  "uv_filter_type",
  "닥터트럽 바이오 리페어 썬크림 바이오 무기자차 민감하고 붉어진 문제성 피부",
);
assert.equal(directMineral?.normalizedValue, "mineral");

const ingredientOnly = extractStrictFactCandidate(
  "uv_filter_type",
  "전성분: 징크옥사이드 23.04%, 정제수, 글리세린",
);
assert.equal(ingredientOnly, null);

const vaguePhysical = extractStrictFactCandidate(
  "uv_filter_type",
  "물리적 케어와 징크 성분을 사용했습니다.",
);
assert.equal(vaguePhysical, null);

console.log("DATA_AI29C_D1A_UNRESOLVED_FACT_RERESEARCH=PASS");
console.log("explicit_physical_claim=mineral ingredient_only=null");
