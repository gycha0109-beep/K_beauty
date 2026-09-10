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
  type LegacyOfferManifestRow,
  type LegacyOfferMigrationManifest,
} from "./lib/offers/legacy-offer-migration.js";
import {
  LEGACY_OFFER_IMPORT_MAX_BATCH,
  assertProductOfferReadback,
  buildProductOfferInsertPayload,
  resolveLegacyOfferImportConfirm,
  selectLegacyOfferImportRows,
  type ProductOfferReadback,
} from "./lib/offers/legacy-offer-import.js";

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

type Options = {
  manifestPath: string;
  limit: number;
  productId: string | null;
  confirmValue: string | null;
  expectedManifestDigest: string | null;
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

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!argument.startsWith("--")) continue;
    const separator = argument.indexOf("=");
    if (separator >= 0) {
      values.set(argument.slice(2, separator), argument.slice(separator + 1));
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(argument.slice(2), next);
      index += 1;
    } else {
      values.set(argument.slice(2), "");
    }
  }

  const rawManifest = values.get("manifest")?.trim() ?? "";
  if (!rawManifest) {
    throw new Error("legacy_offer_import_manifest_required");
  }

  const rawLimit = values.get("limit")?.trim() || String(LEGACY_OFFER_IMPORT_MAX_BATCH);
  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > LEGACY_OFFER_IMPORT_MAX_BATCH) {
    throw new Error(`legacy_offer_import_limit_must_be_1_to_${LEGACY_OFFER_IMPORT_MAX_BATCH}`);
  }

  const productId = values.get("product-id")?.trim() || null;
  if (productId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
    throw new Error("legacy_offer_import_product_id_invalid");
  }

  return {
    manifestPath: path.resolve(process.cwd(), rawManifest),
    limit,
    productId,
    confirmValue: values.has("confirm") ? values.get("confirm")! : null,
    expectedManifestDigest: values.has("expected-manifest-digest")
      ? values.get("expected-manifest-digest")!
      : null,
  };
}

async function loadRules(crawlerDirectory: string): Promise<OfferSourceRules> {
  const raw = await readFile(path.join(crawlerDirectory, "config", "offer-source-rules.json"), "utf8");
  const parsed = JSON.parse(raw) as OfferSourceRules;
  if (!parsed.version || !parsed.hosts || typeof parsed.hosts !== "object") {
    throw new Error("legacy_offer_import_invalid_rules");
  }
  return parsed;
}

async function loadManifest(filePath: string): Promise<LegacyOfferMigrationManifest> {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as LegacyOfferMigrationManifest;
  validateLegacyOfferManifest(parsed);
  return parsed;
}

function classifyProduct(product: ProductRow, rules: OfferSourceRules): LegacyOfferClassification {
  return classifyLegacyOffer(
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
  );
}

function toExistingOffer(row: OfferRow): ExistingOfferIdentity {
  return {
    offerId: row.offer_id,
    productId: row.product_id,
    sellerKey: row.seller_key,
    listingId: row.listing_id,
    listingUrl: row.listing_url,
  };
}

function assertCurrentClassification(row: LegacyOfferManifestRow, current: LegacyOfferClassification): void {
  const expected = row.proposedOffer;
  if (
    current.migrationDecision !== "LINK_ONLY_READY" ||
    current.priceState !== "unknown" ||
    current.sellerKey !== expected.sellerKey ||
    current.listingId !== expected.listingId ||
    current.canonicalListingUrl !== expected.listingUrl
  ) {
    throw new Error(`legacy_offer_import_current_product_changed:${row.productId}`);
  }
}

async function loadIdentityOffers(
  client: ReturnType<typeof createServiceRoleClient>,
  row: LegacyOfferManifestRow,
): Promise<OfferRow[]> {
  const offer = row.proposedOffer;
  const [byId, byUrl] = await Promise.all([
    client
      .from("product_offers")
      .select("offer_id, product_id, seller_key, listing_id, listing_url")
      .eq("seller_key", offer.sellerKey)
      .eq("listing_id", offer.listingId)
      .limit(2),
    client
      .from("product_offers")
      .select("offer_id, product_id, seller_key, listing_id, listing_url")
      .eq("seller_key", offer.sellerKey)
      .eq("listing_url", offer.listingUrl)
      .limit(2),
  ]);

  if (byId.error) throw new Error(`legacy_offer_import_identity_id_read_failed:${row.productId}:${byId.error.message}`);
  if (byUrl.error) throw new Error(`legacy_offer_import_identity_url_read_failed:${row.productId}:${byUrl.error.message}`);

  const unique = new Map<string, OfferRow>();
  for (const existing of [...((byId.data ?? []) as OfferRow[]), ...((byUrl.data ?? []) as OfferRow[])]) {
    unique.set(existing.offer_id, existing);
  }
  return [...unique.values()];
}

async function assertSingleRowPreflight(
  client: ReturnType<typeof createServiceRoleClient>,
  row: LegacyOfferManifestRow,
  rules: OfferSourceRules,
): Promise<"insert" | "already_present"> {
  const product = await client
    .from("products")
    .select("id, brand, name, buy_link, price_min, price_max, source_url")
    .eq("id", row.productId)
    .single();
  if (product.error) {
    throw new Error(`legacy_offer_import_product_reread_failed:${row.productId}:${product.error.message}`);
  }
  assertCurrentClassification(row, classifyProduct(product.data as ProductRow, rules));

  const identityOffers = await loadIdentityOffers(client, row);
  const conflicting = identityOffers.find((offer) => offer.product_id !== row.productId);
  if (conflicting) {
    throw new Error(`legacy_offer_import_identity_conflict:${row.productId}:${conflicting.offer_id}`);
  }
  return identityOffers.length > 0 ? "already_present" : "insert";
}

