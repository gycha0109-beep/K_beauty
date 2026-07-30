import { expect, test, type APIResponse, type Page } from "playwright/test";

type RuntimeWindow = typeof window & {
  __bejewelyFaceLandmarkerFactory?: unknown;
  __runtimeCameraStops?: number;
};

const ASSET_CONTRACTS = [
  {
    bytes: 3_758_596,
    contentType: "application/octet-stream",
    path: "/api/mediapipe/face_landmarker.task"
  },
  {
    bytes: 136_993,
    contentType: "text/javascript",
    path: "/api/mediapipe/vision_bundle.mjs"
  },
  {
    bytes: 322_044,
    contentType: "text/javascript",
    path: "/api/mediapipe/wasm/vision_wasm_internal.js"
  },
  {
    bytes: 11_153_617,
    contentType: "application/wasm",
    path: "/api/mediapipe/wasm/vision_wasm_internal.wasm"
  },
  {
    bytes: 321_847,
    contentType: "text/javascript",
    path: "/api/mediapipe/wasm/vision_wasm_nosimd_internal.js"
  },
  {
    bytes: 10_481_398,
    contentType: "application/wasm",
    path: "/api/mediapipe/wasm/vision_wasm_nosimd_internal.wasm"
  }
] as const;

async function installRealRuntimeCamera(page: Page) {
  await page.addInitScript(() => {
    const runtimeWindow = window as RuntimeWindow;
    runtimeWindow.__runtimeCameraStops = 0;

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
            context.fillStyle = frame % 2 === 0 ? "rgb(24, 31, 39)" : "rgb(25, 32, 40)";
            context.fillRect(0, 0, canvas.width, canvas.height);
            track?.requestFrame?.();
            frame += 1;
          };

          paintFrame();
          const frameTimer = window.setInterval(paintFrame, 50);
          track?.addEventListener("ended", () => window.clearInterval(frameTimer), {
            once: true
          });

          for (const streamTrack of stream.getTracks()) {
            const originalStop = streamTrack.stop.bind(streamTrack);
            streamTrack.stop = () => {
              runtimeWindow.__runtimeCameraStops =
                (runtimeWindow.__runtimeCameraStops || 0) + 1;
              originalStop();
            };
          }

          return stream;
        }
      }
    });
  });
}

function cameraButton(page: Page) {
  return page.locator("button.ui-button-primary").first();
}

function cameraOverlay(page: Page) {
  return page.getByTestId("mobile-camera-overlay");
}

async function openHydratedHome(page: Page) {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(cameraButton(page)).toBeVisible();
  await expect(cameraButton(page)).toBeEnabled();
}

async function openRealRuntimeCamera(page: Page) {
  await cameraButton(page).click();
  const overlay = cameraOverlay(page);
  await expect(overlay).toHaveAttribute("data-camera-phase", "open");
  await expect(overlay).toHaveAttribute("data-face-guide-state", "no_face", {
    timeout: 90_000
  });
  await expect(overlay).toHaveAttribute("data-face-guide-error-stage", "none");
  await expect(overlay).toHaveAttribute("data-face-guide-error-category", "none");
  return overlay;
}

async function expectSafeUnavailable(page: Page) {
  const overlay = cameraOverlay(page);
  await expect(overlay).toHaveAttribute("data-face-guide-state", "unavailable", {
    timeout: 90_000
  });
  await expect(overlay).not.toHaveAttribute("data-face-guide-error-stage", "none");
  await expect(overlay).not.toHaveAttribute("data-face-guide-error-category", "none");
  await expect(overlay).not.toContainText(/(?:404|Unexpected end of input|WebAssembly)/);
  return overlay;
}

async function expectAssetContract(response: APIResponse, contract: (typeof ASSET_CONTRACTS)[number]) {
  expect(response.status(), contract.path).toBe(200);
  expect(response.headers()["content-type"], contract.path).toContain(contract.contentType);
  const contentLength = response.headers()["content-length"];
  if (contentLength !== undefined) {
    expect(contentLength, contract.path).toBe(String(contract.bytes));
  }
  expect(response.headers()["x-bejewely-mediapipe-asset-bytes"], contract.path).toBe(
    String(contract.bytes)
  );

  const body = await response.body();
  expect(body.byteLength, contract.path).toBe(contract.bytes);
  if (contract.contentType === "application/wasm") {
    expect(Array.from(body.subarray(0, 4)), contract.path).toEqual([0, 97, 115, 109]);
  } else {
    expect(body.subarray(0, 64).toString("utf8"), contract.path).not.toMatch(
      /^\s*(?:<!doctype\s+html|<html)\b/i
    );
  }
}

