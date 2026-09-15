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

const migration = read("supabase/migrations/20260915102500_trust_phase2_subject_resolution_v1.sql");
const fixture = read("tests/fixtures/trust-subject-resolution/20260915100000_trust_subject_resolution_fixture_extension.sql");
const runtime = read("tests/fixtures/trust-subject-resolution/verify_trust_subject_resolution_runtime.sql");

[
  "create or replace function public.resolve_catalog_trust_subject_v1",
  "product-fact-subject-resolution-v1",
  "EXACT_SUBJECT_FOUND",
  "SUBJECT_CANDIDATE_FOUND",
  "SUBJECT_CREATION_REQUIRED",
  "IDENTITY_BLOCKED",
  "VARIANT_CONFLICT",
  "FORMULATION_CONFLICT",
  "MARKET_CONFLICT",
  "catalog_identity_state",
  "single_current_resolved_exact_market_subject",
  "subjects_exist_only_outside_exact_market",
  "create or replace function public.process_catalog_trust_product_v1",
  "catalog_trust_identity_task_reconciliation_required",
  "grant execute on function public.resolve_catalog_trust_subject_v1(uuid)",
  "grant execute on function public.process_catalog_trust_product_v1(uuid)"
].forEach((value) => includes(migration, value, "Phase 2 migration"));

[
  "identity_ambiguous",
  "variant_scope_conflict",
  "formulation_conflict",
  "market_conflict"
].forEach((value) => includes(migration, value, "catalog identity reuse"));

excludes(migration, "admin_register_product_fact_subject_v1(", "Subject creation authority");
assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.product_fact_subjects\b/i.test(migration),
  "Phase 2 migration must not mutate Product Fact Subjects"
);
assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.(product_fact_instances|product_fact_current|product_fact_confirmations|product_evidence_records)\b/i.test(migration),
  "Phase 2 migration must not mutate Product Fact authority"
);
assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.recommendation/i.test(migration),
  "Phase 2 migration must not mutate Recommendation authority"
);
assert(
  !/grant\s+execute[\s\S]{0,180}resolve_catalog_trust_subject_v1[\s\S]{0,80}to\s+(?:anon|authenticated|public)/i.test(migration),
  "Subject resolver must remain service-role-only"
);

[
  "identity_resolution_state",
  "variant_key",
  "formulation_revision_key",
  "variant_scope_conflict",
  "candidate-formulation-v1",
  "same-formulation",
  "formulation-a",
  "formulation-b"
].forEach((value) => includes(fixture, value, "Phase 2 fixture"));

[
  "phase2_exact_subject_resolution_failed",
  "phase2_missing_subject_state_invalid",
  "phase2_subject_candidate_state_invalid",
  "phase2_upstream_ambiguous_not_blocked",
  "phase2_market_conflict_not_blocked",
  "phase2_variant_conflict_classification_failed",
  "phase2_formulation_conflict_classification_failed",
  "phase2_late_subject_task_duplicate",
  "phase2_late_subject_task_reconciliation_failed",
  "phase2_mutated_current",
  "phase2_mutated_confirmations",
  "phase2_mutated_recommendation_data",
  "TRUST_PHASE2_SUBJECT_RESOLUTION_RUNTIME_VERIFIED"
].forEach((value) => includes(runtime, value, "Phase 2 runtime verifier"));

console.log("TRUST_PHASE2_SUBJECT_RESOLUTION_CONTRACT_VERIFIED");
