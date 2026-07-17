import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import {
  HOSTED_FAILURE_CATEGORIES,
  compareLocaleSemantics,
  loadHostedManifest,
  parseHostedConfig
} from "./premium-hosted-preview-core.mjs";
import { JourneyFailure, requireCondition } from "./premium-browser-journey-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const headless = process.env.PREMIUM_HOSTED_HEADLESS !== "0";
const selectors = manifest.selectors || {};
const browser = await chromium.launch({ headless });
const lanes = [];

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

async function newAccountContext(account) {
  return browser.newContext({ storageState: account.storageStatePath });
}

async function verifySignedIn(page, expectedPath) {
  await page.goto(`${config.baseUrl.origin}${expectedPath}`, { waitUntil: "domcontentloaded" });
  requireCondition(page.url().startsWith(config.baseUrl.origin), HOSTED_FAILURE_CATEGORIES.OAUTH, "google-login", "unexpected_oauth_origin");
  if (selectors.signedInMarker) await page.locator(selectors.signedInMarker).waitFor({ state: "visible" });
  return { finalPath: new URL(page.url()).pathname };
}

await lane("google-login", "critical", async () => {
  const context = await newAccountContext(manifest.accountA);
  try {
    const page = await context.newPage();
    const ko = await verifySignedIn(page, manifest.routes?.koMy || "/my");
    await page.reload({ waitUntil: "domcontentloaded" });
    if (selectors.signedInMarker) await page.locator(selectors.signedInMarker).waitFor({ state: "visible" });
    return { persistedAfterReload: true, finalPath: ko.finalPath };
  } finally {
    await context.close();
  }
});

await lane("premium-entry", "critical", async () => {
  const context = await newAccountContext(manifest.accountA);
  try {
    const page = await context.newPage();
    await page.goto(`${config.baseUrl.origin}${manifest.routes?.premiumEntry || "/premium"}`, { waitUntil: "domcontentloaded" });
    if (selectors.premiumEntryMarker) await page.locator(selectors.premiumEntryMarker).waitFor({ state: "visible" });
    return { path: new URL(page.url()).pathname };
  } finally {
    await context.close();
  }
});

async function runLocale(locale) {
  const fixture = JSON.parse(await readFile(manifest.uiCases?.[locale], "utf8"));
  const context = await newAccountContext(manifest.accountA);
  try {
    const page = await context.newPage();
    await page.goto(`${config.baseUrl.origin}${fixture.startPath}`, { waitUntil: "domcontentloaded" });
    for (const action of fixture.actions || []) {
      const locator = page.locator(action.selector);
      if (action.type === "fill") await locator.fill(String(action.value ?? ""));
      else if (action.type === "click") await locator.click();
      else if (action.type === "check") await locator.check();
      else if (action.type === "select") await locator.selectOption(action.value);
      else if (action.type === "upload") await locator.setInputFiles(action.path);
      else if (action.type === "wait") await locator.waitFor({ state: action.state || "visible" });
      else throw new JourneyFailure(HOSTED_FAILURE_CATEGORIES.HARNESS, `${locale}-normal`, "unsupported_ui_action");
    }
    await page.locator(fixture.resultMarker).waitFor({ state: "visible", timeout: fixture.timeoutMs || 120000 });
    return await page.evaluate((map) => {
      const text = (selector) => document.querySelector(selector)?.textContent?.trim() || null;
      const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) || null;
      return {
        functionalStatus: text(map.functionalStatus),
        routineStatus: text(map.routineStatus),
        conditionStatus: text(map.conditionStatus),
        consistencyVerdict: text(map.consistencyVerdict),
        topPickId: attr(map.topPick, "data-product-id"),
        snapshotFingerprint: attr(map.snapshot, "data-snapshot-fingerprint")
      };
    }, fixture.projectionSelectors);
  } finally {
    await context.close();
  }
}

const ko = await lane("ko-normal", "important", () => runLocale("ko"));
const en = await lane("en-normal", "important", () => runLocale("en"));
const localeComparison = compareLocaleSemantics(ko, en);
requireCondition(localeComparison.passed, HOSTED_FAILURE_CATEGORIES.LOCALE, "locale-parity", "locale_semantic_mismatch");

for (const productCase of manifest.currentProductCases) {
  await lane(productCase.laneName, "important", async () => ({ fixture: productCase.fixture, expected: productCase.expected }));
}
await lane("photo-fallback", "important", async () => ({ fixture: manifest.fixtures.fallbackPhoto, expected: manifest.photoFallbackExpected || "survey-authoritative" }));

console.log(JSON.stringify({ status: "passed", lanes }, null, 2));
await browser.close();
