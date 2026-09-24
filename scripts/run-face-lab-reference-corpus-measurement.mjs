import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import {
  validateFaceSpaceReferenceCorpusSourceManifest
} from "../lib/face-lab-reference-corpus-source-manifest.js";
import {
  buildFaceSpaceReferenceCorpusRunOutput
} from "../lib/face-lab-reference-corpus-run-output.js";
import {
  buildPhotoGeometryMeasurementFromFaceLandmarkerResult
} from "../lib/face-lab-mediapipe-metric-geometry.js";

const RUNNER_VERSION =
  "face-space-reference-corpus-measurement-runner-v0";

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
  assert.ok(
    runtimeRoot,
    "FACE_LAB_IMAGE_E2E_RUNTIME_ROOT is required when root playwright is unavailable"
  );
  return createRequire(path.join(runtimeRoot, "runtime.cjs"))(
    "playwright-core"
  ).chromium;
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
  assert.equal(
    sha256(buffer),
    model.sha256,
    "Face Landmarker model sha256 mismatch"
  );
  return buffer;
}

function resolveSourceAssets(sourceManifestPath, sourceManifest) {
  const baseDir = path.dirname(path.resolve(sourceManifestPath));
  return sourceManifest.records.map((record, index) => {
    const resolvedPath = path.isAbsolute(record.image.path)
      ? record.image.path
      : path.resolve(baseDir, record.image.path);
    assert.ok(
      existsSync(resolvedPath),
      "Reference corpus source image missing: " + record.sampleId
    );
    const buffer = readFileSync(resolvedPath);
    assert.equal(
      sha256(buffer),
      record.image.sha256,
      "Reference corpus source image sha256 mismatch: " + record.sampleId
    );
    return {
      record,
      route: "/asset/" + index,
      buffer
    };
  });
}

