import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "tmp", "trust-gpt-catalog-intake-e2e");
const REGISTRY_SOURCE = path.join(
  ROOT,
  "evidence",
  "product-evidence-decision-axis-v1",
  "cross-category-registry-v1.json",
);
const REGISTRY_FIXTURE_MIGRATION = "20260909000000_trust_gpt_catalog_registry_fixture_v1.sql";
const MIGRATIONS = [
  "20260809115932_product_fact_storage_v1.sql",
  "20260810174400_product_fact_controlled_write_v1.sql",
  "20260810174410_product_fact_subject_registration_v1.sql",
  "20260822130309_crawler_canonical_adoption_authority_remediation_v1.sql",
  "20260910102000_product_source_bindings_v1.sql",
  "20260913201050_data_taxonomy1_shadow_catalog_taxonomy_foundation_v1.sql",
  "20260913201324_data_taxonomy1_shadow_catalog_taxonomy_hardening_v1.sql",
  "20260913202500_data_taxonomy2_candidate_manual_classification_v1.sql",
  "20260913210000_data_taxonomy2_production_adoption_reconcile_v1.sql",
  "20260913232300_data_taxonomy3_product_exact_equivalence_v1.sql",
  "20260914030000_data_taxonomy8_nullable_legacy_category_projection_v1.sql",
  "20260914072000_data_taxonomy11_catalog_only_transactional_adoption_v1.sql",
  "20260915095306_trust_phase1_intake_foundation_v1.sql",
  "20260915095333_trust_phase1_intake_delivery_hardening_v1.sql",
  "20260915095347_trust_phase1_promotion_decoupling_v1.sql",
  "20260915112124_trust_phase2_subject_resolution_v1.sql",
  "20260915112151_trust_phase2_presentation_scope_hardening_v1.sql",
  "20260915120000_data_taxonomy13_catalog_only_candidate_approval_v1.sql",
  "20260915131141_trust_phase3_research_worker_v1.sql",
  "20260915155618_data_taxonomy15_catalog_only_trust_intake_bridge_v1.sql",
  "20261001183000_trust_gpt_catalog_intake_pipeline_v1.sql",
];

function fail(message) {
  throw new Error(message);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const materialize = spawnSync(
  process.execPath,
  [
    "scripts/materialize-product-fact-replay-baseline-v1.mjs",
    `--output=${path.relative(ROOT, OUTPUT).replaceAll(path.sep, "/")}`,
  ],
  { cwd: ROOT, stdio: "inherit", windowsHide: true },
);
if (materialize.status !== 0) {
  fail("TRUST_GPT_CATALOG_E2E_BASELINE_MATERIALIZATION_FAILED");
}

const configPath = path.join(OUTPUT, "supabase", "config.toml");
const config = await readFile(configPath, "utf8");
if (!config.includes("major_version = 15")) {
  fail("TRUST_GPT_CATALOG_E2E_BASELINE_DB_VERSION_UNEXPECTED");
}
await writeFile(
  configPath,
  config.replace("major_version = 15", "major_version = 17"),
  "utf8",
);

const migrationDir = path.join(OUTPUT, "supabase", "migrations");
await mkdir(migrationDir, { recursive: true });

for (const name of MIGRATIONS) {
  await copyFile(
    path.join(ROOT, "supabase", "migrations", name),
    path.join(migrationDir, name),
  );
}

const registry = JSON.parse(await readFile(REGISTRY_SOURCE, "utf8"));
if (
  registry?.registry_version !== "product-fact-registry-cross-category-v1" ||
  !Array.isArray(registry?.facts) ||
  registry.facts.length === 0
) {
  fail("TRUST_GPT_CATALOG_E2E_REGISTRY_SOURCE_INVALID");
}

const requiredFactKeys = new Set([
  "low_ph",
  "deep_cleansing",
  "product_format",
  "contains_active",
  "active_concentration",
  "recommended_use_frequency",
  "wipe_off_use",
  "pad_surface_texture",
  "primary_use_role",
  "barrier_support_claim",
  "spf_value",
  "uva_label",
  "uv_filter_type",
]);
const registryFactKeys = new Set(registry.facts.map((fact) => fact.fact_key));
for (const factKey of requiredFactKeys) {
  if (!registryFactKeys.has(factKey)) {
    fail(`TRUST_GPT_CATALOG_E2E_REGISTRY_FACT_MISSING:${factKey}`);
  }
}

const registryJson = JSON.stringify(registry);
const definitionRows = registry.facts.map((fact) => {
  const definitionJson = JSON.stringify(fact);
  return [
    "(",
    sqlLiteral(registry.registry_version),
    ", ",
    sqlLiteral(fact.fact_key),
    ", ",
    sqlLiteral(fact.value_type),
    ", ",
    sqlLiteral(definitionJson),
    "::jsonb, ",
    "encode(extensions.digest(convert_to(",
    sqlLiteral(definitionJson),
    ", 'UTF8'), 'sha256'), 'hex'), false, null)",
  ].join("");
}).join(",\n  ");

const registryFixtureSql = [
  "-- GENERATED FROM evidence/product-evidence-decision-axis-v1/cross-category-registry-v1.json.",
  "-- TEST / LOCAL REPLAY ONLY. NOT A PRODUCTION MIGRATION.",
  "begin;",
  "",
  "insert into public.product_fact_registry_versions (",
  "  registry_version, registry_checksum, identity_serializer_version, effective_at",
  ") values (",
  `  ${sqlLiteral(registry.registry_version)},`,
  `  encode(extensions.digest(convert_to(${sqlLiteral(registryJson)}, 'UTF8'), 'sha256'), 'hex'),`,
  "  'product-fact-subject-identity-v1',",
  "  null",
  ")",
  "on conflict (registry_version) do nothing;",
  "",
  "insert into public.product_fact_definition_snapshots (",
  "  registry_version, fact_key, value_type, definition, definition_checksum, deprecated, superseded_by_fact_key",
  ") values",
  `  ${definitionRows}`,
  "on conflict (registry_version, fact_key) do nothing;",
  "",
  "commit;",
  "",
].join("\n");

await writeFile(
  path.join(migrationDir, REGISTRY_FIXTURE_MIGRATION),
  registryFixtureSql,
  "utf8",
);

const manifest = {
  contract: "trust-gpt-catalog-intake-isolated-e2e-runtime-v1",
  local_only: true,
  production_database_used: false,
  hosted_branch_used: false,
  baseline_materializer: "product-fact-local-replay-baseline-v1",
  registry_fixture_source: path.relative(ROOT, REGISTRY_SOURCE).replaceAll(path.sep, "/"),
  registry_fixture_migration: REGISTRY_FIXTURE_MIGRATION,
  registry_fixture_fact_count: registry.facts.length,
  post_baseline_migrations: MIGRATIONS,
};
await writeFile(
  path.join(OUTPUT, "trust-gpt-catalog-intake-e2e-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8",
);
process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
