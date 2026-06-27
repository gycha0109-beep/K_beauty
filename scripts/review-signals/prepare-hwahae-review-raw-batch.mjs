#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolveProductCategorySemantics } from "../../lib/product-category-normalizer.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_EXTRACTOR_PATH = path.join(
  ROOT_DIR,
  "scripts",
  "console-snippets",
  "\uD654\uD574 \uC81C\uD488 \uB9AC\uBDF0 \uCD94\uCD9C.js",
);
const PRODUCT_ID_PLACEHOLDER = "USER_MUST_REPLACE_SUPABASE_PRODUCT_ID";

const CATEGORY_FOLDER_BY_PREFIX = [
  [/^cleanser/, "cleanser"],
  [/^(toner|toner_essence|toner_pad)/, "toner"],
  [/^treatment/, "treatment"],
  [/^moisturizer_lotion_emulsion/, path.join("moisturizer", "lotion")],
  [/^moisturizer_cream/, path.join("moisturizer", "cream")],
  [/^moisturizer_gel/, path.join("moisturizer", "gel")],
  [/^moisturizer_balm/, path.join("moisturizer", "balm")],
  [/^moisturizer/, "moisturizer"],
  [/^sunscreen/, "sunscreen"],
];

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());

  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])),
  );
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompact(value) {
  return normalizeText(value).replace(/[^a-z0-9가-힣]/g, "");
}

