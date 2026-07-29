import { expect, test, type Page } from "playwright/test";

type CameraMockOptions = {
  deferFirstFrame?: boolean;
  deny?: boolean;
};

async function installCameraMock(page: Page, options: CameraMockOptions = {}) {
  await page.addInitScript(({ deferFirstFrame, deny }) => {
    const cameraWindow = window as typeof window & {
      __cameraGetUserMediaCalls?: number;
      __cameraStops?: number;
      __cameraStreams?: MediaStream[];
      __cameraCanvases?: HTMLCanvasElement[];
      __releaseCameraFrame?: () => void;
    };

    cameraWindow.__cameraGetUserMediaCalls = 0;
    cameraWindow.__cameraStops = 0;
    cameraWindow.__cameraStreams = [];
    cameraWindow.__cameraCanvases = [];

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          cameraWindow.__cameraGetUserMediaCalls = (cameraWindow.__cameraGetUserMediaCalls || 0) + 1;

          if (deny) {
            throw new DOMException("Permission denied", "NotAllowedError");
          }

          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext("2d");
          const stream = canvas.captureStream(deferFirstFrame ? 0 : 12);
          const track = stream.getVideoTracks()[0];

          const paintFrame = () => {
            if (context) {
              context.fillStyle = "rgb(255, 0, 0)";
              context.fillRect(0, 0, canvas.width / 2, canvas.height);
              context.fillStyle = "rgb(0, 0, 255)";
              context.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);
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
        }
      }
    });
  }, options);
}

