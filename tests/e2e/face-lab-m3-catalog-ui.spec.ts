import { expect, test, type Page } from "playwright/test";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../../lib/face-lab-observation-contract.js";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V7X6SIAAAAASUVORK5CYII=",
  "base64"
);

function syntheticAnalysis() {
  const observations: Record<string, Record<string, unknown>> = {};
  for (const [group, definitions] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    observations[group] = {};
    for (const [key, values] of Object.entries(definitions)) {
      observations[group][key] = {
        value: group === "featureLayout" && key === "focalFeatures"
          ? [values[0]] : values[0],
        visibility: "clear",
        evidence: [`synthetic-fixture:${group}.${key}`],
        unavailableReason: null
      };
    }
  }
  const analysis = buildFaceLabObservationAnalysis({
    quality: {
      faceVisibility: "clear",
      faceScale: "adequate",
      pose: { yaw: "frontal", pitch: "level", roll: "level" },
      occlusion: { forehead: "none", brows: "none", eyes: "none", cheeks: "none", jawline: "none" },
      sharpness: "clear",
      exposure: "balanced",
      lightingUniformity: "even",
      whiteBalance: "stable",
      filterOrEditing: "none_detected",
      makeupCoverage: "none_or_light",
      structureSuitability: "suitable",
      colorSuitability: "suitable",
      evidence: ["synthetic-fixture:quality"]
    },
    observations
  }, {
    eligibility: { faceLabEligible: true },
    provider: "synthetic_fixture_only",
    model: "not-a-real-person"
  });
  if (analysis.status !== "available") throw new Error("Synthetic fixture is not eligible");
  return analysis;
}

async function approveTarget(page: Page) {
  await page.route("**/api/face-reading-test", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "available",
        source: "vision",
        failureReason: null,
        analyzedAt: "2026-10-14T00:00:00.000Z",
        data: { analysis: syntheticAnalysis() },
        eligibility: { faceLabEligible: true }
      })
    });
  });
  const response = await page.goto("/face-lab-test", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  // React must be hydrated before the mock file selection event is dispatched.
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"][accept*="image/png"]').setInputFiles({
    name: "synthetic-no-person.png",
    mimeType: "image/png",
    buffer: PNG_1X1
  });
  await page.getByRole("button", { name: "명확해요", exact: true }).click();
  await page.getByRole("button", { name: "세련된", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "헤어", exact: true }).click();
  await page.getByRole("button", { name: "메이크업", exact: true }).click();
  await page.getByRole("button", { name: "이대로 결과 보기", exact: true }).click();
  await expect(page.getByRole("button", { name: "추구미 수정", exact: true })).toBeVisible();
}

test.describe("Face Lab M3 unavailable actual merchandise", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("preserves styling guidance but never promotes an unavailable Product/Variant/Shade", async ({ page }) => {
    await approveTarget(page);

    const catalog = page.getByTestId("face-lab-catalog-availability");
    // A default route is only a preview. No execution/SKU state is promoted
    // until the user commits an actual styling route.
    await expect(catalog).toHaveCount(0);
    const selectable = page.locator('button[aria-pressed="false"]');
    await expect(selectable.first()).toBeVisible();
    await selectable.first().click();
    await expect(catalog).toBeVisible();
    await expect(catalog).toHaveAttribute("data-catalog-status", "not_ready");
    await expect(catalog).toContainText("실제 상품·색상 연결");
    await expect(catalog).toContainText("실제 구매 가능한 제품과 색상은 아직 연결되지 않았습니다.");
    await expect(catalog.getByRole("button")).toHaveCount(0);
    await expect(catalog.getByRole("link")).toHaveCount(0);
    await expect(catalog.locator("img")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "추구미 수정", exact: true })).toBeVisible();

    // No fixture-identities, fake prices or checkout links should leak into
    // a user-visible catalog card. Non-catalog route buttons remain available.
    await expect(catalog).not.toContainText(/product_variant:|mock_publication_verified|₩[0-9]/);
  });

  test("keeps the honest merchandise status after a route change on narrow dark mobile", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.emulateMedia({ colorScheme: "dark" });
    await approveTarget(page);

    const catalog = page.getByTestId("face-lab-catalog-availability");
    await expect(catalog).toHaveCount(0);
    const selectRoute = page.locator('button[aria-pressed="false"]');
    await expect(selectRoute.first()).toBeVisible();
    await selectRoute.first().click();
    await expect(catalog).toHaveAttribute("data-catalog-status", "not_ready");

    const alternateRoute = page.locator('button[aria-pressed="false"]').first();
    await expect(alternateRoute).toBeVisible();
    await alternateRoute.click();
    await expect(catalog).toHaveAttribute("data-catalog-status", "not_ready");

    const bounds = await catalog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(321);
    await expect(catalog.getByRole("button")).toHaveCount(0);
  });
});
