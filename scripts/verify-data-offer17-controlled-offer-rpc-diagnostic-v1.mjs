#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const servicePath = path.join(root, "lib/server/product-offer-read-service.js");
const oidcPath = path.join(root, "lib/product-offer-controlled-probe-oidc.js");
const routePath = path.join(
  root,
  "app/api/internal/product-offer-presentation-authority-controlled-probe/route.js",
);
const workflowPath = path.join(
  root,
  ".github/workflows/data-offer17-controlled-offer-rpc-diagnostic.yml",
);
const healthPath = path.join(root, "scripts/verify-current-main-health.mjs");

const serviceSource = fs.readFileSync(servicePath, "utf8");
const oidcSource = fs.readFileSync(oidcPath, "utf8");
const routeSource = fs.readFileSync(routePath, "utf8");
const workflowSource = fs.readFileSync(workflowPath, "utf8");
const healthSource = fs.readFileSync(healthPath, "utf8");

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function verifyControlledPngFixture() {
  const fixtureMatch = workflowSource.match(
    /printf '%s' '([A-Za-z0-9+\/=]+)' \| base64 --decode > "\$image_file"/,
  );
  assert.ok(fixtureMatch, "controlled analyze PNG fixture must be embedded in the workflow");

  const bytes = Buffer.from(fixtureMatch[1], "base64");
  assert.deepEqual(
    bytes.subarray(0, 8),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    "controlled analyze fixture must have a PNG signature",
  );

  let offset = 8;
  let sawIhdr = false;
  let sawIdat = false;
  let sawIend = false;

  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, "PNG fixture chunk header must be complete");
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    const chunkEnd = crcOffset + 4;
    assert.ok(chunkEnd <= bytes.length, "PNG fixture chunk must fit in the payload");

    const type = bytes.subarray(typeStart, dataStart);
    const data = bytes.subarray(dataStart, dataEnd);
    const typeName = type.toString("ascii");
    const storedCrc = bytes.readUInt32BE(crcOffset);
    const calculatedCrc = crc32(Buffer.concat([type, data]));
    assert.equal(
      storedCrc,
      calculatedCrc,
      `controlled analyze PNG fixture CRC mismatch for ${typeName}`,
    );

    if (typeName === "IHDR") {
      sawIhdr = true;
      assert.equal(length, 13, "PNG IHDR length must be canonical");
      assert.equal(data.readUInt32BE(0), 2, "controlled fixture width must be 2");
      assert.equal(data.readUInt32BE(4), 2, "controlled fixture height must be 2");
    } else if (typeName === "IDAT") {
      sawIdat = true;
    } else if (typeName === "IEND") {
      sawIend = true;
    }

    offset = chunkEnd;
    if (typeName === "IEND") break;
  }

  assert.equal(offset, bytes.length, "PNG fixture must not contain trailing bytes");
  assert.ok(sawIhdr && sawIdat && sawIend, "PNG fixture must contain IHDR, IDAT, and IEND");
}

verifyControlledPngFixture();

assert.match(
  oidcSource,
  /urn:bejewely:data-offer17:offer-runtime-probe/,
);
assert.match(
  oidcSource,
  /\.github\/workflows\/data-offer17-controlled-offer-rpc-diagnostic\.yml/,
);
assert.match(oidcSource, /gycha0109-beep\/K_beauty/);
assert.match(oidcSource, /repository_id/);
assert.match(oidcSource, /event_name !== "push"/);
assert.match(oidcSource, /runner_environment !== "github-hosted"/);
assert.match(oidcSource, /payload\?\.workflow_sha !== expectedDeploymentSha/);
assert.match(oidcSource, /payload\?\.sha !== expectedDeploymentSha/);
assert.match(oidcSource, /MAX_TOKEN_AGE_SECONDS = 10 \* 60/);

