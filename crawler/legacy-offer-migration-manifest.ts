#!/usr/bin/env node

import dotenv from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createServiceRoleClient } from "./lib/supabase.js";
import {
  classifyLegacyOffer,
  type MigrationDecision,
  type OfferSourceRules,
} from "./lib/offers/legacy-offer-classifier.js";
import {
  buildLegacyOfferManifest,
  buildManifestRow,
} from "./lib/offers/legacy-offer-migration.js";

type ProductRow = {
  id: string;
  brand: string | null;
  name: string | null;
  buy_link: string | null;
  price_min: number | null;
  price_max: number | null;
  source_url: string | null;
};

function loadEnvironment(): string {
  const crawlerDirectory = path.dirname(fileURLToPath(import.meta.url));
  const workspaceDirectory = path.resolve(crawlerDirectory, "..");
  for (const envFile of [
    path.join(crawlerDirectory, ".env"),
    path.join(crawlerDirectory, ".env.local"),
    path.join(workspaceDirectory, ".env"),
    path.join(workspaceDirectory, ".env.local"),
  ]) {
    dotenv.config({ path: envFile, override: false });
  }
  return crawlerDirectory;
}

function parseOutputPath(crawlerDirectory: string): string {
  const index = process.argv.indexOf("--output");
  if (index >= 0) {
    const value = process.argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("legacy_offer_manifest_missing_output_path");
    }
    return path.resolve(process.cwd(), value);
  }
  return path.join(crawlerDirectory, "data", "product-offer-migration", "link-only-manifest.json");
}

async function loadRules(crawlerDirectory: string): Promise<OfferSourceRules> {
  const raw = await readFile(path.join(crawlerDirectory, "config", "offer-source-rules.json"), "utf8");
  const parsed = JSON.parse(raw) as OfferSourceRules;
  if (!parsed.version || !parsed.hosts || typeof parsed.hosts !== "object") {
    throw new Error("legacy_offer_manifest_invalid_rules");
  }
  return parsed;
}

function countDecisions(decisions: MigrationDecision[]) {
  const counts = {
    AUTO_READY: 0,
    LINK_ONLY_READY: 0,
    REVIEW_REQUIRED: 0,
    DO_NOT_MIGRATE: 0,
  };
  for (const decision of decisions) {
    counts[decision] += 1;
  }
  return counts;
}

async function main(): Promise<void> {
  const crawlerDirectory = loadEnvironment();
  const outputPath = parseOutputPath(crawlerDirectory);
  const rules = await loadRules(crawlerDirectory);
  const client = createServiceRoleClient();

  const result = await client
    .from("products")
    .select("id, brand, name, buy_link, price_min, price_max, source_url")
    .order("id", { ascending: true })
    .limit(5000);
  if (result.error) {
    throw new Error(`legacy_offer_manifest_products_failed:${result.error.message}`);
  }

  const products = (result.data ?? []) as ProductRow[];
  const classified = products.map((product) => ({
    product,
    classification: classifyLegacyOffer(
      {
        productId: product.id,
        brand: product.brand,
        name: product.name,
        buyLink: product.buy_link,
        priceMin: product.price_min,
        priceMax: product.price_max,
        sourceUrl: product.source_url,
      },
      rules,
    ),
  }));
  const decisionCounts = countDecisions(classified.map(({ classification }) => classification.migrationDecision));

  const rows = classified
    .filter(({ classification }) => classification.migrationDecision === "LINK_ONLY_READY")
    .map(({ product, classification }) =>
      buildManifestRow(classification, product.buy_link, rules.version),
    );

  const manifest = buildLegacyOfferManifest({
    classifierRulesVersion: rules.version,
    generatedAt: new Date().toISOString(),
    sourceProductCount: products.length,
    decisionCounts,
    rows,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log("Legacy offer link-only migration manifest");
  console.log(`- products_scanned: ${manifest.sourceProductCount}`);
  console.log(`- link_only_rows: ${manifest.rows.length}`);
  console.log(`- AUTO_READY: ${manifest.decisionCounts.AUTO_READY}`);
  console.log(`- LINK_ONLY_READY: ${manifest.decisionCounts.LINK_ONLY_READY}`);
  console.log(`- REVIEW_REQUIRED: ${manifest.decisionCounts.REVIEW_REQUIRED}`);
  console.log(`- DO_NOT_MIGRATE: ${manifest.decisionCounts.DO_NOT_MIGRATE}`);
  console.log(`- price_amounts_proposed: 0`);
  console.log(`- availability_inferred: 0`);
  console.log(`- database_writes: 0`);
  console.log(`- manifest_digest: ${manifest.manifestDigest}`);
  console.log(`- output: ${outputPath}`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
