import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "playwright/test";

const PRODUCT_PURCHASE_LINK_MODULE_PATH = path.join(process.cwd(), "lib", "product-purchase-link.js");

const FIXTURE_IMAGE_PATH = path.join(
  process.cwd(),
  "public",
  "test-assets",
  "kakao-test-face.png"
);
const LOCAL_ENV_PATH = path.join(process.cwd(), ".env.local");
const RESULT_TIMEOUT_MS = 180000;
const REMOTE_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "";
const REMOTE_TARGET =
  Boolean(REMOTE_BASE_URL) &&
  !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(REMOTE_BASE_URL);

function envFileContainsAll(keys: string[]) {
  if (!fs.existsSync(LOCAL_ENV_PATH)) {
    return false;
  }

  const envText = fs.readFileSync(LOCAL_ENV_PATH, "utf8");
  return keys.every((key) => new RegExp(`^${key}=.+$`, "m").test(envText));
}

const LIVE_FLOW_READY =
  REMOTE_TARGET ||
  envFileContainsAll([
    "OPENAI_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "WRITE_ACCESS_TOKEN_SECRET"
  ]);

async function uploadFixtureImage(page: Page) {
  await expect(page.locator('input[type="file"]').last()).toBeAttached();
  await page.locator('input[type="file"]').last().setInputFiles(FIXTURE_IMAGE_PATH);
  await expect(
    page.getByAltText("Preview of the uploaded face photo")
  ).toBeVisible();
}

async function goToSurvey(page: Page) {
  await page.getByRole("button", { name: /^Next$/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tell us your skin context" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Which skin type feels closest to you?" })
  ).toBeVisible();
}

