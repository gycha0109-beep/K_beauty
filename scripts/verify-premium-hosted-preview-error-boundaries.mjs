import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import {
  HOSTED_FAILURE_CATEGORIES,
  loadDeploymentAttestation,
  loadHostedManifest,
  parseHostedConfig,
  validateDeploymentAttestation
} from "./premium-hosted-preview-core-v2.mjs";
import { assertPathInside } from "./premium-hosted-preview-security.mjs";
import { parseApiResponse, requireCondition } from "./premium-browser-journey-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const attestation = await loadDeploymentAttestation(config, manifest);
const accountBToken = String(process.env.PREMIUM_HOSTED_ACCOUNT_B_ACCESS_TOKEN || "").trim();
const accountASavedReportId = String(process.env.PREMIUM_HOSTED_ACCOUNT_A_SAVED_REPORT_ID || "").trim();
const lanes = [];
const allowedProtectionCookies = new Set(["_vercel_jwt", "__vercel_live_token"]);

async function lane(name, severity, fn) {
  try {
    const evidence = await fn();
    lanes.push({ name, severity, status: "passed", evidence });
  } catch (error) {
    lanes.push({ name, severity, status: "failed", errorCode: error?.code || "assertion_failed" });
    throw error;
  }
}

function isAllowedBootstrapCookie(cookie) {
  const name = String(cookie?.name || "");
  return name.includes("auth-token") || allowedProtectionCookies.has(name);
}

async function accountBContext(browser) {
  const path = assertPathInside(config.securePaths.credentialsDir, manifest.accountB.storageStatePath, "account_b_storage_state_outside_secure_root");
  const state = JSON.parse(await readFile(path, "utf8"));
  const cookies = Array.isArray(state.cookies) ? state.cookies.filter(isAllowedBootstrapCookie) : [];
  requireCondition(cookies.some((cookie) => String(cookie.name || "").includes("auth-token")), HOSTED_FAILURE_CATEGORIES.AUTH, "error-boundaries", "account_b_auth_cookie_missing");
  return browser.newContext({ storageState: { cookies, origins: [] }, serviceWorkers: "block" });
}

async function postWithoutRedirect(context, url, options) {
  return context.request.post(url, { ...options, maxRedirects: 0 });
}

const browser = await chromium.launch({ headless: true });
try {
  const anonymous = await browser.newContext({ serviceWorkers: "block" });
  await lane("unauthenticated", "critical", async () => {
    const response = await postWithoutRedirect(anonymous, `${config.baseUrl.origin}/api/full-report`, { data: { locale: "ko" } });
    const parsed = await parseApiResponse(response);
    requireCondition(parsed.status === 401, HOSTED_FAILURE_CATEGORIES.AUTH, "unauthenticated", "unauthenticated_not_rejected");
    return { status: parsed.status, errorCode: parsed.body?.error || null };
  });
  await anonymous.close();

  requireCondition(accountBToken, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "forbidden", "account_b_token_missing");
  const accountB = await accountBContext(browser);
  await lane("forbidden", "critical", async () => {
    const response = await postWithoutRedirect(accountB, `${config.baseUrl.origin}/api/full-report`, {
      headers: { Authorization: `Bearer ${accountBToken}` },
      data: { locale: "ko" }
    });
    const parsed = await parseApiResponse(response);
    requireCondition([402, 403].includes(parsed.status), HOSTED_FAILURE_CATEGORIES.PREMIUM_ACCESS, "forbidden", "forbidden_account_not_rejected");
    return { status: parsed.status, errorCode: parsed.body?.error || null };
  });

  requireCondition(accountASavedReportId, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "ownership", "account_a_saved_report_missing");
  await lane("ownership", "critical", async () => {
    const response = await postWithoutRedirect(accountB, `${config.baseUrl.origin}/api/full-report`, {
      headers: { Authorization: `Bearer ${accountBToken}` },
      data: { savedReportId: accountASavedReportId, locale: "ko" }
    });
    const parsed = await parseApiResponse(response);
    requireCondition(parsed.status === 401, HOSTED_FAILURE_CATEGORIES.AUTH, "ownership", "foreign_saved_report_exposed");
    return { status: parsed.status, errorCode: parsed.body?.error || null };
  });
  await accountB.close();

  const fault = manifest.faultCase || {};
  requireCondition(
    fault.attestationPath && fault.prNumber && fault.expectedSha && fault.vercelProjectId,
    HOSTED_FAILURE_CATEGORIES.PRECONDITION,
    "safe-5xx",
    "fault_preview_attestation_missing"
  );
  const faultAttestation = validateDeploymentAttestation(
    JSON.parse(await readFile(fault.attestationPath, "utf8")),
    {
      repository: "gycha0109-beep/K_beauty",
      prNumber: fault.prNumber,
      headSha: fault.expectedSha,
      vercelProjectId: fault.vercelProjectId
    }
  );
  requireCondition(
    faultAttestation.vercelDeploymentId !== attestation.vercelDeploymentId &&
      faultAttestation.immutableHost !== attestation.immutableHost,
    HOSTED_FAILURE_CATEGORIES.PRECONDITION,
    "safe-5xx",
    "fault_preview_not_isolated"
  );
  const faultUrl = new URL(faultAttestation.immutableUrl);
  await lane("safe-5xx", "important", async () => {
    const response = await fetch(`${faultUrl.origin}${fault.path || "/api/full-report"}`, {
      method: fault.method || "POST",
      redirect: "manual",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fault.body || { locale: "ko" })
    });
    requireCondition(![301, 302, 303, 307, 308].includes(response.status), HOSTED_FAILURE_CATEGORIES.ERROR_HANDLING, "safe-5xx", "fault_preview_redirected");
    const text = await response.text();
    requireCondition(response.status >= 500 && response.status <= 599, HOSTED_FAILURE_CATEGORIES.ERROR_HANDLING, "safe-5xx", "fault_preview_did_not_fail");
    requireCondition(!/(service_role|authorization|supabase|postgres|stack trace|api key)/i.test(text), HOSTED_FAILURE_CATEGORIES.ERROR_HANDLING, "safe-5xx", "internal_detail_exposed");
    return { status: response.status, safeBody: true, deploymentId: faultAttestation.vercelDeploymentId };
  });

  console.log(JSON.stringify({ status: "passed", deploymentId: attestation.vercelDeploymentId, lanes }, null, 2));
} finally {
  await browser.close();
}
