import fs from "node:fs";
import {
  GPT_CATALOG_SUPPORTED_CATEGORIES,
  validateGptCatalogResearchInput
} from "../lib/trust/gpt-catalog-intake.mjs";

const migrationPath = "supabase/migrations/20261001183000_trust_gpt_catalog_intake_pipeline_v1.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const orchestrator = fs.readFileSync("scripts/trust-gpt-catalog-intake.mjs", "utf8");
const library = fs.readFileSync("lib/trust/gpt-catalog-intake.mjs", "utf8");
const materializer = fs.readFileSync("scripts/materialize-trust-gpt-catalog-intake-e2e.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/trust-gpt-catalog-intake.yml", "utf8");
const runtimeProof = fs.readFileSync("tests/fixtures/trust-gpt-catalog-intake/verify_runtime.sql", "utf8");

const required = [
  "create table if not exists public.gpt_catalog_intake_runs",
  "create or replace function public.ingest_gpt_catalog_product_v1",
  "create or replace function public.process_gpt_catalog_trust_product_pinned_v1",
  "create or replace function public.claim_gpt_catalog_research_tasks_v1",
  "grant execute on function public.ingest_gpt_catalog_product_v1(text,jsonb)",
  "to service_role",
  "product_fact_confirmation_allowed',false",
  "recommendation_admission_allowed',false",
  "UNSUPPORTED_TRUST_CATEGORY",
  "gpt-catalog-machine-subject-v1",
  "product-fact-subject-identity-v1",
  "gpt_official",
  "EVIDENCE_CANDIDATE"
];

for (const marker of required) {
  if (!migration.includes(marker) && !orchestrator.includes(marker)) {
    throw new Error(`missing_contract_marker:${marker}`);
  }
}

for (const forbidden of [
  "admin_confirm_product_fact_confirmation_v1(",
  "admin_confirm_trust_evidence",
  "recommendationRuntimeCutover = true",
  "recommendation_runtime_cutover',true",
  "domain:makeup','active'",
  "category:foundation','active'",
  "form:cushion','active'"
]) {
  if (migration.includes(forbidden) || orchestrator.includes(forbidden) || library.includes(forbidden)) {
    throw new Error(`forbidden_authority_marker:${forbidden}`);
  }
}

if (!migration.includes("revoke all on function public.ingest_gpt_catalog_product_v1(text,jsonb)\n  from public, anon, authenticated, service_role;")) {
  throw new Error("ingest_rpc_revoke_missing");
}
if (!migration.includes("grant execute on function public.ingest_gpt_catalog_product_v1(text,jsonb)\n  to service_role;")) {
  throw new Error("ingest_rpc_service_role_grant_missing");
}
if (!migration.includes("set search_path = ''")) {
  throw new Error("security_definer_empty_search_path_missing");
}
if (!orchestrator.includes("claim_gpt_catalog_research_tasks_v1")) {
  throw new Error("product_scoped_research_claim_missing");
}
if (!orchestrator.includes("automatic_confirmation: false")) {
  throw new Error("automatic_confirmation_boundary_missing");
}

if (!migration.includes("crawler-identity-resolution-v1")) {
  throw new Error("candidate_identity_resolution_version_not_canonical");
}
if (migration.includes("gpt-catalog-identity-v1")) {
  throw new Error("noncanonical_candidate_identity_resolution_version");
}
if (!migration.includes("gpt-catalog-identity-evidence-v1")) {
  throw new Error("gpt_identity_provenance_evidence_missing");
}

for (const marker of [
  "product-fact-registry-cross-category-v1",
  "process_catalog_trust_product_v3(uuid,text)",
  "process_catalog_trust_product_v2(uuid,text)",
  "process_gpt_catalog_trust_product_pinned_v1(v_product_id)"
]) {
  if (!migration.includes(marker)) {
    throw new Error(`registry_pinned_dispatch_marker_missing:${marker}`);
  }
}
if (migration.includes("perform public.process_catalog_trust_product_v1(v_product_id);")) {
  throw new Error("direct_legacy_trust_processor_call_forbidden");
}
if (!migration.includes("revoke all on function public.process_gpt_catalog_trust_product_pinned_v1(uuid)\n  from public, anon, authenticated, service_role;")) {
  throw new Error("registry_pinned_helper_revoke_missing");
}

