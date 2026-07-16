import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "playwright/test";

const PRODUCT_PURCHASE_LINK_MODULE_PATH = path.join(process.cwd(), "lib", "product-purchase-link.js");
const APPROVED_PRODUCT_IMAGE_URL =
  "https://img.hwahae.co.kr/products/12345/12345_20260715123456.jpg";

const FIXTURE_IMAGE_PATH = path.join(
  process.cwd(),
  "public",
  "test-assets",
  "kakao-test-face.png"
);
const LOCAL_ENV_PATH = path.join(process.cwd(), ".env.local");
const RESULT_TIMEOUT_MS = 180000;
const REMOTE_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "";
const SHARED_RESULT_SMOKE_IDS = {
  public: "CQkJCQkJCQkJCQkJCQkJCQ",
  notFound: "AgICAgICAgICAgICAgICAg",
  rateLimited: "AwMDAwMDAwMDAwMDAwMDAw",
  unavailable: "BAQEBAQEBAQEBAQEBAQEBA"
};
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

function createSharedResultFixture() {
  return {
    shareId: SHARED_RESULT_SMOKE_IDS.public,
    schemaVersion: 1,
    locale: "en",
    skinType: "dry",
    mainConcerns: ["redness"],
    summary: "server-only-result-payload",
    routineAm: ["Gentle cleanse"],
    routinePm: ["Moisturize"],
    topPick: {
      id: "fixture-top-pick",
      name: "Fixture Cream",
      brand: "Fixture Brand",
      step: "Moisturizer",
      reason: "fixture reason"
    },
    categoryPicks: [],
    routineStructure: null
  };
}

async function seedProductImageResult(page: Page, imageUrl: string) {
  await page.evaluate((nextImageUrl) => {
    sessionStorage.setItem(
      "skinTestResult",
      JSON.stringify({
        summary: "Image origin fixture",
        priority: { axis: "barrier", label: "Barrier" },
        topPick: {
          id: "image-origin-product",
          name: "Image Origin Product",
          brand: "Fixture Brand",
          category: "treatment",
          step: "serum_ampoule",
          image_url: nextImageUrl,
          reason: "Fixture reason"
        },
        alternative: null,
        categoryPicks: [],
        altPicks: [],
        morning: ["Cleanse", "Moisturize"],
        night: ["Cleanse", "Repair"],
        warnings: [],
        photoEvidence: [],
        surveyEvidence: []
      })
    );
    sessionStorage.setItem(
      "skinTestSubmission",
      JSON.stringify({ locale: "en", form: { skinType: "oily", mainConcerns: ["pores"] } })
    );
  }, imageUrl);
}

