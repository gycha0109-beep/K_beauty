import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = String(process.env.PREMIUM_E2E_BASE_URL || "").replace(/\/$/, "");
const accessToken = process.env.PREMIUM_E2E_ACCESS_TOKEN || "";
const conflictBodyJson = process.env.PREMIUM_E2E_CONFLICT_BODY_JSON || "";
const headless = process.env.PREMIUM_E2E_HEADLESS !== "0";

if (!baseUrl) {
  throw new Error("PREMIUM_E2E_BASE_URL is required");
}
if (!accessToken) {
  throw new Error("PREMIUM_E2E_ACCESS_TOKEN is required");
}

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6L9sAAAAASUVORK5CYII=";

function oppositeLocale(locale) {
  return locale === "en" ? "ko" : "en";
}

async function browserJson(page, path, options = {}) {
  return page.evaluate(
    async ({ url, token, requestOptions }) => {
      const headers = new Headers(requestOptions.headers || {});
      headers.set("Authorization", `Bearer ${token}`);
      if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }
      const response = await fetch(url, {
        ...requestOptions,
        headers,
        credentials: "include"
      });
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text };
      }
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body
      };
    },
    {
      url: `${baseUrl}${path}`,
      token: accessToken,
      requestOptions: options
    }
  );
}

async function runAnalyze(page, locale) {
  return page.evaluate(
    async ({ url, token, imageBase64, selectedLocale }) => {
      const bytes = Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0));
      const form = new FormData();
      form.set("image", new File([bytes], "premium-e2e.png", { type: "image/png" }));
      form.set("skinType", "combination");
      form.set("sensitivityLevel", "medium");
      form.set("mainConcern", "dehydration");
      form.set("mainConcerns", JSON.stringify(["dehydration", "barrier"]));
      form.set("cleansingFrequency", "twice_daily");
      form.set("texturePreference", "gel");
      form.set("postCleanseFeel", "tight");
      form.set("afternoonState", "more_oily");
      form.set("dislikedFeel", "heavy");
      form.set("environmentExposure", JSON.stringify(["outdoor"]));
      form.set("currentProducts", JSON.stringify([]));
      form.set("locale", selectedLocale);

      const response = await fetch(`${url}/api/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        credentials: "include"
      });
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text };
      }
      return { status: response.status, body };
    },
    {
      url: baseUrl,
      token: accessToken,
      imageBase64: ONE_PIXEL_PNG_BASE64,
      selectedLocale: locale
    }
  );
}

function assertNoSensitiveRotationFields(body) {
  const serialized = JSON.stringify(body || {});
  for (const forbidden of ["sessionId", "premiumSessionToken", "accessToken"]) {
    assert.equal(serialized.includes(forbidden), false, `rotation response exposed ${forbidden}`);
  }
}

const browser = await chromium.launch({ headless });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const initialLocale = process.env.PREMIUM_E2E_LOCALE === "en" ? "en" : "ko";
  const analyze = await runAnalyze(page, initialLocale);
  assert.equal(analyze.status, 200, `analyze failed: ${JSON.stringify(analyze.body)}`);

  const premiumCookies = (await context.cookies()).filter(
    (cookie) => cookie.name === "kbeauty_premium_report"
  );
  assert.equal(premiumCookies.length, 1, "premium session cookie was not created");
  const firstSessionCookie = premiumCookies[0].value;

  const reportBody = { locale: initialLocale, currentProducts: [] };
  const first = await browserJson(page, "/api/full-report", {
    method: "POST",
    body: JSON.stringify(reportBody)
  });
  assert.equal(first.status, 200, `first full report failed: ${JSON.stringify(first.body)}`);
  assert.ok(first.body?.meta?.persistence?.savedReportId, "first save did not return savedReportId");
  assert.ok(
    ["saved", "existing"].includes(first.body?.meta?.persistence?.status),
    `unexpected first persistence status: ${first.body?.meta?.persistence?.status}`
  );
  const firstSavedReportId = first.body.meta.persistence.savedReportId;
  const savedLocale = first.body?.meta?.locale;

  const retry = await browserJson(page, "/api/full-report", {
    method: "POST",
    body: JSON.stringify(reportBody)
  });
  assert.equal(retry.status, 200, `retry failed: ${JSON.stringify(retry.body)}`);
  assert.equal(retry.body?.meta?.persistence?.status, "existing");
  assert.equal(retry.body?.meta?.persistence?.savedReportId, firstSavedReportId);

  const reopened = await browserJson(page, "/api/full-report", {
    method: "POST",
    body: JSON.stringify({
      savedReportId: firstSavedReportId,
      locale: oppositeLocale(initialLocale),
      topPick: { id: "request-tampering-must-be-ignored" }
    })
  });
  assert.equal(reopened.status, 200, `saved reopen failed: ${JSON.stringify(reopened.body)}`);
  assert.equal(reopened.body?.meta?.source, "saved-report");
  assert.equal(reopened.body?.meta?.locale, savedLocale, "request locale changed saved report locale");
  assert.equal(reopened.body?.meta?.persistence?.savedReportId, firstSavedReportId);

  if (conflictBodyJson) {
    const conflictBody = JSON.parse(conflictBodyJson);
    const conflict = await browserJson(page, "/api/full-report", {
      method: "POST",
      body: JSON.stringify({ ...conflictBody, locale: initialLocale })
    });
    assert.equal(conflict.status, 409, `expected finalized conflict: ${JSON.stringify(conflict.body)}`);
    assert.equal(conflict.body?.error, "premium_snapshot_finalized");

    const afterConflict = await browserJson(page, "/api/full-report", {
      method: "POST",
      body: JSON.stringify(reportBody)
    });
    assert.equal(afterConflict.status, 200);
    assert.equal(afterConflict.body?.meta?.persistence?.savedReportId, firstSavedReportId);
  }

  const sessionStatus = await browserJson(page, "/api/full-report/session", { method: "GET" });
  assert.equal(sessionStatus.status, 200);
  assert.equal(sessionStatus.body?.hasSavedReport, true);
  assert.equal(sessionStatus.body?.savedReportId, firstSavedReportId);

  const rotation = await browserJson(page, "/api/full-report/session", { method: "POST" });
  assert.equal(rotation.status, 200, `rotation failed: ${JSON.stringify(rotation.body)}`);
  assert.equal(rotation.body?.rotated, true);
  assert.equal(rotation.body?.reason, "new_session_created");
  assertNoSensitiveRotationFields(rotation.body);

  const rotatedCookies = (await context.cookies()).filter(
    (cookie) => cookie.name === "kbeauty_premium_report"
  );
  assert.equal(rotatedCookies.length, 1);
  assert.notEqual(rotatedCookies[0].value, firstSessionCookie, "rotation did not replace session cookie");

  const nextReport = await browserJson(page, "/api/full-report", {
    method: "POST",
    body: JSON.stringify(reportBody)
  });
  assert.equal(nextReport.status, 200, `new report failed: ${JSON.stringify(nextReport.body)}`);
  assert.ok(nextReport.body?.meta?.persistence?.savedReportId);
  assert.notEqual(nextReport.body.meta.persistence.savedReportId, firstSavedReportId);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        firstSavedReportId,
        nextSavedReportId: nextReport.body.meta.persistence.savedReportId,
        conflictChecked: Boolean(conflictBodyJson),
        locale: savedLocale
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
