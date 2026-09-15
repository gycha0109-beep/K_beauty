import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) throw new Error(`missing file: ${path}`);
  return readFileSync(absolute, "utf8");
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const includes = (text, value, label) => assert(text.includes(value), `${label} missing: ${value}`);
const excludes = (text, value, label) => assert(!text.includes(value), `${label} unexpectedly contains: ${value}`);

const migration = read("supabase/migrations/20260915112151_trust_phase2_presentation_scope_hardening_v1.sql");
const runtime = read("tests/fixtures/trust-subject-resolution/verify_trust_subject_resolution_presentation_hardening_runtime.sql");

[
  "v_exact_current_variant_key is null",
  "single_product_scoped_current_subject_exact_market",
  "presentation_relation_not_proven_for_variant_scoped_subject",
  "presentation_relation_proven",
  "SUBJECT_CANDIDATE_FOUND",
  "REVIEW_REQUIRED",
  "Variant-scoped Subjects require separately governed presentation equivalence"
].forEach((value) => includes(migration, value, "presentation-scope hardening"));

excludes(migration, "admin_register_product_fact_subject_v1(", "Subject creation authority");
assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.product_fact_subjects\b/i.test(migration),
  "presentation hardening must not mutate Product Fact Subjects"
);
assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.(product_fact_instances|product_fact_current|product_fact_confirmations|product_evidence_records)\b/i.test(migration),
  "presentation hardening must not mutate Product Fact authority"
);
assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.recommendation/i.test(migration),
  "presentation hardening must not mutate Recommendation authority"
);

[
  "phase2_variant_scoped_subject_auto_linked",
  "presentation_relation_not_proven_for_variant_scoped_subject",
  "phase2_late_variant_subject_auto_linked",
  "phase2_product_scoped_exact_path_failed",
  "single_product_scoped_current_subject_exact_market",
  "phase2_hardening_mutated_current",
  "phase2_hardening_mutated_confirmations",
  "phase2_hardening_mutated_recommendation_data",
  "TRUST_PHASE2_PRESENTATION_SCOPE_HARDENING_VERIFIED"
].forEach((value) => includes(runtime, value, "presentation-scope runtime"));

console.log("TRUST_PHASE2_PRESENTATION_SCOPE_HARDENING_CONTRACT_VERIFIED");
