import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProductDataSufficiencyAudit } from "../lib/product-data-sufficiency-audit.js";
import { resolveProductFunctionalProfile } from "../lib/product-functional-profile.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = path.join("_local_data", "products-raw-export-post-sunscreen-remediation.json");
const OUTPUT_PATH = path.join(ROOT, "tmp", "sunscreen-metadata-rebaseline-local.json");
const EXPECTED_ROWS = 164;
const EXPECTED_NORMALIZED_EXPORT_SHA256 = "59fe10c81c713fa950bfb187bfb5107c5b01d69bad489f85414a7d26c7558422";
const EXPECTED_DATASET_HASH = "6c74785e7b7163a70fa2d47526ba4845a062bbd70486b01485da7cd4b5a1e978";
const REMEDIATION_VERSION = "sunscreen-protection-metadata-remediation-v1";
const EXPECTED_TARGETS = new Map([
  ["9983f167-24e7-4223-bd86-446ce6ced31b", {
    uvaLabel: "PA++++",
    pillingRisk: "low",
    requiredSourceFields: ["source_url", "hwahae_url"]
  }],
  ["cbcd06a2-de29-47ca-afd1-ab1d5de93903", {
    uvaLabel: "PA++++",
    pillingRisk: "low",
    requiredSourceFields: ["source_url"]
  }]
]);
let assertionCount = 0;

function check(value, message) {
  assertionCount += 1;
  assert.ok(value, message);
}

function equal(actual, expected, message) {
  assertionCount += 1;
  assert.equal(actual, expected, message);
}

function deepEqual(actual, expected, message) {
  assertionCount += 1;
  assert.deepEqual(actual, expected, message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function productId(product) {
  return String(product?.id || product?.productId || product?.product_id || "").trim();
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") {
      args.input = argv[index + 1] || "";
      index += 1;
    }
  }
  return args;
}

function readProducts(inputPath) {
  check(existsSync(inputPath), `input file not found: ${path.basename(inputPath)}`);
  const bytes = readFileSync(inputPath);
  const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(text);
  const products = Array.isArray(parsed) ? parsed : parsed?.products;
  check(Array.isArray(products), "input must be a JSON array or an object containing products");
  const ordered = structuredClone(products).sort((left, right) =>
    productId(left).localeCompare(productId(right))
  );
  return {
    products: ordered,
    sourceFileSha256: sha256(bytes),
    normalizedExportText: `${JSON.stringify(ordered, null, 2)}\n`
  };
}

function verify(inputPath) {
  const { products, sourceFileSha256, normalizedExportText } = readProducts(inputPath);
  const normalizedExportSha256 = sha256(normalizedExportText);

  equal(products.length, EXPECTED_ROWS, "catalog row count");
  equal(new Set(products.map(productId)).size, EXPECTED_ROWS, "unique product IDs");
  equal(normalizedExportSha256, EXPECTED_NORMALIZED_EXPORT_SHA256, "normalized post-remediation export SHA-256");

  const remediationRows = products.filter(
    (product) => product?.review_signals?.metadata_remediation?.version === REMEDIATION_VERSION
  );
  equal(remediationRows.length, EXPECTED_TARGETS.size, "remediation evidence row count");
  deepEqual(
    remediationRows.map(productId).sort(),
    [...EXPECTED_TARGETS.keys()].sort(),
    "remediation evidence target IDs"
  );

  for (const [id, expected] of EXPECTED_TARGETS) {
    const product = products.find((row) => productId(row) === id);
    check(product, "approved remediation target exists");
    equal(product.category, "sunscreen", "approved target category");
    equal(product.uva_label, expected.uvaLabel, "approved UVA label");
    equal(product.pilling_risk, expected.pillingRisk, "approved pilling risk");
    equal(
      product.review_signals.metadata_remediation.version,
      REMEDIATION_VERSION,
      "remediation version"
    );
    check(
      Array.isArray(product.review_signals.metadata_remediation.sources) &&
        product.review_signals.metadata_remediation.sources.length > 0,
      "versioned source evidence"
    );
    for (const field of expected.requiredSourceFields) {
      check(hasValue(product[field]), `${field} must be present`);
    }
  }

  const sunscreenRows = products.filter((product) => product.category === "sunscreen");
  equal(sunscreenRows.length, 11, "sunscreen row count");
  equal(sunscreenRows.filter((product) => hasValue(product.uva_label)).length, 11, "UVA complete count");
  equal(sunscreenRows.filter((product) => hasValue(product.pilling_risk)).length, 11, "pilling complete count");
  equal(
    sunscreenRows.filter((product) => {
      const profile = resolveProductFunctionalProfile(product);
      return profile.categoryRole === "protection" &&
        profile.functionalAxes.some((axis) => axis.axis === "sunscreen_protection") &&
        !profile.cautionTags.includes("sunscreen_metadata_incomplete");
    }).length,
    11,
    "protection-complete sunscreen profiles"
  );

  const audit = buildProductDataSufficiencyAudit(products, { sourceType: "raw_export" });
  equal(audit.dataset.datasetHash, EXPECTED_DATASET_HASH, "post-remediation dataset hash");
  equal(audit.dataset.rowCount, EXPECTED_ROWS, "audit row count");
  equal(audit.status, "audit_complete", "audit status");
  equal(audit.summary.transportCompleteCount, EXPECTED_ROWS, "snapshot transport complete");
  equal(audit.summary.criticalGapCount, 0, "critical gaps");
  equal(audit.summary.importantGapCount, 0, "important gaps");
  equal(audit.summary.qualityGapCount, 0, "quality gaps");
  equal(audit.summary.sunscreenProtectionReadyCount, 11, "sunscreen protection ready");
  equal(audit.summary.sunscreenPreferenceReadyCount, 11, "sunscreen preference ready");

  return {
    status: "SUNSCREEN_METADATA_REMEDIATION_REBASELINE_LOCAL_PASS",
    input: {
      basename: path.basename(inputPath),
      sourceFileSha256,
      normalizedExportSha256
    },
    rows: products.length,
    uniqueIds: new Set(products.map(productId)).size,
    remediationRows: remediationRows.length,
    datasetHash: audit.dataset.datasetHash,
    auditStatus: audit.status,
    transportComplete: audit.summary.transportCompleteCount,
    gaps: {
      critical: audit.summary.criticalGapCount,
      important: audit.summary.importantGapCount,
      quality: audit.summary.qualityGapCount
    },
    sunscreen: {
      total: sunscreenRows.length,
      uvaComplete: sunscreenRows.filter((product) => hasValue(product.uva_label)).length,
      pillingComplete: sunscreenRows.filter((product) => hasValue(product.pilling_risk)).length,
      protectionReady: audit.summary.sunscreenProtectionReadyCount,
      preferenceReady: audit.summary.sunscreenPreferenceReadyCount
    },
    assertions: assertionCount
  };
}

const args = parseArgs(process.argv.slice(2));
const inputPath = path.isAbsolute(args.input || "")
  ? path.resolve(args.input)
  : path.resolve(ROOT, args.input || DEFAULT_INPUT);
mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

try {
  const result = verify(inputPath);
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const failure = {
    status: "PRECONDITION_FAILURE",
    input: { basename: path.basename(inputPath) },
    reason: error instanceof Error ? error.message : String(error),
    assertions: assertionCount
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(failure, null, 2)}\n`, "utf8");
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
