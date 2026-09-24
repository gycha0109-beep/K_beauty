#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20260924025307_trust_phase8g_source_verification_comparability_v1.sql";
const hardeningPath = "supabase/migrations/20260924025341_trust_phase8g_profile_idempotency_hardening_v1.sql";
const runtimePath = "tests/fixtures/trust-phase8g-source-verification/verify_trust_phase8g_source_verification_runtime.sql";
const contractPath = "docs/evidence/trust-phase8g-source-verification-comparability-v1.md";
const lifecyclePath = "docs/evidence/trust-phase8a-product-fact-revalidation-contract-v1.md";
const transportPath = "lib/trust/official-source-fetch.mjs";
const workerPath = "scripts/trust-source-verification-worker.mjs";
const researchWorkerPath = "scripts/trust-research-worker.mjs";
const semanticAdapterPath = "lib/trust/official-source-semantic-adapter.mjs";
const semanticVerifierPath = "scripts/verify-trust-official-product-semantic-adapter.mjs";
const semanticProfileMigrationPath = "supabase/migrations/20260924104150_trust_phase8g_semantic_profile_contract_v1.sql";
const controlledBatchPath = "tests/fixtures/trust-phase8g-semantic-adapter/controlled-expansion-batch-v1.json";
const controlledProbePath = "scripts/trust-source-semantic-controlled-batch-probe.mjs";

const migration = fs.readFileSync(migrationPath, "utf8");
const hardening = fs.readFileSync(hardeningPath, "utf8");
const runtime = fs.readFileSync(runtimePath, "utf8");
const contract = fs.readFileSync(contractPath, "utf8");
const lifecycle = fs.readFileSync(lifecyclePath, "utf8");
const transport = fs.readFileSync(transportPath, "utf8");
const worker = fs.readFileSync(workerPath, "utf8");
const researchWorker = fs.readFileSync(researchWorkerPath, "utf8");
const semanticAdapter = fs.readFileSync(semanticAdapterPath, "utf8");
const semanticVerifier = fs.readFileSync(semanticVerifierPath, "utf8");
const semanticProfileMigration = fs.readFileSync(semanticProfileMigrationPath, "utf8");
const controlledBatch = JSON.parse(fs.readFileSync(controlledBatchPath, "utf8"));
const controlledProbe = fs.readFileSync(controlledProbePath, "utf8");

for (const token of [
  "create table public.product_evidence_source_verification_profiles",
  "COMPARABLE",
  "BASELINE_RECOVERY_REQUIRED",
  "MANUAL_ONLY",
  "fresh_recovery",
  "historical_replay",
  "product_evidence_source_verification_profiles_immutable",
  "admin_register_product_evidence_source_verification_profile_v1",
  "record_product_evidence_source_verification_v2",
  "trust_phase8g_assert_verification_comparable_v1",
  "product_fact_revalidation_verification_not_comparable",
  "trust_phase8g_preflight_revalidation_legacy_v1",
  "trust_phase8g_mark_revalidation_legacy_v1",
  "revoke all on table public.product_evidence_source_verification_profiles",
  "grant select on table public.product_evidence_source_verification_profiles to service_role",
  "automatic_fact_mutation",
  "automatic_confirmation"
]) {
  assert.ok(migration.includes(token), `missing Phase 8G migration token: ${token}`);
}

for (const token of [
  "product_evidence_source_verification_profile_request_conflict",
  "idempotent"
]) {
  assert.ok(hardening.includes(token), `missing Phase 8G hardening token: ${token}`);
}

for (const forbidden of [
  "update public.product_fact_current",
  "delete from public.product_fact_current",
  "insert into public.product_fact_instances",
  "update public.product_fact_instances",
  "delete from public.product_fact_instances",
  "insert into public.product_fact_confirmations",
  "admin_confirm_product_fact_v1(",
  "insert into public.recommendation",
  "update public.recommendation",
  "delete from public.recommendation"
]) {
  assert.ok(!migration.toLowerCase().includes(forbidden.toLowerCase()), `forbidden Phase 8G authority: ${forbidden}`);
  assert.ok(!hardening.toLowerCase().includes(forbidden.toLowerCase()), `forbidden Phase 8G hardening authority: ${forbidden}`);
}

for (const token of [
  "phase8g_unresolved_profile_verification_not_rejected",
  "phase8g_profile_exact_replay_not_idempotent",
  "phase8g_raw_compat_profile_invalid",
  "phase8g_semantic_profile_missing_canonical_length_not_rejected",
  "phase8g_semantic_basis_key_mismatch_not_rejected",
  "phase8g_semantic_version_mismatch_not_rejected",
  "phase8g_unknown_adapter_not_rejected",
  "phase8g_profile_request_conflict_not_rejected",
  "phase8g_verification_request_conflict_not_rejected",
  "phase8g_unprofiled_revalidation_not_rejected",
  "phase8g_profiled_revalidation_preflight_invalid",
  "phase8g_authority_state_mutated",
  "phase8g_profile_acl_mismatch",
  "phase8g_function_acl_mismatch",
  "TRUST_PHASE8G_SOURCE_VERIFICATION_COMPARABILITY_RUNTIME_VERIFIED"
]) {
  assert.ok(runtime.includes(token), `missing Phase 8G runtime assertion: ${token}`);
}

for (const token of [
  "HTTPS only",
  "BASELINE_RECOVERY_REQUIRED",
  "No synthetic",
  "Recommendation authority delta = 0"
]) {
  assert.ok(contract.includes(token), `missing Phase 8G contract token: ${token}`);
}

