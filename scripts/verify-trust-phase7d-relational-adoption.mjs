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

const migration = read("supabase/migrations/20260921211920_trust_phase7d_relational_fact_adoption_v1.sql");
const worker = read("scripts/trust-research-worker.mjs");
const fixture = read("tests/fixtures/trust-phase7d-relational/20260921115900_trust_phase7d_relational_fixture.sql");
const runtime = read("tests/fixtures/trust-phase7d-relational/verify_trust_phase7d_relational_runtime.sql");

[
  "add column if not exists parent_proposition_key text",
  "trust_evidence_candidates_parent_proposition_key_check",
  "'parent_propositions'",
  "trust_research_parent_proposition_required",
  "trust_research_parent_proposition_invalid",
  "trust_research_parent_scope_mismatch",
  "MANUAL_RETRY_ELIGIBLE_RELATIONAL_PARENT",
  "trust_phase4_parent_proposition_not_current",
  "trust_phase4_parent_scope_mismatch",
  "'parent_fact_instance_id', v_parent_fact_instance_id",
  "'parent_proposition_key', v_parent_proposition_key",
  "when v_parent_proposition_key is null then '{}'::jsonb",
  "grant execute on function public.claim_trust_research_tasks_v1",
  "grant execute on function public.record_trust_research_result_v1",
  "grant execute on function public.process_trust_reentry_event_v1",
  "grant execute on function public.trust_phase4_build_adoption_plan_v1"
].forEach((value) => includes(migration, value, "Phase 7-D migration"));

[
  "explicit-parent-bound-active-concentration-v1",
  "task.parent_propositions",
  "parent_proposition_key: extracted.parentPropositionKey",
  "matches.length === 1 ? matches[0] : null"
].forEach((value) => includes(worker, value, "Research worker"));

[
  "phase7d_relational_positive_preflight_failed",
  "phase7d_missing_parent_not_blocked",
  "phase7d_noncurrent_parent_not_blocked",
  "phase7d_wrong_parent_fact_not_blocked",
  "phase7d_automatic_confirmation_detected",
  "TRUST_PHASE7D_RELATIONAL_FACT_RUNTIME_VERIFIED"
].forEach((value) => includes(runtime, value, "Phase 7-D runtime"));

includes(fixture, "trust_phase7c_has_controlled_official_source_v1", "Phase 7-D fixture");
assert(
  !migration.includes("jsonb_strip_nulls(jsonb_build_object(\n    'subject_id', v_task.subject_id"),
  "non-relational candidate digest must retain the Phase 3 null-key basis"
);

excludes(migration, "admin_confirm_product_fact_v1(", "automatic Product Fact confirmation");
assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.recommendation/i.test(migration),
  "Phase 7-D migration must not mutate Recommendation authority"
);
assert(
  !/grant\s+execute[\s\S]{0,180}(claim_trust_research_tasks_v1|record_trust_research_result_v1|process_trust_reentry_event_v1|trust_phase4_build_adoption_plan_v1)[\s\S]{0,80}to\s+(?:anon|authenticated|public)/i.test(migration),
  "Phase 7-D privileged RPCs must remain service-role-only"
);

console.log("TRUST_PHASE7D_RELATIONAL_FACT_CONTRACT_VERIFIED");
