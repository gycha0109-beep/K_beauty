import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { renderHostedHumanCueReviewHtml } from "../lib/face-lab-hosted-review-html.js";

const parseArgs = (argv = process.argv.slice(2)) => {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    assert.match(key || "", /^--[a-z-]+$/);
    assert.ok(argv[index + 1], `missing value for ${key}`);
    result[key.slice(2)] = argv[index + 1];
  }
  return result;
};

const args = parseArgs();
const localRender = args["local-render"] === "true";
if (!localRender) {
  assert.ok(args.url, "--url is required");
  assert.ok(args.token, "--token is required");
}
let fixtureRoot = null;
let navigationUrl;
if (localRender) {
  fixtureRoot = mkdtempSync(path.join(tmpdir(), "face-lab-hosted-ui-"));
  const authority = JSON.parse(
    readFileSync(
      "evidence/facelab/face-lab-independent-human-cue-single-hosted-set-20260815-v1.json",
      "utf8"
    )
  );
  authority.orderedItems = authority.orderedItems.map((item) => ({
    ...item,
    assetPath: pathToFileURL(
      path.resolve("public/facelab/hosted-review/v1/assets", item.assetName)
    ).href
  }));
  const fixture = path.join(fixtureRoot, "review.html");
  writeFileSync(
    fixture,
    renderHostedHumanCueReviewHtml({
      authority,
      accessToken: "test_only_opaque_access_token_000000000000000000",
      nonce: "AAAAAAAAAAAAAAAAAAAAAA==",
      testMode: true,
      submitEndpoint: "https://hosted-review.test/api/facelab/review/submit"
    }),
    "utf8"
  );
  navigationUrl = pathToFileURL(fixture).href;
} else {
  const baseUrl = new URL(args.url);
  baseUrl.searchParams.set("t", args.token);
  baseUrl.searchParams.set("smoke", "1");
  navigationUrl = baseUrl.toString();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "ko-KR" });
const page = await context.newPage();
const requests = [];
const consoleErrors = [];
let mockedSubmissionPayload = null;
page.on("request", (request) =>
  requests.push({ method: request.method(), url: request.url() })
);
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

if (args["mock-submit"] === "true") {
  await page.route("**/api/facelab/review/submit", async (route) => {
    mockedSubmissionPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        result: {
          id: "00000000-0000-4000-8000-000000000001",
          status: "test",
          submittedAt: new Date().toISOString(),
          responsePayloadSha256: "0".repeat(64)
        }
      })
    });
  });
}

async function fillCurrentImage() {
  for (let index = 0; index < 10; index += 1) {
    let card = page.locator(".axis-card").nth(index);
    if ((await card.locator('button[data-response][aria-pressed="true"]').count()) === 0) {
      await card.locator("button[data-response]").first().click();
    }
    card = page.locator(".axis-card").nth(index);
    if ((await card.locator('button[data-confidence][aria-pressed="true"]').count()) === 0) {
      await card.locator('button[data-confidence="low"]').click();
    }
  }
}

try {
  const response = await page.goto(navigationUrl, {
    waitUntil: "domcontentloaded"
  });
  assert.equal(response?.status(), 200);
  await page.getByText("약 5분 동안 얼굴 사진 14장").waitFor();
  assert.equal(await page.locator("[data-attestation]").count(), 8);
  for (const checkbox of await page.locator("[data-attestation]").all()) {
    await checkbox.check();
  }
  await page.getByRole("button", { name: "평가 시작" }).click();
  await page.locator("#review-image").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("#review-image")?.naturalWidth > 0
  );
  assert.equal(await page.locator(".axis-card").count(), 10);

  await page.locator(".axis-card").first().locator("button[data-response]").first().click();
  await page
    .locator(".axis-card")
    .first()
    .locator('button[data-confidence="low"]')
    .click();
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(
    await page
      .locator(".axis-card")
      .first()
      .locator('button[data-response][aria-pressed="true"]')
      .count(),
    1
  );
  assert.equal(
    await page
      .locator(".axis-card")
      .first()
      .locator('button[data-confidence][aria-pressed="true"]')
      .count(),
    1
  );

  for (let imageIndex = 0; imageIndex < 14; imageIndex += 1) {
    await fillCurrentImage();
    const button = page.locator("#next");
    if (imageIndex === 13) {
      await assert.doesNotReject(async () =>
        assert.equal(await button.textContent(), "최종 제출")
      );
    }
    await button.click();
    if (imageIndex < 13) {
      await page.getByText(`사진 ${imageIndex + 2} / 14`).waitFor();
    }
  }

  await page.getByText("제출이 완료되었습니다.").waitFor({ timeout: 30_000 });
  const remainingState = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) =>
      key.startsWith("face-lab-hosted-review::")
    )
  );
  assert.deepEqual(remainingState, []);
  assert.deepEqual(consoleErrors, []);

  const expectedOrigin = localRender ? "null" : new URL(args.url).origin;
  const externalRequests = requests.filter(
    (request) =>
      new URL(request.url).origin !== expectedOrigin &&
      new URL(request.url).origin !== "https://hosted-review.test"
  );
  assert.deepEqual(externalRequests, []);
  const submitRequests = requests.filter(
    (request) =>
      request.method === "POST" &&
      new URL(request.url).pathname === "/api/facelab/review/submit"
  );
  assert.equal(submitRequests.length, 1);
  if (args["mock-submit"] === "true") {
    assert.equal(mockedSubmissionPayload?.judgments?.length, 140);
    assert.equal(mockedSubmissionPayload?.completion?.imageCount, 14);
    assert.equal(mockedSubmissionPayload?.distributionMode, "single_hosted_set");
    assert.equal("reviewerSlot" in mockedSubmissionPayload, false);
  }

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        route: localRender ? "/facelab/review" : new URL(args.url).pathname,
        KoreanLabels: "PASS",
        imageLoaded: "PASS",
        progress: "PASS",
        navigationValidation: "PASS",
        localStorageRestore: "PASS",
        testStateCleared: "PASS",
        selfOriginRequests: requests.length,
        externalRequests: 0,
        submitRequests: 1,
        submitMode: args["mock-submit"] === "true" ? "mock" : "real",
        testSubmissions: args["mock-submit"] === "true" ? 0 : 1,
        humanCompletionResponses: 0
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
}
