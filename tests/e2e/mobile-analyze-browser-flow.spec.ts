import path from "node:path";
import { devices, expect, test, type Page, type Route } from "playwright/test";

const FIXTURE_IMAGE_PATH = path.join(
  process.cwd(),
  "test",
  "fixtures",
  "analyze",
  "test-face-placeholder.png"
);

const ANALYZE_PATH_PATTERN = "**/api/analyze";
const START_ANALYSIS_BUTTON_NAME = /^Start (?:AI )?analysis$/;
const MOBILE_DEVICE = devices["Pixel 5"];

test.use({
  ...MOBILE_DEVICE
});

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function createAnalyzeSuccessPayload() {
  const imageEligibility = {
    status: "eligible",
    source: "vision",
    imageType: "photorealistic_human",
    humanFaceCount: 1,
    faceLabEligible: true,
    skinAnalysisEligible: true,
    faceLabFailureReason: null,
    skinFailureReason: null,
    confidence: 0.94,
    evidence: ["One synthetic test face is usable for browser-flow verification."]
  };

  return {
    meta: {
      schemaVersion: 2,
      source: "mobile-browser-e2e",
      generatedAt: "2026-07-27T00:00:00.000Z",
      imageProviderAttemptCount: 1
    },
    summary: "Your answers point to lightweight hydration and balanced surface care.",
    skinType: "oily",
    topCategory: "serum_ampoule",
    priority: {
      axis: "oiliness",
      label: "Oil balance",
      score: 82
    },
    routineStructure: {
      type: "am_pm",
      label: "AM / PM routine",
      morning: {
        mode: "morning",
        label: "Morning routine",
        strategyLine: "Keep the morning routine light.",
        steps: ["Cleanser", "Hydrating serum", "Sunscreen"]
      },
      night: {
        mode: "night",
        label: "Night routine",
        strategyLine: "Restore moisture without a heavy finish.",
        steps: ["Cleanser", "Hydrating serum", "Moisturizer"]
      }
    },
    directionSummary: "Balance surface oil while preserving comfortable hydration.",
    photoObservations: {
      summary: "Synthetic browser fixture: balanced hydration cues.",
      signals: [
        {
          key: "oiliness",
          label: "Surface oil",
          area: "T-zone",
          confidence: "medium",
          description: "Synthetic browser-flow observation."
        }
      ]
    },
    imageEligibility,
    topPick: {
      id: "mobile-e2e-serum",
      name: "Mobile E2E Hydrating Serum",
      brand: "Test Brand",
      category: "serum",
      step: "serum_ampoule",
      concerns: ["oiliness", "dehydration"],
      matched_signals: {
        oiliness: true,
        dehydration: true
      },
      texture: "light",
      finish: "fresh",
      sensitivity_safe: true,
      irritation_risk: "low",
      price_range: "$$",
      image_url: "",
      buy_link: "",
      reason: "A bounded test recommendation for the mobile result screen.",
      explanation: "A lightweight hydration option for the mocked browser response.",
      why_picked: "It matches the synthetic survey direction."
    },
    alternative: null,
    categoryPicks: [],
    morning: [],
    night: [],
    warnings: [],
    analysisRunId: "mobile-browser-e2e-analysis-run",
    faceLab: {
      status: "available",
      source: "vision",
      failureReason: null,
      analyzedAt: "2026-07-27T00:00:00.000Z",
      eligibility: imageEligibility,
      data: {
        structured: {
          mood: {
            status: "available",
            source: "vision",
            confidence: 0.9,
            evidence: ["Synthetic browser-flow mood evidence."],
            unavailableReason: null,
            value: {
              primary: "Balanced and approachable",
              traits: ["balanced", "approachable"],
              animalType: null
            }
          },
          color: {
            status: "available",
            source: "vision",
            confidence: 0.86,
            evidence: ["Synthetic browser-flow color evidence."],
            unavailableReason: null,
            value: {
              palette: ["soft beige", "peach", "cream"],
              directions: ["Use soft warm-neutral accents."]
            }
          },
          style: {
            status: "available",
            source: "vision",
            confidence: 0.88,
            evidence: ["Synthetic browser-flow style evidence."],
            unavailableReason: null,
            value: {
              hairDirections: ["Soft layers"],
              stylingDirections: ["Balanced oval proportions"]
            }
          }
        },
        base_data: {
          face_shape: "balanced oval",
          landmarks: ["soft jaw line", "balanced proportions"]
        },
        features: {
          physiognomy: {
            headline_label: "Balanced and approachable",
            overall_impression: "Soft lines and balanced proportions.",
            interpretation_axes: ["balanced", "approachable"],
            feature_based_interpretation: ["Synthetic browser-flow evidence."]
          },
          face_shape_hairstyle: {
            summary: "Balanced oval proportions support softly layered styles.",
            recommendations: ["Soft layers"],
            avoid: ["Heavy straight fringe"]
          },
          color_tone_recommendation: {
            summary: "Soft warm-neutral colors keep the look balanced.",
            palette: ["soft beige", "peach", "cream"],
            recommendations: ["Use soft warm-neutral accents."],
            avoid: ["Very harsh contrast"]
          }
        }
      }
    }
  };
}

