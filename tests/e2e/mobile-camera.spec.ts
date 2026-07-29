import { expect, test, type Page } from "playwright/test";

type CameraMockOptions = {
  deferFirstFrame?: boolean;
  deny?: boolean;
  pending?: boolean;
};

async function installCameraMock(page: Page, options: CameraMockOptions = {}) {
  await page.addInitScript(({ deferFirstFrame, deny, pending }) => {
    const cameraWindow = window as typeof window & {
      __cameraGetUserMediaCalls?: number;
      __cameraStops?: number;
      __cameraStreams?: MediaStream[];
      __cameraCanvases?: HTMLCanvasElement[];
      __releaseCameraFrame?: () => void;
      __resolveCameraRequest?: () => void;
    };

    cameraWindow.__cameraGetUserMediaCalls = 0;
    cameraWindow.__cameraStops = 0;
    cameraWindow.__cameraStreams = [];
    cameraWindow.__cameraCanvases = [];

    const createStream = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext("2d");
      const stream = canvas.captureStream(deferFirstFrame ? 0 : 12);
      const track = stream.getVideoTracks()[0];

      const paintFrame = () => {
        if (context) {
          context.fillStyle = "rgb(255, 79, 138)";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        track?.requestFrame?.();
      };

      if (deferFirstFrame) {
        cameraWindow.__releaseCameraFrame = paintFrame;
      } else {
        paintFrame();
      }

      for (const streamTrack of stream.getTracks()) {
        const originalStop = streamTrack.stop.bind(streamTrack);
        streamTrack.stop = () => {
          cameraWindow.__cameraStops = (cameraWindow.__cameraStops || 0) + 1;
          originalStop();
        };
      }

      cameraWindow.__cameraCanvases?.push(canvas);
      cameraWindow.__cameraStreams?.push(stream);
      return stream;
    };

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          cameraWindow.__cameraGetUserMediaCalls = (cameraWindow.__cameraGetUserMediaCalls || 0) + 1;

          if (deny) {
            throw new DOMException("Permission denied", "NotAllowedError");
          }

          if (pending) {
            return new Promise<MediaStream>((resolve) => {
              cameraWindow.__resolveCameraRequest = () => resolve(createStream());
            });
          }

          return createStream();
        }
      }
    });
  }, options);
}

async function openHydratedPage(page: Page, path = "/") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

function getCameraOpenButton(page: Page) {
  return page.locator("button.ui-button-primary");
}

function getFullscreenCloseButton(page: Page) {
  return page.getByTestId("mobile-camera-overlay").locator("button").first();
}

