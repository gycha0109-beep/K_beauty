import {
  FAILURE_CATEGORIES,
  requireCondition
} from "./premium-browser-journey-core.mjs";
import {
  LOCAL_PROFILE_A_PATH,
  LOCAL_PROFILE_B_PATH,
  LOCAL_STORAGE_A_PATH,
  LOCAL_STORAGE_B_PATH,
  assertAccountPair,
  captureAccountSession,
  ensureLocalRuntime,
  getGitBranch,
  parseCliArgs,
  readJsonIfPresent,
  resolvePreviewConfiguration,
  saveBootstrapMetadata,
  writeConflictFixture,
  writeSyntheticImageFixture,
  LOCAL_CONFIG_PATH
} from "./premium-browser-journey-local-auth.mjs";

const args = parseCliArgs();
await ensureLocalRuntime();
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

const accountA = await captureAccountSession({
  label: "A",
  profilePath: LOCAL_PROFILE_A_PATH,
  storageStatePath: LOCAL_STORAGE_A_PATH,
  baseUrl,
  previewBypassToken,
  interactive: true
});
console.log(`[A] 로그인 확인 완료: ${accountA.userHash}`);

const accountB = await captureAccountSession({
  label: "B",
  profilePath: LOCAL_PROFILE_B_PATH,
  storageStatePath: LOCAL_STORAGE_B_PATH,
  baseUrl,
  previewBypassToken,
  interactive: true
});
console.log(`[B] 로그인 확인 완료: ${accountB.userHash}`);

assertAccountPair(accountA, accountB);
await Promise.all([
  saveBootstrapMetadata({ baseUrl, environment, expectedHost, branch, accountA, accountB }),
  writeConflictFixture(),
  writeSyntheticImageFixture()
]);

console.log(JSON.stringify({
  ok: true,
  targetHost: baseUrl.hostname,
  branch,
  accountAHash: accountA.userHash,
  accountBHash: accountB.userHash,
  distinctAccounts: true,
  nextCommand: "npm run e2e:premium:hosted"
}, null, 2));
