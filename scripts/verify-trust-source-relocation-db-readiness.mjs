import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const contract = await readFile(
  new URL("../docs/evidence/trust-phase8h-governed-relocation-confirmation-contract-v1.md", import.meta.url),
  "utf8",
);
const migrationFiles = (await readdir(new URL("../supabase/migrations/", import.meta.url)))
  .filter((name) => name.endsWith(".sql"));

const relocationMigrations = [];
for (const name of migrationFiles) {
  const sql = await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
  if (
    sql.includes("admin_confirm_trust_official_source_relocation_v1")
    || sql.includes("trust_official_source_relocations")
  ) {
    relocationMigrations.push({ name, sql });
  }
}

assert.equal(
  relocationMigrations.length,
  0,
  "Phase 8H-2B deployable migration must not be hand-authored before Supabase CLI migration generation",
);

for (const required of [
  "public.trust_official_source_relocations",
  "prestate_digest",
  "relocation_plan_digest",
  "BEFORE UPDATE OR DELETE trigger rejects mutation",
  "RLS is enabled on the ledger",
  "grant `SELECT` only to `service_role`",
  "public.admin_confirm_trust_official_source_relocation_v1",
  "SECURITY DEFINER",
  "admin.products.review",
  "Retire the old binding only after the replacement review exists.",
  "Do not invent or hand-author a migration timestamp.",
]) {
  assert.equal(contract.includes(required), true, `missing DB readiness invariant: ${required}`);
}

console.log(JSON.stringify({
  status: "READY_FOR_CLI_GENERATED_MIGRATION",
  deployableMigrationCount: relocationMigrations.length,
  migrationProvenance: "SUPABASE_CLI_REQUIRED",
}, null, 2));
