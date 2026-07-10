#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_ROOT = path.join(ROOT_DIR, "data", "hwahae-review-signals");
const NO_ID_DIR = path.join(ROOT_DIR, "data", "no_ID");
const OUTPUT_DIR = path.join(ROOT_DIR, "tmp", "review-signals-rebuild");
const PLACEHOLDER_PRODUCT_ID = "USER_MUST_REPLACE_SUPABASE_PRODUCT_ID";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function loadEnv() {
  dotenv.config({ path: path.join(ROOT_DIR, ".env.local"), quiet: true });
  dotenv.config({ path: path.join(ROOT_DIR, ".env"), quiet: true });
}

function createSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl.startsWith("http") ? supabaseUrl : `https://${supabaseUrl}`, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function getRelativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).replaceAll("\\", "/");
}

function extractItems(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.products)) {
    return value.products;
  }

  return value && typeof value === "object" ? [value] : [];
}

function getProductId(item) {
  if (!Object.hasOwn(item || {}, "productId") && !Object.hasOwn(item || {}, "product_id")) {
    return "";
  }

  return String(item?.productId ?? item?.product_id ?? "").trim();
}

function parseCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const parsed = Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function hasFunctionalNonZero(functional) {
  if (Array.isArray(functional)) {
    return functional.some((entry) => {
      const count = Array.isArray(entry) ? entry[1] : entry?.count;
      return parseCount(count) > 0;
    });
  }

  if (isObject(functional)) {
    return Object.values(functional).some((value) => parseCount(value) > 0);
  }

  return false;
}

function getFunctionalState(item) {
  const ingredientRaw = item?.ingredient_raw;
  const functional = ingredientRaw?.functional;

  if (!ingredientRaw || typeof ingredientRaw !== "object") {
    return "ingredient_raw_missing";
  }

  if (functional == null) {
    return "functional_missing";
  }

  if (!Array.isArray(functional) && !isObject(functional)) {
    return "functional_shape_unsupported";
  }

  if (!hasFunctionalNonZero(functional)) {
    return "functional_all_zero";
  }

  return "functional_non_zero";
}

function getCompletenessScore(item) {
  const ingredientRaw = item?.ingredient_raw;
  const functionalState = getFunctionalState(item);

  return (
    (item?.review_raw ? 2 : 0) +
    (item?.market_raw ? 2 : 0) +
    (ingredientRaw ? 2 : 0) +
    (ingredientRaw?.functional != null ? 3 : 0) +
    (functionalState === "functional_non_zero" ? 5 : 0) +
    (ingredientRaw?.risk ? 1 : 0) +
    (ingredientRaw?.skin_type ? 1 : 0)
  );
}

function classifyFile(filePath, items) {
  const basename = path.basename(filePath);
  const hasFixtureShape = items.some((item) =>
    Object.hasOwn(item || {}, "review_signals") ||
    Object.hasOwn(item || {}, "market_signals") ||
    Object.hasOwn(item || {}, "ingredient_signals")
  );
  const hasRawShape = items.some((item) =>
    Object.hasOwn(item || {}, "review_raw") ||
    Object.hasOwn(item || {}, "market_raw") ||
    Object.hasOwn(item || {}, "ingredient_raw")
  );

  if (hasFixtureShape) {
    return "fixture";
  }

  if (hasRawShape) {
    if (filePath.endsWith(".jsonl") || /raw-batch|batch\.json$/i.test(basename)) {
      return "raw_batch";
    }

    return "raw_json";
  }

  return "other_json";
}

function isPlaceholderProductId(productId) {
  return (
    !productId ||
    productId === PLACEHOLDER_PRODUCT_ID ||
    productId.toLowerCase() === "null" ||
    productId.toLowerCase() === "undefined" ||
    !UUID_RE.test(productId)
  );
}

function hasDbFunctional(product) {
  return Array.isArray(product?.ingredient_signals?.functional) && product.ingredient_signals.functional.length > 0;
}

