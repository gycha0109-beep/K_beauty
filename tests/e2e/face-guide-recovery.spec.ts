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
          const stream = canvas.captureStream(20);
          const track = stream.getVideoTracks()[0];
          let frame = 0;

          const paintFrame = () => {
            if (!context || track?.readyState === "ended") {
              return;
            }

            context.fillStyle = frame % 2 === 0 ? "rgb(32, 32, 32)" : "rgb(33, 33, 33)";
            context.fillRect(0, 0, canvas.width, canvas.height);
            track?.requestFrame?.();
            frame += 1;
          };

          paintFrame();
          const frameTimer = window.setInterval(paintFrame, 50);
          track?.addEventListener(
            "ended",
            () => {
              window.clearInterval(frameTimer);
            },
            { once: true }
          );

          return stream;
        }
      }
    });
  });
}

function cameraButton(page: Page) {
  return page.locator("button.ui-button-primary").first();
}

function closeCameraButton(page: Page) {
  return page.getByTestId("mobile-camera-overlay").locator("button").first();
}

async function openHome(page: Page) {
  page.on("pageerror", (error) => {
    console.log(`recovery-page-error: ${error.name}: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.log(`recovery-console-error: ${message.text()}`);
    }
  });

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  console.log(`recovery-page-status: ${response?.status() ?? "none"}`);
  console.log(`recovery-page-url: ${page.url()}`);

  try {
    await expect(cameraButton(page)).toBeVisible();
    await expect(cameraButton(page)).toBeEnabled();
  } catch (error) {
    const bodyText = await page.locator("body").innerText().catch(() => "<body unavailable>");
    console.log(`recovery-page-body: ${bodyText.slice(0, 1500)}`);
    throw error;
  }
}

async function expectCpuNoFaceState(page: Page) {
  const overlay = page.getByTestId("mobile-camera-overlay");
  await expect(overlay).toHaveAttribute("data-camera-phase", "open");
  await expect(page.locator('[data-face-guide-state="no_face"]')).toBeVisible();
  await expect(overlay).toHaveAttribute("data-face-guide-error-stage", "none");
}

test.describe("MediaPipe runtime recovery", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.setTimeout(60000);

  test("replaces a GPU inference failure with a clean CPU session across reopen", async ({ page }) => {
    await installRecoveryMock(page);
    await openHome(page);

    await cameraButton(page).click();
    const overlay = page.getByTestId("mobile-camera-overlay");

    await expectCpuNoFaceState(page);
    await expect
      .poll(() =>
        page.evaluate(() => (window as RecoveryWindow).__faceGuideDelegateAttempts)
      )
      .toEqual(["gpu", "cpu"]);
    await expect
      .poll(() => page.evaluate(() => (window as RecoveryWindow).__faceGuideCloseCount))
      .toBeGreaterThanOrEqual(1);

    await closeCameraButton(page).click();
    await expect(overlay).toHaveCount(0);

    await cameraButton(page).click();
    await expectCpuNoFaceState(page);
    await expect
      .poll(() =>
        page.evaluate(() => (window as RecoveryWindow).__faceGuideDelegateAttempts)
      )
      .toEqual(["gpu", "cpu", "cpu"]);
  });
});
