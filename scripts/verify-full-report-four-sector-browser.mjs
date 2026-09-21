// Local, intercepted fixture verification. Never contacts a production API or writes reports.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { buildTestResult } from "../lib/test-result-fixture.js";
import { buildPremiumDecisionState } from "../lib/premium-decision-state.js";

const base = process.env.FULL_REPORT_UI_BASE || "http://localhost:3014";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local server required");
const output = process.env.FULL_REPORT_UI_OUTPUT || "artifacts/full-report-four-sector";
await mkdir(output, { recursive: true });
const freeResult = buildTestResult();
const names = ["검증용 순한 클렌저", "검증용 수분 토너", "검증용 기능성 세럼", "검증용 보습 크림"];
const categories = ["cleanser", "toner_essence", "treatment", "moisturizer"];
const products = categories.map((category, i) => ({ id: `ui-fixture-${i}`, name: names[i], category, product_form: category === "treatment" ? "serum" : "", brand: "UI test fixture", irritation_risk: i === 2 ? "high" : "low", sensitivity_safe: i !== 2, ingredient_signals: { source: "fixture", functional: [{ label: i === 2 ? "Exfoliation" : "Skin Hydration", count: 4 }] }, image_url: "" }));
function payload(locale = "ko", variant = "canonical") {
  const answers = { skinType: "combination", sensitivity: "high", mainConcerns: ["dehydration"], primaryConcern: "dehydration", recentlyChangedProduct: "yes", productReaction: "yes", postWashFeeling: "tight", afternoonSkinChange: "more_dry", cleansingFrequency: "3_plus", environmentExposure: [], recentSkinChange: "yes" };
  const source = { freeResult: { ...freeResult, answers, priority: { axis: "dehydration", score: 70 }, scoring: { concernScores: { dehydration: { total: 70 }, barrier: { total: 65 }, redness: { total: 50 } } } }, currentProducts: { selections: [...products.map((product, i) => ({ category: product.category, status: "selected", productId: product.id, productSnapshot: product, useTime: i === 2 ? "evening" : "both", useFrequency: "daily", satisfaction: i === 2 ? "bad" : "good" })), { category: "sunscreen", status: "not_in_db", useTime: "morning", useFrequency: "daily" }] }, premiumIntake: { version: "premium-intake-v1", stepStates: { currentProducts: "answered", usage: "answered", recentContext: "answered", decisionFocus: "answered" }, answers: { recentlyChangedProduct: "yes", productReaction: "yes" }, decisionFocus: "current_product_fit" }, supportingProducts: products, photoEvidenceState: { status: "not_provided" } };
  const state = buildPremiumDecisionState(source, { locale, source: "four-sector-browser-fixture" });
  if (variant === "legacy") return { ...freeResult.premiumReport, freeResult };
  if (variant === "unknown") return { freeResult, currentProducts: { selections: [{ category: "sunscreen", status: "unanswered" }, { category: "moisturizer", status: "not_using" }] }, fullRoutine: { morningSteps: [], nightSteps: [] } };
  if (variant === "start") {
    source.freeResult.answers = { ...answers, sensitivity: "low", productReaction: "no", recentlyChangedProduct: "no", recentSkinChange: "no", postWashFeeling: "comfortable", afternoonSkinChange: "mostly_same", cleansingFrequency: "twice" };
    source.freeResult.scoring = { concernScores: { dehydration: { total: 20 } } };
    source.currentProducts.selections = [];
    return { ...source, ...buildPremiumDecisionState(source, { locale, source: "four-sector-start-fixture" }) };
  }
  return { ...source, ...state };
}
const browser = await chromium.launch({ headless: true });
const errors = [];
const knownConsoleIssues = [];
const checks = [];
const captured = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  let variant = "canonical";
  let calls = 0;
  let lastRequestedId;
  let lastRequestBody;
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== new URL(base).origin) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    if (url.pathname === "/api/full-report") {
      calls++;
      const body = request.postDataJSON();
      lastRequestBody = body;
      lastRequestedId = body.savedReportId;
      return route.fulfill({ json: payload(body.locale, variant) });
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: {} });
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("hydrated") && text.includes("nonce=")) knownConsoleIssues.push("Existing root-layout CSP nonce hydration mismatch");
    else errors.push(text);
  });
  async function open(locale = "ko") {
    await page.goto(`${base}${locale === "en" ? "/en" : ""}/result/full-report?savedReportId=ui-fixture`);
    const opener = page.getByRole("button", { name: locale === "en" ? "Open generated Skin Match plan" : "생성된 Skin Match 플랜 열기" });
    const hub = page.getByRole("button", { name: locale === "en" ? "Open Current routine review" : "현재 루틴 점검 섹션으로 이동", exact: true });
    for (let attempt = 0; attempt < 60 && !await hub.isVisible(); attempt++) {
      if (await opener.isVisible() && await opener.isEnabled()) { await opener.click(); break; }
      await page.waitForTimeout(500);
    }
    await hub.click({ timeout: 30000 });
    await page.locator('[data-report-section="routine"]').waitFor();
    await page.waitForTimeout(350);
  }
  async function sector(index) {
    await page.getByRole("navigation", { name: /Full Report/ }).getByRole("button").nth(index).click();
    await page.waitForTimeout(400);
    assert.equal(await page.getByRole("navigation", { name: /Full Report/ }).getByRole("button").count(), 4);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "no horizontal document overflow");
    assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  }
  await open();
  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => { document.documentElement.classList.toggle("dark", theme === "dark"); localStorage.setItem("theme", theme); }, theme);
      for (let i = 0; i < 4; i++) {
        await sector(i);
        const name = `${width}-${theme}-${i + 1}.png`;
        await page.locator("[data-report-section]").screenshot({ path: `${output}/${name}`, animations: "disabled", style: "nextjs-portal { visibility: hidden }" });
        captured.push(name);
        if (width === 390) {
          await page.screenshot({ path: `${output}/viewport-${theme}-${i + 1}.png`, animations: "disabled", style: "nextjs-portal { visibility: hidden }" });
        }
      }
    }
  }
  checks.push("Four sectors, 390/430px, Light/Dark, screenshots, no document overflow");
  await sector(0);
  await page.getByRole("button", { name: "PM", exact: true }).click();
  await page.locator('[data-report-section="routine"] details').first().locator(":scope > summary").click();
  assert.match(await page.locator('[data-report-section="routine"]').innerText(), /저녁|세안|진정/);
  checks.push("AM/PM and row evidence disclosure");
  await sector(3);
  const scenarioButtons = page.locator('[data-report-section="condition"] [aria-label="상황 선택"] button');
  assert.equal(await scenarioButtons.count(), payload().conditionPlan.responses.length);
  if (await scenarioButtons.count() > 1) {
    await scenarioButtons.nth(1).click();
    assert.equal(await scenarioButtons.nth(1).getAttribute("aria-pressed"), "true");
  }
  checks.push("Scenario selector uses payload and changes selected guidance");
  const beforeReentry = calls;
  await open();
  assert.ok(calls > beforeReentry);
  assert.equal(lastRequestedId, "ui-fixture");
  checks.push("Saved-report URL reload requests the same id (intercepted API)");
  await open("en");
  for (let i = 0; i < 4; i++) await sector(i);
  assert.match(await page.locator("[data-report-section]").innerText(), /Situational care/);
  await page.screenshot({ path: `${output}/english.png` });
  checks.push("English section navigation");
  variant = "legacy";
  await open();
  await sector(3);
  assert.match(await page.locator("[data-report-section]").innerText(), /이전 리포트|역할별 변경/);
  checks.push("Legacy saved payload remains readable without invented routine diff");
  variant = "unknown";
  await open();
  await sector(2);
  assert.equal(await page.locator("[data-plan-mode]").getAttribute("data-plan-mode"), "UNKNOWN");
  await sector(3);
  assert.equal(await scenarioButtons.count(), 0);
  checks.push("Unknown plan remains UNKNOWN; absent scenarios stay absent");
  variant = "start";
  await open();
  await sector(2);
  assert.equal(await page.locator("[data-plan-mode]").getAttribute("data-plan-mode"), payload("ko", "start").functionalPlan.planMode);
  checks.push("START fixture preserves canonical mode");
  await sector(3);
  await Promise.all([
    page.waitForRequest((request) => /^\/(?:ko\/|en\/)?my$/.test(new URL(request.url()).pathname)),
    page.getByRole("button", { name: "저장된 리포트 보기", exact: true }).click()
  ]);
  checks.push("Final CTA requests My (unauthenticated redirect is retained)");
  await page.goto(`${base}/result/full-report`);
  await page.getByRole("button", { name: "사용 중 / DB 미등록", exact: true }).first().click();
  await page.getByRole("button", { name: "사용 안 함", exact: true }).nth(1).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "아침", exact: true }).click();
  await page.getByRole("button", { name: "매일", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "이 단계 건너뛰기", exact: true }).click();
  await page.getByRole("button", { name: "현재 제품을 유지·조정할지", exact: true }).click();
  await page.getByRole("button", { name: "이 정보로 풀 리포트 만들기", exact: true }).click();
  await page.getByRole("button", { name: "현재 루틴 점검 섹션으로 이동", exact: true }).waitFor({ timeout: 30000 });
  assert.ok(lastRequestBody.currentProducts.some((item) => item.status === "not_in_db" && item.useTime === "morning" && item.useFrequency === "daily"));
  assert.ok(lastRequestBody.currentProducts.some((item) => item.status === "not_using"));
  assert.equal(lastRequestBody.premiumIntake.stepStates.recentContext, "skipped");
  assert.equal(lastRequestBody.premiumIntake.answers.productReaction, "unknown");
  checks.push("Current-product inputs and usage metadata flow through Premium Intake into the report request; skipped answers stay unknown");
  await page.getByRole("button", { name: "현재 루틴 점검 섹션으로 이동", exact: true }).click();
  await sector(3);
  await page.getByRole("button", { name: "Face Lab 리포트 확인하기", exact: true }).click();
  assert.equal(await page.locator("[data-report-section]").count(), 0);
  assert.match(await page.locator("body").innerText(), /Face Lab/);
  checks.push("Existing Face Lab entry opens the separate experience");
  assert.deepEqual(errors, []);
  checks.push("No uncaught page errors");
  await writeFile(`${output}/verification.json`, JSON.stringify({ base, fixtureOnly: true, checks, captured, errors, knownConsoleIssues: [...new Set(knownConsoleIssues)] }, null, 2));
  console.log(JSON.stringify({ checks, captured: captured.length, errors, knownConsoleIssues: [...new Set(knownConsoleIssues)] }, null, 2));
} finally {
  await browser.close();
}
