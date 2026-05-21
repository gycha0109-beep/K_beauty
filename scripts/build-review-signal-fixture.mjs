#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  getReviewSignalCategoryFamily,
  normalizeReviewSignals,
} from "../lib/review-signals.js";

const PRODUCT_ID_PLACEHOLDER = "USER_MUST_REPLACE_SUPABASE_PRODUCT_ID";
const FUNCTIONAL_SIGNAL_RULES = [
  { label: "skin hydration", mapped: ["dehydration"] },
  { label: "moisture evaporation blocking", mapped: ["barrier"] },
  { label: "skin protection", mapped: ["barrier"] },
  { label: "soothing/astringent", mapped: ["redness", "oiliness"] },
  { label: "exfoliation", mapped: ["pores", "acne"] },
  { label: "whitening", mapped: ["uneven_tone"] },
  { label: "acne relief", mapped: ["acne"] },
  { label: "uv protection", mapped: ["uv"] },
  { label: "wrinkle improvement", mapped: ["wrinkle_improvement"] },
];

function logStatus(kind, message) {
  const prefixes = {
    success: "[ok]",
    warn: "[warn]",
    error: "[error]",
    info: "[info]",
  };

  process.stdout.write(`${prefixes[kind] || "[info]"} ${message}\n`);
}

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

async function loadEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

async function loadLocalEnv() {
  await loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  await loadEnvFile(path.resolve(process.cwd(), ".env"));
}

function getSupabaseReadConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  return {
    supabaseUrl: String(supabaseUrl).trim(),
    serviceRoleKey: String(serviceRoleKey).trim(),
  };
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

function parseCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const digits = String(value || "").replace(/[^\d]/g, "");
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseRating(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseFloat(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeOptionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeCategoryFamilyToken(value) {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toLowerCase().replace(/\s+/g, "_") : null;
}

function createCategoryLookupContext() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseReadConfig();

  if (!supabaseUrl) {
    return {
      supabase: null,
      cache: new Map(),
      availabilityWarning:
        "Missing Supabase URL. Category auto-lookup skipped; using common mapping only when raw category is absent.",
    };
  }

  if (!serviceRoleKey) {
    return {
      supabase: null,
      cache: new Map(),
      availabilityWarning:
        "Missing SUPABASE_SERVICE_ROLE_KEY. Category auto-lookup skipped; using common mapping only when raw category is absent.",
    };
  }

  return {
    supabase: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
    cache: new Map(),
    availabilityWarning: "",
  };
}

async function fetchProductCategory(categoryLookup, productId) {
  if (!categoryLookup?.supabase) {
    return null;
  }

  if (categoryLookup.cache.has(productId)) {
    return categoryLookup.cache.get(productId);
  }

  const { data, error } = await categoryLookup.supabase
    .from("products")
    .select("category")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase category lookup failed for ${productId}: ${error.message}`);
  }

  const category = normalizeOptionalText(data?.category);
  categoryLookup.cache.set(productId, category);
  return category;
}

async function resolveReviewCategory(rawItem, categoryLookup) {
  const productId = normalizeOptionalText(rawItem?.productId);
  const rawCategory = normalizeOptionalText(rawItem?.category);
  const rawCategoryFamily = normalizeCategoryFamilyToken(rawItem?.categoryFamily);

  if (rawCategory) {
    return {
      category: rawCategory,
      categoryFamily: getReviewSignalCategoryFamily(rawCategory),
      source: "raw",
      warning: "",
    };
  }

  if (productId && categoryLookup?.supabase) {
    try {
      const category = await fetchProductCategory(categoryLookup, productId);

      if (category) {
        return {
          category,
          categoryFamily: getReviewSignalCategoryFamily(category),
          source: "supabase",
          warning: "",
        };
      }

      if (rawCategoryFamily) {
        return {
          category: null,
          categoryFamily: rawCategoryFamily,
          source: "raw",
          warning: `products.category is empty for ${productId}; using raw categoryFamily fallback.`,
        };
      }

      return {
        category: null,
        categoryFamily: null,
        source: "missing/common-only",
        warning: `products.category is empty or missing for ${productId}; using common mapping only.`,
      };
    } catch (error) {
      if (rawCategoryFamily) {
        return {
          category: null,
          categoryFamily: rawCategoryFamily,
          source: "raw",
          warning: `${
            error instanceof Error ? error.message : String(error)
          } Falling back to raw categoryFamily.`,
        };
      }

      return {
        category: null,
        categoryFamily: null,
        source: "missing/common-only",
        warning: `${error instanceof Error ? error.message : String(error)} Using common mapping only.`,
      };
    }
  }

  if (rawCategoryFamily) {
    return {
      category: null,
      categoryFamily: rawCategoryFamily,
      source: "raw",
      warning: "",
    };
  }

  return {
    category: null,
    categoryFamily: null,
    source: "missing/common-only",
    warning: "",
  };
}

async function readInput(args) {
  if (args.input) {
    const resolvedPath = path.resolve(process.cwd(), String(args.input));
    const raw = (await fs.readFile(resolvedPath, "utf8")).replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  }

  if (args.stdin || !process.stdin.isTTY) {
    const chunks = [];

    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "").trim();

    if (!raw) {
      throw new Error("No JSON received from stdin.");
    }

    return JSON.parse(raw);
  }

  throw new Error('Missing input. Use --input "data/hwahae-review-signals/samples/single/hwahae-raw.single.json" or pipe JSON through stdin.');
}

async function writeOutput(payload, outFile) {
  const output = `${JSON.stringify(payload, null, 2)}\n`;

  if (!outFile) {
    process.stdout.write(output);
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), outFile);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, output, "utf8");
  process.stdout.write(`Saved ${resolvedPath}\n`);
}

function normalizeReviewRawList(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      if (Array.isArray(entry)) {
        return {
          label: String(entry[0] || "").trim(),
          count: parseCount(entry[1]),
        };
      }

      if (entry && typeof entry === "object") {
        return {
          label: String(entry.label || "").trim(),
          count: parseCount(entry.count),
        };
      }

      return null;
    })
    .filter((entry) => entry?.label && entry.count > 0);
}

function buildReviewSignals(reviewRaw, warnings, options = {}) {
  const positive = normalizeReviewRawList(reviewRaw?.positive);
  const negative = normalizeReviewRawList(reviewRaw?.negative);

  if (!positive.length && !negative.length) {
    return null;
  }

  const normalized = normalizeReviewSignals({
    source: "hwahae_ai_review",
    positive,
    negative,
    updated_at: getLocalDateString(),
  }, options);

  if (!normalized) {
    return null;
  }

  normalized.positive
    .filter((entry) => !entry.mapped.length)
    .forEach((entry) => warnings.unmappedReviewLabels.add(entry.label));

  normalized.negative
    .filter((entry) => !entry.mapped.length)
    .forEach((entry) => warnings.unmappedReviewLabels.add(entry.label));

  return normalized;
}

function normalizeRatingDistribution(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [String(key), entryValue])
      .map(([key, entryValue]) => [
        key,
        String(entryValue).includes("%") ? String(entryValue).trim() : parseCount(entryValue),
      ])
      .filter(([, entryValue]) => entryValue !== 0 && entryValue !== "")
  );
}

function buildMarketSignals(marketRaw) {
  if (!marketRaw || typeof marketRaw !== "object") {
    return null;
  }

  const reviewCount = parseCount(marketRaw.review_count);
  const rating = parseRating(marketRaw.rating);
  const ratingDistribution = normalizeRatingDistribution(marketRaw.rating_distribution);

  if (!reviewCount && !rating && !Object.keys(ratingDistribution).length) {
    return null;
  }

  return {
    source: "hwahae_visible_page",
    review_count: reviewCount || null,
    rating: rating ?? null,
    rating_distribution: ratingDistribution,
    updated_at: getLocalDateString(),
  };
}

function mapFunctionalLabel(label) {
  const normalized = normalizeCompact(label);
  const matched = FUNCTIONAL_SIGNAL_RULES.find(
    (rule) => normalizeCompact(rule.label) === normalized,
  );

  return matched ? matched.mapped : [];
}

function normalizeFunctionalEntries(functionalRaw, warnings) {
  const entries = [];

  if (Array.isArray(functionalRaw)) {
    functionalRaw.forEach((entry) => {
      if (Array.isArray(entry)) {
        const label = String(entry[0] || "").trim();
        const count = parseCount(entry[1]);

        if (label && count > 0) {
          entries.push({ label, count, mapped: mapFunctionalLabel(label) });
        }
      }
    });
  } else if (functionalRaw && typeof functionalRaw === "object") {
    Object.entries(functionalRaw).forEach(([label, value]) => {
      const count = parseCount(value);

      if (label && count > 0) {
        entries.push({ label: String(label).trim(), count, mapped: mapFunctionalLabel(label) });
      }
    });
  }

  entries.forEach((entry) => {
    if (!entry.mapped.length) {
      warnings.unmappedFunctionalLabels.add(entry.label);
    }
  });

  return entries;
}

function summarizeMappedFunctional(entries) {
  const summary = {};

  entries.forEach((entry) => {
    entry.mapped.forEach((tag) => {
      summary[tag] = (summary[tag] || 0) + entry.count;
    });
  });

  return summary;
}

function normalizeSkinTypeMetrics(rawValue) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  const readBucket = (value) => ({
    positive: parseCount(value?.positive),
    negative: parseCount(value?.negative),
  });

  return {
    oily: readBucket(source.oily),
    dry: readBucket(source.dry),
    sensitive: readBucket(source.sensitive),
  };
}

function buildIngredientSignals(ingredientRaw, warnings) {
  if (!ingredientRaw || typeof ingredientRaw !== "object") {
    return null;
  }

  const totalIngredients = parseCount(ingredientRaw.total_ingredients);
  const risk = {
    low: parseCount(ingredientRaw?.risk?.low),
    medium: parseCount(ingredientRaw?.risk?.medium),
    high: parseCount(ingredientRaw?.risk?.high),
    unknown: parseCount(ingredientRaw?.risk?.unknown),
  };
  const functional = normalizeFunctionalEntries(ingredientRaw.functional, warnings);
  const functionalSummary = summarizeMappedFunctional(functional);
  const skinType = normalizeSkinTypeMetrics(ingredientRaw.skin_type);

  const hasRisk = Object.values(risk).some((value) => value > 0);
  const hasSkinType = Object.values(skinType).some(
    (bucket) => bucket.positive > 0 || bucket.negative > 0,
  );

  if (!totalIngredients && !hasRisk && !functional.length && !hasSkinType) {
    return null;
  }

  return {
    source: "hwahae_visible_page",
    total_ingredients: totalIngredients || null,
    risk,
    functional,
    functional_summary: functionalSummary,
    skin_type: skinType,
    updated_at: getLocalDateString(),
  };
}

function validateProductId(productId) {
  if (!productId) {
    throw new Error("Missing productId in raw JSON.");
  }

  if (productId === PRODUCT_ID_PLACEHOLDER) {
    throw new Error(
      `productId is still ${PRODUCT_ID_PLACEHOLDER}. Replace it with a real Supabase products.id before building the fixture.`,
    );
  }
}

async function buildFixtureItem(rawItem, categoryLookup) {
  const warnings = {
    unmappedReviewLabels: new Set(),
    unmappedFunctionalLabels: new Set(),
  };
  const productId = String(rawItem?.productId || "").trim();

  validateProductId(productId);
  const categoryResolution = await resolveReviewCategory(rawItem, categoryLookup);

  const fixture = {
    productId,
    review_signals: buildReviewSignals(rawItem?.review_raw, warnings, {
      category: categoryResolution.category,
      categoryFamily: categoryResolution.categoryFamily,
    }),
    market_signals: buildMarketSignals(rawItem?.market_raw),
    ingredient_signals: buildIngredientSignals(rawItem?.ingredient_raw, warnings),
  };

  return {
    fixture,
    warnings,
    categoryResolution,
  };
}

function printWarnings(index, warnings) {
  if (warnings.unmappedReviewLabels.size > 0) {
    process.stdout.write(
      `[warn] item ${index}: unmapped review labels -> ${Array.from(warnings.unmappedReviewLabels).join(", ")}\n`,
    );
  }

  if (warnings.unmappedFunctionalLabels.size > 0) {
    process.stdout.write(
      `[warn] item ${index}: unmapped functional labels -> ${Array.from(warnings.unmappedFunctionalLabels).join(", ")}\n`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadLocalEnv();
  const categoryLookup = createCategoryLookupContext();
  const input = await readInput(args);
  const items = Array.isArray(input) ? input : [input];
  const outputItems = [];

  if (categoryLookup.availabilityWarning) {
    logStatus("warn", categoryLookup.availabilityWarning);
  }

  for (const [index, item] of items.entries()) {
    const { fixture, warnings, categoryResolution } = await buildFixtureItem(item || {}, categoryLookup);
    outputItems.push(fixture);
    logStatus(
      "info",
      `item ${index + 1}: productId=${fixture.productId} resolved category=${
        categoryResolution.category || "-"
      } resolved categoryFamily=${categoryResolution.categoryFamily || "-"} category source=${
        categoryResolution.source
      }`
    );
    if (categoryResolution.warning) {
      logStatus("warn", `item ${index + 1}: ${categoryResolution.warning}`);
    }
    printWarnings(index + 1, warnings);
  }

  const outputPayload = Array.isArray(input) ? outputItems : outputItems[0];
  await writeOutput(outputPayload, args.out ? String(args.out) : "");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
