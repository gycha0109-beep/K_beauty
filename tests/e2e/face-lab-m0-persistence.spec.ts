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
        evidence: [`fixture:${group}.${key}`],
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
      evidence: ["fixture:quality"]
    },
    observations
  }, {
    eligibility: { faceLabEligible: true },
    provider: "fixture_only",
    model: "synthetic-not-a-person"
  });
  if (analysis.status !== "available") throw new Error("Invalid M0 synthetic observation fixture");
  return analysis;
}

async function openSyntheticFaceLab(page: Page) {
  const analysis = syntheticAnalysis();
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
        data: { analysis },
        eligibility: { faceLabEligible: true }
      })
    });
  });
  const response = await page.goto("/face-lab-test", { waitUntil: "domcontentloaded" });
  expect(response?.status(), "development-only Face Lab test route must load").toBe(200);
  // Wait for Next.js hydration before dispatching the synthetic file-input change.
  // A DOMContentLoaded-only navigation can race React listener attachment in CI.
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"][accept*="image/png"]').setInputFiles({
    name: "synthetic-m0-no-person.png",
    mimeType: "image/png",
    buffer: PNG_1X1
  });
  await expect(page.getByRole("button", { name: "명확해요", exact: true })).toBeVisible();
}

async function approveSyntheticTarget(page: Page) {
  await page.getByRole("button", { name: "명확해요", exact: true }).click();
  await page.getByRole("button", { name: "세련된", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "헤어", exact: true }).click();
  await page.getByRole("button", { name: "메이크업", exact: true }).click();
  await page.getByRole("button", { name: "이대로 결과 보기", exact: true }).click();
  await expect(page.getByRole("button", { name: "추구미 수정", exact: true })).toBeVisible();
}

async function getLocalState(page: Page) {
  return page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith("bejewely:face-lab-v2:"));
    return keys.length === 1 ? { key: keys[0], value: localStorage.getItem(keys[0]) } : null;
  });
}

test.describe("Face Lab M0-B synthetic browser persistence", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps approved result and local pending save unchanged after cancelling target edits", async ({ page }) => {
    await openSyntheticFaceLab(page);
    await approveSyntheticTarget(page);
    await expect(page.locator('[data-face-lab-persistence-status="pending"]')).toBeVisible();
    const before = await getLocalState(page);
    expect(before?.key).toMatch(/^bejewely:face-lab-v2:/);
    expect(before?.value).toContain('"targetSelections":["sophisticated"]');

    await page.getByRole("button", { name: "추구미 수정", exact: true }).click();
    await expect(page.locator('[data-face-lab-target-back="cancel-edit"]')).toBeVisible();
    await page.getByRole("button", { name: "부드러운", exact: true }).click();
    await page.locator('[data-face-lab-target-back="cancel-edit"]').click();
    await expect(page.getByRole("button", { name: "추구미 수정", exact: true })).toBeVisible();
    await expect(page.getByText("세련된", { exact: true })).toBeVisible();
    expect(await getLocalState(page), "cancelling a draft must not write or overwrite the approved payload")
      .toEqual(before);
  });

  test("requires both partial clarifiers before approving and keeps the saved values", async ({ page }) => {
    await openSyntheticFaceLab(page);
    await page.getByRole("button", { name: "대충 있어요", exact: true }).click();
    await page.getByRole("button", { name: "세련된", exact: true }).click();
    const next = page.getByRole("button", { name: "다음", exact: true });
    await expect(next).toBeDisabled();

    await page.getByRole("button", { name: "부드러운 쪽", exact: true }).click();
    await expect(next).toBeDisabled();
    await page.getByRole("button", { name: "힘 뺀 쪽", exact: true }).click();
    await expect(next).toBeEnabled();
    await next.click();

    await page.getByRole("button", { name: "헤어", exact: true }).click();
    await page.getByRole("button", { name: "이대로 결과 보기", exact: true }).click();
    await expect(page.locator('[data-face-lab-persistence-status="pending"]')).toBeVisible();
    const raw = await getLocalState(page);
    const stored = JSON.parse(raw?.value || "{}");
    expect(stored.surveyAnswers.entryMode).toBe("partial");
    expect(stored.surveyAnswers.clarifiers).toEqual({
      softSharp: "soft", naturalPolished: "natural"
    });
    expect(stored.surveyAnswers.targetSelections).toEqual(["sophisticated"]);
    expect(stored.syncStatus).toBe("pending");
  });

  test("handles Finder back and inconclusive choices without inventing a user-approved target", async ({ page }) => {
    await openSyntheticFaceLab(page);
    await page.getByRole("button", { name: "잘 모르겠어요", exact: true }).click();

    await expect(page.getByText("1/5", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "둘 다 좋아요", exact: true }).click();
    await expect(page.getByText("2/5", { exact: true })).toBeVisible();
    await page.locator('[data-face-lab-finder-back="previous-round"]').click();
    await expect(page.getByText("1/5", { exact: true })).toBeVisible();

    for (let round = 1; round <= 5; round += 1) {
      await expect(page.getByText(`${round}/5`, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "둘 다 별로예요", exact: true }).click();
    }

    await expect(page.getByText("선택만으로 한 방향을 정하기 어려웠습니다.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "세련된", exact: true }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page.getByRole("button", { name: "헤어", exact: true }).click();
    await page.getByRole("button", { name: "이대로 결과 보기", exact: true }).click();

    await expect(page.locator('[data-face-lab-persistence-status="pending"]')).toBeVisible();
    const saved = JSON.parse((await getLocalState(page))?.value || "{}");
    expect(saved.surveyAnswers.entryMode).toBe("known");
    expect(saved.surveyAnswers.targetSelections).toEqual(["sophisticated"]);
    expect(saved.targetFinderResult).toBeNull();
    expect(saved.syncStatus).toBe("pending");
  });

  test("restores approved local target and route after a full browser reload", async ({ page }) => {
    await openSyntheticFaceLab(page);
    await approveSyntheticTarget(page);
    await expect(page.locator('[data-face-lab-persistence-status="pending"]')).toBeVisible();
    const before = await getLocalState(page);
    expect(before?.value).toContain('"targetSelections":["sophisticated"]');

    await page.reload({ waitUntil: "networkidle" });
    // A page reload does not restore the input File; users may re-select the
    // same synthetic file, while the bounded approved local snapshot survives.
    await page.locator('input[type="file"][accept*="image/png"]').setInputFiles({
      name: "synthetic-m0-no-person.png",
      mimeType: "image/png",
      buffer: PNG_1X1
    });
    await expect(page.getByRole("button", { name: "추구미 수정", exact: true })).toBeVisible();
    await expect(page.locator('[data-face-lab-persistence-status="pending"]')).toBeVisible();
    expect(await getLocalState(page), "reentry must not silently change an approved pending payload")
      .toEqual(before);
  });

  test("reports storage failure without claiming the draft was saved", async ({ page }) => {
    await openSyntheticFaceLab(page);
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("Synthetic storage failure", "QuotaExceededError");
      };
    });
    await approveSyntheticTarget(page);
    await expect(page.locator('[data-face-lab-persistence-status="local_failed"]')).toBeVisible();
    await expect(page.locator('[data-face-lab-save-retry="local_failed"]')).toBeVisible();
    expect(await getLocalState(page)).toBeNull();
  });
});
