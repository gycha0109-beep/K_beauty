import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.local");
const NON_PRODUCTION_VALUES = new Set(["dev", "development", "test", "testing", "local", "preview"]);
export const LOCAL_SHADOW_TEST_WORKDIR = "supabase/local-shadow-test";

export function loadEnvForTargetAssertion(envPath = ENV_PATH) {
  return existsSync(envPath) ? dotenv.parse(readFileSync(envPath)) : {};
}

function isLoopbackHost(hostname) {
  return ["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(hostname);
}

function hasNonProductionMarker(env) {
  return ["SUPABASE_ENVIRONMENT", "APP_ENV", "DEPLOYMENT_ENV", "SHADOW_TEST_ENVIRONMENT"].some(
    (key) => NON_PRODUCTION_VALUES.has(String(env[key] || "").trim().toLowerCase())
  );
}

export function assertNonProductionSupabaseTarget({ env = {}, root = ROOT } = {}) {
  const configuredUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
  const explicitAllow = env.SHADOW_ROUTE_NON_PRODUCTION_TARGET === "1";
  const disposableMarker = env.SHADOW_TEST_DB_DISPOSABLE === "1";
  const markerPresent = hasNonProductionMarker(env);
  const localConfigPresent = ["supabase/config.toml", ".supabase/config.toml"].some((file) =>
    existsSync(path.join(root, file))
  );

  if (!configuredUrl) {
    return {
      checked: true,
      safeToRunRoute: false,
      targetType: "missing_target",
      reasonCode: "supabase_target_not_configured",
      secretsPrinted: false,
      productionBlocked: true
    };
  }

  let hostname = "";
  try {
    hostname = new URL(configuredUrl).hostname.toLowerCase();
  } catch {
    return {
      checked: true,
      safeToRunRoute: false,
      targetType: "unparseable_target",
      reasonCode: "supabase_target_unparseable",
      secretsPrinted: false,
      productionBlocked: true
    };
  }

  if (isLoopbackHost(hostname)) {
    return {
      checked: true,
      safeToRunRoute: true,
      targetType: localConfigPresent ? "local_supabase_configured" : "local_loopback_target",
      reasonCode: "local_target_allowed",
      secretsPrinted: false,
      productionBlocked: false
    };
  }

  if (explicitAllow && disposableMarker && markerPresent) {
    return {
      checked: true,
      safeToRunRoute: true,
      targetType: "hosted_disposable_nonproduction_allowlisted",
      reasonCode: "explicit_disposable_nonproduction_allowlist",
      secretsPrinted: false,
      productionBlocked: false
    };
  }

  return {
    checked: true,
    safeToRunRoute: false,
    targetType: "hosted_unknown",
    reasonCode: "hosted_target_without_disposable_nonproduction_allowlist",
    secretsPrinted: false,
    productionBlocked: true
  };
}

export function assertLocalShadowTestWorkdir({ root = ROOT } = {}) {
  const workdir = path.resolve(root, LOCAL_SHADOW_TEST_WORKDIR);
  const rootPath = path.resolve(root);
  const configPath = path.join(workdir, "config.toml");
  const migrationPath = path.join(workdir, "migrations", "00000000000000_local_shadow_bootstrap.sql");
  const seedPath = path.join(workdir, "seed.sql");
  const insideRoot = workdir.startsWith(`${rootPath}${path.sep}`);
  const configSource = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const safeProjectId = /project_id\s*=\s*"local-shadow-test"/.test(configSource);

  return {
    checked: true,
    safeToRunLocalDatabaseCommands: insideRoot && safeProjectId && existsSync(migrationPath) && existsSync(seedPath),
    targetType: insideRoot && safeProjectId ? "loopback_disposable_local_shadow_test" : "local_shadow_test_unconfigured",
    reasonCode:
      insideRoot && safeProjectId && existsSync(migrationPath) && existsSync(seedPath)
        ? "local_shadow_test_workdir_verified"
        : "local_shadow_test_workdir_incomplete",
    workdir: LOCAL_SHADOW_TEST_WORKDIR,
    secretsPrinted: false,
    productionBlocked: true
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = assertNonProductionSupabaseTarget({ env: loadEnvForTargetAssertion() });
  console.log("assert-non-production-supabase-target summary");
  console.log(JSON.stringify(result, null, 2));
}
