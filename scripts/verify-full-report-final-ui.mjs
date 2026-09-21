import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { buildTestResult } from "../lib/test-result-fixture.js";
import { FUNCTIONAL_PLAN_DEV_SCENARIOS } from "../lib/functional-plan-dev-fixtures.js";
import { FULL_REPORT_SECTIONS, focusedSection, intakeAnswer, verdictCounts, finalAction } from "../lib/full-report-presentation.js";

const baseURL = process.env.FULL_REPORT_UI_URL || "http://127.0.0.1:3016";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const output = "_local_data/full-report-final";
await mkdir(output, { recursive: true });
const free = buildTestResult();
const scenario = FUNCTIONAL_PLAN_DEV_SCENARIOS[0];
const base = { ...free.premiumReport, freeResult: free, functionalPlan: scenario.functionalPlan, functionalRoutineAudit: scenario.routineAudit,
  premiumIntake: { stepStates: { recentContext: "skipped", decisionFocus: "answered" }, answers: { recentlyChangedProduct: "yes", productReaction: "yes" }, decisionFocus: "condition_response" },
  meta: { persistence: { status: "existing", savedReportId: "ui-fixture" } }
};
assert.equal(intakeAnswer(base, "productReaction"), "응답 건너뜀");
assert.equal(focusedSection(base), "adjustment-guide");
assert.equal(focusedSection({ premiumIntake: { ...base.premiumIntake, stepStates: { decisionFocus: "skipped" } } }), null);
assert.equal(finalAction(base), finalAction({ ...base, premiumIntake: { ...base.premiumIntake, decisionFocus: "functional_addition" } }));
assert.deepEqual(FULL_REPORT_SECTIONS.map((s) => s.ko), ["오늘의 리포트", "현재 루틴 점검", "문제 추적", "다음 변화 플랜", "상황별 대응"]);
assert.equal(verdictCounts({ currentProductVerdicts: [{ status: "check_needed" }] }).hold, 0);

