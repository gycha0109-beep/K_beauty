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
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl) {
    throw new Error(
      "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. This script requires service-role access to update products.review_signals."
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey
  };
}

async function readJsonFile(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(resolvedPath, "utf8");

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

function normalizeItems(data) {
  const items = Array.isArray(data) ? data : [data];

  return items.map((item, index) => {
    const productId = String(item?.productId || item?.product_id || "").trim();
    const reviewSignals = normalizeReviewSignals(
      item?.review_signals || item?.reviewSignals || null
    );

    return {
      index,
      productId,
      reviewSignals
    };
  });
}

async function detectUpdatedAtColumn(supabase) {
  const { error } = await supabase
    .from("products")
    .select("id, updated_at")
    .limit(1);

  if (!error) {
    return true;
  }

  const message = String(error.message || "");

  if (message.toLowerCase().includes("updated_at")) {
    return false;
  }

  throw new Error(`Failed to inspect products.updated_at column: ${message}`);
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

async function updateReviewSignals(supabase, productId, reviewSignals, hasUpdatedAtColumn) {
  const payload = {
    review_signals: reviewSignals
  };

  if (hasUpdatedAtColumn) {
    payload.updated_at = new Date().toISOString();
  }

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

  if (!filePath) {
    throw new Error('Missing required --file argument. Example: --file "tmp/hwahae-review-signals.json"');
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

  const hasUpdatedAtColumn = await detectUpdatedAtColumn(supabase);
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

    if (!item.reviewSignals) {
      skippedCount += 1;
      logStatus("warn", `${label}: invalid or missing review_signals for ${item.productId}, skipped.`);
      continue;
    }

    try {
      const exists = await productExists(supabase, item.productId);

      if (!exists) {
        skippedCount += 1;
        logStatus("warn", `${label}: product ${item.productId} does not exist, skipped.`);
        continue;
      }

      await updateReviewSignals(
        supabase,
        item.productId,
        item.reviewSignals,
        hasUpdatedAtColumn
      );

      updatedCount += 1;
      logStatus("success", `${label}: updated review_signals for ${item.productId}.`);
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
