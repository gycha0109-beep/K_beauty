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

const RAW_URL =
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000001&t_page=search&trackingCd=Result_1";
const CANONICAL_URL =
  "https://oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000001";

function classification(overrides: Partial<LegacyOfferClassification> = {}): LegacyOfferClassification {
  return {
    schemaVersion: "legacy_offer_classification_v1",
    productId: "00000000-0000-0000-0000-000000000001",
    brand: "테스트",
    name: "테스트 제품",
    host: "oliveyoung.co.kr",
    normalizedUrl: RAW_URL,
    canonicalListingUrl: CANONICAL_URL,
    listingId: "A000000000001",
    linkRole: "seller_page",
    linkState: "verified",
    sellerKey: "oliveyoung",
    priceState: "unknown",
    priceMin: 18000,
    priceMax: 18000,
    migrationDecision: "LINK_ONLY_READY",
    reasons: [
      "known_seller_product_route",
      "stable_listing_identity_extracted",
      "legacy_product_price_has_no_explicit_offer_provenance",
    ],
    ...overrides,
  };
}

function manifestFor(row = buildManifestRow(classification(), RAW_URL, "1.1")) {
  return buildLegacyOfferManifest({
    classifierRulesVersion: "1.1",
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

const row = buildManifestRow(classification(), RAW_URL, "1.1");
assert.equal(row.proposedOffer.listingId, "A000000000001");
assert.equal(row.proposedOffer.listingUrl, CANONICAL_URL);
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

const alreadyPresentByIdWithDifferentUrl = buildLegacyOfferDryRun({
  manifest,
  currentClassifications: new Map([[row.productId, classification()]]),
  existingOffers: [
    {
      offerId: "00000000-0000-0000-0000-000000000010",
      productId: row.productId,
      sellerKey: row.proposedOffer.sellerKey,
      listingId: row.proposedOffer.listingId,
      listingUrl: `${row.proposedOffer.listingUrl}&legacy_tracking=1`,
    },
  ],
});
assert.equal(alreadyPresentByIdWithDifferentUrl[0]?.status, "already_present");

const identityConflictById = buildLegacyOfferDryRun({
  manifest,
  currentClassifications: new Map([[row.productId, classification()]]),
  existingOffers: [
    {
      offerId: "00000000-0000-0000-0000-000000000011",
      productId: "00000000-0000-0000-0000-000000000999",
      sellerKey: row.proposedOffer.sellerKey,
      listingId: row.proposedOffer.listingId,
      listingUrl: "https://oliveyoung.co.kr/legacy-url",
    },
  ],
});
assert.equal(identityConflictById[0]?.status, "identity_conflict");
assert.match(identityConflictById[0]?.reason ?? "", /listing_id/);

const stale = buildLegacyOfferDryRun({
  manifest,
  currentClassifications: new Map([
    [row.productId, classification({ listingId: "A000000000002" })],
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

const forgedListingId = structuredClone(manifest) as LegacyOfferMigrationManifest;
forgedListingId.rows[0]!.proposedOffer.listingId = "A000000999999";
const forgedIdWithoutDigest = { ...forgedListingId.rows[0]! } as Record<string, unknown>;
delete forgedIdWithoutDigest.rowDigest;
forgedListingId.rows[0]!.rowDigest = sha256Canonical(forgedIdWithoutDigest);
forgedListingId.manifestDigest = sha256Canonical({
  schemaVersion: forgedListingId.schemaVersion,
  classifierRulesVersion: forgedListingId.classifierRulesVersion,
  sourceProductCount: forgedListingId.sourceProductCount,
  decisionCounts: forgedListingId.decisionCounts,
  rows: forgedListingId.rows,
});
const forgedIdDryRun = buildLegacyOfferDryRun({
  manifest: forgedListingId,
  currentClassifications: new Map([[row.productId, classification()]]),
  existingOffers: [],
});
assert.equal(forgedIdDryRun[0]?.status, "stale_product");

const duplicateProductRow = buildManifestRow(
  classification({
    listingId: "A000000000002",
    canonicalListingUrl:
      "https://oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000002",
  }),
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000000002",
  "1.1",
);
assert.throws(
  () =>
    buildLegacyOfferManifest({
      classifierRulesVersion: "1.1",
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

const sameListingDifferentProduct = buildManifestRow(
  classification({ productId: "00000000-0000-0000-0000-000000000002" }),
  RAW_URL,
  "1.1",
);
assert.throws(
  () =>
    buildLegacyOfferManifest({
      classifierRulesVersion: "1.1",
      generatedAt: "2026-09-10T00:00:00.000Z",
      sourceProductCount: 2,
      decisionCounts: {
        AUTO_READY: 0,
        LINK_ONLY_READY: 2,
        REVIEW_REQUIRED: 0,
        DO_NOT_MIGRATE: 0,
      },
      rows: [row, sameListingDifferentProduct],
    }),
  /duplicate_listing_id/,
);

const badCounts = structuredClone(manifest);
badCounts.decisionCounts.DO_NOT_MIGRATE = 3;
assert.throws(() => validateLegacyOfferManifest(badCounts), /decision_counts_invalid/);

const tamperedDigest = structuredClone(manifest);
tamperedDigest.manifestDigest = "0".repeat(64);
assert.throws(() => validateLegacyOfferManifest(tamperedDigest), /manifest_digest_mismatch/);

console.log("Legacy offer migration manifest/dry-run verification PASS");
console.log("- stable_listing_id_required: PASS");
console.log("- canonical_listing_url: PASS");
console.log("- link_only_price_null: PASS");
console.log("- would_insert: PASS");
console.log("- already_present_by_listing_id: PASS");
console.log("- identity_conflict_by_listing_id: PASS");
console.log("- stale_listing_identity: PASS");
console.log("- forged_price_blocked: PASS");
console.log("- forged_listing_id_detected_by_reread: PASS");
console.log("- duplicate_product_blocked: PASS");
console.log("- duplicate_listing_id_blocked: PASS");
console.log("- decision_counts_guarded: PASS");
console.log("- manifest_digest_guarded: PASS");
console.log("- database_writes: 0");
