import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import {
  FAILURE_CATEGORIES,
  JourneyFailure,
  fetchAuthUser,
  hashIdentifier,
  inspectStorageState,
  normalizeBaseUrl,
  requireCondition
} from "./premium-browser-journey-core.mjs";

export const LOCAL_RUNTIME_ROOT = resolve(process.cwd(), ".codex/runtime/premium-e2e");
export const LOCAL_CONFIG_PATH = resolve(LOCAL_RUNTIME_ROOT, "config.json");
export const LOCAL_ACCOUNT_METADATA_PATH = resolve(LOCAL_RUNTIME_ROOT, "account-metadata.json");
export const LOCAL_PROFILE_A_PATH = resolve(LOCAL_RUNTIME_ROOT, "profile-a");
export const LOCAL_PROFILE_B_PATH = resolve(LOCAL_RUNTIME_ROOT, "profile-b");
export const LOCAL_STORAGE_A_PATH = resolve(LOCAL_RUNTIME_ROOT, "account-a-storage-state.json");
export const LOCAL_STORAGE_B_PATH = resolve(LOCAL_RUNTIME_ROOT, "account-b-storage-state.json");
export const LOCAL_CONFLICT_PATH = resolve(LOCAL_RUNTIME_ROOT, "conflict-body.json");
export const LOCAL_SYNTHETIC_IMAGE_PATH = resolve(LOCAL_RUNTIME_ROOT, "synthetic-face-fixture.png");
export const LOCAL_ARTIFACT_ROOT = resolve(LOCAL_RUNTIME_ROOT, "artifacts");

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const AUTH_CAPTURE_PATH = "/auth/v1/user";

export function parseCliArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const separatorIndex = value.indexOf("=");
    if (separatorIndex > 2) {
      args[value.slice(2, separatorIndex)] = value.slice(separatorIndex + 1);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export async function ensureLocalRuntime() {
  await Promise.all([
    mkdir(LOCAL_RUNTIME_ROOT, { recursive: true }),
    mkdir(LOCAL_PROFILE_A_PATH, { recursive: true }),
    mkdir(LOCAL_PROFILE_B_PATH, { recursive: true }),
    mkdir(LOCAL_ARTIFACT_ROOT, { recursive: true })
  ]);
}

export async function readJsonIfPresent(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new JourneyFailure(FAILURE_CATEGORIES.PRECONDITION, "local-config", "local_json_invalid");
  }
}

export async function writePrivateJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function getGitHead() {
  try {
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    requireCondition(SHA_PATTERN.test(head), FAILURE_CATEGORIES.PRECONDITION, "git", "git_head_invalid");
    return head;
  } catch (error) {
    if (error instanceof JourneyFailure) throw error;
    throw new JourneyFailure(FAILURE_CATEGORIES.PRECONDITION, "git", "git_head_unavailable");
  }
}

export function getGitBranch() {
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

export function resolvePreviewConfiguration({ args, storedConfig }) {
  const rawBaseUrl = String(
    args.url || process.env.PREMIUM_E2E_BASE_URL || storedConfig?.baseUrl || ""
  ).trim();
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const environment = String(
    args.environment || process.env.PREMIUM_E2E_ENVIRONMENT || storedConfig?.environment || "preview"
  ).trim();
  requireCondition(environment === "preview", FAILURE_CATEGORIES.PRECONDITION, "local-config", "local_runner_preview_only");
  const expectedHost = String(
    args.host || process.env.PREMIUM_E2E_EXPECTED_HOST || storedConfig?.expectedHost || baseUrl.hostname
  ).trim();
  requireCondition(expectedHost === baseUrl.hostname, FAILURE_CATEGORIES.PRECONDITION, "local-config", "local_expected_host_mismatch");
  return { baseUrl, environment, expectedHost };
}

export function resolveExpectedSha(args) {
  const gitHead = getGitHead();
  const expectedSha = String(
    args.sha || process.env.PREMIUM_E2E_EXPECTED_SHA || gitHead
  ).trim();
  const deploymentSha = String(
    args["deployment-sha"] || process.env.PREMIUM_E2E_DEPLOYMENT_SHA || expectedSha
  ).trim();
  requireCondition(SHA_PATTERN.test(expectedSha), FAILURE_CATEGORIES.PRECONDITION, "local-config", "expected_sha_invalid");
  requireCondition(SHA_PATTERN.test(deploymentSha), FAILURE_CATEGORIES.PRECONDITION, "local-config", "deployment_sha_invalid");
  requireCondition(expectedSha === gitHead, FAILURE_CATEGORIES.PRECONDITION, "local-config", "expected_sha_not_local_head");
  requireCondition(deploymentSha === expectedSha, FAILURE_CATEGORIES.PRECONDITION, "local-config", "deployment_sha_mismatch");
  return { expectedSha, deploymentSha, gitHead };
}

function createDeferred() {
  let settled = false;
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolveValue, rejectValue) => {
    resolvePromise = resolveValue;
    rejectPromise = rejectValue;
  });
  return {
    promise,
    get settled() {
      return settled;
    },
    resolve(value) {
      if (settled) return;
      settled = true;
      resolvePromise(value);
    },
    reject(error) {
      if (settled) return;
      settled = true;
      rejectPromise(error);
    }
  };
}

