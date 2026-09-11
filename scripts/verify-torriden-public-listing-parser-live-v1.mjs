import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  parseSellerListingObservationV1,
} from "../lib/seller-listing-observation-v1.js";
import {
  admitSellerListingParserFixtureV1,
} from "../lib/server/seller-listing-parser-fixture-v1.js";
import {
  TORRIDEN_PUBLIC_CAPTURE_GOODS_NO,
  TORRIDEN_PUBLIC_CAPTURE_TARGET,
  TORRIDEN_PUBLIC_CAPTURE_VERSION,
} from "../lib/server/torriden-public-listing-capture-v1.js";
import {
  TORRIDEN_PUBLIC_LISTING_PARSER_VERSION,
  parseTorridenCapturedListingFixtureV1,
} from "../lib/server/torriden-public-listing-parser-v1.js";

function parseArgs(argv) {
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

const inputDir = parseArgs(process.argv.slice(2));
const fixtureName = `torriden-${TORRIDEN_PUBLIC_CAPTURE_GOODS_NO}-parser-fixture.json`;
const fixturePath = path.join(inputDir, fixtureName);
const fixture = admitSellerListingParserFixtureV1(
  JSON.parse(await fs.readFile(fixturePath, "utf8")),
);

assert.equal(fixture.evidence.seller, "torriden_official");
assert.equal(fixture.evidence.listing_url, TORRIDEN_PUBLIC_CAPTURE_TARGET);
assert.equal(fixture.evidence.source_version, TORRIDEN_PUBLIC_CAPTURE_VERSION);

const parsed = parseTorridenCapturedListingFixtureV1(fixture);
assert.equal(parsed.listing_id, TORRIDEN_PUBLIC_CAPTURE_GOODS_NO);
assert.equal(parsed.price !== null, true);
assert.equal(Number.isFinite(parsed.price.amount), true);
assert.equal(parsed.price.amount >= 0, true);
assert.equal(parsed.price.currency, "KRW");
assert.equal(["unknown", "in_stock"].includes(parsed.availability), true);

const observation = parseSellerListingObservationV1({
  seller: fixture.evidence.seller,
  listing_id: parsed.listing_id,
  listing_url: fixture.evidence.listing_url,
  price: parsed.price,
  availability: parsed.availability,
  observed_at: fixture.evidence.observed_at,
  source_version: fixture.evidence.source_version,
});

const result = Object.freeze({
  schema_version: "torriden_public_listing_parser_result_v1",
  parser_version: TORRIDEN_PUBLIC_LISTING_PARSER_VERSION,
  evidence_sha256: fixture.evidence.payload_sha256,
  observation,
});

await fs.writeFile(
  path.join(inputDir, `torriden-${TORRIDEN_PUBLIC_CAPTURE_GOODS_NO}-parser-result.json`),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);

console.log("TORRIDEN_PARSER_LIVE_OUTCOME=parsed_captured_source");
console.log(`TORRIDEN_PARSER_LISTING_ID=${parsed.listing_id}`);
console.log(`TORRIDEN_PARSER_PRICE_AMOUNT=${parsed.price.amount}`);
console.log(`TORRIDEN_PARSER_PRICE_CURRENCY=${parsed.price.currency}`);
console.log(`TORRIDEN_PARSER_AVAILABILITY=${parsed.availability}`);
console.log(`TORRIDEN_PARSER_EVIDENCE_SHA256=${fixture.evidence.payload_sha256}`);
