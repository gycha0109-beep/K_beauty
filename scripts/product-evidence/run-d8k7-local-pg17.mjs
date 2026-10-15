#!/usr/bin/env node
// Disposable PostgreSQL 17 Docker acceptance runner for D8K-7 (NO Supabase).
// Only launches/stops its own networkless, volume-free, randomly named
// container. NEVER reads .env, uses a configured DB URL, mounts a host path,
// invokes a hosted database or modifies a working Docker container.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const IMAGE = "postgres:17";
const CONTAINER = "bejewely-d8k7-" + process.pid + "-" + randomBytes(4).toString("hex");
const PRODUCT = "93000000-0000-4000-8000-000000000001";
const SQL_PATHS = Object.freeze([
  "tests/fixtures/product-offers/20260910102500_product_offers_runtime_seed.sql",
  "supabase/migrations/20260910103000_product_offers_shadow_v1.sql",
  "tests/fixtures/product-offers/20260913050000_product_offer_read_runtime_role_seed.sql",
  "supabase/migrations/20260913052338_data_offer16_offer_presentation_authority_read_v1.sql",
  "docs/taxonomy-ai/sql/d8k5-selected-option-evidence-schema-review-only.sql",
  "docs/taxonomy-ai/sql/d8k5-selected-option-private-read-review-only.sql",
  "tests/fixtures/product-offers/d8k7-selected-option-local-pg17.sql"
]);
const BOOTSTRAP = `
-- Roles which exist on Supabase but NOT in a vanilla, isolated PG17 image.
-- These are disposable placeholders for negative-privilege probes only.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit;
`;
let started = false;
let stopping = false;
const timeout = (label, seconds = 60) => ({
  label, timeout: seconds * 1000, maxBuffer: 8 * 1024 * 1024,
  encoding: "utf8", windowsHide: true
});
function docker(args, { input, allowFailure = false, seconds = 60 } = {}) {
  const { timeout: ms, maxBuffer, encoding, windowsHide } = timeout("docker", seconds);
  const result = spawnSync("docker", args, {
    encoding, windowsHide, timeout: ms, maxBuffer, input,
    shell: false
  });
  if (result.error) {
    if (allowFailure) return { status: -1, stdout: "", stderr: String(result.error) };
    throw new Error("DOCKER_NOT_AVAILABLE: " + result.error.message);
  }
  if (result.status !== 0 && !allowFailure) {
    const message = (result.stderr || result.stdout || "").trim().slice(0, 1500);
    throw new Error("DOCKER_COMMAND_FAILED (" + args[0] + "): " + message);
  }
  return result;
}
function sqlFile(rel) {
  if (!SQL_PATHS.includes(rel)) throw new Error("UNEXPECTED_SQL_FILE");
  const name = path.join(ROOT, rel);
  if (!existsSync(name)) throw new Error("MISSING_FILE: " + rel);
  const content = readFileSync(name, "utf8");
  if (!content.trim() || content.includes("\u0000")) throw new Error("SQL_INVALID: " + rel);
  return content;
}
function psql(sql, { expectedFailure = false } = {}) {
  const result = docker([
    "exec", "--user", "postgres", "-i", CONTAINER,
    "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres",
    "-d", "postgres", "-f", "-"
  ], { input: sql, allowFailure: expectedFailure, seconds: 100 });
  if (expectedFailure) {
    assert.notEqual(result.status, 0, "Expected SQL privilege refusal but query succeeded");
    assert.match(result.stderr, /permission denied for (table|function)/i,
      "Expected a real SQL permission denial, not a syntax or connection error");
  } else {
    assert.equal(result.status, 0);
  }
  return (result.stdout || "").trim();
}
function assertLocalDaemon() {
  const override = process.env.DOCKER_HOST;
  if (override && !/^(?:unix:\/\/|npipe:\/\/)/.test(override)) {
    throw new Error("REMOTE_DOCKER_HOST_FORBIDDEN");
  }
  const context = docker(["context", "inspect", "--format", "{{json .Endpoints}}"]);
  let endpoints;
  try { endpoints = JSON.parse(context.stdout.trim()); }
  catch { throw new Error("UNVERIFIED_DOCKER_CONTEXT"); }
  const host = endpoints?.docker?.Host;
  if (typeof host !== "string" || !/^(?:unix:\/\/|npipe:\/\/)/.test(host))
    throw new Error("REMOTE_OR_UNKNOWN_DOCKER_CONTEXT_FORBIDDEN: " + String(host));
  const os = docker(["info", "--format", "{{.OSType}}"]).stdout.trim();
  if (os !== "linux") throw new Error("DOCKER_LINUX_ENGINE_REQUIRED");
  // Docker image must already exist; no implicit pull or external network use.
  docker(["image", "inspect", IMAGE, "--format", "{{.Id}}"]);
}
function cleanup() {
  if (!started || stopping) return;
  stopping = true;
  docker(["rm", "--force", CONTAINER], { allowFailure: true, seconds: 15 });
  started = false;
}
process.on("SIGINT", () => { cleanup(); process.exit(130); });
process.on("SIGTERM", () => { cleanup(); process.exit(143); });

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Local-only disposable PG17 acceptance: node scripts/product-evidence/run-d8k7-local-pg17.mjs [--check-files]");
    console.log("First run: docker pull postgres:17  (using local Docker Desktop).");
    return;
  }
  if (args.some(x => x !== "--check-files")) throw new Error("UNKNOWN_ARGUMENT");
  for (const rel of SQL_PATHS) sqlFile(rel);
  // Guard accidental use of a corrupted proposal: only ONE committed
  // candidate schema transaction is allowed in the local test.
  const schema = sqlFile(SQL_PATHS[4]);
  assert.equal((schema.match(/^create table /gm) || []).length, 2);
  assert.equal((schema.match(/^commit;$/gm) || []).length, 1);
  assert.match(schema, /source_evidence_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
  const reader = sqlFile(SQL_PATHS[5]);
  assert.match(reader, /latest_review as \(/);
  assert.match(reader, /limit 257/);
  console.log("D8K7_CHECK_FILES_PASS (7 repository SQL files, 2 schema tables)");
  if (args.includes("--check-files")) return;

  assertLocalDaemon();
  try {
    console.log("Starting isolated " + IMAGE + " (network:none, no ports, no host mounts)...");
    docker([
      "run", "--detach", "--rm", "--pull=never", "--network=none",
      "--tmpfs", "/var/lib/postgresql/data:rw,size=268435456",
      "--name", CONTAINER,
      "--label", "bejewely.local-test=d8k7",
      "--env", "POSTGRES_PASSWORD=disposable-local-only",
      IMAGE
    ], { seconds: 60 });
    started = true;
    let ready = false;
    for (let i = 0; i < 80; i++) {
      const probe = docker([
        "exec", "--user", "postgres", CONTAINER, "pg_isready", "-q",
        "-U", "postgres", "-d", "postgres"
      ], { allowFailure: true, seconds: 10 });
      if (probe.status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("PG17_CONTAINER_NOT_READY");
    const version = psql("select current_setting('server_version_num')::integer / 10000 as major;");
    assert.match(version, /\b17\b/, "Expected PostgreSQL 17 image");

    psql(BOOTSTRAP);
    for (let i = 0; i < SQL_PATHS.length; i++) {
      console.log("PG17 applying local-only fixture " + (i + 1) + "/" + SQL_PATHS.length +
        ": " + SQL_PATHS[i]);
      const output = psql(sqlFile(SQL_PATHS[i]));
      if (i === SQL_PATHS.length - 1) {
        assert.match(output, /D8K7_PG17_SQL_ACCEPTANCE_PASS/);
        console.log("D8K7_PG17_SQL_ACCEPTANCE_PASS");
      }
    }

    const negative = [
      ["anon", "select count(*) from public.product_offer_option_observations;"],
      ["authenticated", "select count(*) from public.product_offer_option_reviews;"],
      ["service_role", "select count(*) from public.product_offer_option_observations;"],
      ["recommendation_admission_runtime",
        "select count(*) from public.product_offer_option_reviews;"],
      ["anon", "select public.read_selected_offer_option_evidence_v1(array['" + PRODUCT + "'::uuid]);"],
      ["authenticated", "select public.read_selected_offer_option_evidence_v1(array['" + PRODUCT + "'::uuid]);"],
      ["service_role", "select public.read_selected_offer_option_evidence_v1(array['" + PRODUCT + "'::uuid]);"]
    ];
    for (const [role, query] of negative) {
      psql("set role " + role + "; " + query, { expectedFailure: true });
      console.log("PG17_DENIED_AS_EXPECTED " + role);
    }
    const allowed = psql(`set role recommendation_admission_runtime;
select
  (public.read_selected_offer_option_evidence_v1(
    array['${PRODUCT}'::uuid])->>'status') = 'AUTHORITY_RESOLVED'
  and jsonb_array_length(public.read_selected_offer_option_evidence_v1(
    array['${PRODUCT}'::uuid])->'options') = 1 as allowed;`);
    assert.match(allowed, /\bt\b|\btrue\b/i, "Authorized internal role could not read one remaining option");
    console.log("D8K7_LOCAL_DOCKER_PG17_PASS");
    console.log("Validated: schema, latest-review revocation, no old-price fallback, shipping CHECK,");
    console.log("257-row cap, 64-product cap, client-role denial and internal-role positive read.");
  } finally {
    cleanup();
    console.log("Removed disposable local PG17 container.");
  }
}
main().catch(err => {
  cleanup();
  console.error("D8K7_LOCAL_DOCKER_PG17_FAIL:", err.message);
  process.exitCode = 1;
});