function isLegacyManual(product) {
  const signals = product?.ingredient_signals;
  return isObject(signals) && Object.keys(signals).length > 0 && !Object.hasOwn(signals, "functional");
}

function sanitizeFileToken(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 160) || "unknown";
}

function getNoIdCopyPath(relativePath) {
  const parsed = path.parse(relativePath);
  const token = sanitizeFileToken(path.join(parsed.dir, parsed.name).replaceAll("\\", "__").replaceAll("/", "__"));
  const baseCandidate = path.join(NO_ID_DIR, `${token}${parsed.ext || ".json"}`);
  let candidate = baseCandidate;
  let suffix = 2;

  if (fs.existsSync(baseCandidate)) {
    return {
      path: baseCandidate,
      alreadyExists: true
    };
  }

  while (fs.existsSync(candidate)) {
    candidate = path.join(NO_ID_DIR, `${token}__${suffix}${parsed.ext || ".json"}`);
    suffix += 1;
  }

  return {
    path: candidate,
    alreadyExists: false
  };
}

async function fetchProducts() {
  const supabase = createSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id,brand,name,category,normalized_brand,normalized_name,ingredient_signals,review_signals,market_signals,hwahae_url,source_url,buy_link")
    .limit(1000);

  if (error) {
    throw new Error(`products read failed: ${error.message}`);
  }

  return data || [];
}