function pickFirst(row, keys) {
  for (const key of keys) {
    const value = String(row[key] || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function inferCategoryFolder(category) {
  const normalized = String(category || "").trim().toLowerCase();
  const matched = CATEGORY_FOLDER_BY_PREFIX.find(([pattern]) => pattern.test(normalized));
  return matched ? matched[1] : normalized || "unknown";
}

function categoriesAreCompatible(rowCategory, requestedCategory) {
  if (!rowCategory || !requestedCategory) {
    return true;
  }

  return rowCategory === requestedCategory;
}

function normalizeOptionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function resolvePlanCategorySemantics(row, options, liveProduct = null) {
  const rowCategory = normalizeOptionalText(pickFirst(row, ["category"]));
  const rowProductForm = normalizeOptionalText(pickFirst(row, ["product_form", "productForm", "form"]));
  const optionCategory = normalizeOptionalText(options.category);
  const optionProductForm = normalizeOptionalText(options.productForm);

  if (rowCategory || optionCategory) {
    return resolveProductCategorySemantics({
      category: rowCategory || optionCategory,
      product_form: rowProductForm || optionProductForm,
    });
  }

  if (liveProduct) {
    return resolveProductCategorySemantics({
      category: liveProduct.category,
      product_form: liveProduct.product_form ?? liveProduct.productForm,
    });
  }

  return resolveProductCategorySemantics({
    category: null,
    product_form: null,
  });
}

function resolveRawOutputDir(row, options) {
  if (options.categorySemantics?.canonicalCategory !== "treatment") {
    return path.join(options.outDir, "raw");
  }

  return path.join(options.outDir, options.categorySemantics.productForm, "raw");
}

function sanitizeFileSegment(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function ensureHwahaeUrl(row) {
  const direct = pickFirst(row, ["hwahae_url", "source_url", "buy_link", "url"]);

  if (direct) {
    return direct;
  }

  const externalType = String(row.external_type || "").trim();
  const externalId = String(row.external_id || "").trim();

  if (externalType && externalId) {
    return `https://www.hwahae.co.kr/${externalType}/${externalId}`;
  }

  return "";
}

function withReviewIngredientsTab(url) {
  const text = String(url || "").trim();

  if (!text || text.includes("goods_tab=")) {
    return text;
  }

  return `${text}${text.includes("?") ? "&" : "?"}goods_tab=review_ingredients`;
}

function createRawResultScript(extractorSource, productId) {
  const runtimeStartIndex = extractorSource.indexOf("if (typeof window");
  const functionOnlySource =
    runtimeStartIndex >= 0 ? extractorSource.slice(0, runtimeStartIndex) : extractorSource;
  const patchedExtractor = functionOnlySource
    .replace(
      "globalThis.__hwahaeExtractFromText = function __hwahaeExtractFromText(rawText) {",
      "function __hwahaeExtractFromText(rawText) {",
    )
    .replace("globalThis.__hwahaeLastDebug =", "const __hwahaeLastDebug =")
    .replace(
      `const PRODUCT_ID_PLACEHOLDER = "${PRODUCT_ID_PLACEHOLDER}";`,
      `const PRODUCT_ID_PLACEHOLDER = ${JSON.stringify(productId)};`,
    );

  return `
(() => {
${patchedExtractor}
return __hwahaeExtractFromText(document.body?.innerText || "");
})()
`;
}

function hasExtractedSignals(result) {
  const positiveCount = Array.isArray(result?.review_raw?.positive)
    ? result.review_raw.positive.length
    : 0;
  const negativeCount = Array.isArray(result?.review_raw?.negative)
    ? result.review_raw.negative.length
    : 0;
  const market = result?.market_raw || {};
  const ingredient = result?.ingredient_raw || {};
  const functionalTotal = Object.values(ingredient.functional || {}).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
  const skinTypeTotal = Object.values(ingredient.skin_type || {}).reduce(
    (sum, bucket) => sum + (Number(bucket?.positive) || 0) + (Number(bucket?.negative) || 0),
    0,
  );

  return Boolean(
    positiveCount ||
      negativeCount ||
      Number(market.review_count) ||
      Number(market.rating) ||
      Number(ingredient.total_ingredients) ||
      functionalTotal ||
      skinTypeTotal,
  );
}

async function loadEnv() {
  dotenv.config({ path: path.join(ROOT_DIR, ".env.local"), quiet: true });
  dotenv.config({ path: path.join(ROOT_DIR, ".env"), quiet: true });
}

function createSupabaseClientIfAvailable() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function fetchLiveProducts(supabase, ids) {
  if (!supabase || !ids.length) {
    return new Map();
  }

  const liveProducts = new Map();
  const batchSize = 100;

  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,brand,category,product_form,hwahae_url,source_url,buy_link,external_source,external_type,external_id")
      .in("id", batch);

    if (error) {
      throw new Error(`Supabase products lookup failed: ${error.message}`);
    }

    for (const product of data || []) {
      liveProducts.set(product.id, product);
    }
  }

  return liveProducts;
}

export function buildPlanItem(row, options, liveProduct = null) {
  const id = pickFirst(row, ["id", "productId", "product_id"]);
  const name = pickFirst(row, ["name", "product_name", "productName"]);
  const brand = pickFirst(row, ["brand"]);
  const category = pickFirst(row, ["category"]) || options.category || "";
  const url = ensureHwahaeUrl(row);
  const categorySemantics = resolvePlanCategorySemantics(row, options, liveProduct);
  const categoryFolder = categorySemantics.authorizesRecommendationCategory
    ? inferCategoryFolder(categorySemantics.canonicalCategory)
    : options.categoryFolder || inferCategoryFolder(category || options.category);
  const outputName = `${id} ${sanitizeFileSegment(name)}.json`;
  const outputPath = path.join(
    resolveRawOutputDir(row, { ...options, categoryFolder, liveProduct, categorySemantics }),
    outputName,
  );
  const liveUrl = liveProduct ? ensureHwahaeUrl(liveProduct) : "";
  const liveName = liveProduct?.name || "";
  const liveCategory = liveProduct?.category || "";
  const liveProductForm = liveProduct?.product_form || "";
  const warnings = [];

  if (!id) {
    warnings.push("missing id");
  }
  if (!name) {
    warnings.push("missing name");
  }
  if (!url) {
    warnings.push("missing hwahae url");
  }
  if (category && options.category && !categoriesAreCompatible(category, options.category)) {
    warnings.push(`csv category ${category} differs from requested category ${options.category}`);
  }
  if (liveProduct && liveName && normalizeCompact(liveName) !== normalizeCompact(name)) {
    warnings.push(`live name differs: ${liveName}`);
  }
  if (liveProduct && liveCategory && category && !categoriesAreCompatible(category, liveCategory)) {
    warnings.push(`live category differs: ${liveCategory}`);
  }
  if (!categorySemantics.authorizesRecommendationCategory) {
    warnings.push(`unresolved category/product_form: ${categorySemantics.unresolvedReason}`);
  }
  if (
    categorySemantics.authorizesRecommendationCategory &&
    liveProduct &&
    liveCategory &&
    liveProductForm
  ) {
    const liveSemantics = resolveProductCategorySemantics({
      category: liveCategory,
      product_form: liveProductForm,
    });

    if (
      liveSemantics.authorizesRecommendationCategory &&
      (
        liveSemantics.canonicalCategory !== categorySemantics.canonicalCategory ||
        liveSemantics.productForm !== categorySemantics.productForm
      )
    ) {
      warnings.push(`live category/form differs: ${liveCategory}/${liveProductForm}`);
    }
  }
  if (liveProduct && liveUrl && url && liveUrl !== url) {
    warnings.push(`live url differs: ${liveUrl}`);
  }
  if (liveProduct === false) {
    warnings.push("not found in live Supabase products");
  }

  return {
    id,
    name,
    brand,
    category,
    categoryFolder,
    canonical_category: categorySemantics.canonicalCategory,
    product_form: categorySemantics.productForm,
    category_status: categorySemantics.authorizesRecommendationCategory ? "ready" : "unresolved",
    category_skip_reason: categorySemantics.authorizesRecommendationCategory ? null : categorySemantics.unresolvedReason,
    url,
    outputPath,
    live: liveProduct
      ? {
          name: liveName,
          category: liveCategory,
          product_form: liveProductForm,
          url: liveUrl,
        }
      : null,
    ready: Boolean(id && name && url && !warnings.length),
    warnings,
  };
}

async function maybeExtract(plan, options) {
  if (!options.extract) {
    return {
      extracted: 0,
      skipped: plan.items.length,
      failures: [],
    };
  }

  const { chromium } = await import("playwright");
  const extractorSource = await fs.readFile(options.extractorPath, "utf8");
  await fs.mkdir(options.outDir, { recursive: true });

  const browser = options.cdpUrl
    ? await chromium.connectOverCDP(options.cdpUrl)
    : await chromium.launch({
        headless: options.headless,
      });
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  const failures = [];
  let extracted = 0;

  try {
    for (const item of plan.items) {
      if (!item.ready) {
        failures.push({ id: item.id, name: item.name, reason: item.warnings.join("; ") });
        continue;
      }

      try {
        await fs.rm(item.outputPath, { force: true });
        await page.goto(withReviewIngredientsTab(item.url), {
          waitUntil: "domcontentloaded",
          timeout: options.timeoutMs,
        });
        await page.waitForLoadState("networkidle", { timeout: options.timeoutMs }).catch(() => {});
        const result = await page.evaluate(createRawResultScript(extractorSource, item.id));
        if (!hasExtractedSignals(result)) {
          const title = await page.title().catch(() => "");
          const bodyPreview = await page
            .locator("body")
            .innerText({ timeout: 5000 })
            .then((text) => text.replace(/\s+/g, " ").trim().slice(0, 240))
            .catch(() => "");
          throw new Error(
            `extracted empty signals; page title=${JSON.stringify(title)} body=${JSON.stringify(bodyPreview)}`,
          );
        }
        await fs.mkdir(path.dirname(item.outputPath), { recursive: true });
        await fs.writeFile(item.outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
        extracted += 1;
      } catch (error) {
        failures.push({
          id: item.id,
          name: item.name,
          url: item.url,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await browser.close();
  }

  return {
    extracted,
    skipped: plan.items.length - extracted,
    failures,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = args.csv ? path.resolve(process.cwd(), String(args.csv)) : "";

  if (!csvPath) {
    throw new Error('Missing --csv. Example: node scripts/review-signals/prepare-hwahae-review-raw-batch.mjs --csv "C:/Users/hun/Downloads/moisturizer_cream_rows.csv" --category moisturizer_cream');
  }

  await loadEnv();

  const category = String(args.category || "").trim();
  const productForm = String(args["product-form"] || args.product_form || "").trim();
  const categoryFolder = String(args["category-folder"] || inferCategoryFolder(category)).trim();
  const outDir = path.resolve(
    process.cwd(),
    String(args["out-dir"] || path.join("data", "hwahae-review-signals", "categories", categoryFolder)),
  );
  const planOut = args["plan-out"]
    ? path.resolve(process.cwd(), String(args["plan-out"]))
    : path.join(outDir, `${category || categoryFolder}.extract-plan.json`);
  const extractorPath = path.resolve(process.cwd(), String(args.extractor || DEFAULT_EXTRACTOR_PATH));
  const extract = Boolean(args.extract);
  const verifySupabase = args["no-verify-supabase"] !== true;
  const headless = args.headed ? false : true;
  const timeoutMs = Number.parseInt(String(args.timeout || "45000"), 10);
  const cdpUrl = String(args["cdp-url"] || "").trim();

  const csvText = await fs.readFile(csvPath, "utf8");
  const rows = parseCsv(csvText).filter((row) => {
    if (!category) {
      return true;
    }

    return categoriesAreCompatible(String(row.category || "").trim(), category);
  });

  const ids = [...new Set(rows.map((row) => pickFirst(row, ["id", "productId", "product_id"])).filter(Boolean))];
  let liveProducts = new Map();
  let supabaseStatus = "skipped";

  if (verifySupabase) {
    const supabase = createSupabaseClientIfAvailable();

    if (supabase) {
      liveProducts = await fetchLiveProducts(supabase, ids);
      supabaseStatus = `checked ${liveProducts.size}/${ids.length}`;
    } else {
      supabaseStatus = "skipped: missing Supabase URL or service role key";
    }
  }

  const options = {
    category,
    productForm,
    categoryFolder,
    outDir,
    extractorPath,
    extract,
    headless,
    timeoutMs,
    cdpUrl,
  };
  const items = rows.map((row) => {
    const id = pickFirst(row, ["id", "productId", "product_id"]);
    const liveProduct = verifySupabase ? liveProducts.get(id) || false : null;
    return buildPlanItem(row, options, liveProduct);
  });
  const summary = {
    csvPath,
    category: category || null,
    categoryFolder,
    outDir,
    extractorPath,
    mode: extract ? "extract" : "plan-only",
    supabaseStatus,
    totalRows: rows.length,
    ready: items.filter((item) => item.ready).length,
    blocked: items.filter((item) => !item.ready).length,
  };
  const plan = {
    summary,
    items,
  };

  await fs.mkdir(path.dirname(planOut), { recursive: true });
  await fs.writeFile(planOut, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  const extractionResult = await maybeExtract(plan, options);

  process.stdout.write(
    JSON.stringify(
      {
        ...summary,
        planOut,
        extractionResult,
      },
      null,
      2,
    ) + "\n",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
