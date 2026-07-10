#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { resolveProductCategorySemantics } from "../../lib/product-category-normalizer.js";

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");
const REVIEW_SIGNAL_DIR = path.join(DATA_DIR, "hwahae-review-signals", "categories");

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

const CATEGORY_BY_FILE_TOKEN = [
  [/cleanser/, "cleanser"],
  [/toner_essence/, "toner_essence"],
  [/toner_pad/, "toner_pad"],
  [/moisturizer_lotion_emulsion/, "moisturizer_lotion_emulsion"],
  [/moisturizer_cream/, "moisturizer_cream"],
  [/moisturizer_gel/, "moisturizer_gel"],
  [/moisturizer_balm/, "moisturizer_balm"],
  [/moisturizer/, "moisturizer"],
  [/sunscreen/, "sunscreen"],
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

function inferCategoryFromFileToken(fileToken) {
  const matched = CATEGORY_BY_FILE_TOKEN.find(([pattern]) => pattern.test(fileToken));
  return matched ? matched[1] : "";
}

function rowMatchesCategory(rowCategory, category) {
  if (!rowCategory) {
    return true;
  }

  return rowCategory === category;
}

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function findCsv(args) {
  if (args.csv) {
    return path.resolve(ROOT_DIR, String(args.csv));
  }

  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const csvFiles = [];

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".csv") {
      continue;
    }

    const fullPath = path.join(DATA_DIR, entry.name);
    const stat = await fs.stat(fullPath);
    csvFiles.push({ fullPath, mtimeMs: stat.mtimeMs });
  }

  if (csvFiles.length === 0) {
    throw new Error(`No CSV found in ${DATA_DIR}. Put one CSV there or pass --csv "path/to/file.csv".`);
  }

  if (csvFiles.length > 1) {
    const names = csvFiles
      .sort((left, right) => right.mtimeMs - left.mtimeMs)
      .map((file) => `- ${file.fullPath}`)
      .join("\n");
    throw new Error(`Multiple CSV files found in ${DATA_DIR}. Pass --csv explicitly.\n${names}`);
  }

  return csvFiles[0].fullPath;
}

export async function loadCsvContext(csvPath, requestedCategory, requestedProductForm = "") {
  const csvText = await fs.readFile(csvPath, "utf8");
  const rows = parseCsv(csvText);

  if (!rows.length) {
    throw new Error(`CSV has no data rows: ${csvPath}`);
  }

  const categories = [
    ...new Set(rows.map((row) => String(row.category || "").trim()).filter(Boolean)),
  ];
  const fileToken = normalizeToken(path.basename(csvPath, path.extname(csvPath)));
  let category = String(requestedCategory || "").trim();

  if (!category && categories.length === 1) {
    category = categories[0];
  }

  if (!category) {
    const categoryFromName = inferCategoryFromFileToken(fileToken);
    category = categoryFromName || "";
  }

  if (!category) {
    throw new Error("Cannot infer category. Add a category column with one value or pass --category.");
  }

  const productForms = [
    ...new Set(rows.map((row) => String(row.product_form || row.productForm || row.form || "").trim()).filter(Boolean)),
  ];
  let productForm = String(requestedProductForm || "").trim();

  if (!productForm && productForms.length === 1) {
    productForm = productForms[0];
  }

  const semanticStatus = resolveProductCategorySemantics({
    category,
    product_form: productForm || null,
  });

  if (!semanticStatus.authorizesRecommendationCategory) {
    throw new Error(
      `Unresolved category/product_form for review-signal generation: ${semanticStatus.unresolvedReason}. ` +
        "Use explicit canonical category plus product_form for treatment products.",
    );
  }

  const filteredRows = rows.filter((row) => {
    const rowCategory = String(row.category || "").trim();
    return rowMatchesCategory(rowCategory, category);
  });

  if (!filteredRows.length) {
    throw new Error(`No rows match category ${category}.`);
  }

  const missingRequired = filteredRows.filter((row) => {
    const id = pickFirst(row, ["id", "productId", "product_id"]);
    const name = pickFirst(row, ["name", "product_name", "productName"]);
    const url = pickFirst(row, ["hwahae_url", "source_url", "buy_link", "url"]);
    const externalType = String(row.external_type || "").trim();
    const externalId = String(row.external_id || "").trim();
    return !id || !name || (!url && !(externalType && externalId));
  });

  if (missingRequired.length > 0) {
    throw new Error(
      `CSV has ${missingRequired.length} row(s) missing id/name/Hwahae URL or external_type+external_id.`,
    );
  }

  return {
    rows: filteredRows,
    category: semanticStatus.canonicalCategory,
    productForm: semanticStatus.productForm,
    categoryFolder: inferCategoryFolder(semanticStatus.canonicalCategory),
  };
}

