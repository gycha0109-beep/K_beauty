import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DEDICATED_ACCOUNT_CONFIRMATION,
  FAILURE_CATEGORIES,
  JourneyFailure,
  createRunId,
  requireCondition
} from "./premium-browser-journey-core.mjs";
import {
  LOCAL_ARTIFACT_ROOT,
  LOCAL_CONFIG_PATH,
  LOCAL_CONFLICT_PATH,
  LOCAL_PROFILE_A_PATH,
  LOCAL_PROFILE_B_PATH,
  LOCAL_STORAGE_A_PATH,
  LOCAL_STORAGE_B_PATH,
  LOCAL_SYNTHETIC_IMAGE_PATH,
  assertAccountPair,
  captureAccountSession,
  ensureLocalRuntime,
  getGitBranch,
  loadBootstrapMetadata,
  parseCliArgs,
  readJsonIfPresent,
  resolveExpectedSha,
  resolvePreviewConfiguration,
  writeConflictFixture,
  writeSyntheticImageFixture
} from "./premium-browser-journey-local-auth.mjs";

function runNodeScript(path, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [path], {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      shell: false
    });
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      resolvePromise({ code: typeof code === "number" ? code : 1, signal: signal || null });
    });
  });
}

async function probePreview(baseUrl, previewBypassToken) {
  const headers = previewBypassToken
    ? {
        "x-vercel-protection-bypass": previewBypassToken,
        "x-vercel-set-bypass-cookie": "true"
      }
    : {};
  let response;
  try {
    response = await fetch(baseUrl.origin, { method: "GET", headers, redirect: "follow" });
  } catch {
    throw new JourneyFailure(FAILURE_CATEGORIES.INFRASTRUCTURE, "preview-probe", "preview_unreachable");
  }
  requireCondition(response.status < 400, FAILURE_CATEGORIES.INFRASTRUCTURE, "preview-probe", `preview_http_${response.status}`);
  return {
    status: response.status,
    vercelRequestIdPresent: Boolean(response.headers.get("x-vercel-id"))
  };
}

