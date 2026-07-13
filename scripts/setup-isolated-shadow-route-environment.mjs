import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
const EXPECTED_SYNTHETIC_PRODUCT_COUNT = 5;
const SEED_SUMMARY_MARKER = "LOCAL_SHADOW_SEED_SUMMARY";
const OBSERVER_SUMMARY_MARKER = "LOCAL_SHADOW_OBSERVER_SUMMARY";
const LOCAL_DB_CONTAINER = "supabase_db_local-shadow-test";

function sanitizeDiagnosticText(value) {
  const sanitized = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[redacted]@")
    .replace(/\b(?:postgres(?:ql)?|https?):\/\/[^\s"']+/gi, "[redacted-url]")
    .replace(/\beyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){2}\b/g, "[redacted-jwt]")
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/gi, "[redacted-supabase-key]")
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted-provider-key]")
    .replace(
      /(([A-Z0-9_]*(?:KEY|SECRET|TOKEN)[A-Z0-9_]*)\s*["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi,
      "$1[redacted]"
    )
    .trim();

  return sanitized ? sanitized.slice(-2000) : null;
}

function summarizeCommand(result) {
  return {
    exitCode: Number.isInteger(result?.status) ? result.status : null,
    timedOut: result?.error?.code === "ETIMEDOUT",
    sanitizedStderr: sanitizeDiagnosticText(result?.stderr)
  };
}

function summarizeLastError(value) {
  const lines = String(sanitizeDiagnosticText(value) || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(-8).join("\n") || null;
}

function parseSeedSummary(output) {
  const normalized = String(output || "").replace(/\r\n?/g, "\n");
  const match = normalized.match(
    new RegExp(`${SEED_SUMMARY_MARKER}\\|(\\d+)\\|([0-9a-f]{32}|none)`, "i")
  );

  if (!match) {
    return null;
  }

  return {
    productCount: Number.parseInt(match[1], 10),
    seedDigest: match[2].toLowerCase() === "none" ? null : match[2].toLowerCase()
  };
}

function parseObserverSummary(output) {
  const normalized = String(output || "").replace(/\r\n?/g, "\n");
  const match = normalized.match(
    new RegExp(`${OBSERVER_SUMMARY_MARKER}\\|(\\d+)\\|(\\d+)`, "i")
  );

  if (!match) {
    return null;
  }

  return {
    matchingInsertEventCount: Number.parseInt(match[1], 10),
    totalEventCount: Number.parseInt(match[2], 10)
  };
}

function resolveWindowsSupabaseScript() {
  const located = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "(Get-Command supabase -ErrorAction Stop).Source"],
    { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: 30_000 }
  );
  const scriptPath = String(located.stdout || "").trim();
  return located.status === 0 && scriptPath.toLowerCase().endsWith(".ps1") ? scriptPath : null;
}

function run(command, args, timeout = 180_000) {
  const options = {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: timeout
  };
  if (command === "supabase" && process.platform === "win32") {
    const scriptPath = resolveWindowsSupabaseScript();
    if (!scriptPath) {
      return { status: null, stdout: "", stderr: "", error: new Error("supabase_powershell_script_unavailable") };
    }
    return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", scriptPath, ...args], options);
  }
  return spawnSync(command, args, options);
}

function commandAvailable(command) {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  return run(locator, [command], 600_000).status === 0;
}

