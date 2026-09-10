#!/usr/bin/env node

import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  buildIdentityKeyRepairPlan,
  type IdentityKeyRepairDisposition,
  type IdentityKeyRepairProduct,
} from "./lib/identity-key-repair-plan.js";
import { createServiceRoleClient } from "./lib/supabase.js";

interface ReportOptions {
  details: boolean;
  disposition: IdentityKeyRepairDisposition | null;
}

const ALLOWED_DISPOSITIONS = new Set<IdentityKeyRepairDisposition>([
  "current",
  "safe_mechanical_candidate",
  "manual_review_required",
  "blocked_proposed_collision",
  "blocked_missing_identity",
]);

function loadEnvironment(): void {
  const currentFile = fileURLToPath(import.meta.url);
  const crawlerDirectory = path.dirname(currentFile);
  const workspaceDirectory = path.resolve(crawlerDirectory, "..");

  for (const envFile of [
    path.join(crawlerDirectory, ".env"),
    path.join(crawlerDirectory, ".env.local"),
    path.join(workspaceDirectory, ".env"),
    path.join(workspaceDirectory, ".env.local"),
  ]) {
    dotenv.config({ path: envFile, override: false });
  }
}

function parseArgs(argv: string[]): ReportOptions {
  const optionMap = new Map<string, string | undefined>();

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      continue;
    }

    const [rawKey, rawValue] = argument.slice(2).split("=", 2);
    optionMap.set(rawKey, rawValue);
  }

  const rawDisposition = optionMap.get("disposition")?.trim() ?? "";
  if (rawDisposition && !ALLOWED_DISPOSITIONS.has(rawDisposition as IdentityKeyRepairDisposition)) {
    throw new Error(`identity_key_repair_invalid_disposition:${rawDisposition}`);
  }

  return {
    details: optionMap.has("details"),
    disposition: rawDisposition
      ? (rawDisposition as IdentityKeyRepairDisposition)
      : null,
  };
}

async function main(): Promise<void> {
  loadEnvironment();
  const options = parseArgs(process.argv.slice(2));
  const client = createServiceRoleClient();
  const { data, error } = await client
    .from("products")
    .select("id, brand, name, normalized_brand, normalized_name")
    .order("brand", { ascending: true })
    .order("name", { ascending: true })
    .limit(2000);

  if (error) {
    throw new Error(`identity_key_repair_product_load_failed:${error.message}`);
  }

  const products = (data ?? []) as IdentityKeyRepairProduct[];
  const plan = buildIdentityKeyRepairPlan(products);
  const counts = new Map<IdentityKeyRepairDisposition, number>();

  for (const row of plan) {
    counts.set(row.disposition, (counts.get(row.disposition) ?? 0) + 1);
  }

  console.log("Product identity key repair plan");
  console.log(`- products: ${products.length}`);
  console.log(`- current: ${counts.get("current") ?? 0}`);
  console.log(`- safe_mechanical_candidate: ${counts.get("safe_mechanical_candidate") ?? 0}`);
  console.log(`- manual_review_required: ${counts.get("manual_review_required") ?? 0}`);
  console.log(`- blocked_proposed_collision: ${counts.get("blocked_proposed_collision") ?? 0}`);
  console.log(`- blocked_missing_identity: ${counts.get("blocked_missing_identity") ?? 0}`);
  console.log("- product_writes: 0");
  console.log("- candidate_writes: 0");

  if (!options.details && !options.disposition) {
    return;
  }

  console.log("");
  console.log("Repair plan details");
  for (const row of plan) {
    if (options.disposition && row.disposition !== options.disposition) {
      continue;
    }
    if (!options.disposition && row.disposition === "current") {
      continue;
    }

    console.log(
      [
        `product=${row.productId}`,
        `disposition=${row.disposition}`,
        `brand=${JSON.stringify(row.brand)}`,
        `name=${JSON.stringify(row.name)}`,
        `stored_brand=${JSON.stringify(row.inspection.storedBrandKey)}`,
        `proposed_brand=${JSON.stringify(row.inspection.recomputedBrandKey)}`,
        `stored_name=${JSON.stringify(row.inspection.storedNameKey)}`,
        `proposed_name=${JSON.stringify(row.inspection.recomputedNameKey)}`,
        `reasons=${row.reasons.join("|") || "-"}`,
        `collisions=${row.proposedCollisionProductIds.join("|") || "-"}`,
      ].join(" "),
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