async function advanceToProductImageStep(page: Page) {
  await page.getByRole("button", { name: "See why" }).click();
  await page.getByRole("button", { name: "See recommendation guide" }).click();
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

  test("product image origin boundary is fail-closed at runtime @sec10-image-origin @smoke", async ({ page }) => {
    let approvedRequestCount = 0;
    let rejectedRequestCount = 0;
    let approvedMode: "success" | "error" = "success";

    await page.route("**/api/premium/access", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reason: "premium_unavailable" }) });
    });
    await page.route("**/api/full-report/session", async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "login_required" }) });
    });
    await page.route("**/api/track", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.route("https://img.hwahae.co.kr/**", async (route) => {
      approvedRequestCount += 1;

      if (approvedMode === "error") {
        await route.fulfill({ status: 404, body: "" });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: fs.readFileSync(FIXTURE_IMAGE_PATH)
      });
    });
    await page.route("https://manyo.us/**", async (route) => {
      rejectedRequestCount += 1;
      await route.abort();
    });

    await page.goto("/en");
    await seedProductImageResult(page, APPROVED_PRODUCT_IMAGE_URL);
    await page.goto("/en/result");
    await advanceToProductImageStep(page);

    const approvedImage = page.locator('[data-product-image-state="approved"]').first();
    await expect(approvedImage).toBeVisible();
    await expect(approvedImage).toHaveAttribute("src", APPROVED_PRODUCT_IMAGE_URL);
    await expect(approvedImage).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(approvedRequestCount).toBe(1);

    await seedProductImageResult(page, "https://manyo.us/cdn/product.png");
    await page.reload();
    await advanceToProductImageStep(page);
    await expect(page.locator('[data-product-image-state="placeholder"]').first()).toBeVisible();
    expect(rejectedRequestCount).toBe(0);

    await seedProductImageResult(page, "javascript:alert(1)");
    await page.reload();
    await advanceToProductImageStep(page);
    await expect(page.locator('[data-product-image-state="placeholder"]').first()).toBeVisible();
    expect(rejectedRequestCount).toBe(0);

    approvedMode = "error";
    await seedProductImageResult(page, APPROVED_PRODUCT_IMAGE_URL);
    await page.reload();
    await advanceToProductImageStep(page);
    await expect(page.locator('[data-product-image-state="placeholder"]').first()).toBeVisible();
    await page.waitForTimeout(250);
    expect(approvedRequestCount).toBe(2);
  });

  test("shared result loader has one read boundary and generic failure states @smoke", async ({ page }) => {
    let isPublic = true;
    let publicGetCount = 0;
    let rateLimitedGetCount = 0;
    let patchPayload: unknown = null;
    let releaseInitialRead: (() => void) | undefined;
    const initialRead = new Promise<void>((resolve) => {
      releaseInitialRead = resolve;
    });
    let holdInitialRead = true;

    await page.route("**/api/results/*", async (route) => {
      const request = route.request();
      const shareId = new URL(request.url()).pathname.split("/").at(-1);

      if (request.method() === "PATCH") {
        patchPayload = request.postDataJSON();
        isPublic = false;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, unpublished: true })
        });
        return;
      }

      if (shareId === SHARED_RESULT_SMOKE_IDS.public) {
        publicGetCount += 1;
        if (holdInitialRead) {
          await initialRead;
          holdInitialRead = false;
        }
        await route.fulfill({
          status: isPublic ? 200 : 404,
          contentType: "application/json",
          body: JSON.stringify(
            isPublic
              ? { success: true, result: createSharedResultFixture() }
              : { success: false, error: "Result not found." }
          )
        });
        return;
      }

      if (shareId === SHARED_RESULT_SMOKE_IDS.rateLimited) {
        rateLimitedGetCount += 1;
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({ success: false, error: "result_read_rate_limited" })
        });
        return;
      }

      if (shareId === SHARED_RESULT_SMOKE_IDS.unavailable) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ success: false, error: "result_read_guard_unavailable" })
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Result not found." })
      });
    });

    await page.goto(`/r/${SHARED_RESULT_SMOKE_IDS.public}`, { waitUntil: "domcontentloaded" });
    expect(await page.content()).not.toContain("server-only-result-payload");
    releaseInitialRead?.();
    await expect(page.getByText("Shared Result")).toBeVisible();
    await expect(page.getByText("server-only-result-payload")).toBeVisible();
    await page.waitForTimeout(250);
    expect(publicGetCount).toBe(1);

    const unpublishResponse = await page.evaluate(async (shareId) => {
      const response = await fetch(`/api/results/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: false })
      });
      return { status: response.status, body: await response.json() };
    }, SHARED_RESULT_SMOKE_IDS.public);
    expect(unpublishResponse).toEqual({ status: 200, body: { success: true, unpublished: true } });
    expect(patchPayload).toEqual({ isPublic: false });

    await page.goto(`/r/${SHARED_RESULT_SMOKE_IDS.public}`);
    await expect(page.getByRole("heading", { name: "Result not found" })).toBeVisible();

    await page.goto(`/r/${SHARED_RESULT_SMOKE_IDS.notFound}`);
    await expect(page.getByRole("heading", { name: "Result not found" })).toBeVisible();

    await page.goto(`/r/${SHARED_RESULT_SMOKE_IDS.rateLimited}`);
    await expect(page.getByRole("heading", { name: "Too many requests" })).toBeVisible();
    await page.waitForTimeout(250);
    expect(rateLimitedGetCount).toBe(1);

    await page.goto(`/r/${SHARED_RESULT_SMOKE_IDS.unavailable}`);
    await expect(page.getByRole("heading", { name: "Temporarily unavailable" })).toBeVisible();
  });

  test("photo upload rejects unsupported files before preview @smoke", async ({ page }) => {
    await page.goto("/en");

    const uploadInput = page.locator('input[type="file"]').last();
    await expect(uploadInput).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp"
    );
    await uploadInput.setInputFiles({
      name: "not-an-image.jpg",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image", "utf8")
    });

    await expect(
      page.getByText("Choose a non-empty JPEG, PNG, or WebP image.")
    ).toBeVisible();
    await expect(page.getByAltText("Preview of the uploaded face photo")).toHaveCount(0);
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
