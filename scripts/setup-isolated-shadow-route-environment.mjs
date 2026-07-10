import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertNonProductionSupabaseTarget,
  loadEnvForTargetAssertion
} from "./assert-non-production-supabase-target.mjs";
import { buildShadowRouteMutationObserverPlan } from "./lib/shadow-route-mutation-observer.mjs";
import { inspectShadowRouteProviderIsolation } from "./lib/shadow-route-provider-isolation.mjs";

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, "tmp");
const OUTPUT_PATH = path.join(TMP_DIR, "isolated-shadow-route-environment-setup.json");

function commandAvailable(command) {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(locator, [command], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15_000
  });
  return result.status === 0;
}

function commandRuns(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15_000
  });
  return result.status === 0;
}

function readMigrationSources() {
  const migrationDir = path.join(ROOT, "supabase", "migrations");
  if (!existsSync(migrationDir)) return [];
  return Array.from(
    new Set(
      spawnSync("git", ["ls-files", "supabase/migrations/*.sql"], {
        cwd: ROOT,
        encoding: "utf8",
        windowsHide: true
      }).stdout.split(/\r?\n/).filter(Boolean)
    )
  ).map((relativePath) => ({
    relativePath,
    source: readFileSync(path.join(ROOT, relativePath), "utf8")
  }));
}

function inspectMigrationReproducibility() {
  const migrations = readMigrationSources();
  const joined = migrations.map((item) => item.source).join("\n");
  const createsProducts = /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.products\b/i.test(joined);
  const altersProducts = /alter\s+table\s+public\.products\b/i.test(joined);
  const createsPremiumSessions = /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.premium_report_sessions\b/i.test(joined);
  const createsGuardTables =
    /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.analysis_request_rate_windows\b/i.test(joined) &&
    /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.analysis_request_idempotency\b/i.test(joined);
  const schemaReproducible = migrations.length > 0 && createsProducts && createsPremiumSessions && createsGuardTables;

  return {
    migrationCount: migrations.length,
    createsProducts,
    altersProducts,
    createsPremiumSessions,
    createsGuardTables,
    schemaReproducible,
    reasonCode: schemaReproducible
      ? "required_route_schema_migrations_present"
      : !createsProducts && altersProducts
        ? "missing_base_products_table_migration"
        : "required_route_schema_migration_incomplete"
  };
}

function inspectFixture() {
  const payloadPath = path.join(ROOT, "test", "fixtures", "analyze", "analyze-payload.fixture.json");
  const imagePath = path.join(ROOT, "test", "fixtures", "analyze", "test-face-placeholder.png");
  let payload = null;
  let payloadParseable = false;
  if (existsSync(payloadPath)) {
    try {
      payload = JSON.parse(readFileSync(payloadPath, "utf8"));
      payloadParseable = true;
    } catch {
      payloadParseable = false;
    }
  }
  const imageBytes = existsSync(imagePath) ? readFileSync(imagePath) : null;
  const pngSignatureValid = Boolean(
    imageBytes &&
    imageBytes.length >= 8 &&
    imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  );
  const requiredFields = [
    "skinType",
    "sensitivity",
    "mainConcern",
    "cleansingFrequency",
    "preferredTexture",
    "postWashFeeling",
    "afternoonSkinChange",
    "mostDislikedFeel"
  ];
  const fields = payload?.formFields || {};
  const payloadContractComplete = requiredFields.every((field) => typeof fields[field] === "string" && fields[field]);

  return {
    payloadFixturePresent: existsSync(payloadPath),
    payloadParseable,
    payloadContractComplete,
    imageFixturePresent: existsSync(imagePath),
    imageFixtureType: pngSignatureValid ? "synthetic_png_upload_boundary" : "invalid_or_missing",
    imageFixtureSemanticallySuitableForFaceAnalysis: false,
    fixtureReadyForDeterministicProviderFallback: payloadContractComplete && pngSignatureValid,
    userImageUsed: false,
    fixturePaths: {
      payload: "test/fixtures/analyze/analyze-payload.fixture.json",
      image: "test/fixtures/analyze/test-face-placeholder.png"
    }
  };
}

