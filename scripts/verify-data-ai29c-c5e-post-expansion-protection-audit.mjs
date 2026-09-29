#!/usr/bin/env node

import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20260929194500_data_ai29c_c5e_post_expansion_protection_audit_v1.sql",
  "utf8",
);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

for (const token of [
  "read_data_ai29c_protection_expansion_audit_v1",
  "products.category=sunscreen",
  "catalog-taxonomy-v1:category:sunscreen",
  "assignment_state = 'shadow'",
  "product_specific_primary",
  "fused_confidence in ('high','medium')",
  "spf_50_plus",
  "uva_pa4",
  "water_80_plus",
  "spfMinimumCoverage",
  "uvaMinimumCoverage",
  "waterMinimumCoverage",
  "minimumDistinctScoringBuckets",
  "HOLD_NO_DISCRIMINATING_AXIS",
  "productionCutoverAuthorized",
  "outdoorRankableSignalAuthorized",
  "recommendationAuthorityMutated",
  "to service_role;",
]) {
  check(migration.includes(token), "C5E audit token missing: " + token);
}

check(
  migration.includes("security definer") && migration.includes("stable"),
  "C5E audit must remain a stable read boundary",
);
for (const forbidden of [
  "insert into public.",
  "update public.",
  "delete from public.",
  "truncate ",
]) {
  check(
    !migration.toLowerCase().includes(forbidden),
    "C5E audit must be read-only: " + forbidden,
  );
}

console.log("DATA_AI29C_C5E_POST_EXPANSION_PROTECTION_AUDIT=PASS");
