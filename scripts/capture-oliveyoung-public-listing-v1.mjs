import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  OLIVEYOUNG_PUBLIC_CAPTURE_GOODS_NO,
  OLIVEYOUNG_PUBLIC_CAPTURE_POLICY,
  OLIVEYOUNG_PUBLIC_CAPTURE_TARGET,
  captureOliveYoungPublicListingV1,
  classifyOliveYoungPublicCaptureFailureV1,
} from "../lib/server/oliveyoung-public-listing-capture-v1.js";
import {
  decodeAdmittedSellerListingParserFixturePayloadV1,
} from "../lib/server/seller-listing-parser-fixture-v1.js";

function parseOutputDir(argv) {
  let outputDir = null;
  for (const argument of argv) {
    if (!argument.startsWith("--output-dir=")) {
      throw new Error(`unsupported_argument:${argument}`);
    }
    if (outputDir !== null) {
      throw new Error("duplicate_output_dir");
    }
    outputDir = argument.slice("--output-dir=".length).trim();
  }
  if (!outputDir) {
    throw new Error("missing_output_dir");
  }
  return path.resolve(outputDir);
}

const outputDir = parseOutputDir(process.argv.slice(2));
const attemptStartedAt = new Date().toISOString();
await fs.mkdir(outputDir, { recursive: true });

const fixtureFile = path.join(
  outputDir,
  `oliveyoung-${OLIVEYOUNG_PUBLIC_CAPTURE_GOODS_NO}-parser-fixture.json`,
);
const metadataFile = path.join(
  outputDir,
  `oliveyoung-${OLIVEYOUNG_PUBLIC_CAPTURE_GOODS_NO}-capture-metadata.json`,
);

try {
  const report = await captureOliveYoungPublicListingV1();
  const payloadBytes = decodeAdmittedSellerListingParserFixturePayloadV1(report.fixture);
  const payloadContainsGoodsNo = payloadBytes.includes(
    Buffer.from(OLIVEYOUNG_PUBLIC_CAPTURE_GOODS_NO, "utf8"),
  );

  await fs.writeFile(fixtureFile, `${JSON.stringify(report.fixture, null, 2)}\n`, "utf8");
  await fs.writeFile(
    metadataFile,
    `${JSON.stringify(
      {
        schema_version: "oliveyoung_public_listing_capture_attempt_v1",
        outcome: "captured_source",
        capture_admitted: true,
        attempted_at: attemptStartedAt,
        capture_policy: report.capture_policy,
        response: report.response,
        evidence: {
          seller: report.fixture.evidence.seller,
          listing_url: report.fixture.evidence.listing_url,
          source_version: report.fixture.evidence.source_version,
          observed_at: report.fixture.evidence.observed_at,
          content_type: report.fixture.evidence.content_type,
          payload_sha256: report.fixture.evidence.payload_sha256,
          payload_byte_length: payloadBytes.byteLength,
          payload_contains_goods_no: payloadContainsGoodsNo,
        },
        fixture_file: path.basename(fixtureFile),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("OLIVEYOUNG_CAPTURE_OUTCOME=captured_source");
  console.log(`OLIVEYOUNG_CAPTURE_STATUS=${report.response.status}`);
  console.log(`OLIVEYOUNG_CAPTURE_FINAL_URL=${report.response.final_url}`);
  console.log(`OLIVEYOUNG_CAPTURE_BYTES=${payloadBytes.byteLength}`);
  console.log(`OLIVEYOUNG_CAPTURE_SHA256=${report.fixture.evidence.payload_sha256}`);
  console.log(`OLIVEYOUNG_CAPTURE_CONTAINS_GOODS_NO=${payloadContainsGoodsNo}`);
  console.log(`OLIVEYOUNG_CAPTURE_OUTPUT_DIR=${outputDir}`);
} catch (error) {
  const classification = classifyOliveYoungPublicCaptureFailureV1(error);
  if (!classification) {
    throw error;
  }

  await fs.writeFile(
    metadataFile,
    `${JSON.stringify(
      {
        schema_version: "oliveyoung_public_listing_capture_attempt_v1",
        outcome: classification.outcome,
        capture_admitted: classification.capture_admitted,
        attempted_at: attemptStartedAt,
        capture_policy: OLIVEYOUNG_PUBLIC_CAPTURE_POLICY,
        target: OLIVEYOUNG_PUBLIC_CAPTURE_TARGET,
        error_code: classification.error_code,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`OLIVEYOUNG_CAPTURE_OUTCOME=${classification.outcome}`);
  console.log(`OLIVEYOUNG_CAPTURE_ERROR_CODE=${classification.error_code}`);
  console.log(`OLIVEYOUNG_CAPTURE_TARGET=${OLIVEYOUNG_PUBLIC_CAPTURE_TARGET}`);
  console.log(`OLIVEYOUNG_CAPTURE_OUTPUT_DIR=${outputDir}`);
}
