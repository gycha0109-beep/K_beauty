import { chromium } from "playwright";
import { loadHostedManifest, parseHostedConfig, HOSTED_FAILURE_CATEGORIES } from "./premium-hosted-preview-core.mjs";
import { parseApiResponse, requireCondition } from "./premium-browser-journey-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const accountBToken = String(process.env.PREMIUM_HOSTED_ACCOUNT_B_ACCESS_TOKEN || "").trim();
const accountASavedReportId = String(process.env.PREMIUM_HOSTED_ACCOUNT_A_SAVED_REPORT_ID || "").trim();
const faultBaseUrl = String(process.env.PREMIUM_HOSTED_FAULT_BASE_URL || "").trim();
const faultExpectedHost = String(process.env.PREMIUM_HOSTED_FAULT_EXPECTED_HOST || "").trim();
const lanes = [];

async function lane(name, severity, fn) {
  try {
    const evidence = await fn();
    lanes.push({ name, severity, status: "passed", evidence });
  } catch (error) {
    lanes.push({ name, severity, status: "failed", errorCode: error?.code || "assertion_failed" });
    throw error;
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const anonymous = await browser.newContext();
  await lane("unauthenticated", "critical", async () => {
    const response = await anonymous.request.post(`${config.baseUrl.origin}/api/full-report`, { data: { locale: "ko" } });
    const parsed = await parseApiResponse(response);
    requireCondition(parsed.status === 401, HOSTED_FAILURE_CATEGORIES.AUTH, "unauthenticated", "unauthenticated_not_rejected");
    return { status: parsed.status, errorCode: parsed.body?.error || null };
  });
  await anonymous.close();

  requireCondition(accountBToken, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "forbidden", "account_b_token_missing");
  const accountB = await browser.newContext({ storageState: manifest.accountB.storageStatePath });
  await lane("forbidden", "critical", async () => {
    const response = await accountB.request.post(`${config.baseUrl.origin}/api/full-report`, {
      headers: { Authorization: `Bearer ${accountBToken}` },
      data: { locale: "ko" }
    });
    const parsed = await parseApiResponse(response);
    requireCondition([402, 403].includes(parsed.status), HOSTED_FAILURE_CATEGORIES.PREMIUM_ACCESS, "forbidden", "forbidden_account_not_rejected");
    return { status: parsed.status, errorCode: parsed.body?.error || null };
  });

  requireCondition(accountASavedReportId, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "ownership", "account_a_saved_report_missing");
  await lane("ownership", "critical", async () => {
    const response = await accountB.request.post(`${config.baseUrl.origin}/api/full-report`, {
      headers: { Authorization: `Bearer ${accountBToken}` },
      data: { savedReportId: accountASavedReportId, locale: "ko" }
    });
    const parsed = await parseApiResponse(response);
    requireCondition(parsed.status === 401, HOSTED_FAILURE_CATEGORIES.AUTH, "ownership", "foreign_saved_report_exposed");
    return { status: parsed.status, errorCode: parsed.body?.error || null };
  });
  await accountB.close();

  requireCondition(faultBaseUrl && faultExpectedHost, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "safe-5xx", "fault_preview_missing");
  const faultUrl = new URL(faultBaseUrl);
  requireCondition(faultUrl.protocol === "https:" && faultUrl.hostname === faultExpectedHost && faultUrl.hostname !== config.baseUrl.hostname, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "safe-5xx", "fault_preview_invalid");
  await lane("safe-5xx", "important", async () => {
    const response = await fetch(`${faultUrl.origin}${manifest.faultCase?.path || "/api/full-report"}`, {
      method: manifest.faultCase?.method || "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(manifest.faultCase?.body || { locale: "ko" })
    });
    const text = await response.text();
    requireCondition(response.status >= 500 && response.status <= 599, HOSTED_FAILURE_CATEGORIES.ERROR_HANDLING, "safe-5xx", "fault_preview_did_not_fail");
    requireCondition(!/(service_role|authorization|supabase|postgres|stack trace|api key)/i.test(text), HOSTED_FAILURE_CATEGORIES.ERROR_HANDLING, "safe-5xx", "internal_detail_exposed");
    return { status: response.status, safeBody: true };
  });

  console.log(JSON.stringify({ status: "passed", lanes }, null, 2));
} finally {
  await browser.close();
}