function createAnalyzeUnavailablePayload() {
  const imageEligibility = {
    status: "eligible",
    source: "vision",
    imageType: "photorealistic_human",
    humanFaceCount: 1,
    skinAnalysisEligible: true,
    faceLabEligible: false,
    faceLabFailureReason: "face_occluded",
    skinFailureReason: null,
    confidence: 0.81,
    evidence: ["The synthetic browser fixture represents an occluded full-face view."]
  };
  const successPayload = createAnalyzeSuccessPayload();

  return {
    ...successPayload,
    summary: "Survey-based recommendations remain available for this test result.",
    imageEligibility,
    topPick: {
      ...successPayload.topPick,
      id: "test-product",
      name: "Test Product"
    },
    analysisRunId: "test-analysis-run-unavailable",
    faceLab: {
      status: "unavailable",
      source: null,
      failureReason: "face_occluded",
      analyzedAt: "2026-07-27T00:00:00.000Z",
      data: null,
      eligibility: imageEligibility
    }
  };
}

type BrowserDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  externalNetworkMarkers: string[];
};

async function installBrowserGuards(
  page: Page,
  { expectAnalyze503 = false }: { expectAnalyze503?: boolean } = {}
): Promise<BrowserDiagnostics> {
  const diagnostics: BrowserDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    externalNetworkMarkers: []
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      const isExpectedAnalyze503NetworkDiagnostic =
        expectAnalyze503 &&
        text === "Failed to load resource: the server responded with a status of 503 (Service Unavailable)";
      const isExpectedBoundedClientFailureDiagnostic =
        expectAnalyze503 &&
        text.includes("[security-event]") &&
        text.includes("event: client_operation_failed") &&
        text.includes("category: network_unavailable");
      const isKnownDevelopmentNonceHydrationDiagnostic =
        text.includes("A tree hydrated but some attributes") &&
        text.includes("nonce=");
      if (
        !isExpectedAnalyze503NetworkDiagnostic &&
        !isExpectedBoundedClientFailureDiagnostic &&
        !isKnownDevelopmentNonceHydrationDiagnostic
      ) {
        diagnostics.consoleErrors.push(text);
      }
    }
  });
  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push(error.name);
  });
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (
      (requestUrl.protocol === "http:" || requestUrl.protocol === "https:") &&
      requestUrl.hostname !== "127.0.0.1" &&
      requestUrl.hostname !== "localhost"
    ) {
      diagnostics.externalNetworkMarkers.push("UNEXPECTED_EXTERNAL_NETWORK_REQUEST");
      await route.abort("blockedbyclient");
      return;
    }

    await route.fallback();
  });
  await page.route("**/__mobile-e2e-supabase/auth/v1/signup", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "synthetic-local-access-token",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "synthetic-local-refresh-token",
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          aud: "authenticated",
          role: "authenticated",
          is_anonymous: true
        }
      })
    });
  });

  return diagnostics;
}

