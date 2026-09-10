#!/usr/bin/env node

import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createServiceRoleClient } from "./lib/supabase.js";
import {
  classifyLegacyOffer,
  type LegacyOfferClassification,
  type OfferSourceRules,
} from "./lib/offers/legacy-offer-classifier.js";
import {
  buildLegacyOfferDryRun,
  validateLegacyOfferManifest,
  type ExistingOfferIdentity,
  type LegacyOfferMigrationManifest,
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

type OfferRow = {
  offer_id: string;
  product_id: string;
  seller_key: string;
  listing_id: string | null;
  listing_url: string;
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

function manifestPathFromArgs(): string {
  const index = process.argv.indexOf("--manifest");
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (!value || value.startsWith("--")) {
    throw new Error("legacy_offer_dry_run_manifest_required");
  }
  return path.resolve(process.cwd(), value);
}

async function loadRules(crawlerDirectory: string): Promise<OfferSourceRules> {
  const raw = await readFile(path.join(crawlerDirectory, "config", "offer-source-rules.json"), "utf8");
  const parsed = JSON.parse(raw) as OfferSourceRules;
  if (!parsed.version || !parsed.hosts || typeof parsed.hosts !== "object") {
    throw new Error("legacy_offer_dry_run_invalid_rules");
  }
  return parsed;
}

async function loadManifest(filePath: string): Promise<LegacyOfferMigrationManifest> {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as LegacyOfferMigrationManifest;
  validateLegacyOfferManifest(parsed);
  return parsed;
}

async function main(): Promise<void> {
  const crawlerDirectory = loadEnvironment();
  const manifestPath = manifestPathFromArgs();
  const [rules, manifest] = await Promise.all([
    loadRules(crawlerDirectory),
    loadManifest(manifestPath),
  ]);

  if (manifest.classifierRulesVersion !== rules.version) {
    throw new Error(
      `legacy_offer_dry_run_rules_version_mismatch:${manifest.classifierRulesVersion}:${rules.version}`,
    );
  }

  const client = createServiceRoleClient();
  const productIds = manifest.rows.map((row) => row.productId);
  const productResult = productIds.length
    ? await client
        .from("products")
        .select("id, brand, name, buy_link, price_min, price_max, source_url")
        .in("id", productIds)
        .limit(5000)
    : { data: [] as ProductRow[], error: null };
  if (productResult.error) {
    throw new Error(`legacy_offer_dry_run_products_failed:${productResult.error.message}`);
  }

  const currentClassifications = new Map<string, LegacyOfferClassification>();
  for (const product of (productResult.data ?? []) as ProductRow[]) {
    currentClassifications.set(
      product.id,
      classifyLegacyOffer(
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
    );
  }

  const offerResult = await client
    .from("product_offers")
    .select("offer_id, product_id, seller_key, listing_id, listing_url")
    .limit(10000);
  if (offerResult.error) {
    throw new Error(`legacy_offer_dry_run_offers_failed:${offerResult.error.message}`);
  }

  const existingOffers: ExistingOfferIdentity[] = ((offerResult.data ?? []) as OfferRow[]).map(
    (offer) => ({
      offerId: offer.offer_id,
      productId: offer.product_id,
      sellerKey: offer.seller_key,
      listingId: offer.listing_id,
      listingUrl: offer.listing_url,
    }),
  );

  const rows = buildLegacyOfferDryRun({
    manifest,
    currentClassifications,
    existingOffers,
  });

  const counts = {
    would_insert: rows.filter((row) => row.status === "would_insert").length,
    already_present: rows.filter((row) => row.status === "already_present").length,
    stale_product: rows.filter((row) => row.status === "stale_product").length,
    identity_conflict: rows.filter((row) => row.status === "identity_conflict").length,
  };
  const blockers = counts.stale_product + counts.identity_conflict;

  console.log("Legacy offer link-only migration dry-run");
  console.log(`- manifest: ${manifestPath}`);
  console.log(`- manifest_digest: ${manifest.manifestDigest}`);
  console.log(`- rows: ${rows.length}`);
  console.log(`- would_insert: ${counts.would_insert}`);
  console.log(`- already_present: ${counts.already_present}`);
  console.log(`- stale_product: ${counts.stale_product}`);
  console.log(`- identity_conflict: ${counts.identity_conflict}`);
  console.log(`- proposed_price_non_null: 0`);
  console.log(`- availability_inferred: 0`);
  console.log(`- database_writes: 0`);

  for (const row of rows.filter((item) => item.status !== "would_insert")) {
    console.log(
      `- row ${row.productId} ${row.status} seller=${row.sellerKey} listing_id=${row.listingId} url=${row.listingUrl} reason=${row.reason}`,
    );
  }

  if (blockers > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
