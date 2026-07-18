import { chromium } from "playwright";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  HOSTED_FAILURE_CATEGORIES,
  compareLocaleSemantics,
  loadDeploymentAttestation,
  loadHostedManifest,
  parseHostedConfig,
  projectCanonicalEvidence,
  validateUiCaseFixture
} from "./premium-hosted-preview-core-v2.mjs";
import {
  assertPathInside,
  hashFileSha256,
  secureWriteJson
} from "./premium-hosted-preview-security.mjs";
import { JourneyFailure, requireCondition } from "./premium-browser-journey-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const attestation = await loadDeploymentAttestation(config, manifest);
const fixtureRoot = await realpath(resolve(manifest.fixtureRoot));
const headless = process.env.PREMIUM_HOSTED_HEADLESS !== "0";
const previewBypassToken = String(process.env.PREMIUM_HOSTED_PREVIEW_BYPASS_TOKEN || "").trim();
const uiCreatedIdsDir = assertPathInside(
  config.securePaths.credentialsDir,
  process.env.PREMIUM_HOSTED_UI_CREATED_IDS_DIR || resolve(config.securePaths.credentialsDir, "ui-created-ids"),
  "ui_created_ids_directory_outside_secure_root"
);
const browser = await chromium.launch({ headless });
const lanes = [];
const createdReportLanes = [];
const uploadExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedProtectionCookies = new Set(["_vercel_jwt", "__vercel_live_token"]);

async function lane(name, severity, fn) {
  const started = Date.now();
  try {
    const evidence = await fn();
    lanes.push({ name, severity, status: "passed", durationMs: Date.now() - started, evidence });
    return evidence;
  } catch (error) {
    const normalized = error instanceof JourneyFailure
      ? error
      : new JourneyFailure(HOSTED_FAILURE_CATEGORIES.UI_PROJECTION, name, "ui_assertion_failed", error?.message || "ui_assertion_failed");
    lanes.push({ name, severity, status: "failed", durationMs: Date.now() - started, errorCode: normalized.code });
    throw normalized;
  }
}

function isAllowedBootstrapCookie(cookie) {
  const name = String(cookie?.name || "");
  return name.includes("auth-token") || allowedProtectionCookies.has(name);
}

async function primePreviewProtection(context) {
  const headers = previewBypassToken
    ? {
        "x-vercel-protection-bypass": previewBypassToken,
        "x-vercel-set-bypass-cookie": "true"
      }
    : {};
  const response = await context.request.get(config.baseUrl.origin, { headers, maxRedirects: 0 });
  requireCondition(response.status() < 400, HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION, "browser-context", "preview_protection_access_not_granted");
}

async function newAccountContext(account) {
  const storageStatePath = assertPathInside(
    config.securePaths.credentialsDir,
    account.storageStatePath,
    "account_storage_state_outside_secure_root"
  );
  const stored = JSON.parse(await readFile(storageStatePath, "utf8"));
  const cookies = Array.isArray(stored.cookies) ? stored.cookies.filter(isAllowedBootstrapCookie) : [];
  requireCondition(cookies.some((cookie) => String(cookie.name || "").includes("auth-token")), HOSTED_FAILURE_CATEGORIES.AUTH_EVIDENCE, "browser-context", "auth_cookie_missing_from_derived_state");
  requireCondition(!cookies.some((cookie) => String(cookie.name || "").includes("premium_report")), HOSTED_FAILURE_CATEGORIES.HARNESS, "browser-context", "premium_cookie_leaked_into_derived_state");
  const context = await browser.newContext({
    storageState: { cookies, origins: [] },
    serviceWorkers: "block"
  });
  await primePreviewProtection(context);
  return context;
}

function locatorForMarker(page, marker) {
  if (marker.kind === "heading") return page.getByRole("heading", { name: marker.name, exact: true });
  if (marker.kind === "role") return page.getByRole(marker.role, { name: marker.name, exact: true });
  return page.getByText(marker.name, { exact: true });
}

async function resolveFixtureFile(inputPath, allowedExtensions, maximumBytes, code) {
  const candidate = await realpath(resolve(String(inputPath || ""))).catch(() => null);
  requireCondition(candidate, HOSTED_FAILURE_CATEGORIES.FIXTURE_CONTRACT, code, "fixture_file_missing");
  const rel = relative(fixtureRoot, candidate);
  requireCondition(rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), HOSTED_FAILURE_CATEGORIES.FIXTURE_CONTRACT, code, "fixture_file_outside_root");
  requireCondition(allowedExtensions.has(extname(candidate).toLowerCase()), HOSTED_FAILURE_CATEGORIES.FIXTURE_CONTRACT, code, "fixture_file_extension_invalid");
  const info = await stat(candidate);
  requireCondition(info.isFile() && info.size > 0 && info.size <= maximumBytes, HOSTED_FAILURE_CATEGORIES.FIXTURE_CONTRACT, code, "fixture_file_size_invalid");
  return candidate;
}

