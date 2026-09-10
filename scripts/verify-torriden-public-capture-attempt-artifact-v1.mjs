import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  TORRIDEN_PUBLIC_CAPTURE_GOODS_NO,
  TORRIDEN_PUBLIC_CAPTURE_POLICY,
  TORRIDEN_PUBLIC_CAPTURE_TARGET,
  TORRIDEN_PUBLIC_CAPTURE_VERSION,
} from "../lib/server/torriden-public-listing-capture-v1.js";
import {
  admitSellerListingParserFixtureV1,
  decodeAdmittedSellerListingParserFixturePayloadV1,
} from "../lib/server/seller-listing-parser-fixture-v1.js";

function parseInputDir(argv) {
  let inputDir = null;
  for (const argument of argv) {
    if (!argument.startsWith("--input-dir=")) {
      throw new Error(`unsupported_argument:${argument}`);
    }
    if (inputDir !== null) throw new Error("duplicate_input_dir");
    inputDir = argument.slice("--input-dir=".length).trim();
  }
  if (!inputDir) throw new Error("missing_input_dir");
  return path.resolve(inputDir);
}

function assertExactKeys(value, expected, label) {
  assert.equal(
    value !== null && typeof value === "object" && !Array.isArray(value),
    true,
    `${label}_not_object`,
  );
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label}_unexpected_keys`);
}

function assertIsoTimestamp(value, label) {
  assert.equal(typeof value, "string", `${label}_not_string`);
  assert.equal(Number.isNaN(Date.parse(value)), false, `${label}_invalid_timestamp`);
}

const inputDir = parseInputDir(process.argv.slice(2));
const metadataName = `torriden-${TORRIDEN_PUBLIC_CAPTURE_GOODS_NO}-capture-metadata.json`;
const metadata = JSON.parse(await fs.readFile(path.join(inputDir, metadataName), "utf8"));

assert.equal(metadata.schema_version, "torriden_public_listing_capture_attempt_v1");
assertIsoTimestamp(metadata.attempted_at, "attempted_at");
assert.deepEqual(metadata.capture_policy, TORRIDEN_PUBLIC_CAPTURE_POLICY);

if (metadata.outcome === "captured_source") {
  assertExactKeys(
    metadata,
    [
      "schema_version",
      "outcome",
      "capture_admitted",
      "attempted_at",
      "capture_policy",
      "response",
      "evidence",
      "fixture_file",
    ],
    "captured_metadata",
  );
  assert.equal(metadata.capture_admitted, true);
  assert.equal(metadata.response.requested_url, TORRIDEN_PUBLIC_CAPTURE_TARGET);
  assert.match(metadata.response.final_url, /^https:\/\/www\.torriden\.com\/goods\/goods_view\.php\?/);
  assert.equal(metadata.response.status >= 200 && metadata.response.status < 300, true);
  assert.equal(metadata.evidence.seller, "torriden_official");
  assert.equal(metadata.evidence.listing_url, TORRIDEN_PUBLIC_CAPTURE_TARGET);
  assert.equal(metadata.evidence.source_version, TORRIDEN_PUBLIC_CAPTURE_VERSION);
  assertIsoTimestamp(metadata.evidence.observed_at, "observed_at");
  assert.equal(typeof metadata.evidence.payload_sha256, "string");
  assert.match(metadata.evidence.payload_sha256, /^[0-9a-f]{64}$/);
  assert.equal(Number.isSafeInteger(metadata.evidence.payload_byte_length), true);
  assert.equal(metadata.evidence.payload_byte_length > 0, true);
  assert.equal(typeof metadata.evidence.payload_contains_goods_no, "boolean");

  const fixturePath = path.join(inputDir, metadata.fixture_file);
  const fixture = admitSellerListingParserFixtureV1(
    JSON.parse(await fs.readFile(fixturePath, "utf8")),
  );
  const payload = decodeAdmittedSellerListingParserFixturePayloadV1(fixture);
  assert.equal(payload.byteLength, metadata.evidence.payload_byte_length);
  assert.equal(fixture.evidence.payload_sha256, metadata.evidence.payload_sha256);
  assert.equal(fixture.evidence.listing_url, TORRIDEN_PUBLIC_CAPTURE_TARGET);
  assert.equal(
    payload.includes(Buffer.from(TORRIDEN_PUBLIC_CAPTURE_GOODS_NO, "utf8")),
    metadata.evidence.payload_contains_goods_no,
  );
} else if (metadata.outcome === "source_access_blocked") {
  assertExactKeys(
    metadata,
    [
      "schema_version",
      "outcome",
      "capture_admitted",
      "attempted_at",
      "capture_policy",
      "target",
      "error_code",
    ],
    "blocked_metadata",
  );
  assert.equal(metadata.capture_admitted, false);
  assert.equal(metadata.target, TORRIDEN_PUBLIC_CAPTURE_TARGET);
  assert.equal(metadata.error_code, "torriden_public_capture_http_status:403");
  await assert.rejects(
    fs.access(path.join(inputDir, `torriden-${TORRIDEN_PUBLIC_CAPTURE_GOODS_NO}-parser-fixture.json`)),
  );
} else {
  throw new Error(`unsupported_capture_outcome:${metadata.outcome}`);
}

console.log(`torriden_public_capture_attempt_artifact_v1: PASS (${metadata.outcome})`);
