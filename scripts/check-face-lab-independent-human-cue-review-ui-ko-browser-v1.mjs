import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const parseArgs = () => {
  const values = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    assert.match(process.argv[index] || "", /^--[a-z-]+$/);
    assert.ok(process.argv[index + 1]);
    values[process.argv[index].slice(2)] = process.argv[index + 1];
  }
  return values;
};

const args = parseArgs();
assert.ok(args.html, "--html is required");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const unexpectedRequests = [];
const consoleErrors = [];
const pageErrors = [];
page.on("request", (request) => {
  const protocol = new URL(request.url()).protocol;
  if (!new Set(["file:", "blob:", "data:"]).has(protocol)) unexpectedRequests.push(request.url());
});
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));
try {
  await page.goto(pathToFileURL(path.resolve(args.html)).href, { waitUntil: "load" });
  await page.getByRole("heading", { name: "얼굴 특징 판별 테스트" }).waitFor();
  assert.equal(await page.locator("#start input[type=checkbox]").count(), 8);
  for (const checkbox of await page.locator("#start input[type=checkbox]").all()) await checkbox.check();
  await page.getByRole("button", { name: "평가 시작" }).click();
  await page.locator("#review-image").waitFor();
  assert.equal(await page.locator("#review-image").evaluate((image) => image.complete && image.naturalWidth > 0), true);
  assert.equal(await page.locator(".axis-card").count(), 8);
  await page.locator(".axis-card details").first().getByText("기준 자세히 보기").click();
  await page.getByRole("heading", { name: "무엇을 보는지" }).first().waitFor();
  await page.getByRole("button", { name: "다음 사진" }).click();
  await page.getByText("현재 사진의 모든 문항에서 응답과 필요한 확신도 또는 이유를 선택해 주세요.").waitFor();
  const firstCard = page.locator(".axis-card").first();
  await firstCard.getByRole("button", { name: "계란형" }).click();
  await firstCard.getByRole("button", { name: "중간" }).click();
  const storageEntryCount = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("face-lab-review-ui::")).length);
  assert.equal(storageEntryCount, 1);
  await page.reload({ waitUntil: "load" });
  await page.locator("#review-image").waitFor();
  assert.equal(await page.locator(".axis-card").first().getByRole("button", { name: "계란형" }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".axis-card").first().getByRole("button", { name: "중간" }).getAttribute("aria-pressed"), "true");
  if (args.screenshot) await page.screenshot({ path: path.resolve(args.screenshot), fullPage: true });
  await page.evaluate(() => localStorage.clear());
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ status: "PASS", startScreen: true, KoreanLabels: true, imageLoaded: true, accordionOpened: true, navigationValidationActivated: true, testOnlyLocalStorageRestored: true, testOnlyLocalStorageCleared: true, networkRequests: 0, HumanCompletionResponses: 0 }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", error: error.message, consoleErrors, pageErrors, bodyText: (await page.locator("body").textContent()).slice(0, 1000) }, null, 2));
  throw error;
} finally {
  await browser.close();
}