for (const marker of [
  "materialize-product-fact-replay-baseline-v1.mjs",
  "20260822130309_crawler_canonical_adoption_authority_remediation_v1.sql",
  "cross-category-registry-v1.json",
  "20260909000000_trust_gpt_catalog_registry_fixture_v1.sql",
  "product-fact-subject-identity-v1",
  "20260914072000_data_taxonomy11_catalog_only_transactional_adoption_v1.sql",
  "20260915155618_data_taxonomy15_catalog_only_trust_intake_bridge_v1.sql",
  "20261001183000_trust_gpt_catalog_intake_pipeline_v1.sql",
  "production_database_used: false",
  "hosted_branch_used: false"
]) {
  if (!materializer.includes(marker)) {
    throw new Error(`isolated_materializer_marker_missing:${marker}`);
  }
}
for (const marker of [
  "scripts/materialize-trust-gpt-catalog-intake-e2e.mjs",
  '--workdir "$runtime_dir"',
  "DB_URL=",
  'psql "$TRUST_GPT_CATALOG_DB_URL"'
]) {
  if (!workflow.includes(marker)) {
    throw new Error(`isolated_workflow_marker_missing:${marker}`);
  }
}
if (workflow.includes("PGPASSWORD=postgres")) {
  throw new Error("hardcoded_local_database_password_forbidden");
}

for (const marker of [
  "GPT_E2E_AUTHENTICATED_INGEST_ALLOWED",
  "gpt-e2e-supported-sunscreen-isolation-001",
  "GPT_E2E_CROSS_PRODUCT_TASK_MUTATION",
  "GPT_E2E_PINNED_HELPER_SERVICE_ROLE_ALLOWED",
  "GPT_E2E_REGISTRY_PIN_DRIFT",
  "'cross_product_claim_isolation',true",
  "'registry_pinned_dispatch',true"
]) {
  if (!runtimeProof.includes(marker)) {
    throw new Error(`runtime_proof_marker_missing:${marker}`);
  }
}

const expectedCategories = [
  "cleanser",
  "toner_essence",
  "toner_pad",
  "treatment",
  "moisturizer",
  "moisturizer_lotion_emulsion",
  "moisturizer_gel",
  "moisturizer_cream",
  "moisturizer_balm",
  "sunscreen"
];
if (JSON.stringify(GPT_CATALOG_SUPPORTED_CATEGORIES) !== JSON.stringify(expectedCategories)) {
  throw new Error("supported_category_contract_drift");
}

const sample = validateGptCatalogResearchInput({
  request_id: "gpt-e2e-static-001",
  brand: "Example Brand",
  product_name: "Example Daily Sunscreen",
  category: "sunscreen",
  market: "KR",
  locale: "ko-KR",
  official_url: "https://example.com/products/example-daily-sunscreen",
  identity_evidence: {
    providers: [
      {
        provider: "brand_official",
        locator: "https://example.com/products/example-daily-sunscreen",
        canonical_brand: "Example Brand",
        canonical_name: "Example Daily Sunscreen"
      },
      {
        provider: "retailer_reference",
        locator: "https://retailer.example.org/example-daily-sunscreen",
        canonical_brand: "Example Brand",
        canonical_name: "Example Daily Sunscreen"
      }
    ]
  }
});
if (sample.payload.contract_version !== "gpt-catalog-research-v1") {
  throw new Error("input_contract_invalid");
}

let unsupportedAccepted = false;
try {
  validateGptCatalogResearchInput({
    request_id: "gpt-e2e-static-002",
    brand: "Example Brand",
    product_name: "Example Cushion",
    category: "foundation",
    market: "KR",
    official_url: "https://example.com/products/example-cushion",
    identity_evidence: {
      providers: [
        {
          provider: "brand_official",
          locator: "https://example.com/products/example-cushion",
          canonical_brand: "Example Brand",
          canonical_name: "Example Cushion"
        },
        {
          provider: "retailer_reference",
          locator: "https://retailer.example.org/example-cushion",
          canonical_brand: "Example Brand",
          canonical_name: "Example Cushion"
        }
      ]
    }
  });
  unsupportedAccepted = true;
} catch {
  unsupportedAccepted = false;
}
if (!unsupportedAccepted) {
  throw new Error("unsupported_category_must_reach_db_fail_closed_gate");
}

console.log(JSON.stringify({
  contract: "trust-gpt-catalog-intake-static-v1",
  result: "PASS",
  supported_categories: expectedCategories.length,
  automatic_confirmation: false,
  unsupported_makeup_activation: false,
  isolated_runtime_materializer: true,
  hardcoded_local_database_password: false,
  registry_pinned_dispatch: true
}));
