import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const port = Number(process.env.MOBILE_ANALYZE_E2E_PORT || "8765");
const artifactDir = resolve(
  process.env.MOBILE_ANALYZE_E2E_ARTIFACT_DIR || "apps/mobile/.mobile-native-artifacts"
);
const maxBytes = 12 * 1024 * 1024;
const requiredFields = [
  "image",
  "skinType",
  "sensitivity",
  "mainConcern",
  "cleansingFrequency",
  "preferredTexture",
  "postWashFeeling",
  "afternoonSkinChange",
  "mostDislikedFeel",
  "locale"
];

mkdirSync(artifactDir, { recursive: true });

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/analyze") {
    sendJson(response, 404, { error: "not_found" });
    return;
  }

  const contentType = String(request.headers["content-type"] || "");
  const idempotencyKey = String(request.headers["idempotency-key"] || "");
  const chunks = [];
  let receivedBytes = 0;
  let overflow = false;

  request.on("data", (chunk) => {
    receivedBytes += chunk.length;
    if (receivedBytes > maxBytes) {
      overflow = true;
      return;
    }
    chunks.push(chunk);
  });

  request.on("end", () => {
    if (overflow) {
      sendJson(response, 413, { error: "fixture_payload_too_large" });
      return;
    }

    const body = Buffer.concat(chunks);
    const multipartText = body.toString("latin1");
    const missingFields = requiredFields.filter(
      (field) => !multipartText.includes(`name="${field}"`)
    );
    const hasMultipartBoundary = /^multipart\/form-data;\s*boundary=/i.test(contentType);
    const hasJpegPart =
      /name="image"[\s\S]{0,512}(?:filename="[^"]+\.jpe?g"|Content-Type:\s*image\/jpeg)/i.test(
        multipartText
      );
    const idempotencyValid = /^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey);

    const evidence = {
      method: request.method,
      url: request.url,
      contentType,
      contentLength: body.length,
      missingFields,
      hasMultipartBoundary,
      hasJpegPart,
      idempotencyValid
    };
    writeFileSync(
      resolve(artifactDir, "analyze-runtime-request.json"),
      JSON.stringify(evidence, null, 2) + "\n"
    );

    if (!hasMultipartBoundary || !hasJpegPart || !idempotencyValid || missingFields.length > 0) {
      sendJson(response, 400, {
        error: "fixture_contract_failed",
        evidence
      });
      return;
    }

    console.log("MOBILE_ANALYZE_E2E_REQUEST=PASS");
    sendJson(response, 200, {
      summary: "Mobile runtime transport verified.",
      topPick: null,
      alternative: null,
      morning: [],
      night: [],
      warnings: [],
      meta: {
        schemaVersion: 2,
        source: "mobile-ci-runtime-fixture",
        locale: "en"
      }
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MOBILE_ANALYZE_E2E_SERVER_READY=PASS port=${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
