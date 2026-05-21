#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normalizeReviewSignals } from "../lib/review-signals.js";

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

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl) {
    throw new Error(
      "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. This script requires service-role access to update product signal columns."
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey
  };
}

async function readJsonFile(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const raw = (await fs.readFile(resolvedPath, "utf8")).replace(/^\uFEFF/, "");

  try {
    return {
      resolvedPath,
      data: JSON.parse(raw)
    };
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from ${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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

function normalizeRatingDistribution(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [String(key), entryValue])
      .map(([key, entryValue]) => [
        key,
        String(entryValue).includes("%") ? String(entryValue).trim() : parseCount(entryValue)
      ])
      .filter(([, entryValue]) => entryValue !== 0 && entryValue !== "")
  );
}

function normalizeMarketSignals(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const reviewCount = parseCount(value.review_count);
  const rating = parseRating(value.rating);
  const ratingDistribution = normalizeRatingDistribution(value.rating_distribution);

  if (!reviewCount && !rating && !Object.keys(ratingDistribution).length) {
    return null;
  }

  return {
    source: String(value.source || "hwahae_visible_page").trim() || "hwahae_visible_page",
    review_count: reviewCount || null,
    rating: rating ?? null,
    rating_distribution: ratingDistribution,
    updated_at: String(value.updated_at || "").trim() || null
  };
}

function normalizeIngredientSignals(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const totalIngredients = parseCount(value.total_ingredients);
  const risk = {
    low: parseCount(value?.risk?.low),
    medium: parseCount(value?.risk?.medium),
    high: parseCount(value?.risk?.high),
    unknown: parseCount(value?.risk?.unknown)
  };
  const functional = Array.isArray(value.functional)
    ? value.functional
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({
          label: String(entry.label || "").trim(),
          count: parseCount(entry.count),
          mapped: Array.isArray(entry.mapped)
            ? entry.mapped.map((item) => String(item || "").trim()).filter(Boolean)
            : []
        }))
        .filter((entry) => entry.label && entry.count > 0)
    : [];
  const functionalSummary =
    value.functional_summary && typeof value.functional_summary === "object" && !Array.isArray(value.functional_summary)
      ? Object.fromEntries(
          Object.entries(value.functional_summary)
            .map(([key, entryValue]) => [String(key), parseCount(entryValue)])
            .filter(([, entryValue]) => entryValue > 0)
        )
      : {};
  const skinType = {
    oily: {
      positive: parseCount(value?.skin_type?.oily?.positive),
      negative: parseCount(value?.skin_type?.oily?.negative)
    },
    dry: {
      positive: parseCount(value?.skin_type?.dry?.positive),
      negative: parseCount(value?.skin_type?.dry?.negative)
    },
    sensitive: {
      positive: parseCount(value?.skin_type?.sensitive?.positive),
      negative: parseCount(value?.skin_type?.sensitive?.negative)
    }
  };

  const hasRisk = Object.values(risk).some((entryValue) => entryValue > 0);
  const hasSkinType = Object.values(skinType).some(
    (bucket) => bucket.positive > 0 || bucket.negative > 0
  );

  if (!totalIngredients && !hasRisk && !functional.length && !hasSkinType) {
    return null;
  }

  return {
    source: String(value.source || "hwahae_visible_page").trim() || "hwahae_visible_page",
    total_ingredients: totalIngredients || null,
    risk,
    functional,
    functional_summary: functionalSummary,
    skin_type: skinType,
    updated_at: String(value.updated_at || "").trim() || null
  };
}

function normalizeItems(data) {
  const items = Array.isArray(data) ? data : [data];

  return items.map((item, index) => {
    const productId = String(item?.productId || item?.product_id || "").trim();
    const reviewSignals = normalizeReviewSignals(
      item?.review_signals || item?.reviewSignals || null
    );
    const marketSignals = normalizeMarketSignals(
      item?.market_signals || item?.marketSignals || null
    );
    const ingredientSignals = normalizeIngredientSignals(
      item?.ingredient_signals || item?.ingredientSignals || null
    );

    return {
      index,
      productId,
      reviewSignals,
      marketSignals,
      ingredientSignals
    };
  });
}

async function detectColumnPresence(supabase, columnName) {
  const { error } = await supabase
    .from("products")
    .select(`id, ${columnName}`)
    .limit(1);

  if (!error) {
    return true;
  }

  const message = String(error.message || "");

  if (message.toLowerCase().includes(columnName.toLowerCase())) {
    return false;
  }

  throw new Error(`Failed to inspect products.${columnName} column: ${message}`);
}

