#!/usr/bin/env node

import dotenv from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createServiceRoleClient } from "./lib/supabase.js";
import {
  classifyLegacyOffer,
  type LegacyOfferClassification,
  type MigrationDecision,
  type OfferSourceRules,
} from "./lib/offers/legacy-offer-classifier.js";

type ProductRow = {
  id: string;
  brand: string | null;
  name: string | null;
  buy_link: string | null;
  price_min: number | null;
  price_max: number | null;
  external_source: string | null;
  external_type: string | null;
  external_id: string | null;
  source_url: string | null;
};

type ReportRow = LegacyOfferClassification & {
  legacyBuyLink: string | null;
  legacySourceUrl: string | null;
  legacyExternalSource: string | null;
  legacyExternalType: string | null;
  legacyExternalId: string | null;
};

function loadEnvironment(): string {
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
  return crawlerDirectory;
}

function parseOutputDirectory(crawlerDirectory: string): string {
  const index = process.argv.indexOf("--output-dir");
  if (index >= 0) {
    const value = process.argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("legacy_offer_report_missing_output_dir");
    }
    return path.resolve(process.cwd(), value);
  }
  return path.resolve(crawlerDirectory, "data", "product-offer-migration");
}

function compactTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function csvCell(value: unknown): string {
  if (value == null) {
    return "";
  }
  const raw = Array.isArray(value) ? value.join("|") : String(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function toCsv(rows: ReportRow[]): string {
  const headers = [
    "product_id",
    "brand",
    "name",
    "host",
    "seller_key",
    "link_role",
    "link_state",
    "price_min",
    "price_max",
    "price_state",
    "migration_decision",
    "buy_link",
    "source_url",
    "external_source",
    "external_type",
    "external_id",
    "reasons",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.productId,
        row.brand,
        row.name,
        row.host,
        row.sellerKey,
        row.linkRole,
        row.linkState,
        row.priceMin,
        row.priceMax,
        row.priceState,
        row.migrationDecision,
        row.legacyBuyLink,
        row.legacySourceUrl,
        row.legacyExternalSource,
        row.legacyExternalType,
        row.legacyExternalId,
        row.reasons,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function countByDecision(rows: ReportRow[]): Record<MigrationDecision, number> {
  const counts: Record<MigrationDecision, number> = {
    AUTO_READY: 0,
    LINK_ONLY_READY: 0,
    REVIEW_REQUIRED: 0,
    DO_NOT_MIGRATE: 0,
  };
  for (const row of rows) {
    counts[row.migrationDecision] += 1;
  }
  return counts;
}

async function loadRules(crawlerDirectory: string): Promise<OfferSourceRules> {
  const rulesPath = path.join(crawlerDirectory, "config", "offer-source-rules.json");
  const parsed = JSON.parse(await readFile(rulesPath, "utf8")) as OfferSourceRules;
  if (!parsed.version || !parsed.hosts || typeof parsed.hosts !== "object") {
    throw new Error("legacy_offer_report_invalid_rules");
  }
  return parsed;
}

async function main(): Promise<void> {
  const crawlerDirectory = loadEnvironment();
  const outputDirectory = parseOutputDirectory(crawlerDirectory);
  const rules = await loadRules(crawlerDirectory);
  const client = createServiceRoleClient();

  const productsResult = await client
    .from("products")
    .select(
      "id, brand, name, buy_link, price_min, price_max, external_source, external_type, external_id, source_url",
    )
    .order("id", { ascending: true })
    .limit(5000);

  if (productsResult.error) {
    throw new Error(`legacy_offer_report_products_failed:${productsResult.error.message}`);
  }

  const products = (productsResult.data ?? []) as ProductRow[];
  const rows: ReportRow[] = products.map((product) => ({
    ...classifyLegacyOffer(
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
    legacyBuyLink: product.buy_link,
    legacySourceUrl: product.source_url,
    legacyExternalSource: product.external_source,
    legacyExternalType: product.external_type,
    legacyExternalId: product.external_id,
  }));

  const decisions = countByDecision(rows);
  const generatedAt = new Date();
  const runToken = compactTimestamp(generatedAt);
  const summary = {
    schemaVersion: "legacy_offer_migration_summary_v1",
    classifierRulesVersion: rules.version,
    generatedAt: generatedAt.toISOString(),
    productsScanned: rows.length,
    decisions,
    verifiedSellerPages: rows.filter(
      (row) => row.linkRole === "seller_page" && row.linkState === "verified",
    ).length,
    referencePages: rows.filter((row) => row.linkRole === "reference_page").length,
    listingPages: rows.filter((row) => row.linkRole === "listing_page").length,
    unknownLinks: rows.filter((row) => row.linkRole === "unknown").length,
    verifiedPrices: rows.filter((row) => row.priceState === "verified").length,
    unknownPrices: rows.filter((row) => row.priceState === "unknown").length,
    conflictedPrices: rows.filter((row) => row.priceState === "conflict").length,
    productWrites: 0,
    offerWrites: 0,
  };

  await mkdir(outputDirectory, { recursive: true });
  const base = `legacy-offers-${runToken}`;
  await Promise.all([
    writeFile(
      path.join(outputDirectory, `${base}.jsonl`),
      `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
      "utf8",
    ),
    writeFile(path.join(outputDirectory, `${base}.csv`), toCsv(rows), "utf8"),
    writeFile(
      path.join(outputDirectory, `${base}-summary.json`),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    ),
  ]);

  console.log("Legacy offer migration classification report");
  console.log(`- classifier_rules_version: ${rules.version}`);
  console.log(`- products_scanned: ${summary.productsScanned}`);
  console.log(`- AUTO_READY: ${decisions.AUTO_READY}`);
  console.log(`- LINK_ONLY_READY: ${decisions.LINK_ONLY_READY}`);
  console.log(`- REVIEW_REQUIRED: ${decisions.REVIEW_REQUIRED}`);
  console.log(`- DO_NOT_MIGRATE: ${decisions.DO_NOT_MIGRATE}`);
  console.log(`- verified_seller_pages: ${summary.verifiedSellerPages}`);
  console.log(`- verified_prices: ${summary.verifiedPrices}`);
  console.log(`- product_writes: ${summary.productWrites}`);
  console.log(`- offer_writes: ${summary.offerWrites}`);
  console.log(`- output_directory: ${outputDirectory}`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
