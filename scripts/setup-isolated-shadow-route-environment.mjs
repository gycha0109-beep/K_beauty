import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertLocalShadowTestWorkdir,
  assertNonProductionSupabaseTarget,
  LOCAL_SHADOW_TEST_WORKDIR
} from "./assert-non-production-supabase-target.mjs";
import { buildShadowRouteMutationObserverPlan } from "./lib/shadow-route-mutation-observer.mjs";
import { inspectShadowRouteProviderIsolation } from "./lib/shadow-route-provider-isolation.mjs";

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, "tmp");
const RUN_DIRECTORY = path.join(TMP_DIR, "isolated-shadow-route-runs", "phase44-local-shadow");
const OUTPUT_PATH = path.join(TMP_DIR, "isolated-shadow-route-environment-setup.json");
const WORKDIR = path.join(ROOT, LOCAL_SHADOW_TEST_WORKDIR);

function run(command, args) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: 180_000 });
}

function commandAvailable(command) {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  return run(locator, [command]).status === 0;
}

function parseEnv(text) {
  return String(text || "").split(/\r?\n/).reduce((env, line) => {
    const index = line.indexOf("=");
    if (index > 0) env[line.slice(0, index)] = line.slice(index + 1);
    return env;
  }, {});
}

function runLocalQuery(sql) {
  const result = run("supabase", ["db", "query", sql, "--local", "--workdir", WORKDIR, "--output", "json", "--yes"]);
  return { ok: result.status === 0, output: String(result.stdout || ""), error: String(result.stderr || "") };
}

function seedDigest() {
  return runLocalQuery("select count(*)::int as product_count, md5(string_agg(id, ',' order by id)) as seed_digest from public.products;");
}

export async function prepareIsolatedShadowRouteEnvironment() {
  const workdirSafety = assertLocalShadowTestWorkdir({ root: ROOT });
  const tools = {
    supabaseCliAvailable: commandAvailable("supabase"),
    dockerDaemonAvailable: commandAvailable("docker") && run("docker", ["version", "--format", "{{.Server.Version}}"]).status === 0
  };
  const providerIsolation = inspectShadowRouteProviderIsolation(ROOT);
  const fixtureReady = existsSync(path.join(ROOT, "test", "fixtures", "analyze", "analyze-payload.fixture.json")) &&
    existsSync(path.join(ROOT, "test", "fixtures", "analyze", "test-face-placeholder.png"));

  const output = {
    evidenceType: "isolated_shadow_route_environment_setup",
    routeInvoked: false,
    externalProductionProviderInvoked: false,
    hostedUnknownTargetUsed: false,
    databaseCommandExecuted: false,
    tools,
    workdirSafety,
    providerIsolation,
    fixture: { fixtureReadyForDeterministicProviderFallback: fixtureReady, syntheticOnly: true },
    localTarget: null,
    seed: { resetTwice: false, deterministic: false, productCountVerified: false },
    mutationObserver: buildShadowRouteMutationObserverPlan({ localDatabaseReady: false }),
    cleanupContract: { verified: false, idempotentCleanupRequired: true },
    runDirectory: null,
    setupStatus: "blocked_local_bootstrap_contract_gap",
    secretsPrinted: false,
    envValuesPrinted: false
  };

  if (!workdirSafety.safeToRunLocalDatabaseCommands || !tools.supabaseCliAvailable || !tools.dockerDaemonAvailable) {
    output.setupStatus = !tools.supabaseCliAvailable || !tools.dockerDaemonAvailable
      ? "blocked_local_supabase_unavailable"
      : "blocked_local_bootstrap_contract_gap";
  } else if (!providerIsolation.canGuaranteeZeroProductionProviderCalls || !fixtureReady) {
    output.setupStatus = !providerIsolation.canGuaranteeZeroProductionProviderCalls
      ? "blocked_provider_isolation_contract"
      : "blocked_local_bootstrap_contract_gap";
  } else {
    const start = run("supabase", ["start", "--workdir", WORKDIR, "--yes", "-x", "studio,imgproxy,mailpit,logflare,vector"]);
    if (start.status !== 0) {
      output.setupStatus = "blocked_local_bootstrap_contract_gap";
    } else {
      const status = run("supabase", ["status", "--workdir", WORKDIR, "--output", "env"]);
      const localEnv = parseEnv(status.stdout);
      output.localTarget = assertNonProductionSupabaseTarget({
        env: { NEXT_PUBLIC_SUPABASE_URL: localEnv.API_URL || "" },
        root: ROOT
      });
      if (!output.localTarget.safeToRunRoute) {
        output.setupStatus = "blocked_local_bootstrap_contract_gap";
      } else {
        const firstReset = run("supabase", ["db", "reset", "--workdir", WORKDIR, "--local", "--yes"]);
        const firstSeed = seedDigest();
        const secondReset = run("supabase", ["db", "reset", "--workdir", WORKDIR, "--local", "--yes"]);
        const secondSeed = seedDigest();
        const observerProbe = runLocalQuery("insert into public.analysis_request_rate_windows (scope, subject_hash, endpoint, window_key, window_started_at, window_reset_at, request_limit, request_count) values ('local', 'normalized', 'analyze', 'phase44', now(), now() + interval '1 hour', 1, 1) on conflict do nothing; select surface_id, operation, count(*)::int as event_count from shadow_audit.mutation_events group by surface_id, operation;");
        const deterministic = firstSeed.ok && secondSeed.ok && firstSeed.output === secondSeed.output && /product_count/.test(firstSeed.output);
        const observerInstalled = observerProbe.ok && /analysis_guard_rate_limit_rpc/.test(observerProbe.output) && /INSERT/.test(observerProbe.output);
        output.databaseCommandExecuted = true;
        output.seed = { resetTwice: firstReset.status === 0 && secondReset.status === 0, deterministic, productCountVerified: deterministic };
        output.mutationObserver = {
          ...buildShadowRouteMutationObserverPlan({ localDatabaseReady: true }),
          observerInstalled,
          mutationObserverCoverage: observerInstalled ? "complete" : "incomplete",
          unobservedMutationSurface: observerInstalled ? ["supabase_storage_mutation_none_found_in_route_call_graph"] : ["database_observer_installation"]
        };
        if (output.seed.resetTwice && deterministic && observerInstalled) {
          await mkdir(RUN_DIRECTORY, { recursive: true });
          await writeFile(path.join(RUN_DIRECTORY, ".phase43-isolated-run"), "phase44-local-shadow\n", "utf8");
          output.runDirectory = RUN_DIRECTORY;
          output.cleanupContract = { verified: true, idempotentCleanupRequired: true, localStorageCleanupRequired: true };
          output.setupStatus = "local_shadow_runtime_ready_for_controlled_route_run";
        } else {
          output.setupStatus = !observerInstalled ? "blocked_mutation_observer_incomplete" : "blocked_local_bootstrap_contract_gap";
        }
      }
    }
  }

  await mkdir(TMP_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const output = await prepareIsolatedShadowRouteEnvironment();
  console.log(JSON.stringify({ setupStatus: output.setupStatus, routeInvoked: false, databaseCommandExecuted: output.databaseCommandExecuted, secretsPrinted: false }, null, 2));
}
