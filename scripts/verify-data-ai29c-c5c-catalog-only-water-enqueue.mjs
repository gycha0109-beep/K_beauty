#!/usr/bin/env node

import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20260929183000_data_ai29c_c5c_catalog_only_water_recovery_enqueue_v1.sql",
  "utf8",
);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

for (const token of [
  "enqueue_data_ai29c_protection_recovery_tasks_v1",
  "product_catalog_taxonomy_assignments",
  "catalog-taxonomy-v1:category:sunscreen",
  "assignment_state = 'shadow'",
  "p.category = 'sunscreen'",
  "catalogOnlyTaxonomyEligibleCount",
  "legacyCategoryEligibleCount",
  "water_resistance_duration",
  "data-ai29c-protection-recovery-v1",
  "EXACT_SUBJECT_FOUND",
  "productFactAuthorityMutated",
  "recommendationAuthorityMutated",
  "productionCutoverAuthorized",
  "to service_role;",
]) {
  check(migration.includes(token), "C5C migration token missing: " + token);
}

check(
  migration.includes("insert into public.product_fact_research_tasks"),
  "recovery task insertion missing",
);
check(
  !migration.includes("insert into public.product_fact_current"),
  "C5C must not write Product Fact Current",
);
check(
  !migration.includes("insert into public.product_fact_instances"),
  "C5C must not write Product Fact instances",
);
check(
  !migration.includes("insert into public.product_evidence_records"),
  "C5C must not write Product Fact evidence",
);
check(
  !migration.includes("insert into public.recommendation"),
  "C5C must not write Recommendation authority",
);

console.log(
  "DATA_AI29C_C5C_CATALOG_ONLY_WATER_RECOVERY_ENQUEUE=PASS",
);
