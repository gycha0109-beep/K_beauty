#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  buildLegacyOfferDryRun,
  buildLegacyOfferManifest,
  buildManifestRow,
  sha256Canonical,
  validateLegacyOfferManifest,
  type LegacyOfferMigrationManifest,
} from "./lib/offers/legacy-offer-migration.js";
import type { LegacyOfferClassification } from "./lib/offers/legacy-offer-classifier.js";

function classification(overrides: Partial<LegacyOfferClassification> = {}): LegacyOfferClassification {
  return {
    schemaVersion: "legacy_offer_classification_v1",
    productId: "00000000-0000-0000-0000-000000000001",
    brand: "테스트",
    name: "테스트 제품",
    host: "oliveyoung.co.kr",
    normalizedUrl:
      "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000001",
    linkRole: "seller_page",
    linkState: "verified",
    sellerKey: "oliveyoung",
    priceState: "unknown",
    priceMin: 18000,
    priceMax: 18000,
    migrationDecision: "LINK_ONLY_READY",
    reasons: ["known_seller_product_route", "legacy_product_price_has_no_explicit_offer_provenance"],
    ...overrides,
  };
}

function manifestFor(row = buildManifestRow(classification(), classification().normalizedUrl, "1.0")) {
  return buildLegacyOfferManifest({
    classifierRulesVersion: "1.0",
    generatedAt: "2026-09-10T00:00:00.000Z",
    sourceProductCount: 4,
    decisionCounts: {
      AUTO_READY: 0,
      LINK_ONLY_READY: 1,
      REVIEW_REQUIRED: 1,
      DO_NOT_MIGRATE: 2,
    },
    rows: [row],
  });
}

const row = buildManifestRow(classification(), classification().normalizedUrl, "1.0");
assert.equal(row.proposedOffer.priceAmount, null);
assert.equal(row.proposedOffer.availabilityState, "unknown");
assert.equal(row.proposedOffer.productScopeState, "product_subject_unresolved");
assert.equal(row.proposedOffer.sourceName, "legacy_product_buy_link_v1");

const manifest = manifestFor(row);
validateLegacyOfferManifest(manifest);
assert.equal(manifest.rows.length, 1);
assert.equal(manifest.manifestDigest.length, 64);

const wouldInsert = buildLegacyOfferDryRun({
  manifest,
  currentClassifications: new Map([[row.productId, classification()]]),
  existingOffers: [],
});
assert.equal(wouldInsert[0]?.status, "would_insert");

const alreadyPresent = buildLegacyOfferDryRun({
  manifest,
  currentClassifications: new Map([[row.productId, classification()]]),
  existingOffers: [
    {
      offerId: "00000000-0000-0000-0000-000000000010",
      productId: row.productId,
      sellerKey: row.proposedOffer.sellerKey,
      listingUrl: row.proposedOffer.listingUrl,
    },
  ],
});
assert.equal(alreadyPresent[0]?.status, "already_present");

const identityConflict = buildLegacyOfferDryRun({
  manifest,
  currentClassifications: new Map([[row.productId, classification()]]),
  existingOffers: [
    {
      offerId: "00000000-0000-0000-0000-000000000011",
      productId: "00000000-0000-0000-0000-000000000999",
      sellerKey: row.proposedOffer.sellerKey,
      listingUrl: row.proposedOffer.listingUrl,
    },
  ],
});
assert.equal(identityConflict[0]?.status, "identity_conflict");

const stale = buildLegacyOfferDryRun({
  manifest,
  currentClassifications: new Map([
    [row.productId, classification({ normalizedUrl: "https://example.com/changed" })],
  ]),
  existingOffers: [],
});
assert.equal(stale[0]?.status, "stale_product");

const forgedPrice = structuredClone(manifest) as LegacyOfferMigrationManifest;
(forgedPrice.rows[0]!.proposedOffer as unknown as { priceAmount: number | null }).priceAmount = 18000;
const forgedWithoutDigest = { ...forgedPrice.rows[0]! } as Record<string, unknown>;
delete forgedWithoutDigest.rowDigest;
forgedPrice.rows[0]!.rowDigest = sha256Canonical(forgedWithoutDigest);
assert.throws(() => validateLegacyOfferManifest(forgedPrice), /offer_contract_mismatch/);

const duplicateProductRow = buildManifestRow(
  classification({
    normalizedUrl: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000002",
  }),
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000002",
  "1.0",
);
assert.throws(
  () =>
    buildLegacyOfferManifest({
      classifierRulesVersion: "1.0",
      generatedAt: "2026-09-10T00:00:00.000Z",
      sourceProductCount: 2,
      decisionCounts: {
        AUTO_READY: 0,
        LINK_ONLY_READY: 2,
        REVIEW_REQUIRED: 0,
        DO_NOT_MIGRATE: 0,
      },
      rows: [row, duplicateProductRow],
    }),
  /duplicate_product/,
);

const badCounts = structuredClone(manifest);
badCounts.decisionCounts.DO_NOT_MIGRATE = 3;
assert.throws(() => validateLegacyOfferManifest(badCounts), /decision_counts_invalid/);

const tamperedDigest = structuredClone(manifest);
tamperedDigest.manifestDigest = "0".repeat(64);
assert.throws(() => validateLegacyOfferManifest(tamperedDigest), /manifest_digest_mismatch/);

console.log("Legacy offer migration manifest/dry-run verification PASS");
console.log("- link_only_price_null: PASS");
console.log("- would_insert: PASS");
console.log("- already_present_idempotency: PASS");
console.log("- identity_conflict: PASS");
console.log("- stale_product: PASS");
console.log("- forged_price_blocked: PASS");
console.log("- duplicate_product_blocked: PASS");
console.log("- decision_counts_guarded: PASS");
console.log("- manifest_digest_guarded: PASS");
console.log("- database_writes: 0");