function runNode(args, label) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n[review_in_supabase] ${label}\n`);
    process.stdout.write(`node ${args.map((arg) => (String(arg).includes(" ") ? `"${arg}"` : arg)).join(" ")}\n`);

    const child = spawn(process.execPath, args, {
      cwd: ROOT_DIR,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });
  });
}

async function isCdpAvailable(cdpUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${cdpUrl.replace(/\/$/, "")}/json/version`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse((await fs.readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function buildRawBatchFromPlan(planPath, rawBatchPath) {
  const plan = await readJson(planPath);
  const blocked = plan.items.filter((item) => !item.ready || item.warnings.length > 0);

  if (blocked.length > 0) {
    throw new Error(`Plan has ${blocked.length} blocked/warned item(s). Fix the plan before applying.`);
  }

  const rawItems = [];
  const missing = [];

  for (const item of plan.items) {
    try {
      rawItems.push(await readJson(item.outputPath));
    } catch {
      missing.push(item.outputPath);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Extraction did not create ${missing.length} raw file(s):\n${missing.join("\n")}`);
  }

  await writeJson(rawBatchPath, rawItems);
  return rawItems;
}

export async function assertFixtureHasPayloads(fixturePath) {
  const fixture = await readJson(fixturePath);
  const items = Array.isArray(fixture) ? fixture : [fixture];
  const skippedReviewSignals = items.filter(
    (item) => item.review_signal_status === "skipped" || item.review_signal_skip_reason,
  );

  if (skippedReviewSignals.length > 0) {
    throw new Error(
      `Fixture has ${skippedReviewSignals.length}/${items.length} unresolved review-signal item(s). Supabase import stopped.`,
    );
  }

  const emptyItems = items.filter(
    (item) => !item.review_signals && !item.market_signals && !item.ingredient_signals,
  );

  if (emptyItems.length > 0) {
    throw new Error(
      `Fixture has ${emptyItems.length}/${items.length} item(s) without review/market/ingredient signals. Supabase import stopped.`,
    );
  }

  return {
    items: items.length,
    withPayloads: items.length - emptyItems.length,
  };
}

async function loadLocalEnv() {
  dotenv.config({ path: path.join(ROOT_DIR, ".env.local"), quiet: true });
  dotenv.config({ path: path.join(ROOT_DIR, ".env"), quiet: true });
}

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function verifySupabaseRows(fixturePath) {
  await loadLocalEnv();
  const fixture = await readJson(fixturePath);
  const items = Array.isArray(fixture) ? fixture : [fixture];
  const ids = items.map((item) => String(item.productId || "").trim()).filter(Boolean);
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("id,review_signals,market_signals,ingredient_signals,updated_at")
    .in("id", ids);

  if (error) {
    throw new Error(`Supabase verification query failed: ${error.message}`);
  }

  const rows = data || [];
  const completeRows = rows.filter(
    (row) => row.review_signals && row.market_signals && row.ingredient_signals,
  );

  return {
    expected: ids.length,
    found: rows.length,
    rowsWithAllSignalColumns: completeRows.length,
    missingIds: ids.filter((id) => !rows.some((row) => row.id === id)),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = await findCsv(args);
  const { category, productForm, categoryFolder } = await loadCsvContext(
    csvPath,
    args.category,
    args["product-form"] || args.product_form || "",
  );
  const categoryDir = path.join(REVIEW_SIGNAL_DIR, categoryFolder);
  const baseName = normalizeToken(category);
  const planPath = path.join(categoryDir, `${baseName}.extract-plan.json`);
  const rawBatchPath = path.join(categoryDir, `${baseName}.raw-batch.json`);
  const fixturePath = path.join(categoryDir, `${baseName}.review-signals.batch.json`);
  const planOnly = Boolean(args["plan-only"]);
  const dryRun = Boolean(args["dry-run"]);
  const headed = Boolean(args.headed);
  const timeout = String(args.timeout || "45000");
  const requestedCdpUrl = String(args["cdp-url"] || "http://127.0.0.1:9222").trim();
  const cdpUrl =
    args["no-cdp"] || planOnly || !(await isCdpAvailable(requestedCdpUrl))
      ? ""
      : requestedCdpUrl;

  const prepareArgs = [
    "scripts/review-signals/prepare-hwahae-review-raw-batch.mjs",
    "--csv",
    csvPath,
    "--category",
    category,
    "--category-folder",
    categoryFolder,
    "--plan-out",
    planPath,
  ];

  if (productForm) {
    prepareArgs.push("--product-form", productForm);
  }

  if (!planOnly) {
    prepareArgs.push("--extract");
  }
  if (headed) {
    prepareArgs.push("--headed");
  }
  if (timeout) {
    prepareArgs.push("--timeout", timeout);
  }
  if (cdpUrl) {
    prepareArgs.push("--cdp-url", cdpUrl);
  }

  await runNode(prepareArgs, planOnly ? "prepare extraction plan" : "extract Hwahae raw JSON");

  if (planOnly) {
    process.stdout.write(`\nPlan ready: ${planPath}\n`);
    return;
  }

  await buildRawBatchFromPlan(planPath, rawBatchPath);
  await runNode(
    [
      "scripts/review-signals/build-review-signal-fixture.mjs",
      "--input",
      rawBatchPath,
      "--out",
      fixturePath,
    ],
    "build normalized review-signal fixture",
  );
  const fixtureStatus = await assertFixtureHasPayloads(fixturePath);
  process.stdout.write(
    `\n[review_in_supabase] fixture ${JSON.stringify(fixtureStatus, null, 2)}\n`,
  );
  await runNode(
    ["scripts/review-signals/import-review-signals-to-supabase.mjs", "--file", fixturePath, "--dry-run"],
    "dry-run Supabase import",
  );

  if (dryRun) {
    process.stdout.write(`\nDry-run complete. Fixture not applied: ${fixturePath}\n`);
    return;
  }

  await runNode(
    ["scripts/review-signals/import-review-signals-to-supabase.mjs", "--file", fixturePath],
    "apply review signals to Supabase products",
  );

  const verification = await verifySupabaseRows(fixturePath);
  process.stdout.write(
    `\n[review_in_supabase] verification ${JSON.stringify(verification, null, 2)}\n`,
  );

  if (
    verification.found !== verification.expected ||
    verification.rowsWithAllSignalColumns !== verification.expected
  ) {
    throw new Error("Supabase verification found missing rows or incomplete signal columns.");
  }

  process.stdout.write("\n[review_in_supabase] done\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`\n[review_in_supabase] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
