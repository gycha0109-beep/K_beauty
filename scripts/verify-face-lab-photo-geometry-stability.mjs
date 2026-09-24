import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import {
  buildPhotoGeometryMeasurementFromFaceLandmarkerResult
} from "../lib/face-lab-mediapipe-metric-geometry.js";
import {
  buildPhotoGeometryStabilityBatch,
  validatePhotoGeometryStabilityObservation
} from "../lib/face-lab-photo-geometry-stability.js";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function findChromeExecutable() {
  return [
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean).find((candidate) => existsSync(candidate)) || null;
}

function loadChromium() {
  const localRequire = createRequire(import.meta.url);
  try {
    return localRequire("playwright").chromium;
  } catch {}

  const runtimeRoot = String(
    process.env.FACE_LAB_IMAGE_E2E_RUNTIME_ROOT || ""
  ).trim();
  assert.ok(runtimeRoot, "FACE_LAB_IMAGE_E2E_RUNTIME_ROOT is required");
  return createRequire(path.join(runtimeRoot, "runtime.cjs"))(
    "playwright-core"
  ).chromium;
}

async function fetchPinnedModel(model) {
  const response = await fetch(model.url, {
    signal: AbortSignal.timeout(120_000)
  });
  assert.equal(response.ok, true, "model download failed: " + response.status);
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(buffer), model.sha256, "model sha256 mismatch");
  return buffer;
}

function startServer({ fixtureBuffer, modelBuffer }) {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    response.setHeader("Cache-Control", "no-store");

    if (requestUrl.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<!doctype html><html><body></body></html>");
      return;
    }

    if (requestUrl.pathname === "/fixture.png") {
      response.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": fixtureBuffer.length
      });
      response.end(fixtureBuffer);
      return;
    }

    if (requestUrl.pathname === "/model/face_landmarker.task") {
      response.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": modelBuffer.length
      });
      response.end(modelBuffer);
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("not found");
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve({
        server,
        origin: "http://127.0.0.1:" + address.port
      });
    });
  });
}

const base = "evidence/facelab/photo-geometry/v0";
const manifest = readJson(base + "/mediapipe-face-geometry.manifest.json");
const runtimeMetadata = readJson(
  base + "/mediapipe-metric-geometry-runtime.metadata.json"
);
const e2eMetadata = readJson(
  base + "/mediapipe-face-landmarker-image-e2e.metadata.json"
);
const semanticContract = readJson(
  "evidence/facelab/structural-measurement/v0/semantic-contract.json"
);
const stabilityContract = readJson(
  base + "/photo-geometry-stability.contract.json"
);

assert.equal(stabilityContract.productionAuthority, false);
assert.equal(stabilityContract.thresholdAuthority, false);

const fixtureBuffer = readFileSync(e2eMetadata.fixture.path);
assert.equal(sha256(fixtureBuffer), e2eMetadata.fixture.sha256);

const modelBuffer = await fetchPinnedModel(e2eMetadata.model);
const { server, origin } = await startServer({ fixtureBuffer, modelBuffer });

