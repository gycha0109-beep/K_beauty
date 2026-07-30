import { expect, test, type Page } from "playwright/test";

type FaceGuideMode =
  | "multiple_faces"
  | "no_face"
  | "not_frontal"
  | "off_center"
  | "ready"
  | "too_close"
  | "too_far";

type CameraMockOptions = {
  deferFirstFrame?: boolean;
  deny?: boolean;
  faceGuideMode?: FaceGuideMode;
  faceModelFails?: boolean;
};

async function installCameraMock(page: Page, options: CameraMockOptions = {}) {
  await page.addInitScript(({ deferFirstFrame, deny, faceGuideMode, faceModelFails }) => {
    const cameraWindow = window as typeof window & {
      __cameraGetUserMediaCalls?: number;
      __cameraStops?: number;
      __cameraStreams?: MediaStream[];
      __cameraCanvases?: HTMLCanvasElement[];
      __faceGuideMode?: FaceGuideMode;
      __releaseCameraFrame?: () => void;
      __setFaceGuideMode?: (mode: FaceGuideMode) => void;
      __bejewelyFaceLandmarkerFactory?: () => Promise<{
        detectForVideo: () => { faceLandmarks: Array<Array<{ x: number; y: number; z: number }>> };
      }>;
    };
    const ovalIndices = [
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
      379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
      234, 127, 162, 21, 54, 103, 67, 109
    ];

    const createFace = (mode: FaceGuideMode) => {
      const scale = mode === "too_far" ? 0.65 : mode === "too_close" ? 1.2 : 1;
      const centerX = mode === "off_center" ? 0.55 : 0.5;
      const centerY = 0.45;
      const radiusX = 0.11 * scale;
      const radiusY = 0.2 * scale;
      const landmarks = Array.from({ length: 478 }, () => ({ x: centerX, y: centerY, z: 0 }));

      ovalIndices.forEach((index, pointIndex) => {
        const angle = -Math.PI / 2 + (pointIndex / ovalIndices.length) * Math.PI * 2;
        landmarks[index] = {
          x: centerX + Math.cos(angle) * radiusX,
          y: centerY + Math.sin(angle) * radiusY,
          z: 0
        };
      });

      landmarks[33] = { x: centerX - radiusX * 0.5, y: centerY - radiusY * 0.36, z: 0 };
      landmarks[263] = { x: centerX + radiusX * 0.5, y: centerY - radiusY * 0.36, z: 0 };
      landmarks[234] = { x: centerX - radiusX, y: centerY, z: 0 };
      landmarks[454] = { x: centerX + radiusX, y: centerY, z: 0 };
      landmarks[152] = { x: centerX, y: centerY + radiusY, z: 0 };
      landmarks[1] = {
        x: mode === "not_frontal" ? centerX - radiusX * 0.75 : centerX,
        y: centerY + radiusY * 0.04,
        z: 0
      };

      return landmarks;
    };

    const getFaceLandmarks = () => {
      const mode = cameraWindow.__faceGuideMode || "ready";
      if (mode === "no_face") {
        return [];
      }
      if (mode === "multiple_faces") {
        return [createFace("ready"), createFace("ready")];
      }
      return [createFace(mode)];
    };

    cameraWindow.__cameraGetUserMediaCalls = 0;
    cameraWindow.__cameraStops = 0;
    cameraWindow.__cameraStreams = [];
    cameraWindow.__cameraCanvases = [];
    cameraWindow.__faceGuideMode = faceGuideMode || "ready";
    cameraWindow.__setFaceGuideMode = (mode) => {
      cameraWindow.__faceGuideMode = mode;
    };
    cameraWindow.__bejewelyFaceLandmarkerFactory = async () => {
      if (faceModelFails) {
        throw new Error("mock_face_model_failure");
      }
      return {
        detectForVideo: () => ({ faceLandmarks: getFaceLandmarks() })
      };
    };

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

          let frameTimer: number | null = null;
          const startFrames = () => {
            paintFrame();
            if (frameTimer === null) {
              frameTimer = window.setInterval(paintFrame, 50);
            }
          };
          track?.addEventListener("ended", () => {
            if (frameTimer !== null) {
              window.clearInterval(frameTimer);
            }
          }, {
            once: true
          });

          if (deferFirstFrame) {
            cameraWindow.__releaseCameraFrame = startFrames;
          } else {
            startFrames();
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

function getCaptureButton(page: Page) {
  return page.getByRole("button", { name: "사진 촬영", exact: true });
}

async function setFaceGuideMode(page: Page, mode: FaceGuideMode) {
  await page.evaluate((nextMode) => {
    (window as typeof window & { __setFaceGuideMode?: (mode: FaceGuideMode) => void }).__setFaceGuideMode?.(nextMode);
  }, mode);
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
    await expect(getCaptureButton(page)).toBeEnabled();
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
    await expect(page.locator('[data-face-guide-state="ready"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "카메라 닫기", exact: true })).toBeFocused();
    await expect(getCaptureButton(page)).toBeEnabled();
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
    await expect(getCaptureButton(page)).toBeEnabled();
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

  test("keeps capture disabled until one centered frontal face is stable", async ({ page }) => {
    await installCameraMock(page, { faceGuideMode: "no_face" });
    await openHydratedHome(page);
    await getCameraOpenButton(page).click();

    const captureButton = getCaptureButton(page);
    await expect(captureButton).toBeDisabled();
    await expect(page.getByTestId("face-guide-message")).toHaveText("얼굴을 타원 안에 맞춰 주세요");
    await expect(page.locator('[data-face-guide-state="no_face"]')).toBeVisible();

    await setFaceGuideMode(page, "too_far");
    await expect(page.getByTestId("face-guide-message")).toHaveText("조금 더 가까이 와 주세요");
    await expect(captureButton).toBeDisabled();

    await setFaceGuideMode(page, "off_center");
    await expect(page.getByTestId("face-guide-message")).toHaveText("얼굴을 타원 중앙에 맞춰 주세요");
    await expect(captureButton).toBeDisabled();

    await setFaceGuideMode(page, "not_frontal");
    await expect(page.getByTestId("face-guide-message")).toHaveText("정면을 바라봐 주세요");
    await expect(captureButton).toBeDisabled();

    await setFaceGuideMode(page, "ready");
    await expect(page.getByTestId("face-guide-message")).toHaveText("좋아요, 그대로 있어 주세요");
    await expect(captureButton).toBeDisabled();
    await expect(page.getByTestId("face-guide-message")).toHaveText("좋아요, 촬영할 수 있어요");
    await expect(captureButton).toBeEnabled();
  });

  test("blocks capture when multiple faces are detected", async ({ page }) => {
    await installCameraMock(page, { faceGuideMode: "multiple_faces" });
    await openHydratedHome(page);
    await getCameraOpenButton(page).click();

    await expect(page.getByTestId("face-guide-message")).toHaveText("한 명만 화면에 보여 주세요");
    await expect(getCaptureButton(page)).toBeDisabled();

    await page.getByRole("button", { name: "카메라 닫기", exact: true }).click();
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
  });

  test("blocks capture when face model initialization fails", async ({ page }) => {
    await installCameraMock(page, { faceModelFails: true });
    await openHydratedHome(page);
    await getCameraOpenButton(page).click();

    const overlay = page.getByTestId("mobile-camera-overlay");
    await expect(page.getByTestId("face-guide-message")).toHaveText(
      "얼굴 인식을 시작하지 못했습니다. 카메라를 닫고 다시 시도해 주세요"
    );
    await expect(overlay).toHaveAttribute("data-face-guidance-ready", "false");
    await expect(overlay).toHaveAttribute("data-face-capture-allowed", "false");
    await expect(overlay).toHaveAttribute("data-face-guide-error-stage", "initialization");
    await expect(getCaptureButton(page)).toBeDisabled();
  });

  test("keeps the mirrored interaction and result preview while preserving original capture pixels", async ({ page }) => {
    await installCameraMock(page, { faceGuideMode: "not_frontal" });
    await openHydratedHome(page);
    await getCameraOpenButton(page).click();

    const liveVideo = page.getByTestId("mobile-camera-overlay").locator("video");
    await expect(liveVideo).toHaveAttribute("data-preview-orientation", "mirrored");
    await expect(liveVideo).toHaveClass(/scale-x-\[-1\]/);

    await page.evaluate(() => {
      const cameraWindow = window as typeof window & {
        __manualCaptureClickedWhenEnabled?: boolean;
      };
      const button = document.querySelector<HTMLButtonElement>(
        '[data-testid="mobile-camera-overlay"] button[aria-label="사진 촬영"]'
      );
      if (!button) {
        throw new Error("manual_capture_button_missing");
      }
      const observer = new MutationObserver(() => {
        if (!button.disabled) {
          cameraWindow.__manualCaptureClickedWhenEnabled = true;
          observer.disconnect();
          button.click();
        }
      });
      observer.observe(button, {
        attributeFilter: ["disabled"],
        attributes: true
      });
    });
    await setFaceGuideMode(page, "ready");

    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & {
              __manualCaptureClickedWhenEnabled?: boolean;
            }).__manualCaptureClickedWhenEnabled
        )
      )
      .toBe(true);
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

    const guideBox = await page.getByTestId("face-guide-oval").boundingBox();
    const closeBox = await page.getByRole("button", { name: "카메라 닫기", exact: true }).boundingBox();
    const captureBox = await getCaptureButton(page).boundingBox();

    expect(guideBox).not.toBeNull();
    expect(closeBox).not.toBeNull();
    expect(captureBox).not.toBeNull();
    expect(guideBox!.y).toBeGreaterThanOrEqual(closeBox!.y + closeBox!.height);
    expect(guideBox!.y + guideBox!.height).toBeLessThanOrEqual(captureBox!.y);

    await page.setViewportSize({ width: 568, height: 320 });
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCSS("width", "568px");
    await expect(page.getByTestId("mobile-camera-overlay")).toHaveCSS("height", "320px");
    await expect(page.getByRole("button", { name: "카메라 닫기", exact: true })).toBeVisible();
    await expect(getCaptureButton(page)).toBeVisible();

    await page.getByRole("button", { name: "카메라 닫기", exact: true }).click();
  });

  test("honors reduced motion without leaving the transition locked", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installCameraMock(page);
    await openHydratedHome(page);
    await getCameraOpenButton(page).click();

    await expect(page.getByTestId("mobile-camera-overlay")).toHaveAttribute("data-camera-phase", "open");
    await expect(getCaptureButton(page)).toBeEnabled();
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