function resolveLocalApiUrl() {
  const configPath = path.join(WORKDIR, "supabase", "config.toml");
  const config = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const apiBlock = config.match(/\[api\]([\s\S]*?)(?=\n\[|$)/);
  const port = apiBlock?.[1]?.match(/^\s*port\s*=\s*(\d+)\s*$/m)?.[1];
  return port ? `http://127.0.0.1:${port}` : "";
}

function stopLocalStack() {
  return run("supabase", ["--workdir", WORKDIR, "stop", "--no-backup", "--yes"], 600_000);
}

function runLocalQuery(sql) {
  const result = run("supabase", ["--workdir", WORKDIR, "db", "query", "--local", sql], 600_000);
  return {
    ok: result.status === 0,
    output: String(result.stdout || ""),
    command: summarizeCommand(result)
  };
}

function captureResetFailureDiagnostics(phase) {
  const logs = run("docker", ["logs", "--tail", "80", LOCAL_DB_CONTAINER], 30_000);
  return {
    phase,
    containerLogCommand: summarizeCommand(logs),
    lastCoreError: summarizeLastError(`${logs.stdout || ""}\n${logs.stderr || ""}`)
  };
}

function seedDigest() {
  return runLocalQuery(`
    select format(
      '${SEED_SUMMARY_MARKER}|%s|%s',
      count(*)::int,
      coalesce(md5(string_agg(id, ',' order by id)), 'none')
    ) as seed_summary
    from public.products;
  `);
}

export async function prepareIsolatedShadowRouteEnvironment() {
  const workdirSafety = assertLocalShadowTestWorkdir({ root: ROOT });
  const tools = {
    supabaseCliAvailable: commandAvailable("supabase"),
    dockerDaemonAvailable: commandAvailable("docker") && run("docker", ["version", "--format", "{{.Server.Version}}"], 600_000).status === 0
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
    seed: {
      expectedProductCount: EXPECTED_SYNTHETIC_PRODUCT_COUNT,
      resetTwice: false,
      productCountVerified: false,
      digestVerified: false,
      deterministic: false,
      first: null,
      second: null
    },
    mutationObserver: buildShadowRouteMutationObserverPlan({ localDatabaseReady: false }),
    cleanupContract: { verified: false, idempotentCleanupRequired: true },
    commands: {},
    predicates: {},
    resetFailureDiagnostics: null,
    runDirectory: null,
    setupStatus: "blocked_local_bootstrap_contract_gap",
    reasonCode: "setup_not_started",
    secretsPrinted: false,
    envValuesPrinted: false
  };
  let canContinue = true;
  let startAttempted = false;
  let firstResetSucceeded = false;
  let secondResetSucceeded = false;

  const block = (setupStatus, reasonCode) => {
    output.setupStatus = setupStatus;
    output.reasonCode = reasonCode;
    canContinue = false;
  };

  if (!workdirSafety.safeToRunLocalDatabaseCommands) {
    block("blocked_local_bootstrap_contract_gap", "blocked_local_workdir_safety");
  } else if (!tools.supabaseCliAvailable) {
    block("blocked_local_supabase_unavailable", "blocked_supabase_cli_unavailable");
  } else if (!tools.dockerDaemonAvailable) {
    block("blocked_local_supabase_unavailable", "blocked_docker_daemon_unavailable");
  } else if (!providerIsolation.canGuaranteeZeroProductionProviderCalls) {
    block("blocked_provider_isolation_contract", "blocked_provider_isolation_contract");
  } else if (!fixtureReady) {
    block("blocked_local_bootstrap_contract_gap", "blocked_fixture_contract");
  }

  if (canContinue) {
    startAttempted = true;
    const start = run("supabase", ["--workdir", WORKDIR, "start", "--yes", "-x", "studio,imgproxy,mailpit,logflare,vector"], 600_000);
    output.commands.start = summarizeCommand(start);
    if (start.status !== 0) {
      block("blocked_local_bootstrap_contract_gap", "blocked_local_stack_start");
    }
  }

  if (canContinue) {
    const status = run("supabase", ["--workdir", WORKDIR, "status", "--output", "env"], 600_000);
    output.commands.status = summarizeCommand(status);
    output.localTarget = assertNonProductionSupabaseTarget({
      env: { NEXT_PUBLIC_SUPABASE_URL: resolveLocalApiUrl() },
      root: ROOT
    });
    if (status.status !== 0) {
      block("blocked_local_bootstrap_contract_gap", "blocked_local_stack_status");
    } else if (!output.localTarget.safeToRunRoute) {
      block("blocked_local_bootstrap_contract_gap", `blocked_local_target_${output.localTarget.reasonCode}`);
    }
  }

  let firstSeedSummary = null;
  let secondSeedSummary = null;

  if (canContinue) {
    output.databaseCommandExecuted = true;
    const firstReset = run("supabase", ["--workdir", WORKDIR, "db", "reset", "--local", "--yes"], 600_000);
    output.commands.firstReset = summarizeCommand(firstReset);
    firstResetSucceeded = firstReset.status === 0;
    if (firstReset.status !== 0) {
      output.resetFailureDiagnostics = captureResetFailureDiagnostics("first");
      block("blocked_local_bootstrap_contract_gap", "blocked_first_local_reset");
    }
  }

  if (canContinue) {
    const firstSeed = seedDigest();
    output.commands.firstSeedQuery = firstSeed.command;
    firstSeedSummary = firstSeed.ok ? parseSeedSummary(firstSeed.output) : null;
    if (!firstSeed.ok) {
      block("blocked_local_bootstrap_contract_gap", "blocked_first_seed_query");
    } else if (!firstSeedSummary) {
      block("blocked_local_bootstrap_contract_gap", "blocked_first_seed_summary_parse");
    }
  }

  if (canContinue) {
    const secondReset = run("supabase", ["--workdir", WORKDIR, "db", "reset", "--local", "--yes"], 600_000);
    output.commands.secondReset = summarizeCommand(secondReset);
    secondResetSucceeded = secondReset.status === 0;
    if (secondReset.status !== 0) {
      output.resetFailureDiagnostics = captureResetFailureDiagnostics("second");
      block("blocked_local_bootstrap_contract_gap", "blocked_second_local_reset");
    }
  }

  if (canContinue) {
    const secondSeed = seedDigest();
    output.commands.secondSeedQuery = secondSeed.command;
    secondSeedSummary = secondSeed.ok ? parseSeedSummary(secondSeed.output) : null;
    if (!secondSeed.ok) {
      block("blocked_local_bootstrap_contract_gap", "blocked_second_seed_query");
    } else if (!secondSeedSummary) {
      block("blocked_local_bootstrap_contract_gap", "blocked_second_seed_summary_parse");
    }
  }

  if (firstSeedSummary || secondSeedSummary) {
    const resetTwice = firstResetSucceeded && secondResetSucceeded;
    const productCountVerified =
      firstSeedSummary?.productCount === EXPECTED_SYNTHETIC_PRODUCT_COUNT &&
      secondSeedSummary?.productCount === EXPECTED_SYNTHETIC_PRODUCT_COUNT;
    const digestVerified = Boolean(firstSeedSummary?.seedDigest && secondSeedSummary?.seedDigest);
    const deterministic = digestVerified && firstSeedSummary.seedDigest === secondSeedSummary.seedDigest;

    output.seed = {
      expectedProductCount: EXPECTED_SYNTHETIC_PRODUCT_COUNT,
      resetTwice,
      productCountVerified,
      digestVerified,
      deterministic,
      first: firstSeedSummary
        ? { productCount: firstSeedSummary.productCount }
        : null,
      second: secondSeedSummary
        ? { productCount: secondSeedSummary.productCount }
        : null
    };

    if (canContinue && !productCountVerified) {
      block("blocked_local_bootstrap_contract_gap", "blocked_seed_product_count_mismatch");
    } else if (canContinue && !digestVerified) {
      block("blocked_local_bootstrap_contract_gap", "blocked_seed_digest_missing");
    } else if (canContinue && !deterministic) {
      block("blocked_local_bootstrap_contract_gap", "blocked_seed_digest_mismatch");
    }
  }

  let observerSummary = null;
  if (canContinue) {
    const observerQueries = [
      {
        evidenceKey: "observerCleanupRowQuery",
        reasonCode: "blocked_observer_cleanup_row_query",
        sql: `
          delete from public.analysis_request_rate_windows
          where scope = 'local'
            and subject_hash = 'normalized'
            and endpoint = 'analyze'
            and window_key = 'phase44';
        `
      },
      {
        evidenceKey: "observerCleanupEventsQuery",
        reasonCode: "blocked_observer_cleanup_events_query",
        sql: "delete from shadow_audit.mutation_events;"
      },
      {
        evidenceKey: "observerMutationQuery",
        reasonCode: "blocked_observer_mutation_query",
        sql: `
          insert into public.analysis_request_rate_windows (
            scope,
            subject_hash,
            endpoint,
            window_key,
            window_started_at,
            window_reset_at,
            request_limit,
            request_count
          ) values (
            'local',
            'normalized',
            'analyze',
            'phase44',
            now(),
            now() + interval '1 hour',
            1,
            1
          );
        `
      },
      {
        evidenceKey: "observerReadQuery",
        reasonCode: "blocked_observer_read_query",
        sql: `
          select format(
            '${OBSERVER_SUMMARY_MARKER}|%s|%s',
            count(*) filter (
              where surface_id = 'analysis_guard_rate_limit_rpc'
                and upper(operation) = 'INSERT'
            ),
            count(*)
          ) as observer_summary
          from shadow_audit.mutation_events;
        `
      }
    ];

    for (const query of observerQueries) {
      const result = runLocalQuery(query.sql);
      output.commands[query.evidenceKey] = result.command;
      if (!result.ok) {
        block("blocked_mutation_observer_incomplete", query.reasonCode);
        break;
      }
      if (query.evidenceKey === "observerReadQuery") {
        observerSummary = parseObserverSummary(result.output);
      }
    }
  }

  if (canContinue) {
    const observerInstalled = observerSummary?.matchingInsertEventCount === 1;
    output.mutationObserver = {
      ...buildShadowRouteMutationObserverPlan({ localDatabaseReady: true }),
      observerInstalled,
      observerSummary: observerSummary
        ? {
            matchingInsertEventCount: observerSummary.matchingInsertEventCount,
            totalEventCount: observerSummary.totalEventCount
          }
        : null,
      mutationObserverCoverage: observerInstalled ? "complete" : "incomplete",
      unobservedMutationSurface: observerInstalled
        ? ["supabase_storage_mutation_none_found_in_route_call_graph"]
        : ["database_observer_installation"]
    };

    if (!observerSummary) {
      block("blocked_mutation_observer_incomplete", "blocked_observer_summary_parse");
    } else if (!observerInstalled) {
      block("blocked_mutation_observer_incomplete", "blocked_observer_insert_event_count");
    }
  }

  if (canContinue) {
    await mkdir(RUN_DIRECTORY, { recursive: true });
    await writeFile(path.join(RUN_DIRECTORY, ".phase43-isolated-run"), "phase44-local-shadow\n", "utf8");
    output.runDirectory = RUN_DIRECTORY;
    output.cleanupContract = { verified: true, idempotentCleanupRequired: true, localStorageCleanupRequired: true };
    output.setupStatus = "local_shadow_runtime_ready_for_controlled_route_run";
    output.reasonCode = "local_shadow_runtime_ready";
  } else if (startAttempted) {
    const cleanup = stopLocalStack();
    output.commands.failureCleanup = summarizeCommand(cleanup);
  }

  await mkdir(TMP_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const output = await prepareIsolatedShadowRouteEnvironment();
  console.log(JSON.stringify({ setupStatus: output.setupStatus, reasonCode: output.reasonCode, routeInvoked: false, databaseCommandExecuted: output.databaseCommandExecuted, secretsPrinted: false }, null, 2));
}