const chromium = loadChromium();
const executablePath = findChromeExecutable();
assert.ok(executablePath, "system Google Chrome executable not found");

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(origin + "/", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const variants = await page.evaluate(async ({
    moduleUrl,
    wasmRoot,
    modelUrl,
    fixtureUrl
  }) => {
    const { FaceLandmarker, FilesetResolver } = await import(moduleUrl);
    const vision = await FilesetResolver.forVisionTasks(wasmRoot);
    const landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelUrl },
      runningMode: "IMAGE",
      numFaces: 1
    });

    function makeCanvas(width, height) {
      const value = document.createElement("canvas");
      value.width = width;
      value.height = height;
      return value;
    }

    function drawScaled(image, width, height, filter) {
      const target = makeCanvas(width, height);
      const context = target.getContext("2d", { willReadFrequently: true });
      context.filter = filter || "none";
      context.drawImage(image, 0, 0, width, height);
      context.filter = "none";
      return target;
    }

    function cropTranslation(image) {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const target = makeCanvas(width, height);
      const context = target.getContext("2d");
      context.drawImage(
        image,
        Math.round(width * 0.015),
        Math.round(height * 0.01),
        Math.round(width * 0.97),
        Math.round(height * 0.97),
        0,
        0,
        width,
        height
      );
      return target;
    }

    function whiteBalance(image) {
      const target = drawScaled(
        image,
        image.naturalWidth,
        image.naturalHeight,
        "none"
      );
      const context = target.getContext("2d", { willReadFrequently: true });
      const imageData = context.getImageData(
        0,
        0,
        target.width,
        target.height
      );
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = Math.min(
          255,
          Math.round(imageData.data[i] * 1.03)
        );
        imageData.data[i + 2] = Math.max(
          0,
          Math.round(imageData.data[i + 2] * 0.97)
        );
      }
      context.putImageData(imageData, 0, 0);
      return target;
    }

    async function encodedImage(sourceCanvas, quality) {
      const blob = await new Promise((resolve, reject) => {
        sourceCanvas.toBlob(
          (value) => value ? resolve(value) : reject(new Error("blob_missing")),
          "image/jpeg",
          quality
        );
      });
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    function serialize(source, result) {
      const faces = Array.isArray(result.faceLandmarks)
        ? result.faceLandmarks
        : [];
      return {
        width: source instanceof HTMLImageElement
          ? source.naturalWidth
          : source.width,
        height: source instanceof HTMLImageElement
          ? source.naturalHeight
          : source.height,
        faceCount: faces.length,
        landmarks: faces.map((face) =>
          face.map((landmark) => ({
            x: landmark.x,
            y: landmark.y,
            z: landmark.z
          }))
        )
      };
    }

    const image = new Image();
    image.src = fixtureUrl;
    await image.decode();

    const result = [];
    const detect = (id, nuisance, source) => {
      result.push({
        id,
        nuisance,
        result: serialize(source, landmarker.detect(source))
      });
    };

    detect("baseline", { class: "repeated_run", role: "reference" }, image);
    detect("repeat", { class: "repeated_run", runOrdinal: 2 }, image);

    const resized = drawScaled(image, 768, 768, "none");
    detect(
      "resolution_768",
      { class: "resolution", width: 768, height: 768 },
      resized
    );

    const compressionCanvas = drawScaled(
      image,
      image.naturalWidth,
      image.naturalHeight,
      "none"
    );
    const compressed = await encodedImage(compressionCanvas, 0.85);
    detect(
      "compression_jpeg_085",
      { class: "compression", format: "jpeg", quality: 0.85 },
      compressed
    );

    detect(
      "crop_translation_small",
      {
        class: "crop_translation",
        cropFraction: 0.03,
        xOffsetFraction: 0.015,
        yOffsetFraction: 0.01
      },
      cropTranslation(image)
    );

    detect(
      "lighting_exposure_plus_8pct",
      { class: "lighting_exposure", brightnessPercent: 108 },
      drawScaled(
        image,
        image.naturalWidth,
        image.naturalHeight,
        "brightness(108%)"
      )
    );

    detect(
      "lighting_contrast_plus_10pct",
      { class: "lighting_contrast", contrastPercent: 110 },
      drawScaled(
        image,
        image.naturalWidth,
        image.naturalHeight,
        "contrast(110%)"
      )
    );

    detect(
      "white_balance_warm_small",
      {
        class: "white_balance",
        redMultiplier: 1.03,
        blueMultiplier: 0.97
      },
      whiteBalance(image)
    );

    landmarker.close();
    return result;
  }, {
    moduleUrl: e2eMetadata.tasksVision.moduleUrl,
    wasmRoot: e2eMetadata.tasksVision.wasmRoot,
    modelUrl: origin + "/model/face_landmarker.task",
    fixtureUrl: origin + "/fixture.png"
  });

  assert.equal(variants.length, 8);

  const measurements = new Map();
  for (const variant of variants) {
    assert.equal(
      variant.result.faceCount,
      1,
      variant.id + " must yield exactly one face"
    );
    assert.ok(variant.result.landmarks[0]?.length >= 468);

    const bridged = buildPhotoGeometryMeasurementFromFaceLandmarkerResult(
      {
        sampleId: e2eMetadata.fixture.sampleId + "::" + variant.id,
        faceLandmarkerResult: {
          faceLandmarks: variant.result.landmarks
        },
        frameWidth: variant.result.width,
        frameHeight: variant.result.height,
        sourceVersion: manifest.providerVersion,
        sourceImagePersisted: false
      },
      manifest,
      runtimeMetadata
    );
    measurements.set(variant.id, bridged.measurement);
  }

  const baseline = measurements.get("baseline");
  const reports = buildPhotoGeometryStabilityBatch(
    {
      pairGroupId: "same_source::" + e2eMetadata.fixture.sampleId,
      referenceMeasurement: baseline,
      variants: variants
        .filter((variant) => variant.id !== "baseline")
        .map((variant) => ({
          measurement: measurements.get(variant.id),
          nuisance: variant.nuisance
        })),
      subjectLinkage: {
        method: "same_source_image_transform",
        status: "exact_same_source_no_biometric_linkage"
      }
    },
    semanticContract
  );

  assert.equal(reports.length, 7);
  for (const report of reports) {
    assert.deepEqual(
      validatePhotoGeometryStabilityObservation(report),
      { ok: true, errors: [] }
    );
    assert.equal(report.interpretationStatus, "research_observation");
    assert.equal(report.diagnostics.thresholdsApplied, false);
  }

  const repeatReport = reports.find(
    (report) => report.nuisance.class === "repeated_run"
  );
  assert.ok(repeatReport);
  assert.equal(repeatReport.diagnostics.maxAbsoluteRatioDifference, 0);
  assert.equal(repeatReport.diagnostics.maxAbsoluteDegreeDifference, 0);
  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({
    ok: true,
    productionAuthority: false,
    thresholdAuthority: false,
    fixtureSampleId: e2eMetadata.fixture.sampleId,
    tasksVisionVersion: e2eMetadata.tasksVision.version,
    repeatedRunDeterministic: true,
    executableNuisances: reports.map((report) => ({
      nuisance: report.nuisance,
      maxAbsoluteRatioDifference:
        report.diagnostics.maxAbsoluteRatioDifference,
      maxAbsoluteDegreeDifference:
        report.diagnostics.maxAbsoluteDegreeDifference,
      interpretationStatus: report.interpretationStatus
    })),
    heldForRealSameSubjectPairs:
      stabilityContract.nuisanceClasses.realSameSubjectPairRequired,
    privacy: {
      sourceImagePersisted: false,
      identityEmbeddingCreated: false,
      biometricIdentityMatchPerformed: false
    }
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
