import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "tmp", "trust-phase8i4g-isolated-e2e");
const MIGRATIONS = [
  "20260809115932_product_fact_storage_v1.sql",
  "20260810174400_product_fact_controlled_write_v1.sql",
  "20260810174410_product_fact_subject_registration_v1.sql",
  "20260910102000_product_source_bindings_v1.sql",
  "20260915095306_trust_phase1_intake_foundation_v1.sql",
  "20260915095333_trust_phase1_intake_delivery_hardening_v1.sql",
  "20260915095347_trust_phase1_promotion_decoupling_v1.sql",
  "20260915112124_trust_phase2_subject_resolution_v1.sql",
  "20260915112151_trust_phase2_presentation_scope_hardening_v1.sql",
  "20260915131141_trust_phase3_research_worker_v1.sql",
  "20260919194545_trust_phase6a_reentry_foundation_v1.sql",
  "20260922010350_trust_phase8b_source_verification_ledger_v1.sql",
  "20260922011229_trust_phase8c_revalidation_transition_v1.sql",
  "20260922011324_trust_phase8c_revalidation_transition_index_hardening_v1.sql",
  "20260922012833_trust_phase8c_prestate_binding_hardening_v1.sql",
  "20260924025307_trust_phase8g_source_verification_comparability_v1.sql",
  "20260926074409_trust_phase8h_governed_official_source_relocation_v1.sql",
  "20260928081244_trust_phase8i2_transport_foundation_v1.sql",
  "20260929045848_trust_phase8i3a_drift_case_bridge_v1.sql",
  "20260929110902_trust_phase8i4_grouped_relocation_v1.sql",
  "20260930090756_trust_phase8i4g_canary_read_boundary_v1.sql",
  "20260930212000_trust_phase8i4g_transport_incident_read_boundary_v1.sql",
];

const FIXTURES = [
  "tests/fixtures/trust-phase8i4g-e2e/20260925000000_trust_phase8i4g_e2e_review_fixture.sql",
  "tests/fixtures/trust-phase8i4g-e2e/20991231235959_trust_phase8i4g_e2e_seed.sql",
];

function fail(message) {
  throw new Error(message);
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
  fail("TRUST_PHASE8I4G_E2E_BASELINE_MATERIALIZATION_FAILED");
}

const configPath = path.join(OUTPUT, "supabase", "config.toml");
const config = await readFile(configPath, "utf8");
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
for (const relative of FIXTURES) {
  await copyFile(
    path.join(ROOT, relative),
    path.join(migrationDir, path.basename(relative)),
  );
}

const manifest = {
  contract: "trust-phase8i4g-isolated-e2e-runtime-v1",
  local_only: true,
  production_database_used: false,
  hosted_branch_used: false,
  post_baseline_migrations: MIGRATIONS,
  fixture_migrations: FIXTURES.map((value) => path.basename(value)),
};
await writeFile(
  path.join(OUTPUT, "trust-phase8i4g-e2e-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8",
);
process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
