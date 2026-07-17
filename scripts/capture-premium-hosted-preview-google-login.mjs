import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { HOSTED_FAILURE_CATEGORIES, loadHostedManifest, parseHostedConfig } from "./premium-hosted-preview-core.mjs";
import { requireCondition } from "./premium-browser-journey-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const accountKey = process.env.PREMIUM_HOSTED_LOGIN_ACCOUNT === "B" ? "accountB" : "accountA";
const account = manifest[accountKey];
const loginPath = manifest.routes?.login || "/";
const callbackPath = manifest.routes?.authCallbackPrefix || "/auth/callback";
const signInSelector = manifest.selectors?.googleSignIn;
requireCondition(signInSelector, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "google-login", "google_signin_selector_missing");
requireCondition(account.storageStatePath, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "google-login", "storage_state_output_missing");
requireCondition(account.loginEvidencePath, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "google-login", "login_evidence_output_missing");

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
try {
  await page.goto(`${config.baseUrl.origin}${loginPath}`, { waitUntil: "domcontentloaded" });
  await page.locator(signInSelector).click();
  await page.waitForURL((url) => url.origin === config.baseUrl.origin && (url.pathname.startsWith(callbackPath) || url.pathname === (account.expectedAfterLoginPath || "/my")), { timeout: 180000 });
  if (page.url().includes(callbackPath)) {
    await page.waitForURL((url) => url.origin === config.baseUrl.origin && url.pathname === (account.expectedAfterLoginPath || "/my"), { timeout: 60000 });
  }
  const finalUrl = new URL(page.url());
  requireCondition(finalUrl.origin === config.baseUrl.origin, HOSTED_FAILURE_CATEGORIES.OAUTH, "google-login", "unexpected_oauth_origin");
  await mkdir(dirname(resolve(account.storageStatePath)), { recursive: true });
  await mkdir(dirname(resolve(account.loginEvidencePath)), { recursive: true });
  await context.storageState({ path: account.storageStatePath });
  const evidence = {
    status: "passed",
    account: accountKey,
    targetHost: config.baseUrl.hostname,
    deploymentSha: config.deploymentSha,
    finalPath: finalUrl.pathname,
    capturedAt: new Date().toISOString()
  };
  await writeFile(resolve(account.loginEvidencePath), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