async function assertHealthyMobilePage(page: Page, diagnostics: BrowserDiagnostics) {
  expect(diagnostics.externalNetworkMarkers, "UNEXPECTED_EXTERNAL_NETWORK_REQUEST").toEqual([]);
  expect(diagnostics.pageErrors, "BROWSER_PAGE_ERROR").toEqual([]);
  expect(diagnostics.consoleErrors, "BROWSER_CONSOLE_ERROR").toEqual([]);
  expect(
    await page.locator("html").evaluate((element) => element.scrollWidth <= window.innerWidth),
    "MOBILE_OVERFLOW_DETECTED"
  ).toBe(true);
  await expect(page.locator("body")).not.toContainText("undefined");
  await expect(page.locator("body")).not.toContainText("[object Object]");
  expect(
    await page.locator(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay"
    ).count()
  ).toBe(0);
}

async function uploadFixtureImage(page: Page) {
  const fileInput = page.locator('input[type="file"]').last();
  await expect(fileInput).toBeAttached();
  await fileInput.setInputFiles(FIXTURE_IMAGE_PATH);
  await expect(page.getByAltText("Preview of the uploaded face photo")).toBeVisible();
}

async function advanceSurveyToSubmit(page: Page) {
  for (let index = 0; index < 14; index += 1) {
    const startButton = page.getByRole("button", { name: START_ANALYSIS_BUTTON_NAME });
    if (await startButton.isVisible()) {
      return startButton;
    }

    await page.getByRole("button", { name: /^Next$/ }).click();
  }

  return page.getByRole("button", { name: START_ANALYSIS_BUTTON_NAME });
}