async function confirmRow(
  client: ReturnType<typeof createServiceRoleClient>,
  row: LegacyOfferManifestRow,
  rules: OfferSourceRules,
): Promise<"inserted" | "already_present"> {
  const preflight = await assertSingleRowPreflight(client, row, rules);
  if (preflight === "already_present") return "already_present";

  const payload = buildProductOfferInsertPayload(row);
  const inserted = await client
    .from("product_offers")
    .insert(payload)
    .select("offer_id")
    .single();

  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const raced = await loadIdentityOffers(client, row);
      if (raced.length > 0 && raced.every((offer) => offer.product_id === row.productId)) {
        return "already_present";
      }
    }
    throw new Error(`legacy_offer_import_insert_failed:${row.productId}:${inserted.error.code ?? "unknown"}:${inserted.error.message}`);
  }

  const readback = await client
    .from("product_offers")
    .select(
      "offer_id, product_id, seller_key, seller_name, source_name, listing_id, listing_url, price_amount, currency_code, availability_state, market_code, locale, offer_state, product_scope_state, first_observed_at, last_observed_at",
    )
    .eq("offer_id", inserted.data.offer_id)
    .single();
  if (readback.error) {
    throw new Error(`legacy_offer_import_readback_failed:${row.productId}:${readback.error.message}`);
  }
  assertProductOfferReadback(readback.data as ProductOfferReadback, payload);
  return "inserted";
}

async function main(): Promise<void> {
  const crawlerDirectory = loadEnvironment();
  const options = parseArgs(process.argv.slice(2));
  const [rules, manifest] = await Promise.all([
    loadRules(crawlerDirectory),
    loadManifest(options.manifestPath),
  ]);

  if (manifest.classifierRulesVersion !== rules.version) {
    throw new Error(
      `legacy_offer_import_rules_version_mismatch:${manifest.classifierRulesVersion}:${rules.version}`,
    );
  }

  const confirmedMode = resolveLegacyOfferImportConfirm({
    manifest,
    confirmValue: options.confirmValue,
    expectedManifestDigest: options.expectedManifestDigest,
  });

  const client = createServiceRoleClient();
  const productIds = manifest.rows.map((row) => row.productId);
  const productResult = await client
    .from("products")
    .select("id, brand, name, buy_link, price_min, price_max, source_url")
    .in("id", productIds)
    .limit(5000);
  if (productResult.error) {
    throw new Error(`legacy_offer_import_products_failed:${productResult.error.message}`);
  }

  const currentClassifications = new Map<string, LegacyOfferClassification>();
  for (const product of (productResult.data ?? []) as ProductRow[]) {
    currentClassifications.set(product.id, classifyProduct(product, rules));
  }

  const offerResult = await client
    .from("product_offers")
    .select("offer_id, product_id, seller_key, listing_id, listing_url")
    .limit(10000);
  if (offerResult.error) {
    throw new Error(`legacy_offer_import_offers_failed:${offerResult.error.message}`);
  }

  const dryRunRows = buildLegacyOfferDryRun({
    manifest,
    currentClassifications,
    existingOffers: ((offerResult.data ?? []) as OfferRow[]).map(toExistingOffer),
  });

  const counts = {
    would_insert: dryRunRows.filter((row) => row.status === "would_insert").length,
    already_present: dryRunRows.filter((row) => row.status === "already_present").length,
    stale_product: dryRunRows.filter((row) => row.status === "stale_product").length,
    identity_conflict: dryRunRows.filter((row) => row.status === "identity_conflict").length,
  };

  console.log(`Legacy offer guarded import ${confirmedMode ? "CONFIRM" : "DRY-RUN"}`);
  console.log(`- manifest_digest: ${manifest.manifestDigest}`);
  console.log(`- manifest_rows: ${manifest.rows.length}`);
  console.log(`- would_insert: ${counts.would_insert}`);
  console.log(`- already_present: ${counts.already_present}`);
  console.log(`- stale_product: ${counts.stale_product}`);
  console.log(`- identity_conflict: ${counts.identity_conflict}`);
  console.log(`- max_batch_size: ${LEGACY_OFFER_IMPORT_MAX_BATCH}`);
  console.log(`- requested_limit: ${options.limit}`);
  console.log("- price_amount_policy: null_only");
  console.log("- availability_policy: unknown_only");

  const selected = selectLegacyOfferImportRows({
    manifest,
    dryRunRows,
    limit: options.limit,
    productId: options.productId,
  });
  console.log(`- selected_rows: ${selected.length}`);
  for (const row of selected) {
    console.log(
      `- selected product=${row.productId} seller=${row.proposedOffer.sellerKey} listing_id=${row.proposedOffer.listingId} url=${row.proposedOffer.listingUrl}`,
    );
  }

  if (!confirmedMode) {
    console.log("- database_writes: 0");
    return;
  }

  let inserted = 0;
  let alreadyPresent = 0;
  for (const row of selected) {
    const result = await confirmRow(client, row, rules);
    if (result === "inserted") inserted += 1;
    else alreadyPresent += 1;
  }

  console.log(`- confirmed_inserts: ${inserted}`);
  console.log(`- race_or_preexisting_same_product: ${alreadyPresent}`);
  console.log("- updates: 0");
  console.log("- deletes: 0");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