async function writeLocalSummary(artifactDir, value) {
  if (!existsSync(artifactDir)) return;
  await writeFile(
    resolve(artifactDir, "local-run-summary.json"),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

const args = parseCliArgs();
await ensureLocalRuntime();
const storedConfig = await readJsonIfPresent(LOCAL_CONFIG_PATH);
const { baseUrl, environment, expectedHost } = resolvePreviewConfiguration({ args, storedConfig });
const { expectedSha, deploymentSha, gitHead } = resolveExpectedSha(args);
const branch = getGitBranch();
requireCondition(
  branch && branch === storedConfig?.branch,
  FAILURE_CATEGORIES.PRECONDITION,
  "local-config",
  "current_branch_not_bootstrap_branch"
);
const bootstrapMetadata = await loadBootstrapMetadata(baseUrl);
const previewBypassToken = String(
  args["preview-bypass-token"] || process.env.PREMIUM_E2E_PREVIEW_BYPASS_TOKEN || ""
).trim();
const imagePath = resolve(
  String(args.image || process.env.PREMIUM_E2E_IMAGE_PATH || LOCAL_SYNTHETIC_IMAGE_PATH).trim()
);
const conflictPath = resolve(
  String(args.conflict || process.env.PREMIUM_E2E_CONFLICT_BODY_PATH || LOCAL_CONFLICT_PATH).trim()
);

if (!existsSync(imagePath) && imagePath === LOCAL_SYNTHETIC_IMAGE_PATH) {
  await writeSyntheticImageFixture();
}
if (!existsSync(conflictPath) && conflictPath === LOCAL_CONFLICT_PATH) {
  await writeConflictFixture();
}
requireCondition(existsSync(imagePath), FAILURE_CATEGORIES.PRECONDITION, "local-fixture", "image_fixture_missing");
requireCondition(existsSync(conflictPath), FAILURE_CATEGORIES.PRECONDITION, "local-fixture", "conflict_fixture_missing");

const previewProbe = await probePreview(baseUrl, previewBypassToken);
console.log(`Preview 확인 완료: ${baseUrl.origin} (HTTP ${previewProbe.status})`);
console.log(`검증 브랜치/SHA: ${branch} @ ${expectedSha}`);

for (const preflightPath of [
  resolve(process.cwd(), "scripts/check-premium-browser-journey-local.mjs"),
  resolve(process.cwd(), "scripts/verify-premium-browser-journey-contract.mjs")
]) {
  const preflightResult = await runNodeScript(preflightPath, process.env);
  requireCondition(
    preflightResult.code === 0,
    FAILURE_CATEGORIES.HARNESS,
    "local-preflight",
    "local_preflight_failed"
  );
}

let accountA;
let accountB;
try {
  accountA = await captureAccountSession({
    label: "A",
    profilePath: LOCAL_PROFILE_A_PATH,
    storageStatePath: LOCAL_STORAGE_A_PATH,
    baseUrl,
    previewBypassToken,
    interactive: false
  });
  accountB = await captureAccountSession({
    label: "B",
    profilePath: LOCAL_PROFILE_B_PATH,
    storageStatePath: LOCAL_STORAGE_B_PATH,
    baseUrl,
    previewBypassToken,
    interactive: false
  });
} catch (error) {
  if (error instanceof JourneyFailure && error.code === "interactive_login_or_session_refresh_required") {
    console.error("AUTH_EXPIRED: npm run e2e:premium:login 을 먼저 실행하십시오.");
  }
  throw error;
}

assertAccountPair(accountA, accountB);
requireCondition(
  accountA.userHash === bootstrapMetadata.accountAHash && accountB.userHash === bootstrapMetadata.accountBHash,
  FAILURE_CATEGORIES.AUTH,
  "local-auth-pair",
  "bootstrap_account_identity_changed"
);
requireCondition(
  accountA.supabaseUrl === accountB.supabaseUrl && accountA.anonKey === accountB.anonKey,
  FAILURE_CATEGORIES.AUTH,
  "local-auth-pair",
  "supabase_public_config_mismatch"
);

const runId = createRunId(args["run-id"] || process.env.PREMIUM_E2E_RUN_ID);
const artifactDir = resolve(LOCAL_ARTIFACT_ROOT, runId);
const commonEnv = {
  ...process.env,
  PREMIUM_E2E_BASE_URL: baseUrl.origin,
  PREMIUM_E2E_ENVIRONMENT: environment,
  PREMIUM_E2E_EXPECTED_HOST: expectedHost,
  PREMIUM_E2E_EXPECTED_SHA: expectedSha,
  PREMIUM_E2E_DEPLOYMENT_SHA: deploymentSha,
  PREMIUM_E2E_ACCESS_TOKEN: accountA.accessToken,
  PREMIUM_E2E_CONFLICT_ACCESS_TOKEN: accountB.accessToken,
  PREMIUM_E2E_EXPECTED_USER_ID_HASH: accountA.userHash,
  PREMIUM_E2E_EXPECTED_CONFLICT_USER_ID_HASH: accountB.userHash,
  PREMIUM_E2E_SUPABASE_URL: accountA.supabaseUrl,
  PREMIUM_E2E_SUPABASE_ANON_KEY: accountA.anonKey,
  PREMIUM_E2E_STORAGE_STATE_PATH: LOCAL_STORAGE_A_PATH,
  PREMIUM_E2E_IMAGE_PATH: imagePath,
  PREMIUM_E2E_CONFLICT_BODY_PATH: conflictPath,
  PREMIUM_E2E_DEDICATED_ACCOUNT_CONFIRMATION: DEDICATED_ACCOUNT_CONFIRMATION,
  PREMIUM_E2E_PREVIEW_BYPASS_TOKEN: previewBypassToken,
  PREMIUM_E2E_RUN_ID: runId,
  PREMIUM_E2E_ARTIFACT_ROOT: LOCAL_ARTIFACT_ROOT,
  PREMIUM_E2E_HEADLESS: args.headed ? "0" : "1"
};

const runnerPath = resolve(process.cwd(), "scripts/run-premium-browser-journey.mjs");
const cleanupPath = resolve(process.cwd(), "scripts/cleanup-premium-browser-journey.mjs");
const startedAt = new Date().toISOString();
const runtimeResult = await runNodeScript(runnerPath, commonEnv);
let cleanupResult = { attempted: false, code: null, required: false };
const persistencePath = resolve(artifactDir, "persistence-evidence.json");
const persistence = await readJsonIfPresent(persistencePath);

if (persistence?.cleanupRequired === true) {
  cleanupResult.required = true;
  cleanupResult.attempted = true;
  const cleanupEnv = {
    ...commonEnv,
    PREMIUM_E2E_ARTIFACT_DIR: artifactDir,
    PREMIUM_E2E_CLEANUP_CONFIRM: `DELETE_TEST_REPORTS_${runId}`
  };
  const childResult = await runNodeScript(cleanupPath, cleanupEnv);
  cleanupResult.code = childResult.code;
}

const completedAt = new Date().toISOString();
await writeLocalSummary(artifactDir, {
  schemaVersion: 1,
  runId,
  targetHost: baseUrl.hostname,
  branch,
  branchHead: gitHead,
  expectedSha,
  deploymentSha,
  deploymentShaSource: args["deployment-sha"] || process.env.PREMIUM_E2E_DEPLOYMENT_SHA
    ? "explicit"
    : "local_git_head_assertion",
  previewProbe,
  accountAHash: accountA.userHash,
  accountBHash: accountB.userHash,
  distinctAccounts: true,
  runtimeExitCode: runtimeResult.code,
  cleanup: cleanupResult,
  startedAt,
  completedAt
});

if (cleanupResult.required && cleanupResult.code !== 0) {
  console.error(JSON.stringify({
    ok: false,
    verdict: "CLEANUP_FAILURE",
    runId,
    artifactDir
  }, null, 2));
  process.exitCode = 2;
} else if (runtimeResult.code !== 0) {
  console.error(JSON.stringify({
    ok: false,
    verdict: "HOSTED_PREVIEW_FAILURE",
    runId,
    artifactDir,
    cleanupCompleted: cleanupResult.attempted ? cleanupResult.code === 0 : true
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    verdict: "HOSTED_PREVIEW_PASS",
    runId,
    artifactDir,
    cleanupCompleted: cleanupResult.required ? cleanupResult.code === 0 : true
  }, null, 2));
}