function getPreviewHeaders(previewBypassToken) {
  return previewBypassToken
    ? {
        "x-vercel-protection-bypass": previewBypassToken,
        "x-vercel-set-bypass-cookie": "true"
      }
    : {};
}

function sanitizeBearerHeader(value) {
  const normalized = String(value || "").trim();
  if (!/^Bearer\s+\S+$/i.test(normalized)) return "";
  return normalized.replace(/^Bearer\s+/i, "").trim();
}

async function inspectAuthRequest(request, deferred) {
  let url;
  try {
    url = new URL(request.url());
  } catch {
    return;
  }
  if (url.pathname !== AUTH_CAPTURE_PATH) return;
  const headers = await request.allHeaders().catch(() => ({}));
  const accessToken = sanitizeBearerHeader(headers.authorization);
  const anonKey = String(headers.apikey || "").trim();
  if (!accessToken || !anonKey) return;
  deferred.resolve({
    accessToken,
    anonKey,
    supabaseUrl: url.origin
  });
}

function attachAuthCapture(page, deferred) {
  page.on("request", (request) => {
    void inspectAuthRequest(request, deferred);
  });
}

function cookieMatchesTargetHost(cookie, targetHost) {
  const domain = String(cookie?.domain || "").trim().replace(/^\./, "").toLowerCase();
  const host = String(targetHost || "").trim().toLowerCase();
  return Boolean(domain && host && (host === domain || host.endsWith(`.${domain}`)));
}

