#!/usr/bin/env node

import assert from "node:assert/strict";

import type { LegacyOfferClassification } from "./lib/offers/legacy-offer-classifier.js";
import {
  buildLegacyOfferManifest,
  buildManifestRow,
  type DryRunRow,
} from "./lib/offers/legacy-offer-migration.js";
import {
  LEGACY_OFFER_IMPORT_CONFIRM_TOKEN,
  LEGACY_OFFER_IMPORT_MAX_BATCH,
  assertLegacyOfferImportLimit,
  assertProductOfferReadback,
  buildProductOfferInsertPayload,
  resolveLegacyOfferImportConfirm,
  selectLegacyOfferImportRows,
  type ProductOfferReadback,
} from "./lib/offers/legacy-offer-import.js";

function productId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function classification(index: number): LegacyOfferClassification {
  const listingId = `A${String(index).padStart(12, "0")}`;
  return {
    schemaVersion: "legacy_offer_classification_v1",
    productId: productId(index),
    brand: "테스트",
    name: `테스트 제품 ${index}`,
    host: "oliveyoung.co.kr",
    normalizedUrl: `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${listingId}`,
    canonicalListingUrl: `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${listingId}`,
    listingId,
    linkRole: "seller_page",
    linkState: "verified",
    sellerKey: "oliveyoung",
    priceState: "unknown",
    priceMin: 10000 + index,
    priceMax: 10000 + index,
    migrationDecision: "LINK_ONLY_READY",
    reasons: ["known_seller_product_route", "stable_listing_identity_extracted"],
  };
}

const rows = Array.from({ length: 6 }, (_, offset) => {
  const current = classification(offset + 1);
  return buildManifestRow(current, current.normalizedUrl, "1.0");
});

const manifest = buildLegacyOfferManifest({
  classifierRulesVersion: "1.0",
  generatedAt: "2026-09-10T00:00:00.000Z",
  sourceProductCount: 6,
  decisionCounts: {
    AUTO_READY: 0,
    LINK_ONLY_READY: 6,
    REVIEW_REQUIRED: 0,
    DO_NOT_MIGRATE: 0,
  },
  rows,
});

const dryRunRows: DryRunRow[] = manifest.rows.map((row) => ({
  productId: row.productId,
  sellerKey: row.proposedOffer.sellerKey,
  listingId: row.proposedOffer.listingId,
  listingUrl: row.proposedOffer.listingUrl,
  status: "would_insert",
  reason: "reviewed_link_only_offer_not_present",
  existingOfferId: null,
}));

assert.equal(
  resolveLegacyOfferImportConfirm({
    manifest,
    confirmValue: null,
    expectedManifestDigest: null,
  }),
  false,
);
assert.throws(
  () =>
    resolveLegacyOfferImportConfirm({
      manifest,
      confirmValue: null,
      expectedManifestDigest: manifest.manifestDigest,
    }),
  /digest_requires_confirm/,
);
assert.throws(
  () =>
    resolveLegacyOfferImportConfirm({
      manifest,
      confirmValue: "wrong-token",
      expectedManifestDigest: manifest.manifestDigest,
    }),
  /confirm_token_required/,
);
assert.throws(
  () =>
    resolveLegacyOfferImportConfirm({
      manifest,
      confirmValue: LEGACY_OFFER_IMPORT_CONFIRM_TOKEN,
      expectedManifestDigest: "0".repeat(64),
    }),
  /manifest_digest_mismatch/,
);
assert.equal(
  resolveLegacyOfferImportConfirm({
    manifest,
    confirmValue: LEGACY_OFFER_IMPORT_CONFIRM_TOKEN,
    expectedManifestDigest: manifest.manifestDigest,
  }),
  true,
);

assert.equal(LEGACY_OFFER_IMPORT_MAX_BATCH, 5);
assert.doesNotThrow(() => assertLegacyOfferImportLimit(5));
assert.throws(() => assertLegacyOfferImportLimit(6), /limit_must_be_1_to_5/);

const selected = selectLegacyOfferImportRows({
  manifest,
  dryRunRows,
  limit: 5,
});
assert.equal(selected.length, 5);
assert.deepEqual(
  selected.map((row) => row.productId),
  manifest.rows.slice(0, 5).map((row) => row.productId),
);

const single = selectLegacyOfferImportRows({
  manifest,
  dryRunRows,
  limit: 5,
  productId: manifest.rows[4]!.productId,
});
assert.equal(single.length, 1);
assert.equal(single[0]!.productId, manifest.rows[4]!.productId);

const blocked = structuredClone(dryRunRows);
blocked[5]!.status = "identity_conflict";
blocked[5]!.reason = "listing_id_already_bound_to_different_product";
assert.throws(
  () => selectLegacyOfferImportRows({ manifest, dryRunRows: blocked, limit: 1 }),
  /legacy_offer_import_blocked:stale=0:identity_conflict=1/,
);

const incomplete = dryRunRows.slice(0, 5);
assert.throws(
  () => selectLegacyOfferImportRows({ manifest, dryRunRows: incomplete, limit: 1 }),
  /dry_run_coverage_mismatch/,
);

const payload = buildProductOfferInsertPayload(manifest.rows[0]!);
assert.equal(payload.product_id, manifest.rows[0]!.productId);
assert.equal(payload.listing_id, manifest.rows[0]!.proposedOffer.listingId);
assert.equal(payload.price_amount, null);
assert.equal(payload.availability_state, "unknown");
assert.equal(payload.product_scope_state, "product_subject_unresolved");

const readback: ProductOfferReadback = {
  offer_id: "00000000-0000-4000-8000-999999999999",
  ...payload,
};
assert.doesNotThrow(() => assertProductOfferReadback(readback, payload));
const forgedReadback = { ...readback, availability_state: "in_stock" } as unknown as ProductOfferReadback;
assert.throws(() => assertProductOfferReadback(forgedReadback, payload), /readback_mismatch:availability_state/);

console.log("Legacy offer guarded import verification PASS");
console.log("- dry_run_default: PASS");
console.log("- exact_confirm_token: PASS");
console.log("- exact_manifest_digest: PASS");
console.log("- max_batch_size_5: PASS");
console.log("- global_stale_conflict_block: PASS");
console.log("- deterministic_selection: PASS");
console.log("- null_price_unknown_availability: PASS");
console.log("- exact_readback_contract: PASS");
console.log("- updates: 0");
console.log("- deletes: 0");