async function detectProductsColumns(supabase) {
  return {
    updated_at: await detectColumnPresence(supabase, "updated_at"),
    review_signals: await detectColumnPresence(supabase, "review_signals"),
    market_signals: await detectColumnPresence(supabase, "market_signals"),
    ingredient_signals: await detectColumnPresence(supabase, "ingredient_signals")
  };
}

async function productExists(supabase, productId) {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(`Lookup failed for ${productId}: ${error.message}`);
  }

  return Boolean(data?.id);
}

function buildUpdatePayload(item, columnPresence) {
  const payload = {};
  const skippedColumns = [];

  if (item.reviewSignals) {
    if (columnPresence.review_signals) {
      payload.review_signals = item.reviewSignals;
    } else {
      skippedColumns.push("review_signals");
    }
  }

  if (item.marketSignals) {
    if (columnPresence.market_signals) {
      payload.market_signals = item.marketSignals;
    } else {
      skippedColumns.push("market_signals");
    }
  }

  if (item.ingredientSignals) {
    if (columnPresence.ingredient_signals) {
      payload.ingredient_signals = item.ingredientSignals;
    } else {
      skippedColumns.push("ingredient_signals");
    }
  }

  if (columnPresence.updated_at && Object.keys(payload).length > 0) {
    payload.updated_at = new Date().toISOString();
  }

  return {
    payload,
    skippedColumns
  };
}

async function updateProductSignals(supabase, productId, payload) {
  const { error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", productId);

  if (error) {
    throw new Error(`Update failed for ${productId}: ${error.message}`);
  }
}

function logStatus(kind, message) {
  const prefixes = {
    success: "[ok]",
    warn: "[warn]",
    error: "[error]"
  };

  process.stdout.write(`${prefixes[kind] || "[info]"} ${message}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = String(args.file || "").trim();
  const dryRun = Boolean(args["dry-run"]);

  if (!filePath) {
    throw new Error('Missing required --file argument. Example: --file "data/hwahae-review-signals/samples/single/hwahae-review-signals.single.fixture.json"');
  }

  await loadLocalEnv();
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const { resolvedPath, data } = await readJsonFile(filePath);
  const items = normalizeItems(data);

  if (!items.length) {
    throw new Error(`No items found in ${resolvedPath}`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const columnPresence = await detectProductsColumns(supabase);
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const item of items) {
    const label = `item ${item.index + 1}`;

    if (!item.productId) {
      skippedCount += 1;
      logStatus("warn", `${label}: missing productId, skipped.`);
      continue;
    }

    if (!item.reviewSignals && !item.marketSignals && !item.ingredientSignals) {
      skippedCount += 1;
      logStatus(
        "warn",
        `${label}: no review_signals, market_signals, or ingredient_signals payload for ${item.productId}, skipped.`
      );
      continue;
    }

    try {
      const exists = await productExists(supabase, item.productId);

      if (!exists) {
        skippedCount += 1;
        logStatus("warn", `${label}: product ${item.productId} does not exist, skipped.`);
        continue;
      }

      const { payload, skippedColumns } = buildUpdatePayload(item, columnPresence);

      if (Object.keys(payload).length === 0) {
        skippedCount += 1;
        logStatus(
          "warn",
          `${label}: fixture is valid but matching products columns are missing (${skippedColumns.join(", ")}), skipped.`
        );
        continue;
      }

      const updatedKeys = Object.keys(payload).filter((key) => key !== "updated_at");

      if (dryRun) {
        skippedCount += 1;
        logStatus(
          "success",
          `${label}: dry-run would update ${updatedKeys.join(", ")} for ${item.productId}.`
        );

        if (skippedColumns.length > 0) {
          logStatus(
            "warn",
            `${label}: columns missing in products and not included -> ${skippedColumns.join(", ")}`
          );
        }

        continue;
      }

      await updateProductSignals(supabase, item.productId, payload);

      updatedCount += 1;
      logStatus("success", `${label}: updated ${updatedKeys.join(", ")} for ${item.productId}.`);

      if (skippedColumns.length > 0) {
        logStatus(
          "warn",
          `${label}: columns missing in products and not updated -> ${skippedColumns.join(", ")}`
        );
      }
    } catch (error) {
      failedCount += 1;
      logStatus(
        "error",
        `${label}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  process.stdout.write(
    `Summary: updated=${updatedCount}, skipped=${skippedCount}, failed=${failedCount}\n`
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
