import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

import {
  classifyLegacyOffer,
  type OfferSourceRules,
} from "../lib/offers/legacy-offer-classifier.js";
import {
  buildLegacyOfferManifest,
  buildManifestRow,
} from "../lib/offers/legacy-offer-migration.js";
import { LEGACY_OFFER_IMPORT_CONFIRM_TOKEN } from "../lib/offers/legacy-offer-import.js";

const PRODUCT_ID = "93000000-0000-4000-8000-000000000001";

type ProductRow = {
  id: string;
  brand: string | null;
  name: string | null;
  price_min: number | null;
  price_max: number | null;
  buy_link: string | null;
  source_url: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`legacy_offer_import_runtime_missing_${name.toLowerCase()}`);
  return value;
}

function runApply(args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("npm", ["run", "offers:legacy-apply", "--", ...args], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: process.env,
    encoding: "utf8",
  });
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.API_URL || requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rulesPath = path.resolve(import.meta.dirname, "..", "config", "offer-source-rules.json");
  const rules = JSON.parse(await readFile(rulesPath, "utf8")) as OfferSourceRules;

  const productResult = await service
    .from("products")
    .select("id, brand, name, price_min, price_max, buy_link, source_url")
    .eq("id", PRODUCT_ID)
    .single();
  if (productResult.error) {
    throw new Error(`legacy_offer_import_runtime_product_failed:${productResult.error.message}`);
  }
  const product = productResult.data as ProductRow;
  const classification = classifyLegacyOffer(
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
  assert.equal(classification.migrationDecision, "LINK_ONLY_READY");
  assert.equal(classification.listingId, "A000000001");

  const manifest = buildLegacyOfferManifest({
    classifierRulesVersion: rules.version,
    generatedAt: "2026-09-10T00:00:00.000Z",
    sourceProductCount: 1,
    decisionCounts: {
      AUTO_READY: 0,
      LINK_ONLY_READY: 1,
      REVIEW_REQUIRED: 0,
      DO_NOT_MIGRATE: 0,
    },
    rows: [buildManifestRow(classification, product.buy_link, rules.version)],
  });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "legacy-offer-import-runtime-"));
  const manifestPath = path.join(tempDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  try {
    const before = await service.from("product_offers").select("offer_id");
    if (before.error) throw new Error(`legacy_offer_import_runtime_before_failed:${before.error.message}`);
    assert.equal(before.data.length, 0);

    const wrongDigest = runApply([
      "--manifest",
      manifestPath,
      "--limit=1",
      `--confirm=${LEGACY_OFFER_IMPORT_CONFIRM_TOKEN}`,
      `--expected-manifest-digest=${"0".repeat(64)}`,
    ]);
    assert.notEqual(wrongDigest.status, 0, "wrong digest must fail closed");
    assert.match(`${wrongDigest.stdout}${wrongDigest.stderr}`, /manifest_digest_mismatch/);

    const afterWrongDigest = await service.from("product_offers").select("offer_id");
    if (afterWrongDigest.error) {
      throw new Error(`legacy_offer_import_runtime_after_wrong_digest_failed:${afterWrongDigest.error.message}`);
    }
    assert.equal(afterWrongDigest.data.length, 0);

    const dryRun = runApply(["--manifest", manifestPath, "--limit=1"]);
    assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
    assert.match(dryRun.stdout, /Legacy offer guarded import DRY-RUN/);
    assert.match(dryRun.stdout, /selected_rows: 1/);
    assert.match(dryRun.stdout, /database_writes: 0/);

    const afterDryRun = await service.from("product_offers").select("offer_id");
    if (afterDryRun.error) throw new Error(`legacy_offer_import_runtime_after_dry_failed:${afterDryRun.error.message}`);
    assert.equal(afterDryRun.data.length, 0);

    const confirmArgs = [
      "--manifest",
      manifestPath,
      "--limit=1",
      `--confirm=${LEGACY_OFFER_IMPORT_CONFIRM_TOKEN}`,
      `--expected-manifest-digest=${manifest.manifestDigest}`,
    ];
    const confirmed = runApply(confirmArgs);
    assert.equal(confirmed.status, 0, confirmed.stderr || confirmed.stdout);
    assert.match(confirmed.stdout, /Legacy offer guarded import CONFIRM/);
    assert.match(confirmed.stdout, /confirmed_inserts: 1/);
    assert.match(confirmed.stdout, /updates: 0/);
    assert.match(confirmed.stdout, /deletes: 0/);

    const inserted = await service
      .from("product_offers")
      .select(
        "offer_id, product_id, seller_key, source_name, listing_id, listing_url, price_amount, availability_state, product_scope_state",
      )
      .single();
    if (inserted.error) throw new Error(`legacy_offer_import_runtime_readback_failed:${inserted.error.message}`);
    assert.ok(inserted.data.offer_id);
    assert.equal(inserted.data.product_id, PRODUCT_ID);
    assert.equal(inserted.data.seller_key, "oliveyoung");
    assert.equal(inserted.data.source_name, "legacy_product_buy_link_v1");
    assert.equal(inserted.data.listing_id, "A000000001");
    assert.equal(
      inserted.data.listing_url,
      "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000001",
    );
    assert.equal(inserted.data.price_amount, null);
    assert.equal(inserted.data.availability_state, "unknown");
    assert.equal(inserted.data.product_scope_state, "product_subject_unresolved");

    const repeated = runApply(confirmArgs);
    assert.equal(repeated.status, 0, repeated.stderr || repeated.stdout);
    assert.match(repeated.stdout, /would_insert: 0/);
    assert.match(repeated.stdout, /already_present: 1/);
    assert.match(repeated.stdout, /selected_rows: 0/);
    assert.match(repeated.stdout, /confirmed_inserts: 0/);

    const finalRows = await service.from("product_offers").select("offer_id, product_id");
    if (finalRows.error) throw new Error(`legacy_offer_import_runtime_final_failed:${finalRows.error.message}`);
    assert.equal(finalRows.data.length, 1);
    assert.equal(finalRows.data[0]?.product_id, PRODUCT_ID);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  process.stdout.write(
    "verify:legacy-offer-import:local-runtime PASS (wrong digest zero writes, dry-run zero writes, exact confirm one insert, null price, unknown availability, exact readback, repeat idempotent)\n",
  );
}

main().catch((error) => {
  process.stderr.write("verify:legacy-offer-import:local-runtime FAIL\n");
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
