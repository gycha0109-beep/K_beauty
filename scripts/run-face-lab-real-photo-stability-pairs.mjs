import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import {
  validateRealPhotoStabilityRunManifest
} from "../lib/face-lab-real-photo-stability-run-manifest.js";
import {
  buildPhotoGeometryMeasurementFromFaceLandmarkerResult
} from "../lib/face-lab-mediapipe-metric-geometry.js";
import {
  buildRealPhotoSameSubjectStabilityEvidence,
  summarizeRealPhotoStabilityCollection
} from "../lib/face-lab-real-photo-stability-evidence.js";

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
  assert.equal(
    sha256(buffer),
    model.sha256,
    "Face Landmarker model sha256 mismatch"
  );
  return buffer;
}

function resolveInputImages(manifestPath, manifest) {
  const baseDir = path.dirname(path.resolve(manifestPath));
  const routeEntries = [];
  const pairRoutes = [];

  manifest.pairs.forEach((pair, pairIndex) => {
    const pairRoute = {};
    for (const side of ["reference", "candidate"]) {
      const input = pair[side];
      const resolvedPath = path.isAbsolute(input.path)
        ? input.path
        : path.resolve(baseDir, input.path);
      assert.ok(
        existsSync(resolvedPath),
        "Input image missing for " + pair.pairGroupId + ":" + side
      );

      const buffer = readFileSync(resolvedPath);
      assert.equal(
        sha256(buffer),
        input.sha256,
        "Input image sha256 mismatch for " + pair.pairGroupId + ":" + side
      );

      const route = "/input/" + pairIndex + "/" + side;
      routeEntries.push({
        route,
        buffer,
        mediaType: input.mediaType
      });
      pairRoute[side] = route;
    }
    pairRoutes.push(pairRoute);
  });

  return { routeEntries, pairRoutes };
}

function startRunnerServer({
  routeEntries,
  modelBuffer,
  runtimeMetadata
}) {
  const byRoute = new Map(routeEntries.map((entry) => [entry.route, entry]));

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Face Lab real-photo stability runner</title></head>
  <body>
    <img id="input" alt="runtime input">
    <script type="module">
      import {
        FaceLandmarker,
        FilesetResolver
      } from ${JSON.stringify(runtimeMetadata.tasksVision.moduleUrl)};

      window.__faceLabReady = false;
      window.__faceLabError = null;

      try {
        const vision = await FilesetResolver.forVisionTasks(
          ${JSON.stringify(runtimeMetadata.tasksVision.wasmRoot)}
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

        const image = document.getElementById("input");

        window.__faceLabRun = async (sourcePath) => {
          image.src = sourcePath;
          await image.decode();

          const result = faceLandmarker.detect(image);
          const faces = Array.isArray(result.faceLandmarks)
            ? result.faceLandmarks
            : [];

          return {
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
        };

        window.__faceLabClose = () => faceLandmarker.close();
      } catch (error) {
        window.__faceLabError = {
          message: String(error?.message || error),
          stack: String(error?.stack || "")
        };
      } finally {
        window.__faceLabReady = true;
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
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(html);
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

    const input = byRoute.get(requestUrl.pathname);
    if (input) {
      response.writeHead(200, {
        "Content-Type": input.mediaType,
        "Content-Length": input.buffer.length
      });
      response.end(input.buffer);
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
  const manifestPath = args.find((arg) => !arg.startsWith("--"));
  const validateOnly = args.includes("--validate-only");

  assert.ok(
    manifestPath,
    "Usage: node scripts/run-face-lab-real-photo-stability-pairs.mjs <manifest.json> [--validate-only]"
  );

  const runManifest = readJson(manifestPath);
  const manifestSummary =
    validateRealPhotoStabilityRunManifest(runManifest);

  if (validateOnly) {
    console.log(JSON.stringify({
      ok: true,
      validateOnly: true,
      manifestSummary,
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
  const semanticContract = readJson(
    "evidence/facelab/structural-measurement/v0/semantic-contract.json"
  );

  const { routeEntries, pairRoutes } =
    resolveInputImages(manifestPath, runManifest);

  const modelBuffer = await fetchPinnedModel(imageRuntimeMetadata.model);
  const { server, origin } = await startRunnerServer({
    routeEntries,
    modelBuffer,
    runtimeMetadata: imageRuntimeMetadata
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
    await page.waitForFunction(
      () => window.__faceLabReady === true,
      null,
      { timeout: 120_000 }
    );

    const browserError = await page.evaluate(
      () => window.__faceLabError
    );
    assert.equal(
      browserError,
      null,
      browserError
        ? "Face Landmarker browser failure: " + browserError.message
        : undefined
    );

    const reports = [];

    for (let pairIndex = 0; pairIndex < runManifest.pairs.length; pairIndex += 1) {
      const pair = runManifest.pairs[pairIndex];
      const routes = pairRoutes[pairIndex];
      const measurements = {};

      for (const side of ["reference", "candidate"]) {
        const input = pair[side];
        const result = await page.evaluate(
          async (route) => window.__faceLabRun(route),
          routes[side]
        );

        assert.equal(
          result.faceCount,
          1,
          "Real-photo input must yield exactly one face: " +
            pair.pairGroupId + ":" + side
        );
        assert.equal(result.landmarks.length, 1);
        assert.ok(
          result.landmarks[0].length >= 468,
          "Real-photo input topology shorter than 468: " +
            pair.pairGroupId + ":" + side
        );

        const bridged =
          buildPhotoGeometryMeasurementFromFaceLandmarkerResult(
            {
              sampleId: input.sampleId,
              faceLandmarkerResult: {
                faceLandmarks: result.landmarks
              },
              frameWidth: result.width,
              frameHeight: result.height,
              sourceVersion: photoManifest.providerVersion,
              sourceImagePersisted: false
            },
            photoManifest,
            metricRuntimeMetadata
          );

        assert.equal(
          bridged.measurement.privacy.sourceImagePersisted,
          false
        );
        assert.equal(
          bridged.measurement.privacy.identityEmbeddingCreated,
          false
        );
        measurements[side] = bridged.measurement;
      }

      reports.push(
        buildRealPhotoSameSubjectStabilityEvidence(
          {
            pairGroupId: pair.pairGroupId,
            referenceMeasurement: measurements.reference,
            candidateMeasurement: measurements.candidate,
            nuisance: pair.nuisance,
            subjectLinkage: pair.subjectLinkage,
            executionProvenance: {
              kind: "real_photo_pair_runner",
              runnerVersion:
                "face-lab-real-photo-stability-pair-runner-v0",
              runManifestDigest: manifestSummary.manifestDigest,
              sourceSetProvenanceRef:
                runManifest.sourceSet.provenanceRef,
              referenceImageSha256: pair.reference.sha256,
              candidateImageSha256: pair.candidate.sha256
            }
          },
          semanticContract
        )
      );
    }

    const collectionSummary =
      summarizeRealPhotoStabilityCollection(reports);

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

    console.log(JSON.stringify({
      schemaVersion: "face-lab-real-photo-stability-run-output-v0",
      ok: true,
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false,
      manifestSummary,
      collectionSummary,
      reports,
      runtime: {
        provider: photoManifest.provider,
        providerVersion: photoManifest.providerVersion,
        modelSha256: imageRuntimeMetadata.model.sha256
      },
      privacy: {
        sourceImagePersisted: false,
        rawLandmarksPersisted: false,
        identityEmbeddingCreated: false,
        biometricIdentityMatchPerformed: false,
        outputContainsStructuralEvidenceOnly: true
      }
    }, null, 2));

    await page.evaluate(() => window.__faceLabClose());
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

await main();