test.describe("real MediaPipe browser runtime", () => {
  test.setTimeout(180_000);

  test("serves complete same-origin model and WASM assets", async ({ request }) => {
    for (const contract of ASSET_CONTRACTS) {
      const response = await request.get(contract.path);
      await expectAssetContract(response, contract);
    }
  });

  test("initializes, detects a blank frame, closes, and initializes again without a factory", async ({
    page
  }) => {
    await installRealRuntimeCamera(page);
    await openHydratedHome(page);
    await expect
      .poll(() =>
        page.evaluate(() => typeof (window as RuntimeWindow).__bejewelyFaceLandmarkerFactory)
      )
      .toBe("undefined");

    const overlay = await openRealRuntimeCamera(page);
    await expect(overlay).toHaveAttribute("data-face-guide-delegate", /^(?:gpu|cpu)$/);
    await expect(overlay).toHaveAttribute("data-face-guide-wasm-capable", "true");

    await overlay.locator("button").first().click();
    await expect(overlay).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => (window as RuntimeWindow).__runtimeCameraStops))
      .toBeGreaterThanOrEqual(1);

    const reopenedOverlay = await openRealRuntimeCamera(page);
    await expect(reopenedOverlay).toHaveAttribute("data-face-guide-delegate", /^(?:gpu|cpu)$/);
    await expect(reopenedOverlay).toHaveAttribute("data-face-guide-error-stage", "none");
  });

  test("creates the actual CPU delegate and runs a VIDEO inference", async ({ page }) => {
    await installRealRuntimeCamera(page);
    await openHydratedHome(page);

    await openRealRuntimeCamera(page);
    const result = await page.evaluate(async () => {
      const importModule = new Function("path", "return import(path)") as (
        path: string
      ) => Promise<{
        FaceLandmarker: {
          createFromOptions: (
            fileset: unknown,
            options: Record<string, unknown>
          ) => Promise<{
            close: () => void;
            detectForVideo: (
              video: HTMLVideoElement,
              timestamp: number
            ) => { faceLandmarks: unknown[] };
          }>;
        };
        FilesetResolver: {
          forVisionTasks: (path: string) => Promise<unknown>;
        };
      }>;
      const { FaceLandmarker, FilesetResolver } = await importModule(
        "/api/mediapipe/vision_bundle.mjs"
      );
      const fileset = await FilesetResolver.forVisionTasks(
        `${window.location.origin}/api/mediapipe/wasm`
      );
      const landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: `${window.location.origin}/api/mediapipe/face_landmarker.task`
        },
        runningMode: "VIDEO"
      });

      try {
        const video = document.querySelector<HTMLVideoElement>(
          '[data-testid="mobile-camera-overlay"] video'
        );
        if (!video) {
          throw new Error("runtime_test_video_missing");
        }
        const detection = landmarker.detectForVideo(video, performance.now());
        return {
          faceLandmarksIsArray: Array.isArray(detection.faceLandmarks),
          factoryType: typeof (window as RuntimeWindow).__bejewelyFaceLandmarkerFactory
        };
      } finally {
        landmarker.close();
      }
    });

    expect(result).toEqual({
      faceLandmarksIsArray: true,
      factoryType: "undefined"
    });
  });

  test("propagates a truncated loader as a safe parse-stage diagnostic", async ({ page }) => {
    await page.route("**/api/mediapipe/wasm/vision_wasm_internal.js", async (route) => {
      await route.fulfill({
        body: "var createMediapipeSolutionsWasm = function(",
        contentType: "text/javascript; charset=utf-8",
        status: 200
      });
    });
    await installRealRuntimeCamera(page);
    await openHydratedHome(page);

    await cameraButton(page).click();
    const overlay = await expectSafeUnavailable(page);
    await expect(overlay).toHaveAttribute(
      "data-face-guide-error-stage",
      "cpu_delegate_initialization"
    );
    await expect(overlay).toHaveAttribute(
      "data-face-guide-error-category",
      "asset_script_parse"
    );
    await expect(overlay).toHaveAttribute("data-face-guide-error-name", "SyntaxError");
    await expect(overlay).toHaveAttribute("data-face-guide-delegate", "cpu");
    await expect(overlay).toHaveAttribute("data-face-guide-recovery-attempted", "true");
    await expect(overlay).not.toContainText("Unexpected end of input");
  });

  test("reports a missing WASM binary without exposing the runtime error", async ({ page }) => {
    await page.route("**/api/mediapipe/wasm/*.wasm", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "test_wasm_missing" }),
        contentType: "application/json",
        status: 404
      });
    });
    await installRealRuntimeCamera(page);
    await openHydratedHome(page);

    await cameraButton(page).click();
    const overlay = await expectSafeUnavailable(page);
    await expect(overlay).toHaveAttribute(
      "data-face-guide-error-stage",
      /^(?:wasm_fileset|delegate_initialization|cpu_delegate_initialization)$/
    );
  });

  test("reports a missing model without exposing the fetch error", async ({ page }) => {
    await page.route("**/api/mediapipe/face_landmarker.task", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "test_model_missing" }),
        contentType: "application/json",
        status: 404
      });
    });
    await installRealRuntimeCamera(page);
    await openHydratedHome(page);

    await cameraButton(page).click();
    const overlay = await expectSafeUnavailable(page);
    await expect(overlay).toHaveAttribute(
      "data-face-guide-error-stage",
      /^(?:delegate_initialization|cpu_delegate_initialization)$/
    );
    await expect(overlay).toHaveAttribute("data-face-guide-delegate", "cpu");
  });
});