export async function prepareIsolatedShadowRouteEnvironment() {
  const currentTargetAssertion = assertNonProductionSupabaseTarget({
    env: loadEnvForTargetAssertion(path.join(ROOT, ".env.local")),
    root: ROOT
  });
  const tools = {
    supabaseCliAvailable: commandAvailable("supabase"),
    dockerDaemonAvailable:
      commandAvailable("docker") && commandRuns("docker", ["version", "--format", "{{.Server.Version}}"])
  };
  const localProject = {
    configPresent: existsSync(path.join(ROOT, "supabase", "config.toml")),
    seedPresent: existsSync(path.join(ROOT, "supabase", "seed.sql")),
    stateDirectoryPresent: existsSync(path.join(ROOT, ".supabase"))
  };
  const migrationReproducibility = inspectMigrationReproducibility();
  const providerIsolation = inspectShadowRouteProviderIsolation(ROOT);
  const fixture = inspectFixture();
  const localDatabaseReady =
    tools.supabaseCliAvailable &&
    tools.dockerDaemonAvailable &&
    localProject.configPresent &&
    migrationReproducibility.schemaReproducible;
  const mutationObserver = buildShadowRouteMutationObserverPlan({ localDatabaseReady });
  const cleanupContract = {
    contractDefined: true,
    localDatabaseResetRequired: true,
    localStorageCleanupRequired: true,
    localArtifactCleanupRestrictedToRunDirectory: true,
    idempotentCleanupRequired: true,
    executableNow: localDatabaseReady,
    verified: false,
    reasonCode: localDatabaseReady ? "cleanup_not_executed_before_run" : "no_reproducible_local_environment"
  };
  const allExecutionGatesReady = [
    localDatabaseReady,
    providerIsolation.canGuaranteeZeroProductionProviderCalls,
    fixture.fixtureReadyForDeterministicProviderFallback,
    mutationObserver.mutationObserverCoverage === "complete",
    cleanupContract.verified
  ].every(Boolean);

  const output = {
    generatedAt: new Date().toISOString(),
    evidenceType: "isolated_shadow_route_environment_setup",
    routeInvoked: false,
    databaseCommandExecuted: false,
    externalProductionProviderInvoked: false,
    hostedUnknownTargetUsed: false,
    currentConfiguredTarget: {
      targetType: currentTargetAssertion.targetType,
      safeToRunRoute: currentTargetAssertion.safeToRunRoute,
      productionBlocked: currentTargetAssertion.productionBlocked,
      reasonCode: currentTargetAssertion.reasonCode
    },
    selectedTarget: "local_supabase_candidate",
    tools,
    localProject,
    migrationReproducibility,
    providerIsolation,
    fixture,
    mutationObserver,
    cleanupContract,
    allExecutionGatesReady,
    setupStatus: !tools.supabaseCliAvailable || !tools.dockerDaemonAvailable
      ? "blocked_local_supabase_unavailable"
      : !migrationReproducibility.schemaReproducible || !localProject.configPresent
        ? "blocked_local_schema_not_reproducible"
        : !providerIsolation.canGuaranteeZeroProductionProviderCalls
          ? "blocked_needs_test_seam_approval"
          : "blocked_mutation_observer_incomplete",
    secretsPrinted: false,
    envValuesPrinted: false
  };

  await mkdir(TMP_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const output = await prepareIsolatedShadowRouteEnvironment();
  console.log("setup-isolated-shadow-route-environment summary");
  console.log(JSON.stringify({
    setupStatus: output.setupStatus,
    routeInvoked: output.routeInvoked,
    hostedUnknownTargetUsed: output.hostedUnknownTargetUsed,
    schemaReproducible: output.migrationReproducibility.schemaReproducible,
    providerIsolated: output.providerIsolation.canGuaranteeZeroProductionProviderCalls,
    observerCoverage: output.mutationObserver.mutationObserverCoverage,
    secretsPrinted: output.secretsPrinted
  }, null, 2));
}
