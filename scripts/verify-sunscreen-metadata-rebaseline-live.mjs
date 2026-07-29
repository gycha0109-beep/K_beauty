import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProductDataSufficiencyAudit } from "../lib/product-data-sufficiency-audit.js";
import { resolveProductFunctionalProfile } from "../lib/product-functional-profile.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT, "tmp", "sunscreen-metadata-rebaseline");
const EXPORT_PATH = path.join(OUTPUT_DIR, "products-raw-export-post-sunscreen-remediation.json");
const EVIDENCE_PATH = path.join(OUTPUT_DIR, "sunscreen-metadata-rebaseline-evidence.json");
const SOURCE_URL = "https://bygrczggxfuisupcevaz.supabase.co";
const SOURCE_KEY = "sb_publishable_siC-o2dSDTKrcXS7lJAHRA_tdNfWCPF";
const EXPECTED_ROWS = 164;
const PRESERVED_EXPORT_TIME = Date.parse("2026-07-28T09:05:37.000Z");
const REMEDIATION_VERSION = "sunscreen-protection-metadata-remediation-v1";
const EXPECTED_TARGETS = new Map([
  ["9983f167-24e7-4223-bd86-446ce6ced31b", { uvaLabel: "PA++++", pillingRisk: "low" }],
  ["cbcd06a2-de29-47ca-afd1-ab1d5de93903", { uvaLabel: "PA++++", pillingRisk: "low" }]
]);
let assertions = 0;

function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

function deepEqual(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function productId(product) {
  return String(product?.id || "").trim();
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => [key, stable(value[key])])
  );
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function fetchPage(offset, limit = 100) {
  const endpoint = new URL("/rest/v1/products", SOURCE_URL);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("order", "id.asc");
  endpoint.searchParams.set("offset", String(offset));
  endpoint.searchParams.set("limit", String(limit));
  const response = await fetch(endpoint, {
    headers: {
      apikey: SOURCE_KEY,
      Authorization: `Bearer ${SOURCE_KEY}`,
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`catalog read failed: ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("catalog response was not an array");
  return rows;
}

async function fetchProducts() {
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const page = await fetchPage(offset, 100);
    rows.push(...page);
    if (page.length < 100) break;
  }
  return rows.sort((left, right) => productId(left).localeCompare(productId(right)));
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

async function run() {
  const firstRead = await fetchProducts();
  const secondRead = await fetchProducts();

  equal(firstRead.length, EXPECTED_ROWS, "catalog row count");
  equal(secondRead.length, EXPECTED_ROWS, "catalog reread row count");
  equal(new Set(firstRead.map(productId)).size, EXPECTED_ROWS, "unique product ids");
  deepEqual(firstRead, secondRead, "ordered Production reads must be identical");

  const updatedAfterPreservedExport = firstRead.filter((product) => {
    const timestamp = Date.parse(String(product.updated_at || ""));
    return Number.isFinite(timestamp) && timestamp > PRESERVED_EXPORT_TIME;
  });
  equal(updatedAfterPreservedExport.length, 2, "exactly two products changed after preserved export");
  deepEqual(
    updatedAfterPreservedExport.map(productId).sort(),
    [...EXPECTED_TARGETS.keys()].sort(),
    "only approved remediation targets changed after preserved export"
  );

  for (const [id, expected] of EXPECTED_TARGETS) {
    const product = firstRead.find((row) => productId(row) === id);
    check(product, "approved target exists");
    equal(product.uva_label, expected.uvaLabel, "approved UVA value");
    equal(product.pilling_risk, expected.pillingRisk, "approved pilling value");
    equal(
      product?.review_signals?.metadata_remediation?.version,
      REMEDIATION_VERSION,
      "versioned remediation evidence"
    );
    check(hasValue(product.source_url), "primary source URL is present");
    check(Array.isArray(product?.review_signals?.metadata_remediation?.sources), "source evidence array");
    check(product.review_signals.metadata_remediation.sources.length > 0, "source evidence is non-empty");
  }

  equal(
    firstRead.filter((product) => product?.review_signals?.metadata_remediation?.version === REMEDIATION_VERSION).length,
    2,
    "exactly two rows carry this remediation version"
  );

  const sunscreen = firstRead.filter((product) => product.category === "sunscreen");
  equal(sunscreen.length, 11, "sunscreen count");
  equal(sunscreen.filter((product) => hasValue(product.uva_label)).length, 11, "UVA complete");
  equal(sunscreen.filter((product) => hasValue(product.pilling_risk)).length, 11, "pilling complete");
  equal(
    sunscreen.filter((product) => {
      const profile = resolveProductFunctionalProfile(product);
      return profile.categoryRole === "protection" &&
        profile.functionalAxes.some((axis) => axis.axis === "sunscreen_protection") &&
        !profile.cautionTags.includes("sunscreen_metadata_incomplete");
    }).length,
    11,
    "all sunscreen protection profiles complete"
  );

  const audit = buildProductDataSufficiencyAudit(firstRead, { sourceType: "raw_export" });
  equal(audit.status, "audit_complete", "audit status");
  equal(audit.dataset.rowCount, EXPECTED_ROWS, "audit row count");
  equal(audit.summary.transportCompleteCount, EXPECTED_ROWS, "transport complete");
  equal(audit.summary.criticalGapCount, 0, "critical gaps");
  equal(audit.summary.importantGapCount, 0, "important gaps");
  equal(audit.summary.qualityGapCount, 0, "quality gaps");
  equal(audit.summary.sunscreenProtectionReadyCount, 11, "sunscreen protection ready");
  equal(audit.summary.sunscreenPreferenceReadyCount, 11, "sunscreen preference ready");

  const exportText = `${JSON.stringify(firstRead, null, 2)}\n`;
  const sunscreenSummary = {
    total: sunscreen.length,
    uvaComplete: sunscreen.filter((product) => hasValue(product.uva_label)).length,
    pillingComplete: sunscreen.filter((product) => hasValue(product.pilling_risk)).length,
    protectionReady: audit.summary.sunscreenProtectionReadyCount,
    preferenceReady: audit.summary.sunscreenPreferenceReadyCount
  };
  const auditSummary = {
    status: audit.status,
    transportComplete: audit.summary.transportCompleteCount,
    criticalGaps: audit.summary.criticalGapCount,
    importantGaps: audit.summary.importantGapCount,
    qualityGaps: audit.summary.qualityGapCount
  };
  const evidence = {
    status: "SUNSCREEN_METADATA_REMEDIATION_REBASELINE_LIVE_PASS",
    source: "production_public_products_select_only",
    rows: firstRead.length,
    uniqueIds: new Set(firstRead.map(productId)).size,
    changedAfterPreservedExport: updatedAfterPreservedExport.length,
    approvedChangedProductCount: 2,
    unexpectedChangedProductCount: 0,
    sunscreen: sunscreenSummary,
    audit: auditSummary,
    rawExportSha256: hash(exportText),
    datasetHash: audit.dataset.datasetHash,
    semanticHash: hash(JSON.stringify(stable({
      rows: firstRead.length,
      changedAfterPreservedExport: updatedAfterPreservedExport.length,
      sunscreen: sunscreenSummary,
      audit: auditSummary,
      datasetHash: audit.dataset.datasetHash
    }))),
    assertions
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(EXPORT_PATH, exportText, "utf8");
  writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(evidence, null, 2));
}

await run();