async function resolveUploadPath(relativePath) {
  const candidate = await realpath(resolve(fixtureRoot, relativePath)).catch(() => null);
  requireCondition(candidate, HOSTED_FAILURE_CATEGORIES.FIXTURE_CONTRACT, "fixture-upload", "fixture_upload_missing");
  const rel = relative(fixtureRoot, candidate);
  requireCondition(rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), HOSTED_FAILURE_CATEGORIES.FIXTURE_CONTRACT, "fixture-upload", "fixture_upload_outside_root");
  requireCondition(uploadExtensions.has(extname(candidate).toLowerCase()), HOSTED_FAILURE_CATEGORIES.FIXTURE_CONTRACT, "fixture-upload", "fixture_upload_extension_invalid");
  const info = await stat(candidate);
  requireCondition(info.isFile() && info.size > 0 && info.size <= 10 * 1024 * 1024, HOSTED_FAILURE_CATEGORIES.FIXTURE_CONTRACT, "fixture-upload", "fixture_upload_size_invalid");
  return candidate;
}

async function applyAction(page, action, laneName) {
  if (action.type === "fillByLabel") await page.getByLabel(action.label, { exact: true }).fill(String(action.value ?? ""));
  else if (action.type === "clickByRole") await page.getByRole(action.role, { name: action.name, exact: true }).click();
  else if (action.type === "checkByLabel") await page.getByLabel(action.label, { exact: true }).check();
  else if (action.type === "selectByLabel") await page.getByLabel(action.label, { exact: true }).selectOption(action.value);
  else if (action.type === "uploadByLabel") await page.getByLabel(action.label, { exact: true }).setInputFiles(await resolveUploadPath(action.path));
  else if (action.type === "waitForVisibleText") await page.getByText(action.text, { exact: true }).waitFor({ state: "visible" });
  else if (action.type === "expectHeading") await page.getByRole("heading", { name: action.name, exact: true }).waitFor({ state: "visible" });
  else throw new JourneyFailure(HOSTED_FAILURE_CATEGORIES.FIXTURE_CONTRACT, laneName, "unsupported_ui_action");
}

function isFullReportResponse(response) {
  try {
    const url = new URL(response.url());
    return url.origin === config.baseUrl.origin && url.pathname === "/api/full-report" && response.request().method() === "POST";
  } catch {
    return false;
  }
}

async function persistCreatedReportEvidence(body, laneName) {
  const persistence = body?.meta?.persistence || null;
  const savedReportId = String(persistence?.savedReportId || "").trim();
  requireCondition(
    persistence?.status === "saved" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedReportId),
    HOSTED_FAILURE_CATEGORIES.PERSISTENCE,
    laneName,
    "ui_saved_report_evidence_missing"
  );
  const path = resolve(uiCreatedIdsDir, `${laneName}.json`);
  await secureWriteJson(path, {
    schemaVersion: "premium-hosted-ui-created-report-v1",
    runId: config.runId,
    prNumber: config.prNumber,
    deploymentId: attestation.vercelDeploymentId,
    deploymentSha: attestation.prHeadSha,
    ownerUserIdHash: manifest.accountA.expectedUserIdHash,
    laneName,
    savedReportId,
    createdAt: new Date().toISOString()
  });
  createdReportLanes.push(laneName);
  return hashFileSha256(path);
}

