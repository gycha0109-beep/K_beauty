#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_ROOT = path.join(ROOT_DIR, "data", "hwahae-review-signals");
const OUTPUT_DIR = path.join(ROOT_DIR, "tmp", "audits");
const PLACEHOLDER_PRODUCT_ID = "USER_MUST_REPLACE_SUPABASE_PRODUCT_ID";
const MAX_EXAMPLES = 5;

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

function getRelativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).replaceAll("\\", "/");
}

function getPathSegments(filePath) {
  return getRelativePath(filePath).split("/");
}

function getProductId(item) {
  return String(item?.productId || item?.product_id || "").trim();
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

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function parseCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const parsed = Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
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

function getFunctionalInfo(item) {
  const ingredientRaw = item?.ingredient_raw;
  const functional = ingredientRaw?.functional;
  let functionalType = "missing";
  let functionalPositiveKeys = 0;
  let functionalAllZero = null;

  if (Array.isArray(functional)) {
    functionalType = "array";
    functionalPositiveKeys = functional.filter((entry) => {
      const value = Array.isArray(entry) ? entry[1] : entry?.count;
      return parseCount(value) > 0;
    }).length;
    functionalAllZero = functionalPositiveKeys === 0;
  } else if (isObject(functional)) {
    functionalType = "object";
    functionalPositiveKeys = Object.values(functional).filter((value) => parseCount(value) > 0).length;
    functionalAllZero = functionalPositiveKeys === 0;
  } else if (functional != null) {
    functionalType = typeof functional;
  }

  return {
    hasReviewRaw: Boolean(item?.review_raw),
    hasMarketRaw: Boolean(item?.market_raw),
    hasIngredientRaw: Boolean(item?.ingredient_raw),
    hasFunctional: functional != null,
    functionalType,
    functionalPositiveKeys,
    functionalAllZero,
    hasRisk: Boolean(ingredientRaw?.risk),
    hasSkinType: Boolean(ingredientRaw?.skin_type),
    canBuildFunctionalFixture:
      functional != null &&
      ["array", "object"].includes(functionalType) &&
      functionalPositiveKeys > 0
  };
}

function getCompletenessScore(info) {
  if (!info) {
    return 0;
  }

  return (
    (info.hasReviewRaw ? 2 : 0) +
    (info.hasMarketRaw ? 2 : 0) +
    (info.hasIngredientRaw ? 2 : 0) +
    (info.hasFunctional ? 3 : 0) +
    (info.functionalPositiveKeys > 0 ? 5 : 0) +
    (info.hasRisk ? 1 : 0) +
    (info.hasSkinType ? 1 : 0)
  );
}

function addEntry(map, productId, entry) {
  if (!productId) {
    return;
  }

  if (!map.has(productId)) {
    map.set(productId, []);
  }

  map.get(productId).push(entry);
}

function getBestRaw(entries = []) {
  return entries
    .slice()
    .sort((left, right) => getCompletenessScore(right.functionalInfo) - getCompletenessScore(left.functionalInfo))[0] || null;
}

function hasDbFunctional(product) {
  return Array.isArray(product?.ingredient_signals?.functional) && product.ingredient_signals.functional.length > 0;
}

function getDbSignalState(product) {
  const signals = product?.ingredient_signals;

  if (signals == null) {
    return "null";
  }

  if (isObject(signals) && Object.keys(signals).length === 0) {
    return "empty_object";
  }

  if (Array.isArray(signals?.functional) && signals.functional.length > 0) {
    return "functional";
  }

  if (Array.isArray(signals?.functional) && signals.functional.length === 0) {
    return "functional_empty_array";
  }

  if (isObject(signals) && !Object.hasOwn(signals, "functional")) {
    return "legacy_or_manual";
  }

  return "unknown";
}

function getExample(productId, product, locations = []) {
  return {
    productId,
    brand: product?.brand || "",
    name: product?.name || "",
    category: product?.category || "",
    paths: locations.slice(0, 3).map((entry) => entry.path)
  };
}

function pushExample(group, example) {
  if (group.examples.length < MAX_EXAMPLES) {
    group.examples.push(example);
  }
}

function makeGroup() {
  return {
    count: 0,
    examples: []
  };
}

function summarizeLocations(locations = []) {
  return locations.map((entry) => ({
    path: entry.path,
    kind: entry.kind,
    inRawFolder: entry.inRawFolder,
    functionalInfo: entry.functionalInfo
  }));
}

async function fetchProducts() {
  const supabase = createSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id,brand,name,category,normalized_brand,normalized_name,ingredient_signals,review_signals,market_signals,hwahae_url,source_url,buy_link,created_at,updated_at")
    .limit(1000);

  if (error) {
    throw new Error(`products read failed: ${error.message}`);
  }

  return data || [];
}

function scanJsonInventory() {
  const allProductLocations = new Map();
  const rawFolderLocations = new Map();
  const rawOutsideLocations = new Map();
  const rawBatchLocations = new Map();
  const fixtureLocations = new Map();
  const filesByKind = {};
  const placeholderLocations = [];
  const parseErrors = [];

  for (const filePath of walkFiles(DATA_ROOT).filter((file) => /\.(json|jsonl)$/i.test(file))) {
    const relativePath = getRelativePath(filePath);
    const segments = getPathSegments(filePath);
    const inRawFolder = segments.includes("raw");

    try {
      const items = filePath.endsWith(".jsonl")
        ? fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
        : extractItems(readJson(filePath));
      const kind = classifyFile(filePath, items);
      filesByKind[kind] = (filesByKind[kind] || 0) + 1;

      for (const item of items) {
        const productId = getProductId(item);

        if (!productId) {
          continue;
        }

        const entry = {
          path: relativePath,
          kind,
          inRawFolder,
          category: item?.category || "",
          functionalInfo: kind.startsWith("raw") ? getFunctionalInfo(item) : null
        };

        addEntry(allProductLocations, productId, entry);

        if (productId === PLACEHOLDER_PRODUCT_ID) {
          placeholderLocations.push(entry);
        }

        if (kind === "fixture") {
          addEntry(fixtureLocations, productId, entry);
          continue;
        }

        if (kind === "raw_batch") {
          addEntry(rawBatchLocations, productId, entry);
        }

        if (kind.startsWith("raw")) {
          addEntry(inRawFolder ? rawFolderLocations : rawOutsideLocations, productId, entry);
        }
      }
    } catch (error) {
      parseErrors.push({
        path: relativePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    allProductLocations,
    rawFolderLocations,
    rawOutsideLocations,
    rawBatchLocations,
    fixtureLocations,
    filesByKind,
    placeholderLocations,
    parseErrors
  };
}

function buildAudit(products, inventory) {
  const productsById = new Map(products.map((product) => [String(product.id), product]));
  const allIds = new Set([
    ...productsById.keys(),
    ...inventory.allProductLocations.keys(),
    ...inventory.fixtureLocations.keys()
  ]);
  const groups = {
    A_db_rawFolder_fixture_dbFunctional: makeGroup(),
    B_db_rawFolder_noFixture: makeGroup(),
    C_db_rawOutside_noFixture: makeGroup(),
    D_db_rawFolder_and_rawOutside: makeGroup(),
    E_db_noJson: makeGroup(),
    F_noDb_json: makeGroup(),
    G_fixture_noDb: makeGroup(),
    H_rawBatch_noFixture: makeGroup(),
    I_fixture_dbNoFunctional: makeGroup(),
    J_dbFunctional_noFixture: makeGroup()
  };
  const rawOutsideDetails = [];
  const duplicateProductIds = [];
  const legacyManualProducts = [];
  const categoryCoverage = {};
  const dbMissingRaw = [];

  for (const product of products) {
    const category = product.category || "missing";
    if (!categoryCoverage[category]) {
      categoryCoverage[category] = {
        db: 0,
        rawFolder: 0,
        rawOutside: 0,
        rawBatch: 0,
        fixture: 0,
        dbFunctional: 0,
        legacyManual: 0
      };
    }

    const bucket = categoryCoverage[category];
    const id = String(product.id);
    const rawFolder = inventory.rawFolderLocations.get(id) || [];
    const rawOutside = inventory.rawOutsideLocations.get(id) || [];
    const rawBatch = inventory.rawBatchLocations.get(id) || [];
    const fixture = inventory.fixtureLocations.get(id) || [];
    const allLocations = inventory.allProductLocations.get(id) || [];
    const dbFunctional = hasDbFunctional(product);
    const dbSignalState = getDbSignalState(product);

    bucket.db += 1;
    if (rawFolder.length) bucket.rawFolder += 1;
    if (rawOutside.length) bucket.rawOutside += 1;
    if (rawBatch.length) bucket.rawBatch += 1;
    if (fixture.length) bucket.fixture += 1;
    if (dbFunctional) bucket.dbFunctional += 1;
    if (dbSignalState === "legacy_or_manual") bucket.legacyManual += 1;

    if (rawFolder.length && fixture.length && dbFunctional) {
      groups.A_db_rawFolder_fixture_dbFunctional.count += 1;
      pushExample(groups.A_db_rawFolder_fixture_dbFunctional, getExample(id, product, [...rawFolder, ...fixture]));
    }

    if (rawFolder.length && !fixture.length) {
      groups.B_db_rawFolder_noFixture.count += 1;
      pushExample(groups.B_db_rawFolder_noFixture, getExample(id, product, rawFolder));
    }

    if (rawOutside.length && !fixture.length) {
      groups.C_db_rawOutside_noFixture.count += 1;
      pushExample(groups.C_db_rawOutside_noFixture, getExample(id, product, rawOutside));
    }

    if (rawFolder.length && rawOutside.length) {
      groups.D_db_rawFolder_and_rawOutside.count += 1;
      pushExample(groups.D_db_rawFolder_and_rawOutside, getExample(id, product, [...rawFolder, ...rawOutside]));
    }

    if (!allLocations.length) {
      groups.E_db_noJson.count += 1;
      pushExample(groups.E_db_noJson, getExample(id, product, []));
      dbMissingRaw.push(getExample(id, product, []));
    }

    if (rawBatch.length && !fixture.length) {
      groups.H_rawBatch_noFixture.count += 1;
      pushExample(groups.H_rawBatch_noFixture, getExample(id, product, rawBatch));
    }

    if (fixture.length && !dbFunctional) {
      groups.I_fixture_dbNoFunctional.count += 1;
      pushExample(groups.I_fixture_dbNoFunctional, getExample(id, product, fixture));
    }

    if (dbFunctional && !fixture.length) {
      groups.J_dbFunctional_noFixture.count += 1;
      pushExample(groups.J_dbFunctional_noFixture, getExample(id, product, allLocations));
    }

    if (dbSignalState === "legacy_or_manual") {
      legacyManualProducts.push({
        productId: id,
        brand: product.brand || "",
        name: product.name || "",
        category,
        keys: Object.keys(product.ingredient_signals || {}).sort()
      });
    }
  }

  for (const [id, locations] of inventory.allProductLocations.entries()) {
    if (!productsById.has(id)) {
      groups.F_noDb_json.count += 1;
      pushExample(groups.F_noDb_json, getExample(id, null, locations));
    }

    if (locations.length > 1) {
      duplicateProductIds.push({
        productId: id,
        count: locations.length,
        paths: locations.slice(0, 8).map((entry) => entry.path)
      });
    }
  }

  for (const [id, locations] of inventory.fixtureLocations.entries()) {
    if (!productsById.has(id)) {
      groups.G_fixture_noDb.count += 1;
      pushExample(groups.G_fixture_noDb, getExample(id, null, locations));
    }
  }

  for (const [id, locations] of inventory.rawOutsideLocations.entries()) {
    const product = productsById.get(id) || null;
    const fixture = inventory.fixtureLocations.get(id) || [];
    const rawFolder = inventory.rawFolderLocations.get(id) || [];
    const bestRaw = getBestRaw(locations);

    rawOutsideDetails.push({
      productId: id,
      dbExists: Boolean(product),
      brand: product?.brand || "",
      name: product?.name || "",
      category: product?.category || "",
      alsoInRawFolder: rawFolder.length > 0,
      inFixture: fixture.length > 0,
      dbFunctional: product ? hasDbFunctional(product) : false,
      canBuildFunctionalFixture: Boolean(bestRaw?.functionalInfo?.canBuildFunctionalFixture),
      bestRawInfo: bestRaw?.functionalInfo || null,
      paths: summarizeLocations(locations)
    });
  }

  const rawOutsideApplicable = rawOutsideDetails.filter((item) =>
    item.dbExists &&
    !item.inFixture &&
    item.canBuildFunctionalFixture
  );
  const placeholderProductIds = inventory.placeholderLocations.map((entry) => entry.path);

  return {
    totals: {
      dbProducts: products.length,
      localJsonProductIds: inventory.allProductLocations.size,
      rawFolderProductIds: inventory.rawFolderLocations.size,
      rawOutsideProductIds: inventory.rawOutsideLocations.size,
      rawBatchProductIds: inventory.rawBatchLocations.size,
      fixtureProductIds: inventory.fixtureLocations.size,
      dbFunctionalProducts: products.filter(hasDbFunctional).length,
      legacyManualProducts: legacyManualProducts.length,
      duplicateProductIds: duplicateProductIds.length,
      placeholderLocations: placeholderProductIds.length,
      parseErrors: inventory.parseErrors.length,
      rawOutsideApplicable: rawOutsideApplicable.length
    },
    filesByKind: inventory.filesByKind,
    groups,
    categoryCoverage,
    rawOutsideDetails,
    rawOutsideApplicable,
    dbMissingRaw,
    duplicateProductIds,
    placeholderProductIds,
    legacyManualProducts,
    parseErrors: inventory.parseErrors
  };
}

function formatTable(rows) {
  return rows.join("\n");
}

function makeMarkdown(audit) {
  const groupRows = Object.entries(audit.groups).map(([key, value]) =>
    `| ${key} | ${value.count} | ${value.examples.map((example) => `${example.category}:${example.name || example.productId}`).join("; ")} |`
  );
  const categoryRows = Object.entries(audit.categoryCoverage)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, value]) =>
      `| ${category} | ${value.db} | ${value.rawFolder} | ${value.rawOutside} | ${value.rawBatch} | ${value.fixture} | ${value.dbFunctional} | ${value.legacyManual} |`
    );
  const outsideRows = audit.rawOutsideDetails.slice(0, 60).map((item) =>
    `| ${item.productId} | ${item.category} | ${item.dbExists ? "yes" : "no"} | ${item.alsoInRawFolder ? "yes" : "no"} | ${item.inFixture ? "yes" : "no"} | ${item.dbFunctional ? "yes" : "no"} | ${item.canBuildFunctionalFixture ? "yes" : "no"} | ${item.paths[0]?.path || ""} |`
  );

  return `${[
    "# Review Signal Inventory Audit",
    "",
    "## Totals",
    "",
    ...Object.entries(audit.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Groups",
    "",
    "| group | count | examples |",
    "|---|---:|---|",
    formatTable(groupRows),
    "",
    "## Category Coverage",
    "",
    "| category | db | raw folder | raw outside | raw-batch | fixture | db functional | legacy/manual |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    formatTable(categoryRows),
    "",
    "## Raw Outside Details (first 60)",
    "",
    "| productId | category | DB | raw folder too | fixture | DB functional | buildable | path |",
    "|---|---|---|---|---|---|---|---|",
    formatTable(outsideRows),
    "",
    "## DB Products Without Any Local JSON",
    "",
    ...audit.dbMissingRaw.map((item) => `- ${item.productId} / ${item.category} / ${item.brand} ${item.name}`),
    "",
    "## Placeholder Locations",
    "",
    ...audit.placeholderProductIds.map((item) => `- ${item}`)
  ].join("\n")}\n`;
}

async function main() {
  loadEnv();
  const products = await fetchProducts();
  const inventory = scanJsonInventory();
  const audit = buildAudit(products, inventory);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, "review-signal-inventory.json");
  const mdPath = path.join(OUTPUT_DIR, "review-signal-inventory.md");

  fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
  fs.writeFileSync(mdPath, makeMarkdown(audit));

  console.log(JSON.stringify({
    totals: audit.totals,
    groups: Object.fromEntries(Object.entries(audit.groups).map(([key, value]) => [key, value.count])),
    output: {
      json: path.relative(ROOT_DIR, jsonPath),
      markdown: path.relative(ROOT_DIR, mdPath)
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