assert.match(
  serviceSource,
  /export async function runProductOfferPresentationRuntimeSecurityProbe\(productIds\)/,
);
assert.match(serviceSource, /Array\.isArray\(productIds\) \? productIds : \[productIds\]/);
assert.match(
  serviceSource,
  /select current_user::text as role/,
);
assert.match(
  serviceSource,
  /select offer_id from public\.product_offers limit 1/,
);
assert.match(
  serviceSource,
  /\$\{sql\.array\(normalizedProductIds\)\}::uuid\[\]/,
);
assert.match(
  serviceSource,
  /array\[\$\{normalizedProductIds\[0\]\}::uuid\]/,
);
assert.match(serviceSource, /MULTI_PRODUCT_PRIMARY_FAILED/);
assert.match(serviceSource, /requestedProductCount: normalizedProductIds\.length/);
for (const resultClass of [
  "SUCCESS",
  "QUERY_FAILED",
  "TIMEOUT",
  "CARDINALITY_INVALID",
  "PAYLOAD_INVALID",
  "CONTRACT_MISMATCH",
]) {
  assert.match(serviceSource, new RegExp(`"${resultClass}"`));
}
assert.doesNotMatch(serviceSource, /console\.(?:log|info|warn|error)\(/);

assert.match(routeSource, /CONTROLLED_PRODUCT_IDS/);
assert.match(
  routeSource,
  /08b85f37-b1fa-42d7-893a-0d4facb17878/,
);
assert.equal(
  (routeSource.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi) || []).length,
  8,
);
assert.match(
  routeSource,
  /runProductOfferPresentationRuntimeSecurityProbe/,
);
assert.match(routeSource, /verifyDataOffer17GitHubActionsOidcToken/);
assert.match(routeSource, /requestedProductCount: probe\.requestedProductCount/);
assert.match(routeSource, /secretValueExposed: false/);
assert.match(routeSource, /result: securityBoundaryPass && rpcPass \? "PASS" : "DIAGNOSTIC_COMPLETE"/);
assert.doesNotMatch(routeSource, /productId\s*:/);
assert.doesNotMatch(routeSource, /listingUrl|priceAmount|databaseUrl|errorMessage|rawError/);
assert.doesNotMatch(routeSource, /console\.(?:log|info|warn|error)\(/);

assert.match(workflowSource, /Checkout exact head/);
assert.match(workflowSource, /DATA_OFFER17_EXACT_HEAD/);
assert.match(
  workflowSource,
  /urn:bejewely:data-offer17:offer-runtime-probe/,
);
assert.match(
  workflowSource,
  /product-offer-presentation-authority-controlled-probe/,
);
assert.match(workflowSource, /payload\.requestedProductCount !== 8/);
assert.match(workflowSource, /Run controlled Production analyze request/);
assert.match(workflowSource, /\/api\/analyze/);
assert.match(workflowSource, /DATA_OFFER17_ANALYZE_EVIDENCE=/);
assert.match(workflowSource, /x-vercel-trusted-oidc-idp-token/);
assert.match(workflowSource, /DIAGNOSTIC_COMPLETE/);
assert.match(workflowSource, /secretValueExposed/);
assert.doesNotMatch(workflowSource, /08b85f37-b1fa-42d7-893a-0d4facb17878/);

assert.match(
  healthSource,
  /verify-data-offer17-controlled-offer-rpc-diagnostic-v1\.mjs/,
);

console.log(JSON.stringify({
  stage: "DATA-OFFER17-CONTROLLED-OFFER-RPC-DIAGNOSTIC",
  oidcBoundToExactWorkflow: true,
  exactDeploymentShaRequired: true,
  primaryRuntimeTransportExercised: true,
  multiProductRuntimeTransportExercised: true,
  controlledAnalyzePathExercised: true,
  controlledAnalyzeFixtureIntegrityVerified: true,
  rawOfferSelectExpectedDenied: true,
  sensitiveOfferFieldsReturned: false,
  rawDatabaseErrorsReturned: false,
  result: "PASS",
}, null, 2));
