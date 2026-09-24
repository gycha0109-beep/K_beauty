import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
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

function startServer({ assets, modelBuffer }) {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    response.setHeader("Cache-Control", "no-store");

    if (requestUrl.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<!doctype html><html><body></body></html>");
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

    if (requestUrl.pathname.startsWith("/asset/")) {
      const name = decodeURIComponent(requestUrl.pathname.slice("/asset/".length));
      const buffer = assets.get(name);
      if (buffer) {
        response.writeHead(200, {
          "Content-Type": "image/png",
          "Content-Length": buffer.length
        });
        response.end(buffer);
        return;
      }
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
const coverageContract = readJson(
  base + "/photo-geometry-multi-fixture-coverage.contract.json"
);
const authority = readJson(coverageContract.sourceAuthorityPath);

assert.equal(coverageContract.productionAuthority, false);
assert.equal(coverageContract.expectedFixtureCount, 14);
assert.equal(authority.imageCount, coverageContract.expectedFixtureCount);
assert.equal(authority.orderedItems.length, coverageContract.expectedFixtureCount);
assert.equal(
  coverageContract.fixtureIdentitySemantics.distinctSubjectsEstablished,
  false
);
assert.equal(coverageContract.coverageClaims.multiSubjectCoverage, false);
assert.equal(coverageContract.coverageClaims.generalFaceCoverage, false);
assert.equal(coverageContract.coverageClaims.populationReferenceCoverage, false);
assert.equal(
  coverageContract.measurementDiagnostics.centerOrScaleEstimationAllowed,
  false
);

const assets = new Map();
for (const item of authority.orderedItems) {
  const repositoryPath = "public" + item.assetPath;
  const buffer = readFileSync(repositoryPath);
  assert.equal(
    sha256(buffer),
    item.assetSha256,
    "fixture sha256 mismatch: " + item.reviewItemId
  );
  assets.set(item.assetName, buffer);
}

const modelBuffer = await fetchPinnedModel(e2eMetadata.model);
const { server, origin } = await startServer({ assets, modelBuffer });

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

  const browserResults = await page.evaluate(async ({
    moduleUrl,
    wasmRoot,
    modelUrl,
    items,
    origin
  }) => {
    const { FaceLandmarker, FilesetResolver } = await import(moduleUrl);
    const vision = await FilesetResolver.forVisionTasks(wasmRoot);
    const landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelUrl },
      runningMode: "IMAGE",
      numFaces: 1
    });

    function serialize(result) {
      const faces = Array.isArray(result.faceLandmarks)
        ? result.faceLandmarks
        : [];
      return {
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

    const results = [];
    for (const item of items) {
      const image = new Image();
      image.src = origin + "/asset/" + encodeURIComponent(item.assetName);
      await image.decode();
      results.push({
        reviewItemId: item.reviewItemId,
        assetName: item.assetName,
        width: image.naturalWidth,
        height: image.naturalHeight,
        result: serialize(landmarker.detect(image))
      });
    }

    landmarker.close();
    return results;
  }, {
    moduleUrl: e2eMetadata.tasksVision.moduleUrl,
    wasmRoot: e2eMetadata.tasksVision.wasmRoot,
    modelUrl: origin + "/model/face_landmarker.task",
    items: authority.orderedItems.map((item) => ({
      reviewItemId: item.reviewItemId,
      assetName: item.assetName
    })),
    origin
  });

  assert.equal(browserResults.length, coverageContract.expectedFixtureCount);

  const dimensionValues = new Map();
  const coverage = [];

  for (const browserResult of browserResults) {
    const authorityItem = authority.orderedItems.find(
      (item) => item.reviewItemId === browserResult.reviewItemId
    );
    assert.ok(authorityItem);
    assert.equal(browserResult.width, authorityItem.width);
    assert.equal(browserResult.height, authorityItem.height);
    assert.equal(
      browserResult.result.faceCount,
      1,
      browserResult.reviewItemId + " must yield exactly one face"
    );
    assert.equal(browserResult.result.landmarks.length, 1);
    assert.ok(
      browserResult.result.landmarks[0].length >= 468,
      browserResult.reviewItemId + " topology shorter than 468"
    );

    const bridged = buildPhotoGeometryMeasurementFromFaceLandmarkerResult(
      {
        sampleId: browserResult.reviewItemId,
        faceLandmarkerResult: {
          faceLandmarks: browserResult.result.landmarks
        },
        frameWidth: browserResult.width,
        frameHeight: browserResult.height,
        sourceVersion: manifest.providerVersion,
        sourceImagePersisted: false
      },
      manifest,
      runtimeMetadata
    );

    assert.equal(bridged.measurement.dimensions.length, 6);
    assert.equal(bridged.measurement.privacy.sourceImagePersisted, false);
    assert.equal(bridged.measurement.privacy.identityEmbeddingCreated, false);

    for (const dimension of bridged.measurement.dimensions) {
      assert.equal(Number.isFinite(dimension.value), true);
      if (!dimensionValues.has(dimension.id)) {
        dimensionValues.set(dimension.id, {
          unit: dimension.unit,
          values: []
        });
      }
      dimensionValues.get(dimension.id).values.push(dimension.value);
    }

    coverage.push({
      reviewItemId: browserResult.reviewItemId,
      faceCount: browserResult.result.faceCount,
      landmarkCount: browserResult.result.landmarks[0].length,
      dimensionCount: bridged.measurement.dimensions.length
    });
  }

  const observedRangeDiagnostics = [...dimensionValues.entries()].map(
    ([id, entry]) => ({
      id,
      unit: entry.unit,
      count: entry.values.length,
      min: Math.min(...entry.values),
      max: Math.max(...entry.values)
    })
  );

  assert.equal(observedRangeDiagnostics.length, 6);
  assert.equal(
    observedRangeDiagnostics.every(
      (dimension) => dimension.count === coverageContract.expectedFixtureCount
    ),
    true
  );
  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({
    ok: true,
    productionAuthority: false,
    coverageKind: "multi_fixture_technical_only",
    opaqueReviewItemCount: coverage.length,
    distinctSubjectsEstablished: false,
    generalFaceCoverageEstablished: false,
    populationReferenceEstablished: false,
    normalizationReferenceEstablished: false,
    allFixturesYieldedExactlyOneFace: true,
    allFixturesYieldedAtLeast468Landmarks: true,
    observedRangeDiagnostics,
    privacy: coverageContract.privacy
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