assert.ok(lifecycle.includes("cross-proposition semantic replacement:"));
assert.ok(lifecycle.includes("new_fact.supersedes_fact_instance_id = null"));
assert.ok(lifecycle.includes("Phase 8G comparability hardening"));

for (const token of [
  "MAX_RESPONSE_BYTES = 2 * 1024 * 1024",
  "FETCH_TIMEOUT_MS = 10_000",
  "MAX_REDIRECTS = 3",
  "SOURCE_BLOCKED:private_dns_resolution",
  "export async function fetchOfficialBytes",
  "export function sha256Hex",
  "export function canonicalizeOfficialHtmlTextV1",
  "export function digestOfficialContent",
  "canonical-html-text-v1",
  "official-product-semantic",
  "canonical-official-product-semantics-v1"
]) {
  assert.ok(transport.includes(token), `missing shared transport token: ${token}`);
}

for (const token of [
  "canonical-official-product-semantics-v1",
  "official-product-semantic",
  "canonical_length",
  "live-page-bytes-v1",
  "product_evidence_source_verification_profile_fresh_recovery_invalid",
  "btrim(p_digest_basis) = 'canonical-official-product-semantics-v1'",
  "btrim(p_adapter_key) = 'official-product-semantic'",
  "btrim(p_adapter_version) = 'v1'",
  "btrim(p_digest_basis) = 'live-page-bytes-v1'",
  "btrim(p_adapter_key) = 'live-page-bytes'"
]) {
  assert.ok(semanticProfileMigration.includes(token), `missing semantic profile migration token: ${token}`);
}

for (const forbidden of [
  "update public.product_fact_current",
  "delete from public.product_fact_current",
  "insert into public.product_fact_instances",
  "update public.product_fact_instances",
  "insert into public.product_fact_confirmations",
  "insert into public.recommendation",
  "update public.recommendation"
]) {
  assert.ok(!semanticProfileMigration.toLowerCase().includes(forbidden.toLowerCase()), `forbidden semantic profile authority: ${forbidden}`);
}

for (const token of [
  "establishFreshBaseline",
  "verifySource",
  "official-product-semantic",
  "canonical-official-product-semantics-v1",
  "record_product_evidence_source_verification_v2",
  "admin_register_product_evidence_source_verification_profile_v1"
]) {
  assert.ok(worker.includes(token), `missing Phase 8G worker token: ${token}`);
}


for (const token of [
  "SOURCE_SEMANTIC_ADAPTER_REQUIRED_ANCHOR_MISSING",
  "SOURCE_SEMANTIC_ADAPTER_UNSUPPORTED",
  "observed_claim",
  "current_direct_claim",
  "direct_claim",
  "structured_products"
]) {
  assert.ok(semanticAdapter.includes(token), `missing semantic adapter fail-closed token: ${token}`);
}

for (const token of [
  "storefront telemetry and runtime script noise must not alter semantic digest",
  "structured Product semantic change must alter digest",
  "SOURCE_SEMANTIC_ADAPTER_REQUIRED_ANCHOR_MISSING",
  "SOURCE_SEMANTIC_ADAPTER_UNSUPPORTED"
]) {
  assert.ok(semanticVerifier.includes(token), `missing semantic adapter verification token: ${token}`);
}

assert.ok(!worker.includes("semantic parse failed"));
assert.ok(!worker.includes("fallback raw"));

assert.ok(researchWorker.includes('from "../lib/trust/official-source-fetch.mjs"'));
assert.ok(!researchWorker.includes('from "node:dns/promises"'));
assert.ok(!researchWorker.includes("const MAX_RESPONSE_BYTES"));

assert.equal(controlledBatch.contract, "trust-phase8g-controlled-expansion-batch-v1");
assert.equal(controlledBatch.authority_mutation, false);
assert.equal(controlledBatch.required_observations, 3);
assert.equal(controlledBatch.adapter_key, "official-product-semantic");
assert.equal(controlledBatch.adapter_version, "v1");
assert.equal(controlledBatch.sources.length, 3);
assert.equal(new Set(controlledBatch.sources.map((source) => source.source_id)).size, 3);
for (const source of controlledBatch.sources) {
  assert.ok(String(source.canonical_locator || "").startsWith("https://"));
  assert.ok(String(source.reviewed_anchor || "").trim().length > 0);
  assert.ok(source.source_metadata && typeof source.source_metadata === "object");
}

for (const token of [
  "trust-phase8g-controlled-expansion-qualification-v1",
  "SUPPORTED_STABLE",
  "LOCATOR_DRIFT",
  "TRANSIENT_FAILURE",
  "SOURCE_BLOCKED",
  "required_observations",
  "reviewed_anchor_present",
  "same_final_hostname",
  "authority_mutation: false"
]) {
  assert.ok(controlledProbe.includes(token), `missing controlled batch probe token: ${token}`);
}

for (const forbidden of [
  "@supabase/supabase-js",
  "createClient(",
  "admin_register_product_evidence_source_verification_profile_v1",
  "record_product_evidence_source_verification_v2"
]) {
  assert.ok(!controlledProbe.includes(forbidden), `controlled batch probe must remain DB-write-free: ${forbidden}`);
}

console.log(JSON.stringify({
  status: "PASS",
  phase: "TRUST_PHASE8G_SOURCE_VERIFICATION_COMPARABILITY",
  unprofiled_revalidation: false,
  legacy_unknown_auto_compare: false,
  fresh_baseline_fact_mutation: false,
  automatic_confirmation: false,
  recommendation_mutation: false
}, null, 2));