async function runUiCase(casePath, laneName, account = manifest.accountA) {
  requireCondition(casePath, HOSTED_FAILURE_CATEGORIES.PRECONDITION, laneName, "ui_case_missing");
  const resolvedCasePath = await resolveFixtureFile(casePath, new Set([".json"]), 1024 * 1024, laneName);
  const rawFixture = JSON.parse(await readFile(resolvedCasePath, "utf8"));
  const fixture = validateUiCaseFixture(rawFixture);
  const context = await newAccountContext(account);
  try {
    const page = await context.newPage();
    await page.goto(`${config.baseUrl.origin}${fixture.startPath}`, { waitUntil: "domcontentloaded" });
    requireCondition(new URL(page.url()).origin === config.baseUrl.origin, HOSTED_FAILURE_CATEGORIES.OAUTH, laneName, "unexpected_ui_origin");

    const matches = [];
    const onResponse = (response) => {
      if (isFullReportResponse(response)) matches.push(response);
    };
    page.on("response", onResponse);
    for (const action of fixture.actions) await applyAction(page, action, laneName);
    await locatorForMarker(page, fixture.resultMarker).waitFor({ state: "visible", timeout: fixture.timeoutMs });
    requireCondition(new URL(page.url()).origin === config.baseUrl.origin, HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION, laneName, "result_page_origin_mismatch");
    await page.waitForTimeout(250);
    page.off("response", onResponse);

    requireCondition(matches.length === 1, HOSTED_FAILURE_CATEGORIES.CANONICAL_PROJECTION, laneName, matches.length ? "full_report_response_ambiguous" : "full_report_response_missing");
    const response = matches[0];
    requireCondition(response.status() === 200, HOSTED_FAILURE_CATEGORIES.ENGINE_OUTPUT, laneName, "full_report_response_not_success");
    let body;
    try {
      body = await response.json();
    } catch {
      throw new JourneyFailure(HOSTED_FAILURE_CATEGORIES.CANONICAL_PROJECTION, laneName, "full_report_response_invalid_json");
    }
    const persistenceEvidenceHash = await persistCreatedReportEvidence(body, laneName);
    const canonical = projectCanonicalEvidence(body, { catalogHash: manifest.catalogHash });
    requireCondition(canonical.locale === (laneName === "en-normal" ? "en" : laneName === "ko-normal" ? "ko" : canonical.locale), HOSTED_FAILURE_CATEGORIES.LOCALE, laneName, "canonical_locale_mismatch");
    return { ...canonical, persistenceEvidenceHash };
  } finally {
    await context.close();
  }
}

try {
  await lane("google-login", "critical", async () => {
    const context = await newAccountContext(manifest.accountA);
    try {
      const page = await context.newPage();
      await page.goto(`${config.baseUrl.origin}${manifest.accountA.expectedAfterLoginPath || manifest.routes?.koMy || "/my"}`, { waitUntil: "domcontentloaded" });
      requireCondition(new URL(page.url()).origin === config.baseUrl.origin, HOSTED_FAILURE_CATEGORIES.OAUTH, "google-login", "unexpected_oauth_origin");
      await locatorForMarker(page, manifest.signedInMarker).waitFor({ state: "visible" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await locatorForMarker(page, manifest.signedInMarker).waitFor({ state: "visible" });
      return { persistedAfterReload: true, finalPath: new URL(page.url()).pathname };
    } finally {
      await context.close();
    }
  });

  await lane("premium-entry", "critical", async () => {
    const context = await newAccountContext(manifest.accountA);
    try {
      const page = await context.newPage();
      await page.goto(`${config.baseUrl.origin}${manifest.routes?.premiumEntry || "/premium"}`, { waitUntil: "domcontentloaded" });
      requireCondition(new URL(page.url()).origin === config.baseUrl.origin, HOSTED_FAILURE_CATEGORIES.PREMIUM_ACCESS, "premium-entry", "premium_entry_origin_mismatch");
      await locatorForMarker(page, manifest.premiumEntryMarker).waitFor({ state: "visible" });
      return { path: new URL(page.url()).pathname };
    } finally {
      await context.close();
    }
  });

  const ko = await lane("ko-normal", "important", () => runUiCase(manifest.uiCases.ko, "ko-normal"));
  const en = await lane("en-normal", "important", () => runUiCase(manifest.uiCases.en, "en-normal"));
  const localeComparison = compareLocaleSemantics(ko, en);
  requireCondition(localeComparison.passed, HOSTED_FAILURE_CATEGORIES.LOCALE, "locale-parity", "locale_semantic_mismatch", localeComparison.mismatches.join(","));

  const allowedProductLanes = ["selected-product", "not-in-db", "selected-plus-not-in-db", "duplicate-axis"];
  for (const productCase of manifest.currentProductCases) {
    requireCondition(allowedProductLanes.includes(productCase.laneName), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", "unknown_product_lane");
    await lane(productCase.laneName, "important", () => runUiCase(productCase.fixture, productCase.laneName));
  }
  await lane("photo-fallback", "important", () => runUiCase(manifest.photoFallbackCase, "photo-fallback"));
  requireCondition(new Set(createdReportLanes).size === 7, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "ui-journey", "ui_created_report_count_invalid");
  console.log(JSON.stringify({
    status: "passed",
    runId: config.runId,
    prNumber: config.prNumber,
    deploymentId: attestation.vercelDeploymentId,
    deploymentSha: attestation.prHeadSha,
    immutableHost: attestation.immutableHost,
    createdReportCount: createdReportLanes.length,
    lanes
  }, null, 2));
} finally {
  await browser.close();
}
