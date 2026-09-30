#!/usr/bin/env node

import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20260930113000_data_ai29c_d1_sunscreen_recommendation_semantic_authority_v1.sql",
  "utf8",
);

for (const token of [
  "sunscreen_recommendation_semantic_field_reviews",
  "admin_register_sunscreen_recommendation_semantic_field_v1",
  "read_sunscreen_recommendation_semantic_bundle_v1",
  "sunscreen-recommendation-semantic-bundle-v1",
  "sunscreen-recommendation-semantic-review-policy-v1",
  "established",
  "reviewed_not_established",
  "conflict",
  "not_reviewed",
  "category_slot",
  "skin_types",
  "concerns",
  "texture",
  "finish",
  "uv_filter_type",
  "sensitivity_safe",
  "irritation_risk",
  "tone_up",
  "white_cast",
  "eye_sting",
  "pilling_risk",
  "catalog-taxonomy-v1:category:sunscreen",
  "product_specific_primary",
  "SEMANTIC_BUNDLE_COMPLETE",
  "SEMANTIC_BUNDLE_INCOMPLETE",
  "recommendation_admission_mutated",
  "production_ranking_changed",
  "to service_role;",
]) {
  assert.ok(migration.includes(token), "D1 semantic authority token missing: " + token);
}

assert.ok(
  migration.includes("create unique index if not exists sunscreen_semantic_current_field_uidx"),
  "D1 must preserve one current review per product/field",
);
assert.ok(
  migration.includes("supersedes_review_id"),
  "D1 must preserve review history via explicit supersession",
);
assert.ok(
  migration.includes("product_fact_current"),
  "D1 established uv_filter_type must bind to governed Product Fact Current",
);
assert.ok(
  migration.includes("field_value is null"),
  "D1 missing/conflict states must preserve null rather than invent values",
);

for (const forbidden of [
  "update public.products",
  "insert into public.products",
  "delete from public.products",
  "insert into public.recommendation",
  "update public.recommendation",
]) {
  assert.ok(
    !migration.toLowerCase().includes(forbidden),
    "D1 semantic authority must not mutate Product/Recommendation rows: " + forbidden,
  );
}

console.log("DATA_AI29C_D1_SUNSCREEN_SEMANTIC_AUTHORITY=PASS");
console.log("required_fields=12 missing_is_not_false=true product_mutation=false");
