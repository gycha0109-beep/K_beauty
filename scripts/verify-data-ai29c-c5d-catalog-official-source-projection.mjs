#!/usr/bin/env node

import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20260929193000_data_ai29c_c5d_catalog_official_source_projection_v1.sql",
  "utf8",
);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

for (const token of [
  "admin_project_catalog_trust_official_source_v1",
  "admin.products.review",
  "catalog-only-product-transactional-adoption-v1",
  "EXACT_SUBJECT_FOUND",
  "catalog-taxonomy-v1:category:sunscreen",
  "assignment_state = 'shadow'",
  "product_fact_write_allowed",
  "recommendation_admission_allowed",
  "product_evidence_sources",
  "product_evidence_source_subject_bindings",
  "exact_subject_match",
  "scope_relation = 'equivalent'",
  "trust_official_source_review_v1",
  "product_source_bindings",
  "trust_official_source_binding_reviews",
  "product_fact_authority_mutated",
  "recommendation_authority_mutated",
  "production_cutover_authorized",
  "to service_role;",
]) {
  check(migration.includes(token), "C5D migration token missing: " + token);
}

check(
  migration.includes("insert into public.product_source_bindings"),
  "operational source projection missing",
);
check(
  migration.includes("insert into public.trust_official_source_binding_reviews"),
  "review record missing",
);
check(
  !migration.includes("insert into public.product_evidence_sources"),
  "projection must not create source authority",
);
check(
  !migration.includes("insert into public.product_evidence_source_subject_bindings"),
  "projection must not create Subject binding authority",
);
check(
  !migration.includes("insert into public.product_fact_instances"),
  "projection must not write Product Fact instances",
);
check(
  !migration.includes("insert into public.product_fact_current"),
  "projection must not write Product Fact Current",
);
check(
  !migration.includes("insert into public.recommendation"),
  "projection must not write Recommendation authority",
);

console.log("DATA_AI29C_C5D_CATALOG_OFFICIAL_SOURCE_PROJECTION=PASS");
