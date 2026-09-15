import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertSafeOfficialUrl, extractStrictFactCandidate } from "./trust-research-worker.mjs";

const root = process.cwd();
const read = (path) => {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) throw new Error(`missing file: ${path}`);
  return readFileSync(absolute, "utf8");
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const includes = (text, value, label) => assert(text.includes(value), `${label} missing: ${value}`);
const excludes = (text, value, label) => assert(!text.includes(value), `${label} unexpectedly contains: ${value}`);

const migration = read("supabase/migrations/20260915131141_trust_phase3_research_worker_v1.sql");
const worker = read("scripts/trust-research-worker.mjs");
const fixture = read("tests/fixtures/trust-research-worker/20260915122500_trust_research_worker_fixture.sql");
const runtime = read("tests/fixtures/trust-research-worker/verify_trust_research_worker_runtime.sql");

[
  "create table public.trust_source_observations",
  "create table public.trust_evidence_candidates",
  "claim_trust_research_tasks_v1",
  "record_trust_research_result_v1",
  "read_trust_research_task_v1",
  "live-page-bytes-v1",
  "frozen-first-party-observation-v1-not-live-page-bytes",
  "source_name ~ '_official$'",
  "s.variant_key is null",
  "EVIDENCE_INSUFFICIENT",
  "SOURCE_BLOCKED",
  "OUT_OF_SCOPE",
  "REGISTRY_GAP",
  "WORKER_LEASE_EXPIRED",
  "SOURCE_TRANSIENT_FAILURE",
  "product_specific_primary",
  "grant execute on function public.claim_trust_research_tasks_v1",
  "grant execute on function public.record_trust_research_result_v1",
  "grant execute on function public.read_trust_research_task_v1"
].forEach((value) => includes(migration, value, "Phase 3 migration"));

[
  "MAX_RESPONSE_BYTES",
  "FETCH_TIMEOUT_MS",
  "MAX_REDIRECTS",
  "redirect: \"manual\"",
  "assertSafeOfficialUrl",
  "private_dns_resolution",
  "source_content_digest: sha256Hex(fetched.bytes)",
  "digest_basis: \"live-page-bytes-v1\"",
  "Missing is not false",
  "No exact-market resolved *_official HTTPS source binding is available.",
  "explicit-spf-label-v1",
  "explicit-pa-label-v1",
  "explicit-filter-system-claim-v1"
].forEach((value) => includes(worker, value, "Research worker"));

excludes(worker, "google.com/search", "search-engine discovery");
excludes(worker, "bing.com/search", "search-engine discovery");
excludes(migration, "admin_ingest_product_fact_evidence_v1(", "Phase 4 Evidence ingest");
excludes(migration, "admin_register_product_fact_subject_v1(", "Subject creation authority");
assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.(product_evidence_sources|product_evidence_source_subject_bindings|product_evidence_records|product_fact_instances|product_fact_current|product_fact_confirmations)\b/i.test(migration),
  "Phase 3 migration must not mutate governed Product Fact authority"
);
assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.recommendation/i.test(migration),
  "Phase 3 migration must not mutate Recommendation authority"
);
assert(
  !/grant\s+execute[\s\S]{0,180}(claim_trust_research_tasks_v1|record_trust_research_result_v1|read_trust_research_task_v1)[\s\S]{0,80}to\s+(?:anon|authenticated|public)/i.test(migration),
  "Phase 3 RPCs must remain service-role-only"
);

[
  "fixture_official",
  "fixture_global_official",
  "manual_fixture",
  "product-scope-formulation-v1"
].forEach((value) => includes(fixture, value, "Phase 3 fixture"));

[
  "phase3_official_source_filter_failed",
  "phase3_candidate_replay_not_idempotent",
  "phase3_third_party_positive_not_blocked",
  "phase3_transient_retry_invalid",
  "phase3_evidence_insufficient_invalid",
  "phase3_mutated_governed_evidence",
  "TRUST_PHASE3_RESEARCH_WORKER_RUNTIME_VERIFIED"
].forEach((value) => includes(runtime, value, "Phase 3 runtime verifier"));

const spf = extractStrictFactCandidate("spf_value", "Official sunscreen SPF 50+ PA++++");
assert(spf?.normalizedValue === 50 && spf?.qualifier?.plus_modifier === "plus", "strict SPF extractor failed");
const uva = extractStrictFactCandidate("uva_label", "Official sunscreen SPF 50+ PA++++");
assert(uva?.normalizedValue === "PA++++", "strict UVA extractor failed");
const filter = extractStrictFactCandidate("uv_filter_type", "This is a 100% mineral sunscreen.");
assert(filter?.normalizedValue === "mineral", "strict UV filter extractor failed");
assert(extractStrictFactCandidate("uv_filter_type", "Ingredients: zinc oxide, titanium dioxide") === null,
  "ingredient list must not infer UV filter type");
assert(extractStrictFactCandidate("uva_label", "Broad Spectrum SPF 50") === null,
  "Broad Spectrum must not infer a PA label");
assert(extractStrictFactCandidate("barrier_support_claim", "supports skin barrier") === null,
  "unsupported marketing claim must not become a fact candidate");

for (const url of ["http://example.com", "https://127.0.0.1/test", "https://localhost/test"]) {
  let blocked = false;
  try { await assertSafeOfficialUrl(url); } catch { blocked = true; }
  assert(blocked, `unsafe URL was not blocked: ${url}`);
}

console.log("TRUST_PHASE3_RESEARCH_WORKER_CONTRACT_VERIFIED");
