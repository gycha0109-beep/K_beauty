import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import {
  buildPhotoGeometryMeasurementFromFaceLandmarkerResult
} from "../lib/face-lab-mediapipe-metric-geometry.js";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function loadChromium() {
  const localRequire = createRequire(import.meta.url);
  try {
    return localRequire("playwright").chromium;
  } catch {}

  const runtimeRoot = String(
    process.env.FACE_LAB_IMAGE_E2E_RUNTIME_ROOT || ""
  ).trim();
  assert.ok(
    runtimeRoot,
    "FACE_LAB_IMAGE_E2E_RUNTIME_ROOT is required when root playwright is unavailable"
  );
  const runtimeRequire = createRequire(path.join(runtimeRoot, "runtime.cjs"));
  return runtimeRequire("playwright-core").chromium;
}

async function fetchPinnedModel(model) {
  const response = await fetch(model.url, {
    signal: AbortSignal.timeout(120_000)
  });
  assert.equal(
    response.ok,
    true,
    "Face Landmarker model download failed: HTTP " + response.status
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  const digest = sha256(buffer);
  assert.equal(
    digest,
    model.sha256,
    "Face Landmarker model sha256 mismatch"
  );
  return buffer;
}

function startFixtureServer({ fixtureBuffer, modelBuffer, metadata }) {
  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Face Lab image E2E</title></head>
  <body>
    <img id="fixture" alt="fixture">
    <script type="module">
      import {
        FaceLandmarker,
        FilesetResolver
      } from ${JSON.stringify(metadata.tasksVision.moduleUrl)};

      window.__faceLabDone = false;
      window.__faceLabError = null;
      window.__faceLabResult = null;

      try {
        const vision = await FilesetResolver.forVisionTasks(
          ${JSON.stringify(metadata.tasksVision.wasmRoot)}
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: location.origin + "/model/face_landmarker.task"
            },
            runningMode: "IMAGE",
            numFaces: 1
          }
        );

        const image = document.getElementById("fixture");
        image.src = "/fixture.png";
        await image.decode();

        const result = faceLandmarker.detect(image);
        const faces = Array.isArray(result.faceLandmarks)
          ? result.faceLandmarks
          : [];

        window.__faceLabResult = {
          width: image.naturalWidth,
          height: image.naturalHeight,
          faceCount: faces.length,
          landmarks: faces.map((face) =>
            face.map((landmark) => ({
              x: landmark.x,
              y: landmark.y,
              z: landmark.z
            }))
          )
        };

        faceLandmarker.close();
      } catch (error) {
        window.__faceLabError = {
          message: String(error?.message || error),
          stack: String(error?.stack || "")
        };
      } finally {
        window.__faceLabDone = true;
      }
    </script>
  </body>
