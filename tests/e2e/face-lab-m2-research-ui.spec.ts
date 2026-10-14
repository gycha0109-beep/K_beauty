import { expect, test, type Page } from "playwright/test";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../../lib/face-lab-observation-contract.js";

const ONE_PIXEL_IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V7X6SIAAAAASUVORK5CYII=",
  "base64"
);

function syntheticAnalysis(overrides: Record<string, string> = {}) {
  const observations: Record<string, Record<string, unknown>> = {};
  for (const [group, definitions] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    observations[group] = {};
    for (const [key, allowed] of Object.entries(definitions)) {
      observations[group][key] = {
        value: group === "featureLayout" && key === "focalFeatures"
          ? [allowed[0]] : allowed[0],
        visibility: "clear",
        evidence: [`fixture:${group}.${key}`],
        unavailableReason: null
      };
    }
  }
  const analysis = buildFaceLabObservationAnalysis({
    quality: {
      faceVisibility: "clear", faceScale: "adequate",
      pose: { yaw: "frontal", pitch: "level", roll: "level" },
      occlusion: { forehead: "none", brows: "none", eyes: "none", cheeks: "none", jawline: "none" },
      sharpness: "clear", exposure: "balanced", lightingUniformity: "even",
      whiteBalance: "stable", filterOrEditing: "none_detected",
      makeupCoverage: "none_or_light", structureSuitability: "suitable",
      colorSuitability: "suitable", evidence: ["fixture:quality"],
      ...overrides
    },
    observations
  }, {
    eligibility: { faceLabEligible: true },
    provider: "fixture_only",
    model: "synthetic-no-face"
  });
  expect(analysis.status).toBe("available");
  return analysis;
}

async function showResearch(page: Page, qualityOverrides: Record<string, string> = {}) {
  await page.route("**/api/face-reading-test", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "available", source: "vision", failureReason: null,
        analyzedAt: "2026-10-14T00:00:00.000Z",
        data: { analysis: syntheticAnalysis(qualityOverrides) },
        eligibility: { faceLabEligible: true }
      })
    });
  });
  const response = await page.goto("/face-lab-test", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await page.locator('input[type="file"][accept*="image/png"]').setInputFiles({
    name: "synthetic-m2-no-person.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_IMAGE
  });
  const preview = page.getByTestId("face-lab-personal-color-research");
  try {
    await expect(preview).toBeVisible();
  } catch {
    const body = await page.locator("body").innerText().catch(() => "BODY_UNAVAILABLE");
    throw new Error(
      `M2_RESEARCH_PREVIEW_NOT_RENDERED body=${body.replace(/\\s+/g, " ").slice(0, 1400)}`
    );
  }
}

test.describe("Face Lab M2 developer-only palette exploration", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows three photo-appearance reference families without SKU or season claims", async ({ page }) => {
    await showResearch(page);
    const preview = page.getByTestId("face-lab-personal-color-research");
    await expect(preview).toHaveAttribute("data-palette-status", "exploratory");
    await expect(preview.getByText("사진에서 관찰된 색감")).toBeVisible();
    await expect(preview.getByText("겉보기 온도")).toBeVisible();
    await expect(preview.locator("span").filter({ hasText: /Espresso|Rust|Ochre/ })).toHaveCount(3);
    await expect(preview).not.toContainText(/4계절|12유형|상품 구매|정확한 웜톤/);
  });

  test("withholds palette families when white balance is unstable", async ({ page }) => {
    await showResearch(page, { whiteBalance: "warm_cast" });
    const preview = page.getByTestId("face-lab-personal-color-research");
    await expect(preview).toHaveAttribute("data-palette-status", "insufficient_evidence");
    await expect(preview).toContainText("색상 후보를 제안할 만큼 확인된 근거가 없습니다.");
    await expect(preview).not.toContainText(/Espresso|Rust|Ochre/);
  });
});