test.describe("mobile fullscreen camera", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens from the capture area, closes with cleanup, and re-enters once", async ({ page }) => {
    await installCameraMock(page);
    await openHydratedPage(page);

    const openButton = page.getByRole("button", { name: "지금 촬영하기", exact: true });
    await page.evaluate(() => {
      const cameraWindow = window as typeof window & { __cameraPhases?: string[] };
      cameraWindow.__cameraPhases = [];
      const observer = new MutationObserver(() => {
        const phase = document.querySelector('[data-testid="mobile-camera-overlay"]')?.getAttribute("data-camera-phase");
        if (phase && cameraWindow.__cameraPhases?.at(-1) !== phase) {
          cameraWindow.__cameraPhases?.push(phase);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    });
    await openButton.click();

    const overlay = page.getByTestId("mobile-camera-overlay");
    await expect(overlay).toHaveAttribute("data-camera-phase", "open");
    await expect(page.locator('[data-face-guide-state="idle"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "카메라 닫기", exact: true })).toBeFocused();
    await expect(page.getByRole("button", { name: "사진 촬영", exact: true })).toBeEnabled();
    await expect(page.locator("body")).toHaveCSS("position", "fixed");
    await expect
      .poll(() =>
        page.evaluate(() => (window as typeof window & { __cameraPhases?: string[] }).__cameraPhases)
      )
      .toEqual(expect.arrayContaining(["requesting", "waiting_for_frame", "expanding", "open"]));

    await page.getByRole("button", { name: "카메라 닫기", exact: true }).click();
    await expect(overlay).toHaveCount(0);
    await expect(page.locator("body")).toHaveCSS("position", "static");
    await expect(openButton).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => (window as typeof window & { __cameraStops?: number }).__cameraStops))
      .toBe(1);

    await openButton.click();
    await expect(overlay).toHaveAttribute("data-camera-phase", "open");
    await expect(overlay).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { __cameraGetUserMediaCalls?: number }).__cameraGetUserMediaCalls
        )
      )
      .toBe(2);

    await page.getByRole("button", { name: "카메라 닫기", exact: true }).click();
    await expect(overlay).toHaveCount(0);
  });

  test("captures a full-resolution frame and returns to the existing preview flow", async ({ page }) => {
    await installCameraMock(page);
    await openHydratedPage(page);
    await page.getByRole("button", { name: "지금 촬영하기", exact: true }).click();

    const captureButton = page.getByRole("button", { name: "사진 촬영", exact: true });
    await expect(captureButton).toBeEnabled();
    await captureButton.click();

    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
    await expect(page.getByAltText("업로드한 얼굴 사진 미리보기")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector("canvas");
          return canvas ? { width: canvas.width, height: canvas.height } : null;
        })
      )
      .toEqual({ width: 640, height: 480 });
  });

  test("recovers from denied permission instead of leaving a loading overlay", async ({ page }) => {
    await installCameraMock(page, { deny: true });
    await openHydratedPage(page);
    await page.locator('input[capture="user"]').evaluate((input) => {
      input.addEventListener("click", (event) => event.preventDefault());
    });

    await page.getByRole("button", { name: "지금 촬영하기", exact: true }).click();

    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
    await expect(page.getByText("카메라 접근에 실패했습니다.")).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("position", "static");
    await expect
      .poll(() => page.evaluate(() => Boolean(window.history.state?.bejewelyMobileCamera)))
      .toBe(false);
  });

  test("keeps the oval and controls separated on a small portrait viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await installCameraMock(page);
    await openHydratedPage(page);
    await page.getByRole("button", { name: "지금 촬영하기", exact: true }).click();
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveAttribute("data-camera-phase", "open");

    const guideBox = await page.locator('[data-face-guide-state="idle"] > div').boundingBox();
    const closeBox = await page.getByRole("button", { name: "카메라 닫기", exact: true }).boundingBox();
    const captureBox = await page.getByRole("button", { name: "사진 촬영", exact: true }).boundingBox();

    expect(guideBox).not.toBeNull();
    expect(closeBox).not.toBeNull();
    expect(captureBox).not.toBeNull();
    expect(guideBox!.y).toBeGreaterThanOrEqual(closeBox!.y + closeBox!.height);
    expect(guideBox!.y + guideBox!.height).toBeLessThanOrEqual(captureBox!.y);

    await page.setViewportSize({ width: 568, height: 320 });
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCSS("width", "568px");
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCSS("height", "320px");
    await expect(page.getByRole("button", { name: "카메라 닫기", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "사진 촬영", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "카메라 닫기", exact: true }).click();
  });

  test("honors reduced motion without leaving the transition locked", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installCameraMock(page);
    await openHydratedPage(page);
    await page.getByRole("button", { name: "지금 촬영하기", exact: true }).click();

    await expect(page.getByTestId("mobile-camera-overlay")).toHaveAttribute("data-camera-phase", "open");
    await page.getByRole("button", { name: "카메라 닫기", exact: true }).click();
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
    await expect(page.locator("body")).toHaveCSS("position", "static");
  });

  test("preserves gallery selection without opening a stream", async ({ page }) => {
    await installCameraMock(page);
    await openHydratedPage(page);

    await page.locator('input[type="file"]:not([capture])').setInputFiles({
      name: "face.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64"
      )
    });

    await expect(page.getByAltText("업로드한 얼굴 사진 미리보기")).toBeVisible();
    const getUserMediaCalls = await page.evaluate(
      () => (window as typeof window & { __cameraGetUserMediaCalls?: number }).__cameraGetUserMediaCalls
    );
    expect(getUserMediaCalls).toBe(0);
  });

  test("consumes one browser back navigation to close the camera and restores the page", async ({ page }) => {
    await installCameraMock(page);
    await openHydratedPage(page);

    const openButton = getCameraOpenButton(page);
    await openButton.click();
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveAttribute("data-camera-phase", "open");

    const pathnameBeforeBack = new URL(page.url()).pathname;
    await page.evaluate(() => window.history.back());

    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
    await expect(page.locator("body")).toHaveCSS("position", "static");
    await expect(openButton).toBeFocused();
    await expect.poll(() => new URL(page.url()).pathname).toBe(pathnameBeforeBack);
    await expect
      .poll(() => page.evaluate(() => (window as typeof window & { __cameraStops?: number }).__cameraStops))
      .toBe(1);
  });

  test("removes the camera history entry after X close", async ({ page }) => {
    await installCameraMock(page);
    await openHydratedPage(page, "/?camera-history-source=1");
    await openHydratedPage(page);

    await getCameraOpenButton(page).click();
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveAttribute("data-camera-phase", "open");
    await getFullscreenCloseButton(page).click();
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);

    await page.goBack();
    await expect.poll(() => new URL(page.url()).search).toBe("?camera-history-source=1");
  });

  test("keeps the page visible until a first video frame is available", async ({ page }) => {
    await installCameraMock(page, { deferFirstFrame: true });
    await openHydratedPage(page);

    await getCameraOpenButton(page).click();
    const overlay = page.getByTestId("mobile-camera-overlay");
    await expect(overlay).toHaveAttribute("data-camera-phase", "waiting_for_frame");
    await expect(overlay).toHaveCSS("opacity", "0");
    await expect(page.locator("body")).toHaveCSS("position", "static");
    await expect(getCameraOpenButton(page)).toBeVisible();

    await page.evaluate(() => {
      (window as typeof window & { __releaseCameraFrame?: () => void }).__releaseCameraFrame?.();
    });

    await expect(overlay).toHaveAttribute("data-camera-phase", "open");
    await expect
      .poll(() =>
        overlay.locator("video").evaluate((video) => {
          const element = video as HTMLVideoElement;
          return element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && element.videoWidth > 0;
        })
      )
      .toBe(true);
    await expect(overlay).toHaveCSS("opacity", "1");
    await getFullscreenCloseButton(page).click();
  });

  test("cancels a pending camera request through browser back and stops its stale stream", async ({ page }) => {
    await installCameraMock(page, { pending: true });
    await openHydratedPage(page);

    await getCameraOpenButton(page).click();
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveAttribute("data-camera-phase", "requesting");
    await expect(page.locator("body")).toHaveCSS("position", "static");

    await page.evaluate(() => window.history.back());
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
    await page.evaluate(() => {
      (window as typeof window & { __resolveCameraRequest?: () => void }).__resolveCameraRequest?.();
    });

    await expect
      .poll(() => page.evaluate(() => (window as typeof window & { __cameraStops?: number }).__cameraStops))
      .toBe(1);
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
  });
});

test("desktop keeps the in-card camera flow", async ({ page }) => {
  await installCameraMock(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openHydratedPage(page);
  await page.getByRole("button", { name: "지금 촬영하기", exact: true }).click();

  await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByRole("button", { name: "취소", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.locator("video")).toHaveCount(0);
});