function startServer({ assets, modelBuffer }) {
  const byRoute = new Map(assets.map((asset) => [asset.route, asset]));

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(
      request.url || "/",
      "http://127.0.0.1"
    );
    response.setHeader("Cache-Control", "no-store");

    if (requestUrl.pathname === "/") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
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

    const asset = byRoute.get(requestUrl.pathname);
    if (asset) {
      response.writeHead(200, {
        "Content-Type": asset.record.image.mediaType,
        "Content-Length": asset.buffer.length
      });
      response.end(asset.buffer);
      return;
    }

    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
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

async function main() {
  const args = process.argv.slice(2);
  const sourceManifestPath = args.find((arg) => !arg.startsWith("--"));
  const validateOnly = args.includes("--validate-only");

  assert.ok(
    sourceManifestPath,
    "Usage: node scripts/run-face-lab-reference-corpus-measurement.mjs <source-manifest.json> [--validate-only]"
  );

  const sourceManifest = readJson(sourceManifestPath);
  const sourceSummary =
    validateFaceSpaceReferenceCorpusSourceManifest(sourceManifest);

  if (validateOnly) {
    console.log(JSON.stringify({
      schemaVersion:
        "face-space-reference-corpus-measurement-run-output-v0",
      ok: true,
      validateOnly: true,
      runnerVersion: RUNNER_VERSION,
      sourceSummary,
      authority: {
        productionAuthority: false,
        normalizationAuthority: false,
        thresholdAuthority: false
      }
    }, null, 2));
    return;
  }

  const base = "evidence/facelab/photo-geometry/v0";
  const photoManifest = readJson(
    base + "/mediapipe-face-geometry.manifest.json"
  );
  const metricRuntimeMetadata = readJson(
    base + "/mediapipe-metric-geometry-runtime.metadata.json"
  );
  const imageRuntimeMetadata = readJson(
    base + "/mediapipe-face-landmarker-image-e2e.metadata.json"
  );

  const assets = resolveSourceAssets(
    sourceManifestPath,
    sourceManifest
  );
  const modelBuffer = await fetchPinnedModel(
    imageRuntimeMetadata.model
  );
  const { server, origin } = await startServer({
    assets,
    modelBuffer
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
  const page = await browser.newPage();
  const pageErrors = [];
  const httpOrigins = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:") {
      httpOrigins.push(url.origin);
    }
  });

  try {
    await page.goto(origin + "/", {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });

    const browserResults = await page.evaluate(async ({
      moduleUrl,
      wasmRoot,
      modelUrl,
      assets,
      origin
    }) => {
      const { FaceLandmarker, FilesetResolver } = await import(moduleUrl);
      const vision = await FilesetResolver.forVisionTasks(wasmRoot);
      const landmarker = await FaceLandmarker.createFromOptions(
        vision,
        {
          baseOptions: { modelAssetPath: modelUrl },
          runningMode: "IMAGE",
          numFaces: 1
        }
      );

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
      for (const asset of assets) {
        const image = new Image();
        image.src = origin + asset.route;
        await image.decode();
        results.push({
          sampleId: asset.sampleId,
          width: image.naturalWidth,
          height: image.naturalHeight,
          result: serialize(landmarker.detect(image))
        });
      }

      landmarker.close();
      return results;
    }, {
      moduleUrl: imageRuntimeMetadata.tasksVision.moduleUrl,
      wasmRoot: imageRuntimeMetadata.tasksVision.wasmRoot,
      modelUrl: origin + "/model/face_landmarker.task",
      assets: assets.map((asset) => ({
        sampleId: asset.record.sampleId,
        route: asset.route
      })),
      origin
    });

    assert.equal(browserResults.length, sourceManifest.records.length);

    const resultBySampleId = new Map(
      browserResults.map((result) => [result.sampleId, result])
    );

    const measurements = sourceManifest.records.map((sourceRecord) => {
      const browserResult = resultBySampleId.get(sourceRecord.sampleId);
      assert.ok(
        browserResult,
        "Face Landmarker result missing: " + sourceRecord.sampleId
      );
      assert.equal(
        browserResult.result.faceCount,
        1,
        "Reference corpus source image must yield exactly one face: " +
          sourceRecord.sampleId
      );
      assert.equal(browserResult.result.landmarks.length, 1);
      assert.ok(
        browserResult.result.landmarks[0].length >= 468,
        "Reference corpus source topology shorter than 468: " +
          sourceRecord.sampleId
      );

      const bridged =
        buildPhotoGeometryMeasurementFromFaceLandmarkerResult(
          {
            sampleId: sourceRecord.sampleId,
            faceLandmarkerResult: {
              faceLandmarks: browserResult.result.landmarks
            },
            frameWidth: browserResult.width,
            frameHeight: browserResult.height,
            sourceVersion: photoManifest.providerVersion,
            sourceImagePersisted: false
          },
          photoManifest,
          metricRuntimeMetadata
        );

      assert.equal(bridged.measurement.dimensions.length, 6);
      assert.equal(
        bridged.measurement.privacy.sourceImagePersisted,
        false
      );
      assert.equal(
        bridged.measurement.privacy.identityEmbeddingCreated,
        false
      );

      return {
        sampleId: sourceRecord.sampleId,
        measurement: bridged.measurement
      };
    });

    const output = buildFaceSpaceReferenceCorpusRunOutput({
      sourceManifest,
      measurements,
      runtimeProvider: {
        source: photoManifest.provider,
        sourceVersion: photoManifest.providerVersion,
        adapterId: photoManifest.adapterId
      },
      runnerVersion: RUNNER_VERSION
    });

    const allowedExternalOrigins = new Set([
      new URL(imageRuntimeMetadata.tasksVision.moduleUrl).origin,
      new URL(imageRuntimeMetadata.tasksVision.wasmRoot).origin
    ]);
    const unexpectedOrigins = [
      ...new Set(
        httpOrigins.filter(
          (requestOrigin) =>
            requestOrigin !== origin &&
            !allowedExternalOrigins.has(requestOrigin)
        )
      )
    ];

    assert.deepEqual(
      unexpectedOrigins,
      [],
      "unexpected browser network origin"
    );
    assert.deepEqual(pageErrors, []);

    console.log(JSON.stringify(output, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

await main();