async function triggerPostLoginAuthLookup({ context, page, baseUrl, deferred, timeoutMs, label }) {
  const deadline = Date.now() + timeoutMs;
  while (!deferred.settled && Date.now() < deadline) {
    const cookies = await context.cookies(baseUrl.origin).catch(() => []);
    const hasTargetAuthCookie = cookies.some((cookie) =>
      String(cookie?.name || "").includes("auth-token") && cookieMatchesTargetHost(cookie, baseUrl.hostname)
    );
    if (hasTargetAuthCookie) {
      await page.goto(baseUrl.origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
      return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  if (!deferred.settled) {
    deferred.reject(new JourneyFailure(
      FAILURE_CATEGORIES.AUTH,
      `local-auth-${label}`,
      "interactive_login_or_session_refresh_required"
    ));
  }
}

async function waitForCapturedSession(deferred, timeoutMs, label) {
  const timeout = setTimeout(() => {
    deferred.reject(new JourneyFailure(
      FAILURE_CATEGORIES.AUTH,
      `local-auth-${label}`,
      "interactive_login_or_session_refresh_required"
    ));
  }, timeoutMs);
  try {
    return await deferred.promise;
  } finally {
    clearTimeout(timeout);
  }
}

export async function captureAccountSession({
  label,
  profilePath,
  storageStatePath,
  baseUrl,
  previewBypassToken = "",
  interactive = false,
  timeoutMs = interactive ? 10 * 60 * 1000 : 45 * 1000
}) {
  const deferred = createDeferred();
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: !interactive,
    viewport: { width: 1365, height: 900 }
  });
  context.on("page", (page) => attachAuthCapture(page, deferred));
  for (const page of context.pages()) attachAuthCapture(page, deferred);

  try {
    const page = context.pages()[0] || await context.newPage();
    if (previewBypassToken) {
      const bypassResponse = await context.request.get(baseUrl.origin, {
        headers: getPreviewHeaders(previewBypassToken),
        timeout: 60_000
      });
      requireCondition(
        bypassResponse.status() < 400,
        FAILURE_CATEGORIES.INFRASTRUCTURE,
        `local-auth-${label}`,
        "preview_bypass_failed"
      );
    }
    await page.goto(baseUrl.origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (interactive) {
      console.log(`[${label}] 브라우저에서 전용 Google 테스트 계정으로 로그인하십시오. 로그인 완료를 자동 감지합니다.`);
      void triggerPostLoginAuthLookup({ context, page, baseUrl, deferred, timeoutMs, label }).catch(() => {
        deferred.reject(new JourneyFailure(
          FAILURE_CATEGORIES.AUTH,
          `local-auth-${label}`,
          "post_login_auth_lookup_failed"
        ));
      });
    }
    const captured = await waitForCapturedSession(deferred, timeoutMs, label);
    const user = await fetchAuthUser({
      supabaseUrl: captured.supabaseUrl,
      anonKey: captured.anonKey,
      accessToken: captured.accessToken
    });
    const providers = Array.isArray(user?.app_metadata?.providers)
      ? user.app_metadata.providers
      : [user?.app_metadata?.provider].filter(Boolean);
    requireCondition(
      user?.is_anonymous === false,
      FAILURE_CATEGORIES.AUTH,
      `local-auth-${label}`,
      "test_account_must_be_permanent"
    );
    requireCondition(
      providers.includes("google"),
      FAILURE_CATEGORIES.AUTH,
      `local-auth-${label}`,
      "test_account_must_use_google"
    );
    const storageState = await context.storageState({ path: storageStatePath });
    inspectStorageState(storageState, baseUrl.hostname);
    return {
      accessToken: captured.accessToken,
      anonKey: captured.anonKey,
      supabaseUrl: captured.supabaseUrl,
      userId: user.id,
      userHash: hashIdentifier(user.id),
      provider: "google",
      storageStatePath
    };
  } finally {
    await context.close();
  }
}

export async function writeConflictFixture() {
  const conflict = {
    ko: {
      currentProducts: [
        { category: "sunscreen", status: "not_using" }
      ]
    },
    en: {
      currentProducts: [
        { category: "sunscreen", status: "not_using" }
      ]
    }
  };
  await writePrivateJson(LOCAL_CONFLICT_PATH, conflict);
  return LOCAL_CONFLICT_PATH;
}

export async function writeSyntheticImageFixture() {
  if (existsSync(LOCAL_SYNTHETIC_IMAGE_PATH)) return LOCAL_SYNTHETIC_IMAGE_PATH;
  const { default: sharp } = await import("sharp");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768">
      <rect width="768" height="768" fill="#f7eee8"/>
      <ellipse cx="384" cy="390" rx="220" ry="275" fill="#d7a68f"/>
      <ellipse cx="300" cy="350" rx="30" ry="18" fill="#3f2b27"/>
      <ellipse cx="468" cy="350" rx="30" ry="18" fill="#3f2b27"/>
      <path d="M384 370 C360 420 360 450 395 455" fill="none" stroke="#855c50" stroke-width="14" stroke-linecap="round"/>
      <path d="M310 520 C355 555 415 555 458 520" fill="none" stroke="#9b4d58" stroke-width="16" stroke-linecap="round"/>
      <circle cx="265" cy="430" r="42" fill="#d98986" opacity="0.45"/>
      <circle cx="503" cy="430" r="42" fill="#d98986" opacity="0.45"/>
      <path d="M190 300 C210 135 330 90 384 95 C495 85 585 185 578 315 C535 235 465 190 380 190 C300 190 230 230 190 300" fill="#4b342f"/>
    </svg>
  `.trim();
  await sharp(Buffer.from(svg)).png().toFile(LOCAL_SYNTHETIC_IMAGE_PATH);
  return LOCAL_SYNTHETIC_IMAGE_PATH;
}

export function assertAccountPair(accountA, accountB) {
  requireCondition(
    accountA.userId !== accountB.userId,
    FAILURE_CATEGORIES.AUTH,
    "local-auth-pair",
    "test_accounts_must_be_distinct"
  );
  requireCondition(
    accountA.supabaseUrl === accountB.supabaseUrl && accountA.anonKey === accountB.anonKey,
    FAILURE_CATEGORIES.AUTH,
    "local-auth-pair",
    "test_accounts_project_mismatch"
  );
}

export async function saveBootstrapMetadata({ baseUrl, environment, expectedHost, branch, accountA, accountB }) {
  requireCondition(branch && !["main", "master"].includes(branch), FAILURE_CATEGORIES.PRECONDITION, "local-config", "preview_branch_invalid");
  await writePrivateJson(LOCAL_CONFIG_PATH, {
    schemaVersion: 1,
    baseUrl: baseUrl.origin,
    environment,
    expectedHost,
    branch,
    updatedAt: new Date().toISOString()
  });
  await writePrivateJson(LOCAL_ACCOUNT_METADATA_PATH, {
    schemaVersion: 1,
    targetHost: baseUrl.hostname,
    accountAHash: accountA.userHash,
    accountBHash: accountB.userHash,
    providers: [accountA.provider, accountB.provider],
    distinctAccounts: accountA.userId !== accountB.userId,
    updatedAt: new Date().toISOString()
  });
}

export async function loadBootstrapMetadata(baseUrl) {
  const metadata = await readJsonIfPresent(LOCAL_ACCOUNT_METADATA_PATH);
  requireCondition(metadata, FAILURE_CATEGORIES.PRECONDITION, "local-auth", "bootstrap_metadata_missing");
  requireCondition(
    metadata.targetHost === baseUrl.hostname,
    FAILURE_CATEGORIES.PRECONDITION,
    "local-auth",
    "bootstrap_target_host_mismatch"
  );
  requireCondition(
    metadata.distinctAccounts === true && metadata.accountAHash && metadata.accountBHash,
    FAILURE_CATEGORIES.PRECONDITION,
    "local-auth",
    "bootstrap_account_pair_invalid"
  );
  return metadata;
}
