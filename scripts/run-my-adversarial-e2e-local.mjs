import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  DEDICATED_ACCOUNT_CONFIRMATION,
  FAILURE_CATEGORIES,
  JourneyFailure,
  createRunId,
  normalizeBaseUrl,
  requireCondition
} from "./premium-browser-journey-core.mjs";
import {
  LOCAL_ARTIFACT_ROOT,
  LOCAL_CONFIG_PATH,
  LOCAL_PROFILE_A_PATH,
  LOCAL_PROFILE_B_PATH,
  LOCAL_STORAGE_A_PATH,
  LOCAL_STORAGE_B_PATH,
  assertAccountPair,
  assertGitWorktreeClean,
  ensureLocalRuntime,
  getGitBranch,
  getGitHead,
  loadBootstrapMetadata,
  parseCliArgs,
  readJsonIfPresent
} from "./premium-browser-journey-local-auth.mjs";
import { captureAccountSessionResilient } from "./premium-e2e-session-capture.mjs";
import { resolveMyE2EPreviewDeployment } from "./my-e2e-vercel-preview.mjs";

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
const branch = getGitBranch();
const gitHead = getGitHead();
const requestedUrl = typeof args.url === "string" ? args.url : "";
const deployment = resolveMyE2EPreviewDeployment({ branch, gitHead, requestedUrl });
const baseUrl = normalizeBaseUrl(deployment.url);
const environment = "preview";
const expectedHost = deployment.hostname;
const expectedSha = gitHead;
const deploymentSha = deployment.gitSha;

if (typeof args.sha === "string") {
  requireCondition(args.sha === gitHead, FAILURE_CATEGORIES.PRECONDITION, "local-config", "expected_sha_not_local_head");
}
if (typeof args["deployment-sha"] === "string") {
  requireCondition(args["deployment-sha"] === deploymentSha, FAILURE_CATEGORIES.PRECONDITION, "local-config", "deployment_sha_not_attested_head");
}

requireCondition(
  branch && branch === storedConfig?.branch,
  FAILURE_CATEGORIES.PRECONDITION,
  "local-config",
  "current_branch_not_bootstrap_branch"
);
const storedBaseUrl = storedConfig?.baseUrl ? normalizeBaseUrl(storedConfig.baseUrl) : null;
if (!storedBaseUrl || storedBaseUrl.hostname !== deployment.hostname) {
  console.error("AUTH_TARGET_STALE: npm run e2e:my:login 을 실행해 현재 attested Preview에 인증을 다시 고정하십시오.");
}
requireCondition(
  storedBaseUrl && storedBaseUrl.hostname === deployment.hostname,
  FAILURE_CATEGORIES.PRECONDITION,
  "local-config",
  "bootstrap_target_not_current_attested_preview"
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
    profilePath: LOCAL_PROFILE_A_PATH,
    storageStatePath: LOCAL_STORAGE_A_PATH,
    baseUrl,
    previewBypassToken
  });
  accountB = await captureAccountSessionResilient({
    label: "B",
    profilePath: LOCAL_PROFILE_B_PATH,
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

console.log(`My adversarial E2E 대상(attested): ${baseUrl.origin}`);
console.log(`검증 브랜치/SHA: ${branch} @ ${expectedSha}`);
console.log(`Vercel attestation: ${deployment.attestationSource}`);

const rlsProbeResult = await runNodeScript(
  resolve(process.cwd(), "scripts/run-my-rls-adversarial-probe.mjs"),
  env
);
requireCondition(
  rlsProbeResult.code === 0,
  FAILURE_CATEGORIES.AUTH,
  "rls-adversarial-preflight",
  "collision_free_forged_owner_probe_failed"
);

const result = await runNodeScript(resolve(process.cwd(), "scripts/run-my-adversarial-e2e.mjs"), env);

console.log(JSON.stringify({
  ok: result.code === 0,
  verdict: result.code === 0 ? "MY_ADVERSARIAL_E2E_PASS" : "MY_ADVERSARIAL_E2E_FAIL",
  runId,
  branch,
  gitHead,
  expectedSha,
  deploymentSha,
  deploymentUrl: baseUrl.origin,
  deploymentAttestation: deployment.attestationSource,
  collisionFreeRlsProbe: rlsProbeResult.code === 0
}, null, 2));

if (result.code !== 0) process.exitCode = result.code;
