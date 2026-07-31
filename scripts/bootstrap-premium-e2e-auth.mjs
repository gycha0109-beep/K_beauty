import {
  FAILURE_CATEGORIES,
  JourneyFailure,
  requireCondition
} from "./premium-browser-journey-core.mjs";
import {
  LOCAL_PROFILE_A_PATH,
  LOCAL_PROFILE_B_PATH,
  LOCAL_STORAGE_A_PATH,
  LOCAL_STORAGE_B_PATH,
  assertAccountPair,
  assertGitWorktreeClean,
  ensureLocalRuntime,
  getGitBranch,
  parseCliArgs,
  readJsonIfPresent,
  resetLocalAuthProfiles,
  resolvePreviewConfiguration,
  saveBootstrapMetadata,
  writeConflictFixture,
  writeSyntheticImageFixture,
  LOCAL_CONFIG_PATH
} from "./premium-browser-journey-local-auth.mjs";
import { openManualSystemChromeSession } from "./premium-e2e-system-browser.mjs";
import { captureAccountSessionResilient } from "./premium-e2e-session-capture.mjs";

const args = parseCliArgs();
await ensureLocalRuntime();
assertGitWorktreeClean();
const resetAll = args["reset-profiles"] === true;
const resetA = resetAll || args["reset-a"] === true;
const resetB = resetAll || args["reset-b"] === true;
const requireDirectPreviewOAuth = args["require-direct-preview-oauth"] === true;
requireCondition(
  !requireDirectPreviewOAuth || (resetA && resetB),
  FAILURE_CATEGORIES.PRECONDITION,
  "local-auth",
  "direct_preview_oauth_requires_reset_profiles"
);
await resetLocalAuthProfiles({ resetA, resetB });
const storedConfig = await readJsonIfPresent(LOCAL_CONFIG_PATH);
const { baseUrl, environment, expectedHost } = resolvePreviewConfiguration({ args, storedConfig });
const branch = getGitBranch();
requireCondition(
  branch && !["main", "master"].includes(branch),
  FAILURE_CATEGORIES.PRECONDITION,
  "local-config",
  "preview_branch_invalid"
);
const previewBypassToken = String(
  args["preview-bypass-token"] || process.env.PREMIUM_E2E_PREVIEW_BYPASS_TOKEN || ""
).trim();

console.log(`Premium E2E 로그인 준비: ${baseUrl.origin}`);
console.log("비밀번호는 이 스크립트나 저장소에 입력하지 않습니다.");
console.log("Google 로그인은 Playwright가 아닌 일반 시스템 Chrome에서 수행합니다.");

async function captureOrLogin({ label, profilePath, storageStatePath, reset }) {
  if (!reset) {
    try {
      const existing = await captureAccountSessionResilient({
        label,
        profilePath,
        storageStatePath,
        baseUrl,
        previewBypassToken,
        timeoutMs: 1_500,
        allowCanonicalBridge: !requireDirectPreviewOAuth
      });
      console.log(`[${label}] 기존 로그인 세션을 재사용합니다.`);
      return existing;
    } catch (error) {
      if (error instanceof JourneyFailure && [
        "oauth_session_stored_on_different_host",
        "supabase_public_config_missing_for_cookie_capture"
      ].includes(error.code)) {
        throw error;
      }
    }
  }

  await openManualSystemChromeSession({
    label,
    profilePath,
    baseUrl,
    waitForClose: requireDirectPreviewOAuth
  });
  return captureAccountSessionResilient({
    label,
    profilePath,
    storageStatePath,
    baseUrl,
    previewBypassToken,
    allowCanonicalBridge: !requireDirectPreviewOAuth
  });
}

const accountA = await captureOrLogin({
  label: "A",
  profilePath: LOCAL_PROFILE_A_PATH,
  storageStatePath: LOCAL_STORAGE_A_PATH,
  reset: resetA
});
console.log(`[A] 로그인 확인 완료: ${accountA.userHash}`);

const accountB = await captureOrLogin({
  label: "B",
  profilePath: LOCAL_PROFILE_B_PATH,
  storageStatePath: LOCAL_STORAGE_B_PATH,
  reset: resetB
});
console.log(`[B] 로그인 확인 완료: ${accountB.userHash}`);

assertAccountPair(accountA, accountB);
requireCondition(
  !requireDirectPreviewOAuth ||
    (
      accountA.oauthSessionSource === "target_host" &&
      accountB.oauthSessionSource === "target_host"
    ),
  FAILURE_CATEGORIES.AUTH,
  "local-auth-pair",
  "direct_preview_oauth_not_proven"
);
await Promise.all([
  saveBootstrapMetadata({
    baseUrl,
    environment,
    expectedHost,
    branch,
    accountA,
    accountB,
    requireDirectPreviewOAuth
  }),
  writeConflictFixture(),
  writeSyntheticImageFixture()
]);

console.log(JSON.stringify({
  ok: true,
  targetHost: baseUrl.hostname,
  branch,
  accountAHash: accountA.userHash,
  accountBHash: accountB.userHash,
  oauthSessionSources: [
    accountA.oauthSessionSource,
    accountB.oauthSessionSource
  ],
  directPreviewOAuthRequired: requireDirectPreviewOAuth,
  distinctAccounts: true,
  nextCommand: "npm run e2e:premium:hosted"
}, null, 2));
