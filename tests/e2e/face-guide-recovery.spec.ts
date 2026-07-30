import { expect, test, type Page } from "playwright/test";

type RecoveryWindow = typeof window & {
  __bejewelyFaceLandmarkerFactory?: (options?: { preferCpu?: boolean }) => Promise<{
    close: () => void;
    detectForVideo: () => { faceLandmarks: Array<Array<{ x: number; y: number; z: number }>> };
  }>;
  __faceGuideCloseCount?: number;
  __faceGuideDelegateAttempts?: string[];
};

async function installRecoveryMock(page: Page) {
  await page.addInitScript(() => {
    const recoveryWindow = window as RecoveryWindow;
    recoveryWindow.__faceGuideCloseCount = 0;
    recoveryWindow.__faceGuideDelegateAttempts = [];
    recoveryWindow.__bejewelyFaceLandmarkerFactory = async ({ preferCpu = false } = {}) => {
      recoveryWindow.__faceGuideDelegateAttempts?.push(preferCpu ? "cpu" : "gpu");

      return {
        close: () => {
          recoveryWindow.__faceGuideCloseCount = (recoveryWindow.__faceGuideCloseCount || 0) + 1;
        },
        detectForVideo: () => {
          if (!preferCpu) {
            throw new Error("mock_gpu_inference_failure");
          }

          return { faceLandmarks: [] };
        }
      };
    };

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext("2d");
          const stream = canvas.captureStream(12);
          const track = stream.getVideoTracks()[0];

          if (context) {
            context.fillStyle = "rgb(32, 32, 32)";
            context.fillRect(0, 0, canvas.width, canvas.height);
          }
          track?.requestFrame?.();
          return stream;
        }
      }
    });
  });
}

function cameraButton(page: Page) {
  return page.getByRole("button", { name: "지금 촬영하기", exact: true });
}

async function openHome(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(cameraButton(page)).toBeVisible();
  await expect(cameraButton(page)).toBeEnabled();
}

test.describe("MediaPipe runtime recovery", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.setTimeout(60000);

  test("replaces a GPU inference failure with a clean CPU session across reopen", async ({ page }) => {
    await installRecoveryMock(page);
    await openHome(page);

    await cameraButton(page).click();
    const overlay = page.getByTestId("mobile-camera-overlay");

    await expect(overlay).toHaveAttribute("data-camera-phase", "open");
    await expect(page.getByTestId("face-guide-message")).toHaveText("얼굴을 타원 안에 맞춰 주세요");
    await expect(overlay).toHaveAttribute("data-face-guide-error-stage", "none");
    await expect
      .poll(() =>
        page.evaluate(() => (window as RecoveryWindow).__faceGuideDelegateAttempts)
      )
      .toEqual(["gpu", "cpu"]);
    await expect
      .poll(() => page.evaluate(() => (window as RecoveryWindow).__faceGuideCloseCount))
      .toBeGreaterThanOrEqual(1);

    await page.getByRole("button", { name: "카메라 닫기", exact: true }).click();
    await expect(overlay).toHaveCount(0);

    await cameraButton(page).click();
    const reopenedOverlay = page.getByTestId("mobile-camera-overlay");
    await expect(reopenedOverlay).toHaveAttribute("data-camera-phase", "open");
    await expect(page.getByTestId("face-guide-message")).toHaveText("얼굴을 타원 안에 맞춰 주세요");
    await expect(reopenedOverlay).toHaveAttribute("data-face-guide-error-stage", "none");
    await expect
      .poll(() =>
        page.evaluate(() => (window as RecoveryWindow).__faceGuideDelegateAttempts)
      )
      .toEqual(["gpu", "cpu", "cpu"]);
  });
});