async function answerRequiredSurvey(page: Page) {
  await page.getByRole("button", { name: "Oily" }).click();
  await page.getByRole("button", { name: /^Next$/ }).click();
  await expect(
    page.getByRole("heading", { name: "Does your skin become reactive easily?" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Normal" }).click();
  await page.getByRole("button", { name: /^Next$/ }).click();
  await expect(
    page.getByRole("heading", { name: "What skin concerns matter most now?" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Breakouts" }).click();
  await page.getByRole("button", { name: /^Next$/ }).click();
  await expect(
    page.getByRole("heading", { name: "What do you want to improve first?" })
  ).toBeVisible();
}

async function submitSurveyWithDefaults(page: Page) {
  for (let index = 0; index < 8; index += 1) {
    const startAnalysisButton = page.getByRole("button", {
      name: /^Start analysis$/
    });

    if (await startAnalysisButton.isVisible()) {
      await startAnalysisButton.click();
      return;
    }

    await page.getByRole("button", { name: /^Next$/ }).click();
  }

  await page.getByRole("button", { name: /^Start analysis$/ }).click();
}

async function assertHomeEntry(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Find products matched to your skin" })
  ).toBeVisible();
  await expect(
    page.getByText("We combine photo signals with your survey answers.")
  ).toBeVisible();
}

async function seedStaleClientState(page: Page) {
  await page.evaluate(() => {
    sessionStorage.setItem(
      "skinTestShare",
      JSON.stringify({
        shareId: "stale-share",
        sharePath: "/r/stale-share",
        shareUrl: "https://example.com/r/stale-share",
        fingerprint: "stale-fingerprint"
      })
    );
    sessionStorage.setItem("skinTestFaceLabFull", JSON.stringify({ stale: true }));
    sessionStorage.setItem("skinTestWriteAccessToken", "stale-write-token");
    localStorage.setItem("lastReportUrl", "https://example.com/old-report");
    localStorage.setItem("lastViewedAt", "2001-01-01T00:00:00.000Z");
    localStorage.setItem("lastFullReportTab", "face_lab");
  });
}

async function advanceToFullReport(page: Page) {
  const stepLabels = [
    "See Skin Dashboard",
    "See Top Pick",
    "Routine & Notes",
    "See Full Report",
    "See Full Report"
  ];

  for (const label of stepLabels) {
    await expect(page.getByRole("button", { name: label })).toBeVisible({
      timeout: 30000
    });
    await page.getByRole("button", { name: label }).click();
  }
}

test.describe("Visuali MVP E2E draft", () => {
  test("purchase-link client boundary imports the shared resolver @smoke", async () => {
    const freeResultPage = fs.readFileSync(path.join(process.cwd(), "app", "result", "page.js"), "utf8");
    const fullReportPage = fs.readFileSync(path.join(process.cwd(), "app", "result", "full-report", "page.js"), "utf8");
    const resolver = fs.readFileSync(PRODUCT_PURCHASE_LINK_MODULE_PATH, "utf8");

    expect(resolver).toContain("resolveProductPurchaseLink");
    expect(freeResultPage).toContain('from "@/lib/product-purchase-link"');
    expect(fullReportPage).toContain('from "@/lib/product-purchase-link"');
    expect(freeResultPage).toContain('rel="noopener noreferrer"');
    expect(fullReportPage).toContain('rel="noopener noreferrer"');
  });

  test("home entry, photo upload, and required survey navigation @smoke", async ({
    page
  }) => {
    await page.goto("/en");

    await assertHomeEntry(page);

    await uploadFixtureImage(page);
    await goToSurvey(page);

    await page.getByRole("button", { name: /^Next$/ }).click();
    await expect(
      page.getByText("Please answer the required question first.")
    ).toBeVisible();

    await answerRequiredSurvey(page);
  });

  test("analysis, share save, shared link, stale cache cleanup, and full report entry @live", async ({
    page,
    context,
    request
  }) => {
    test.skip(
      !LIVE_FLOW_READY,
      "TODO: requires an OpenAI + Supabase-backed runtime. Use local .env.local or set PLAYWRIGHT_BASE_URL to a live target."
    );

    await page.goto("/en");
    await seedStaleClientState(page);
    await uploadFixtureImage(page);
    await goToSurvey(page);
    await answerRequiredSurvey(page);

    const analyzeResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/analyze") &&
        response.request().method() === "POST"
    );

    await submitSurveyWithDefaults(page);

    const analyzeResponse = await analyzeResponsePromise;
    expect(analyzeResponse.ok()).toBeTruthy();

    const analyzePayload = await analyzeResponse.json();
    expect(analyzePayload.meta?.schemaVersion).toBe(1);
    expect(analyzePayload.meta?.source).toBe("skin-match-v2");
    expect(typeof analyzePayload.meta?.generatedAt).toBe("string");

    await page.waitForURL("**/en/result", { timeout: RESULT_TIMEOUT_MS });
    await expect(page.getByRole("button", { name: "Save result" })).toBeVisible({
      timeout: RESULT_TIMEOUT_MS
    });
    await expect(page.getByText("Diagnosis Summary")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Result" })).toBeVisible();

    const storageState = await page.evaluate(() => ({
      share: sessionStorage.getItem("skinTestShare"),
      faceLabFull: sessionStorage.getItem("skinTestFaceLabFull"),
      writeAccessToken: sessionStorage.getItem("skinTestWriteAccessToken"),
      lastReportUrl: localStorage.getItem("lastReportUrl"),
      lastViewedAt: localStorage.getItem("lastViewedAt"),
      lastFullReportTab: localStorage.getItem("lastFullReportTab")
    }));

    expect(storageState.share).toBeNull();
    expect(
      storageState.faceLabFull === null ||
        !storageState.faceLabFull.includes('"stale":true')
    ).toBe(true);
    expect(storageState.writeAccessToken).not.toBe("stale-write-token");
    expect(storageState.lastReportUrl).toBeNull();
    expect(storageState.lastViewedAt).toBeNull();
    expect(storageState.lastFullReportTab).toBeNull();

    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/results") &&
        response.request().method() === "POST"
    );

    await page.getByRole("button", { name: "Save result" }).click();

    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBeTruthy();

    const savePayload = await saveResponse.json();
    expect(savePayload.shareId).toBeTruthy();
    expect(savePayload.sharePath).toMatch(/^\/r\/.+/);

    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible({
      timeout: 30000
    });

    const shareApiUrl = new URL(
      `/api/results/${savePayload.shareId}`,
      page.url()
    ).toString();
    const sharedResultResponse = await request.get(shareApiUrl);

    expect(sharedResultResponse.ok()).toBeTruthy();

    const sharedResultPayload = await sharedResultResponse.json();
    expect(sharedResultPayload.success).toBe(true);
    expect(sharedResultPayload.result?.shareId).toBe(savePayload.shareId);
    expect(sharedResultPayload.result?.schemaVersion).toBe(1);
    expect(Object.keys(sharedResultPayload.result || {}).sort()).toEqual([
      "categoryPicks",
      "locale",
      "mainConcerns",
      "routineAm",
      "routinePm",
      "routineStructure",
      "schemaVersion",
      "shareId",
      "skinType",
      "summary",
      "topPick"
    ]);
    expect(sharedResultPayload.result).not.toHaveProperty("id");
    expect(sharedResultPayload.result).not.toHaveProperty("userId");
    expect(sharedResultPayload.result).not.toHaveProperty("imageUrl");
    expect(sharedResultPayload.result).not.toHaveProperty("source");
    expect(sharedResultPayload.result).not.toHaveProperty("generatedAt");
    expect(sharedResultPayload.result).not.toHaveProperty("createdAt");
    expect(sharedResultPayload.result).not.toHaveProperty("recommendedProducts");
    expect(sharedResultPayload.result).not.toHaveProperty("alternative");
    expect(sharedResultPayload.result).not.toHaveProperty("morning");
    expect(sharedResultPayload.result).not.toHaveProperty("night");
    expect(Object.keys(sharedResultPayload.result?.topPick || {}).sort()).toEqual([
      "brand",
      "id",
      "name",
      "reason",
      "step"
    ]);
    for (const product of sharedResultPayload.result?.categoryPicks || []) {
      expect(Object.keys(product).sort()).toEqual([
        "brand",
        "id",
        "name",
        "step"
      ]);
    }

    const sharePage = await context.newPage();
    await sharePage.goto(new URL(savePayload.sharePath, page.url()).toString());
    await expect(sharePage.getByText("Shared Result")).toBeVisible();
    await expect(sharePage.getByText("K-Beauty Result")).toBeVisible();
    await expect(
      sharePage.getByRole("heading", { name: "Your K-Beauty Match" }).first()
    ).toBeVisible();
    await sharePage.close();

    await advanceToFullReport(page);
    await page.waitForURL("**/en/result/full-report", {
      timeout: RESULT_TIMEOUT_MS
    });

    await expect(page.getByText("FULL REPORT")).toBeVisible();
    await expect(page.getByRole("button", { name: "Skin Match" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Face Lab" })).toBeVisible();
  });

  test("deployed target smoke when PLAYWRIGHT_BASE_URL points to Vercel or another remote host @deploy", async ({
    page
  }) => {
    test.skip(
      !REMOTE_TARGET,
      "TODO: set PLAYWRIGHT_BASE_URL to a deployed Vercel or production URL to exercise item 15."
    );

    await page.goto("/en");
    await assertHomeEntry(page);
    expect(new URL(page.url()).hostname).not.toMatch(/^(127\.0\.0\.1|localhost)$/i);
  });

  test("TODO: native camera capture path remains manual", async () => {
    test.fixme(
      true,
      "Headless browser media permissions are unstable; this draft covers the gallery upload path instead."
    );
  });

  test("TODO: native share sheet and clipboard permission edge cases remain manual", async () => {
    test.fixme(
      true,
      "Cross-browser share targets and OS clipboard prompts vary too much for a stable MVP gate."
    );
  });

  test("TODO: direct Supabase table-row assertions remain manual", async () => {
    test.fixme(
      true,
      "This draft verifies read-after-write through app APIs and shared pages, but it intentionally avoids service-role SQL access."
    );
  });
});