function scanFiles() {
  const records = [];
  const productIdMissingFiles = [];
  const placeholderFiles = [];
  const parseErrors = [];

  for (const filePath of walkFiles(DATA_ROOT).filter((file) => /\.(json|jsonl)$/i.test(file))) {
    const relativePath = getRelativePath(filePath);

    try {
      const data = filePath.endsWith(".jsonl")
        ? fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
        : readJson(filePath);
      const items = filePath.endsWith(".jsonl") ? data : extractItems(data);
      const kind = classifyFile(filePath, items);
      const inRawFolder = relativePath.split("/").includes("raw");
      let hasMissingProductId = false;
      let hasPlaceholderProductId = false;

      for (const [itemIndex, item] of items.entries()) {
        const productId = getProductId(item);
        const placeholder = isPlaceholderProductId(productId);

        if (!productId) {
          hasMissingProductId = true;
        }

        if (placeholder) {
          hasPlaceholderProductId = true;
        }

        records.push({
          filePath,
          relativePath,
          itemIndex,
          kind,
          inRawFolder,
          productId,
          placeholder,
          item,
          functionalState: kind === "raw_json" ? getFunctionalState(item) : "not_raw_candidate",
          completenessScore: kind === "raw_json" ? getCompletenessScore(item) : 0
        });
      }

      if (hasMissingProductId) {
        productIdMissingFiles.push(relativePath);
      }

      if (hasPlaceholderProductId) {
        placeholderFiles.push(relativePath);
      }
    } catch (error) {
      parseErrors.push({
        path: relativePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    records,
    productIdMissingFiles: [...new Set(productIdMissingFiles)],
    placeholderFiles: [...new Set(placeholderFiles)],
    parseErrors
  };
}

function copyPlaceholderFiles(placeholderFiles) {
  fs.mkdirSync(NO_ID_DIR, { recursive: true });

  return placeholderFiles.map((relativePath) => {
    const source = path.join(ROOT_DIR, relativePath);
    const target = getNoIdCopyPath(relativePath);

    if (!target.alreadyExists) {
      fs.copyFileSync(source, target.path);
    }

    return {
      source: relativePath,
      target: getRelativePath(target.path),
      alreadyExists: target.alreadyExists
    };
  });
}

function addExclusion(map, reason) {
  map[reason] = (map[reason] || 0) + 1;
}

function selectRawCandidates(productsById, records) {
  const byProductId = new Map();
  const excluded = {};
  const dbMissingJson = [];
  const duplicateProductIds = [];
  const selectedDuplicates = [];
  const legacyManualRisks = [];
  const existingFunctionalExcluded = [];

  for (const record of records) {
    if (record.kind !== "raw_json") {
      addExclusion(excluded, `not_raw_json_${record.kind}`);
      continue;
    }

    if (record.placeholder) {
      addExclusion(excluded, record.productId ? "placeholder_or_invalid_product_id" : "product_id_missing");
      continue;
    }

    const product = productsById.get(record.productId);

    if (!product) {
      addExclusion(excluded, "db_product_missing");
      dbMissingJson.push({
        productId: record.productId,
        path: record.relativePath
      });
      continue;
    }

    if (record.functionalState !== "functional_non_zero") {
      addExclusion(excluded, record.functionalState);
      continue;
    }

    if (hasDbFunctional(product)) {
      addExclusion(excluded, "existing_db_functional_preserved");
      existingFunctionalExcluded.push({
        productId: record.productId,
        category: product.category || "",
        brand: product.brand || "",
        name: product.name || "",
        path: record.relativePath
      });
      continue;
    }

    if (isLegacyManual(product)) {
      addExclusion(excluded, "legacy_manual_preserved");
      legacyManualRisks.push({
        productId: record.productId,
        category: product.category || "",
        brand: product.brand || "",
        name: product.name || "",
        path: record.relativePath,
        keys: Object.keys(product.ingredient_signals || {}).sort()
      });
      continue;
    }

    if (!byProductId.has(record.productId)) {
      byProductId.set(record.productId, []);
    }

    byProductId.get(record.productId).push(record);
  }

  const selected = [];

  for (const [productId, candidates] of byProductId.entries()) {
    const sorted = candidates
      .slice()
      .sort((left, right) => {
        if (right.completenessScore !== left.completenessScore) {
          return right.completenessScore - left.completenessScore;
        }

        if (left.inRawFolder !== right.inRawFolder) {
          return left.inRawFolder ? -1 : 1;
        }

        return left.relativePath.localeCompare(right.relativePath);
      });
    const winner = sorted[0];
    const product = productsById.get(productId);

    selected.push({
      productId,
      category: product.category || "missing_category",
      brand: product.brand || "",
      name: product.name || "",
      path: winner.relativePath,
      score: winner.completenessScore,
      item: winner.item
    });

    if (sorted.length > 1) {
      duplicateProductIds.push({
        productId,
        selected: winner.relativePath,
        skipped: sorted.slice(1).map((record) => record.relativePath)
      });
      selectedDuplicates.push(...sorted.slice(1).map((record) => ({
        productId,
        path: record.relativePath,
        reason: "duplicate_not_selected"
      })));
    }
  }

  return {
    selected,
    excluded,
    dbMissingJson,
    duplicateProductIds,
    selectedDuplicates,
    legacyManualRisks,
    existingFunctionalExcluded
  };
}

function writeRawBatches(selected) {
  const byCategory = new Map();

  for (const candidate of selected) {
    if (!byCategory.has(candidate.category)) {
      byCategory.set(candidate.category, []);
    }

    byCategory.get(candidate.category).push(candidate);
  }

  const rawBatches = [];

  for (const [category, candidates] of [...byCategory.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const ids = candidates.map((candidate) => candidate.productId);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    const placeholders = ids.filter(isPlaceholderProductId);

    if (duplicateIds.length || placeholders.length) {
      throw new Error(`Invalid raw-batch candidate for ${category}: duplicate=${duplicateIds.length}, placeholder=${placeholders.length}`);
    }

    const outPath = path.join(OUTPUT_DIR, `${category}.raw-batch.json`);
    writeJson(outPath, candidates.map((candidate) => candidate.item));
    rawBatches.push({
      category,
      count: candidates.length,
      path: getRelativePath(outPath),
      productIds: ids,
      products: candidates.map((candidate) => ({
        productId: candidate.productId,
        brand: candidate.brand,
        name: candidate.name,
        sourcePath: candidate.path
      }))
    });
  }

  return rawBatches;
}

function makeMarkdown(summary) {
  const rawRows = summary.rawBatches.map((item) => `| ${item.category} | ${item.count} | ${item.path} |`);
  const copiedRows = summary.placeholderCopies.map((item) => `| ${item.source} | ${item.target} |`);
  const exclusionRows = Object.entries(summary.excludedCounts).map(([reason, count]) => `| ${reason} | ${count} |`);
  const dbMissingRows = summary.dbMissingJson.slice(0, 50).map((item) => `| ${item.productId} | ${item.path} |`);

  return `${[
    "# Review Signal Rebuild Summary",
    "",
    "## Totals",
    "",
    `- dbProducts: ${summary.totals.dbProducts}`,
    `- scannedJsonRecords: ${summary.totals.scannedJsonRecords}`,
    `- selectedRawCandidates: ${summary.totals.selectedRawCandidates}`,
    `- placeholderFilesCopied: ${summary.totals.placeholderFilesCopied}`,
    `- productIdMissingFiles: ${summary.totals.productIdMissingFiles}`,
    `- dbMissingJson: ${summary.totals.dbMissingJson}`,
    `- duplicateSelectedProductIds: ${summary.totals.duplicateSelectedProductIds}`,
    `- legacyManualRisks: ${summary.totals.legacyManualRisks}`,
    `- existingFunctionalPreserved: ${summary.totals.existingFunctionalPreserved}`,
    "",
    "## Raw Batches",
    "",
    "| category | count | path |",
    "|---|---:|---|",
    ...rawRows,
    "",
    "## Placeholder Copies",
    "",
    "| source | target |",
    "|---|---|",
    ...copiedRows,
    "",
    "## Exclusions",
    "",
    "| reason | count |",
    "|---|---:|",
    ...exclusionRows,
    "",
    "## DB Missing JSON",
    "",
    "| productId | path |",
    "|---|---|",
    ...dbMissingRows,
    ""
  ].join("\n")}\n`;
}

async function main() {
  loadEnv();
  const products = await fetchProducts();
  const productsById = new Map(products.map((product) => [String(product.id), product]));
  const scanned = scanFiles();
  const placeholderCopies = copyPlaceholderFiles(scanned.placeholderFiles);
  const selection = selectRawCandidates(productsById, scanned.records);
  const rawBatches = writeRawBatches(selection.selected);

  const summary = {
    generatedAt: new Date().toISOString(),
    totals: {
      dbProducts: products.length,
      scannedJsonRecords: scanned.records.length,
      selectedRawCandidates: selection.selected.length,
      placeholderFilesCopied: placeholderCopies.length,
      productIdMissingFiles: scanned.productIdMissingFiles.length,
      dbMissingJson: selection.dbMissingJson.length,
      duplicateSelectedProductIds: selection.duplicateProductIds.length,
      legacyManualRisks: selection.legacyManualRisks.length,
      existingFunctionalPreserved: selection.existingFunctionalExcluded.length,
      parseErrors: scanned.parseErrors.length
    },
    placeholderCopies,
    productIdMissingFiles: scanned.productIdMissingFiles,
    dbMissingJson: selection.dbMissingJson,
    duplicateProductIds: selection.duplicateProductIds,
    duplicateFilesNotSelected: selection.selectedDuplicates,
    excludedCounts: selection.excluded,
    legacyManualRisks: selection.legacyManualRisks,
    existingFunctionalExcluded: selection.existingFunctionalExcluded,
    rawBatches,
    fixtureResults: [],
    importDryRunResults: [],
    parseErrors: scanned.parseErrors
  };

  writeJson(path.join(OUTPUT_DIR, "rebuild-summary.json"), summary);
  fs.writeFileSync(path.join(OUTPUT_DIR, "rebuild-summary.md"), makeMarkdown(summary), "utf8");

  console.log(JSON.stringify({
    totals: summary.totals,
    rawBatches: rawBatches.map((item) => ({
      category: item.category,
      count: item.count,
      path: item.path
    })),
    outputs: {
      json: getRelativePath(path.join(OUTPUT_DIR, "rebuild-summary.json")),
      markdown: getRelativePath(path.join(OUTPUT_DIR, "rebuild-summary.md"))
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