async function completeRequiredSurvey(page: Page) {
  await page.getByRole("button", { name: /^Next$/ }).click();
  await expect(page.getByRole("heading", { name: "Tell us your skin context" })).toBeVisible();

  await page.getByRole("button", { name: "Oily" }).click();
  await page.getByRole("button", { name: /^Next$/ }).click();
  await page.getByRole("button", { name: "Normal" }).click();
  await page.getByRole("button", { name: /^Next$/ }).click();
  await page.getByRole("button", { name: "Breakouts" }).click();
  await page.getByRole("button", { name: /^Next$/ }).click();
  await expect(
    page.getByRole("heading", { name: "What do you want to improve first?" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Breakouts" }).click();
  await page.getByRole("button", { name: /^Next$/ }).click();

  return advanceSurveyToSubmit(page);
}

function inspectAnalyzeRequest(route: Route) {
  const request = route.request();
  expect(request.method()).toBe("POST");
  expect(request.headers()["content-type"]).toContain("multipart/form-data");
  expect(request.headers()["idempotency-key"]).toBeTruthy();

  const body = request.postDataBuffer();
  expect(body).not.toBeNull();
  const multipartMetadata = body!.toString("latin1");
  expect(multipartMetadata).toContain('name="image"');
  expect(multipartMetadata).toContain("test-face-placeholder.png");
  expect(multipartMetadata).toContain('name="locale"');
  expect(multipartMetadata).toContain('name="skinType"');
}

test.describe("mobile analyze browser flow", () => {
  test.describe.configure({ retries: 0, timeout: 60000 });

  test("selects a photo, shows loading, and renders the result with Face Lab", async ({
    page
  }) => {
    const responseGate = createDeferred();
    const requestDispatched = createDeferred();
    let analyzePostCount = 0;
    const diagnostics = await installBrowserGuards(page);

    await page.route(ANALYZE_PATH_PATTERN, async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      analyzePostCount += 1;
      requestDispatched.resolve();
      inspectAnalyzeRequest(route);
      await responseGate.promise;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "x-kbeauty-result-write-token": "synthetic-result-grant",
          "x-kbeauty-track-write-token": "synthetic-track-grant"
        },
        body: JSON.stringify(createAnalyzeSuccessPayload())
      });
    });

    await page.goto("/en");
    await expect(page.getByRole("heading", { name: "Find products matched to your skin" })).toBeVisible();
    expect(page.viewportSize()?.width).toBeLessThanOrEqual(430);
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);

    await uploadFixtureImage(page);
    const startButton = await completeRequiredSurvey(page);
    await startButton.click();

    await requestDispatched.promise;
    await expect(
      page.getByRole("heading", { name: "Analyzing a routine that fits your skin..." })
    ).toBeVisible();
    await expect(startButton).toBeHidden();
    await page.keyboard.press("Enter");
    expect(analyzePostCount).toBe(1);

    responseGate.resolve();
    await page.waitForURL("**/en/result");
    await expect(page.getByRole("heading", { name: "Your K-Beauty Match" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Core Diagnosis" })).toBeVisible();
    await expect(page.getByTestId("face-lab-available")).toBeVisible();
    await expect(page.getByTestId("face-lab-photo-ineligible")).toHaveCount(0);
    await expect(page.getByText("Analysis is temporarily unavailable.")).toHaveCount(0);
    expect(analyzePostCount).toBe(1);
    await assertHealthyMobilePage(page, diagnostics);
  });

  test("renders the survey result when Face Lab is unavailable for an occluded photo", async ({
    page
  }) => {
    const requestDispatched = createDeferred();
    let analyzePostCount = 0;
    const diagnostics = await installBrowserGuards(page);

    await page.route(ANALYZE_PATH_PATTERN, async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      analyzePostCount += 1;
      requestDispatched.resolve();
      inspectAnalyzeRequest(route);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "x-kbeauty-result-write-token": "synthetic-unavailable-result-grant",
          "x-kbeauty-track-write-token": "synthetic-unavailable-track-grant"
        },
        body: JSON.stringify(createAnalyzeUnavailablePayload())
      });
    });

    await page.goto("/en");
    await uploadFixtureImage(page);
    const startButton = await completeRequiredSurvey(page);
    await startButton.click();

    await requestDispatched.promise;
    await page.waitForURL("**/en/result");
    await expect(page.getByRole("heading", { name: "Your K-Beauty Match" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Core Diagnosis" })).toBeVisible();
    await expect(page.getByTestId("face-lab-photo-ineligible")).toBeVisible();
    await expect(
      page.getByText("Try again with another photo where your full face is clearly visible.")
    ).toBeVisible();
    await expect(page.getByTestId("face-lab-available")).toHaveCount(0);
    expect(analyzePostCount).toBe(1);
    await assertHealthyMobilePage(page, diagnostics);
  });

  test("renders a bounded analyze error after one request", async ({ page }) => {
    const responseGate = createDeferred();
    const requestDispatched = createDeferred();
    let analyzePostCount = 0;
    const diagnostics = await installBrowserGuards(page, { expectAnalyze503: true });

    await page.route(ANALYZE_PATH_PATTERN, async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      analyzePostCount += 1;
      requestDispatched.resolve();
      inspectAnalyzeRequest(route);
      await responseGate.promise;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Analysis is temporarily unavailable."
        })
      });
    });

    await page.goto("/en");
    await uploadFixtureImage(page);
    const startButton = await completeRequiredSurvey(page);
    await startButton.click();

    await requestDispatched.promise;
    await expect(
      page.getByRole("heading", { name: "Analyzing a routine that fits your skin..." })
    ).toBeVisible();
    expect(analyzePostCount).toBe(1);

    responseGate.resolve();
    await expect(page.getByText("Something unexpected went wrong.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tell us your skin context" })).toBeVisible();
    const enabledSubmitButton = await advanceSurveyToSubmit(page);
    await expect(enabledSubmitButton).toBeEnabled();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.getByRole("heading", { name: "Your K-Beauty Match" })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("stack");
    await expect(page.locator("body")).not.toContainText("details");
    expect(analyzePostCount).toBe(1);
    await assertHealthyMobilePage(page, diagnostics);
  });
});