</html>`;

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(
      request.url || "/",
      "http://127.0.0.1"
    );

    response.setHeader("Cache-Control", "no-store");

    if (requestUrl.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
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

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
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
const packageJson = readJson("package.json");
const fixtureAuthority = readJson(e2eMetadata.fixture.authorityPath);

assert.equal(
  e2eMetadata.schemaVersion,
  "face-lab-photo-geometry-image-e2e-v0"
);
assert.equal(e2eMetadata.productionAuthority, false);
assert.equal(e2eMetadata.privacy.sourceImageCopied, false);
assert.equal(e2eMetadata.privacy.sourceImagePersistedByHarness, false);
assert.equal(e2eMetadata.privacy.identityEmbeddingCreated, false);
assert.equal(e2eMetadata.privacy.resultPersistence, false);
assert.equal(
  packageJson.dependencies?.["@mediapipe/tasks-vision"],
  e2eMetadata.tasksVision.version,
  "repository tasks-vision pin must match actual-image E2E runtime"
);

const authorityItem = fixtureAuthority.orderedItems.find(
  (item) => item.reviewItemId === e2eMetadata.fixture.sampleId
);
assert.ok(authorityItem, "fixture sample missing from hosted-set authority");
assert.equal(
  "public" + authorityItem.assetPath,
  e2eMetadata.fixture.path
);
assert.equal(authorityItem.assetSha256, e2eMetadata.fixture.sha256);
assert.equal(authorityItem.width, e2eMetadata.fixture.width);
assert.equal(authorityItem.height, e2eMetadata.fixture.height);

const fixtureBuffer = readFileSync(e2eMetadata.fixture.path);
assert.equal(
  sha256(fixtureBuffer),
  e2eMetadata.fixture.sha256,
  "actual-image fixture sha256 mismatch"
);

const modelBuffer = await fetchPinnedModel(e2eMetadata.model);
const { server, origin } = await startFixtureServer({
  fixtureBuffer,
  modelBuffer,
  metadata: e2eMetadata
});

const chromium = loadChromium();
const executablePath = findChromeExecutable();
assert.ok(
  executablePath,
  "system Google Chrome executable not found"
);

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

const context = await browser.newContext();
const page = await context.newPage();
const pageErrors = [];
const httpRequests = [];

page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("request", (request) => {
  const url = new URL(request.url());
  if (url.protocol === "http:" || url.protocol === "https:") {
    httpRequests.push(url.origin);
  }
});

try {
  await page.goto(origin + "/", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.waitForFunction(
    () => window.__faceLabDone === true,
    null,
    { timeout: 120_000 }
  );

  const browserError = await page.evaluate(() => window.__faceLabError);
  assert.equal(
    browserError,
    null,
    browserError
      ? "Face Landmarker browser failure: " + browserError.message
      : undefined
  );

  const result = await page.evaluate(() => window.__faceLabResult);
  assert.ok(result, "Face Landmarker browser result missing");
  assert.equal(result.width, e2eMetadata.fixture.width);
  assert.equal(result.height, e2eMetadata.fixture.height);
  assert.equal(
    result.faceCount,
    e2eMetadata.runtime.numFaces,
    "actual-image fixture must yield exactly one face"
  );
  assert.equal(result.landmarks.length, 1);
  assert.ok(
    result.landmarks[0].length >=
      e2eMetadata.runtime.expectedMinimumLandmarks,
    "Face Landmarker topology shorter than 468"
  );

  const bridged = buildPhotoGeometryMeasurementFromFaceLandmarkerResult({
    sampleId: e2eMetadata.fixture.sampleId,
    faceLandmarkerResult: {
      faceLandmarks: result.landmarks
    },
    frameWidth: result.width,
    frameHeight: result.height,
    sourceVersion: manifest.providerVersion,
    sourceImagePersisted: false
  }, manifest, runtimeMetadata);

  assert.equal(Object.keys(bridged.packet.landmarks).length, 12);
  assert.equal(bridged.packet.coordinateSpace, "pose_normalized_metric_3d");
  assert.equal(bridged.packet.sourceImagePersisted, false);
  assert.equal(bridged.measurement.dimensions.length, 6);
  assert.equal(bridged.measurement.privacy.sourceImagePersisted, false);
  assert.equal(bridged.measurement.privacy.identityEmbeddingCreated, false);
  for (const dimension of bridged.measurement.dimensions) {
    assert.equal(Number.isFinite(dimension.value), true);
  }

  const allowedExternalOrigin = new URL(
    e2eMetadata.tasksVision.moduleUrl
  ).origin;
  const unexpectedOrigins = [
    ...new Set(
      httpRequests.filter(
        (requestOrigin) =>
          requestOrigin !== origin &&
          requestOrigin !== allowedExternalOrigin
      )
    )
  ];
  assert.deepEqual(
    unexpectedOrigins,
    [],
    "unexpected browser network origin"
  );
  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({
    ok: true,
    productionAuthority: false,
    tasksVisionVersion: e2eMetadata.tasksVision.version,
    modelSha256: e2eMetadata.model.sha256,
    fixture: {
      sampleId: e2eMetadata.fixture.sampleId,
      sha256: e2eMetadata.fixture.sha256,
      width: result.width,
      height: result.height
    },
    inference: {
      faceCount: result.faceCount,
      landmarkCount: result.landmarks[0].length
    },
    bridge: {
      coordinateSpace: bridged.packet.coordinateSpace,
      minimalAnchorCount: Object.keys(bridged.packet.landmarks).length,
      dimensions: bridged.measurement.dimensions
    },
    privacy: e2eMetadata.privacy
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
