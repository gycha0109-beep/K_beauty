import { spawn } from "node:child_process";
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
  LOCAL_STORAGE_A_PATH,
  LOCAL_STORAGE_B_PATH,
  assertAccountPair,
  assertGitWorktreeClean,
  ensureLocalRuntime,
  getGitBranch,
  loadBootstrapMetadata,
  parseCliArgs,
  readJsonIfPresent,
  resolveExpectedSha,
  resolvePreviewConfiguration,
  LOCAL_CONFIG_PATH
} from "./premium-browser-journey-local-auth.mjs";
import { captureAccountSessionResilient } from "./premium-e2e-session-capture.mjs";

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

const args = parseCliArgs();
await ensureLocalRuntime();
assertGitWorktreeClean();
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

const verifierResult = await runNodeScript(
  resolve(process.cwd(), "scripts/verify-my-adversarial-e2e-contract.mjs"),
  process.env
);
requireCondition(
  verifierResult.code === 0,
  FAILURE_CATEGORIES.HARNESS,
  "local-preflight",
  "my_adversarial_e2e_contract_failed"
);

let accountA;
let accountB;
try {
  accountA = await captureAccountSessionResilient({
    label: "A",
    profilePath: resolve(process.cwd(), ".codex/runtime/premium-e2e/profile-a"),
    storageStatePath: LOCAL_STORAGE_A_PATH,
    baseUrl,
    previewBypassToken
  });
  accountB = await captureAccountSessionResilient({
    label: "B",
    profilePath: resolve(process.cwd(), ".codex/runtime/premium-e2e/profile-b"),
    storageStatePath: LOCAL_STORAGE_B_PATH,
    baseUrl,
    previewBypassToken
  });
} catch (error) {
  if (error instanceof JourneyFailure && [
    "interactive_login_or_session_refresh_required",
    "target_host_auth_cookie_missing",
    "persisted_cookie_session_invalid_or_expired"
  ].includes(error.code)) {
    console.error("AUTH_EXPIRED: npm run e2e:my:login 을 먼저 실행하십시오.");
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

const runId = createRunId(args["run-id"] || process.env.MY_E2E_RUN_ID).replace(/^premium-e2e-/, "my-e2e-");
const env = {
  ...process.env,
  MY_E2E_BASE_URL: baseUrl.origin,
  MY_E2E_ENVIRONMENT: environment,
  MY_E2E_EXPECTED_HOST: expectedHost,
  MY_E2E_EXPECTED_SHA: expectedSha,
  MY_E2E_DEPLOYMENT_SHA: deploymentSha,
  MY_E2E_ACCESS_TOKEN_A: accountA.accessToken,
  MY_E2E_ACCESS_TOKEN_B: accountB.accessToken,
  MY_E2E_EXPECTED_USER_HASH_A: accountA.userHash,
  MY_E2E_EXPECTED_USER_HASH_B: accountB.userHash,
  MY_E2E_SUPABASE_URL: accountA.supabaseUrl,
  MY_E2E_SUPABASE_ANON_KEY: accountA.anonKey,
  MY_E2E_STORAGE_STATE_A: LOCAL_STORAGE_A_PATH,
  MY_E2E_STORAGE_STATE_B: LOCAL_STORAGE_B_PATH,
  MY_E2E_PREVIEW_BYPASS_TOKEN: previewBypassToken,
  MY_E2E_DEDICATED_ACCOUNT_CONFIRMATION: DEDICATED_ACCOUNT_CONFIRMATION,
  MY_E2E_RUN_ID: runId,
  MY_E2E_ARTIFACT_ROOT: resolve(LOCAL_ARTIFACT_ROOT, "my-adversarial"),
  MY_E2E_HEADLESS: args.headed ? "0" : "1"
};

console.log(`My adversarial E2E 대상: ${baseUrl.origin}`);
console.log(`검증 브랜치/SHA: ${branch} @ ${expectedSha}`);
const result = await runNodeScript(resolve(process.cwd(), "scripts/run-my-adversarial-e2e.mjs"), env);

console.log(JSON.stringify({
  ok: result.code === 0,
  verdict: result.code === 0 ? "MY_ADVERSARIAL_E2E_PASS" : "MY_ADVERSARIAL_E2E_FAIL",
  runId,
  branch,
  gitHead,
  expectedSha,
  deploymentSha
}, null, 2));

if (result.code !== 0) process.exitCode = result.code;