const browser = await chromium.launch();
const results = [];
function unexpectedErrors(errors) {
  // Existing root-layout dev CSP nonce mismatch, verified independently of this UI.
  return errors.filter((message) => {
    if (!message.startsWith("A tree hydrated") || !message.includes("<RootLayout>")) return true;
    const lines = message.slice(message.indexOf("<RootLayout>")).split("\n").filter((line) => /^\s*[+-]\s/.test(line));
    return !(lines.length === 2 && lines.some((line) => /^\s*\+\s+nonce="[A-Za-z0-9+/=]*"$/.test(line)) && lines.some((line) => /^\s*-\s+nonce=""$/.test(line)));
  });
}
async function open(report, width = 390, theme = "light", locale = "ko") {
  const context = await browser.newContext({ viewport: { width, height: 950 }, colorScheme: theme });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/full-report") { requests.push(route.request().postDataJSON()); return route.fulfill({ json: report }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { success: true } });
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) return route.fulfill({ status: 200, body: "" });
    return route.continue();
  });
  await context.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
  await page.goto(`${baseURL}${locale === "en" ? "/en" : ""}/result/full-report?savedReportId=ui-fixture`, { waitUntil: "networkidle" });
  await page.getByRole('button', { name: locale === 'en' ? /Open my plan/i : '내 플랜 열기', exact: false }).click();
  try { await page.locator('[data-report-section="hub"]').waitFor(); }
  catch (error) { console.error(await page.locator('body').innerText(), errors, requests); throw error; }
  assert.ok(requests.length && requests.every((r) => r.savedReportId === "ui-fixture"));
  return { context, page, errors, requests, initial: requests.length };
}
async function checkPage(page, name) {
  await page.locator('img').evaluateAll((images) => Promise.all(images.map(async (img) => { img.loading = 'eager'; await img.decode().catch(() => {}); })));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: overflow`);
  assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
try {
  for (const theme of ["light", "dark"]) for (const width of [390, 430, 1448]) {
    const report = structuredClone(base);
    report.conditionPlan = { responses: [...(report.conditionResponses || []), { responseKey: "extra", status: "maintain", title: "네 번째 저장 응답", summary: "잘리지 않는 저장된 응답", action: "원본 행동 문구" }] };
    const before = JSON.stringify(report);
    const { context, page, errors, requests, initial } = await open(report, width, theme);
    for (const [index, section] of FULL_REPORT_SECTIONS.entries()) {
      if (index) await page.getByRole("button", { name: section.ko, exact: true }).click();
      await page.waitForTimeout(180);
      await checkPage(page, `${theme}-${width}-${index}`);
      if (index === 1) {
        await page.getByRole("tab", { name: "저녁 루틴", exact: true }).click();
        assert.equal(await page.getByRole("tab", { name: "저녁 루틴", exact: true }).getAttribute("aria-selected"), "true");
      }
      if (index === 2) assert.ok(await page.getByText("응답 건너뜀", { exact: false }).first().isVisible());
      if (index === 3) {
        assert.equal(await page.locator("[data-functional-product]:visible").count(), 1);
        await page.getByRole("button", { name: "다른 후보 2개 보기", exact: true }).focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("[data-functional-product]:visible").count(), 3);
      }
      if (index === 4) {
        assert.ok(await page.getByText("네 번째 저장 응답", { exact: true }).first().isVisible());
        assert.ok(await page.locator("[data-report-completion]").isVisible());
        assert.ok(await page.getByRole("button", { name: "리포트 링크 복사", exact: true }).isEnabled());
        assert.ok(await page.getByRole("button", { name: /My \/ 보관함/ }).isVisible());
      }
      if (index) await page.getByRole("button", { name: "풀 리포트", exact: true }).click();
    }
    assert.equal(requests.length, initial, "navigation never regenerates report");
    assert.equal(JSON.stringify(report), before);
    assert.deepEqual(unexpectedErrors(errors), []);
    results.push({ theme, width, pages: 5, pass: true, baselineWarnings: errors.length });
    await context.close();
  }
  for (const [name, report] of [
    ["hold", { ...base, functionalPlan: { ...base.functionalPlan, planMode: "HOLD", productCandidates: [] } }],
    ["unknown", { ...base, functionalPlan: { ...base.functionalPlan, planMode: "UNKNOWN", productCandidates: [], routineGuide: null } }],
    ["one", { ...base, functionalPlan: { ...base.functionalPlan, productCandidates: base.functionalPlan.productCandidates.slice(0, 1) } }],
    ["legacy", { ...free.premiumReport, freeResult: free, functionalDecisions: [{ title: "과거 저장 판단", summary: "원본 스냅샷", status: "later" }] }],
    ["empty", { freeResult: free, routinePlan: { morningSteps: [], nightSteps: [] }, conditionPlan: { responses: [] }, functionalDecisions: [] }]
  ]) {
    const { context, page, errors } = await open(report);
    await page.getByRole("button", { name: "다음 변화 플랜", exact: true }).click();
    if (["unknown", "legacy", "empty"].includes(name)) assert.equal(await page.getByText("피부 기준 · 시작 가능", { exact: true }).count(), 0);
    if (name === "hold") assert.ok(await page.getByText("피부 기준 · 추가 보류", { exact: true }).isVisible());
    if (name === "one") assert.equal(await page.getByRole("button", { name: /다른 후보/ }).count(), 0);
    if (name === "legacy") assert.ok(await page.getByText("원본 스냅샷", { exact: true }).first().isVisible());
    assert.deepEqual(unexpectedErrors(errors), []);
    results.push({ name, pass: true });
    await context.close();
  }
  const english = await open(base, 430, "dark", "en");
  assert.ok(await english.page.getByRole("heading", { name: "Today's report", exact: true }).isVisible());
  assert.deepEqual(unexpectedErrors(english.errors), []);
  await english.context.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