async function openHydratedHome(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

function getCameraOpenButton(page: Page) {
  return page.getByRole("button", { name: "지금 촬영하기", exact: true });
}

test.describe("mobile fullscreen camera", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("prepares the live video invisibly before the fullscreen expansion", async ({ page }) => {
    await installCameraMock(page, { deferFirstFrame: true });
    await openHydratedHome(page);

    const openButton = getCameraOpenButton(page);
    await openButton.click();

    const overlay = page.getByTestId("mobile-camera-overlay");
    await expect(overlay).toHaveAttribute("data-camera-phase", "preparing");
    await expect(overlay).toHaveCSS("opacity", "0.001");
    await expect(page.locator("body")).toHaveCSS("position", "static");
    await expect(openButton).toBeVisible();
    await expect(page.locator('input[capture="user"]')).toBeDisabled();

    await page.evaluate(() => {
      (window as typeof window & { __releaseCameraFrame?: () => void }).__releaseCameraFrame?.();
    });

    await expect(overlay).toHaveAttribute("data-camera-phase", "open");
    await expect(overlay).toHaveCSS("opacity", "1");
    await expect(overlay.locator("video")).toHaveAttribute("data-preview-orientation", "mirrored");
    await expect(overlay.locator("video")).toHaveClass(/scale-x-\[-1\]/);
    await expect(page.locator("body")).toHaveCSS("position", "fixed");
  });

  test("opens, closes with cleanup, and re-enters once", async ({ page }) => {
    await installCameraMock(page);
    await openHydratedHome(page);

    const openButton = getCameraOpenButton(page);
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
    await expect
      .poll(() => page.evaluate(() => (window as typeof window & { __cameraPhases?: string[] }).__cameraPhases))
      .toEqual(expect.arrayContaining(["preparing", "opening", "open"]));

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
        page.evaluate(() => (window as typeof window & { __cameraGetUserMediaCalls?: number }).__cameraGetUserMediaCalls)
      )
      .toBe(2);

    await page.getByRole("button", { name: "카메라 닫기", exact: true }).click();
    await expect(overlay).toHaveCount(0);
  });

  test("consumes one browser back navigation to close only the camera", async ({ page }) => {
    await installCameraMock(page);
    await openHydratedHome(page);

    const pathnameBeforeBack = new URL(page.url()).pathname;
    await getCameraOpenButton(page).click();
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveAttribute("data-camera-phase", "open");

    await page.evaluate(() => window.history.back());

    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).pathname).toBe(pathnameBeforeBack);
    await expect(page.locator("body")).toHaveCSS("position", "static");
  });

  test("keeps the mirrored interaction and result preview while preserving original capture pixels", async ({ page }) => {
    await installCameraMock(page);
    await openHydratedHome(page);
    await getCameraOpenButton(page).click();

    const liveVideo = page.getByTestId("mobile-camera-overlay").locator("video");
    await expect(liveVideo).toHaveAttribute("data-preview-orientation", "mirrored");
    await expect(liveVideo).toHaveClass(/scale-x-\[-1\]/);

    const captureButton = page.getByRole("button", { name: "사진 촬영", exact: true });
    await expect(captureButton).toBeEnabled();
    await captureButton.click();

    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
    const resultPreview = page.getByAltText("업로드한 얼굴 사진 미리보기");
    await expect(resultPreview).toBeVisible();
    await expect(resultPreview).toHaveAttribute("data-preview-orientation", "mirrored");
    await expect(resultPreview).toHaveClass(/scale-x-\[-1\]/);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector("canvas");
          if (!canvas) {
            return null;
          }
          const context = canvas.getContext("2d");
          if (!context) {
            return null;
          }
          const left = Array.from(context.getImageData(10, 10, 1, 1).data.slice(0, 3));
          const right = Array.from(context.getImageData(canvas.width - 10, 10, 1, 1).data.slice(0, 3));
          return { width: canvas.width, height: canvas.height, left, right };
        })
      )
      .toEqual({
        width: 640,
        height: 480,
        left: [255, 0, 0],
        right: [0, 0, 255]
      });
  });

  test("denied permission stays on the page without opening a native picker", async ({ page }) => {
    await installCameraMock(page, { deny: true });
    await openHydratedHome(page);
    let fileChooserCount = 0;
    page.on("filechooser", () => {
      fileChooserCount += 1;
    });

    await getCameraOpenButton(page).click();

    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
    await expect(page.getByText("카메라 접근에 실패했습니다.")).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("position", "static");
    await expect(page.locator('input[capture="user"]')).toBeDisabled();
    expect(fileChooserCount).toBe(0);
    await expect
      .poll(() =>
        page.evaluate(() => (window as typeof window & { __cameraGetUserMediaCalls?: number }).__cameraGetUserMediaCalls)
      )
      .toBe(1);
  });

  test("keeps the oval and controls separated on a small portrait viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await installCameraMock(page);
    await openHydratedHome(page);
    await getCameraOpenButton(page).click();
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
    await openHydratedHome(page);
    await getCameraOpenButton(page).click();

    await expect(page.getByTestId("mobile-camera-overlay")).toHaveAttribute("data-camera-phase", "open");
    await page.getByRole("button", { name: "카메라 닫기", exact: true }).click();
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
    await expect(page.locator("body")).toHaveCSS("position", "static");
  });

  test("preserves explicit gallery selection in original orientation without opening a stream", async ({ page }) => {
    await installCameraMock(page);
    await openHydratedHome(page);

    await page.locator('input[type="file"]:not([capture])').setInputFiles({
      name: "face.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64"
      )
    });

    const galleryPreview = page.getByAltText("업로드한 얼굴 사진 미리보기");
    await expect(galleryPreview).toBeVisible();
    await expect(galleryPreview).toHaveAttribute("data-preview-orientation", "original");
    await expect(galleryPreview).not.toHaveClass(/scale-x-\[-1\]/);
    const getUserMediaCalls = await page.evaluate(
      () => (window as typeof window & { __cameraGetUserMediaCalls?: number }).__cameraGetUserMediaCalls
    );
    expect(getUserMediaCalls).toBe(0);
  });
});

test("desktop keeps the mirrored in-card camera flow", async ({ page }) => {
  await installCameraMock(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openHydratedHome(page);
  await getCameraOpenButton(page).click();

  await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
  const desktopVideo = page.locator("video");
  await expect(desktopVideo).toBeVisible();
  await expect(desktopVideo).toHaveAttribute("data-preview-orientation", "mirrored");
  await expect(desktopVideo).toHaveClass(/scale-x-\[-1\]/);
  await expect(page.getByRole("button", { name: "취소", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.locator("video")).toHaveCount(0);
});
