import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  HOSTED_FAILURE_CATEGORIES,
  loadHostedManifest,
  parseHostedConfig,
  validateDeploymentAttestation
} from "./premium-hosted-preview-core-v2.mjs";
import {
  ensureSecureRunDirectories,
  hashFileSha256,
  secureWriteJson
} from "./premium-hosted-preview-security.mjs";
import { hashIdentifier, requireCondition } from "./premium-browser-journey-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const accountKey = process.env.PREMIUM_HOSTED_LOGIN_ACCOUNT === "B" ? "accountB" : "accountA";
const accountCode = accountKey === "accountB" ? "B" : "A";
const account = manifest[accountKey];
const loginPath = manifest.routes?.login || "/";
const callbackPath = manifest.routes?.authCallbackPrefix || "/auth/callback";
const signIn = manifest.googleSignInMarker;
const supabaseUrl = String(process.env.PREMIUM_HOSTED_SUPABASE_URL || "").trim();
const anonKey = String(process.env.PREMIUM_HOSTED_SUPABASE_ANON_KEY || "").trim();

const attestation = validateDeploymentAttestation(
  JSON.parse(await readFile(manifest.deploymentAttestationPath, "utf8")),
  {
    repository: "gycha0109-beep/K_beauty",
    prNumber: 38,
    headSha: config.expectedSha,
    vercelProjectId: manifest.vercelProjectId
  }
);
requireCondition(attestation.immutableHost === config.baseUrl.hostname, HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION, "google-login", "immutable_host_mismatch");
requireCondition(signIn?.role && signIn?.name, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "google-login", "google_signin_accessible_locator_missing");
requireCondition(supabaseUrl && anonKey, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "google-login", "supabase_public_config_missing");

await ensureSecureRunDirectories(config.securePaths);

function requireCredentialPath(path, code) {
  const target = resolve(path);
  const rel = relative(config.securePaths.credentialsDir, target);
  requireCondition(rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), HOSTED_FAILURE_CATEGORIES.CREDENTIAL_STORAGE, "google-login", code);
  return target;
}

const storageStatePath = requireCredentialPath(account.storageStatePath, "storage_state_path_outside_secure_root");
const loginEvidencePath = requireCredentialPath(account.loginEvidencePath, "login_evidence_path_outside_secure_root");

function createStorageStateSupabaseClient(storageState) {
  const cookies = Array.isArray(storageState?.cookies) ? storageState.cookies : [];
  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookies.map(({ name, value }) => ({ name, value }));
      },
      setAll() {}
    }
  });
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ serviceWorkers: "block" });
const page = await context.newPage();
try {
  await page.goto(`${config.baseUrl.origin}${loginPath}`, { waitUntil: "domcontentloaded" });
  requireCondition(new URL(page.url()).origin === config.baseUrl.origin, HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION, "google-login", "login_start_origin_mismatch");
  await page.getByRole(signIn.role, { name: signIn.name, exact: true }).click();
  await page.waitForURL(
    (url) => url.origin === config.baseUrl.origin && (url.pathname.startsWith(callbackPath) || url.pathname === (account.expectedAfterLoginPath || "/my")),
    { timeout: 180000 }
  );
  if (new URL(page.url()).pathname.startsWith(callbackPath)) {
    await page.waitForURL(
      (url) => url.origin === config.baseUrl.origin && url.pathname === (account.expectedAfterLoginPath || "/my"),
      { timeout: 60000 }
    );
  }
  const finalUrl = new URL(page.url());
  requireCondition(finalUrl.origin === config.baseUrl.origin, HOSTED_FAILURE_CATEGORIES.OAUTH, "google-login", "unexpected_oauth_origin");

  const storageState = await context.storageState();
  await secureWriteJson(storageStatePath, storageState);
  const storageStateHash = await hashFileSha256(storageStatePath);
  const supabase = createStorageStateSupabaseClient(storageState);
  const { data: { user }, error } = await supabase.auth.getUser();
  requireCondition(!error && user?.id, HOSTED_FAILURE_CATEGORIES.AUTH_EVIDENCE, "google-login", "authenticated_user_lookup_failed");
  requireCondition(user.is_anonymous !== true, HOSTED_FAILURE_CATEGORIES.AUTH_EVIDENCE, "google-login", "test_account_must_be_permanent");
  const googleProvider = user.app_metadata?.provider === "google" || (user.identities || []).some((identity) => identity?.provider === "google");
  requireCondition(googleProvider, HOSTED_FAILURE_CATEGORIES.AUTH_EVIDENCE, "google-login", "google_provider_not_confirmed");
  const userIdHash = hashIdentifier(user.id);
  requireCondition(userIdHash === account.expectedUserIdHash, HOSTED_FAILURE_CATEGORIES.AUTH_EVIDENCE, "google-login", "unexpected_test_account");

  const capturedAt = Date.now();
  const evidence = {
    schemaVersion: "premium-hosted-login-evidence-v2",
    status: "passed",
    accountKey: accountCode,
    userIdHash,
    permanentUser: true,
    providerCategory: "google",
    deploymentId: attestation.vercelDeploymentId,
    deploymentSha: attestation.prHeadSha,
    targetHost: attestation.immutableHost,
    finalPath: finalUrl.pathname,
    storageStateHash,
    createdAt: new Date(capturedAt).toISOString(),
    expiresAt: new Date(capturedAt + 30 * 60 * 1000).toISOString()
  };
  await secureWriteJson(loginEvidencePath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
