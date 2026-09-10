import {
  validateLegacyOfferManifest,
  type DryRunRow,
  type LegacyOfferManifestRow,
  type LegacyOfferMigrationManifest,
} from "./legacy-offer-migration.js";

export const LEGACY_OFFER_IMPORT_CONFIRM_TOKEN = "legacy-offer-link-only-import-v1" as const;
export const LEGACY_OFFER_IMPORT_MAX_BATCH = 5;

export type ProductOfferInsertPayload = {
  product_id: string;
  seller_key: string;
  seller_name: string;
  source_name: string;
  listing_id: string;
  listing_url: string;
  price_amount: null;
  currency_code: "KRW";
  availability_state: "unknown";
  market_code: "KR";
  locale: null;
  offer_state: "current";
  product_scope_state: "product_subject_unresolved";
  first_observed_at: null;
  last_observed_at: null;
};

export type ProductOfferReadback = ProductOfferInsertPayload & {
  offer_id: string;
};

export function assertLegacyOfferImportLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > LEGACY_OFFER_IMPORT_MAX_BATCH) {
    throw new Error(`legacy_offer_import_limit_must_be_1_to_${LEGACY_OFFER_IMPORT_MAX_BATCH}`);
  }
}

export function resolveLegacyOfferImportConfirm(input: {
  manifest: LegacyOfferMigrationManifest;
  confirmValue: string | null;
  expectedManifestDigest: string | null;
}): boolean {
  validateLegacyOfferManifest(input.manifest);

  if (input.confirmValue == null) {
    if (input.expectedManifestDigest != null) {
      throw new Error("legacy_offer_import_digest_requires_confirm");
    }
    return false;
  }

  if (input.confirmValue !== LEGACY_OFFER_IMPORT_CONFIRM_TOKEN) {
    throw new Error(`legacy_offer_import_confirm_token_required:${LEGACY_OFFER_IMPORT_CONFIRM_TOKEN}`);
  }

  const digest = input.expectedManifestDigest?.trim().toLowerCase() ?? "";
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    throw new Error("legacy_offer_import_expected_manifest_digest_required");
  }
  if (digest !== input.manifest.manifestDigest.toLowerCase()) {
    throw new Error("legacy_offer_import_manifest_digest_mismatch");
  }
  return true;
}

export function selectLegacyOfferImportRows(input: {
  manifest: LegacyOfferMigrationManifest;
  dryRunRows: DryRunRow[];
  limit: number;
  productId?: string | null;
}): LegacyOfferManifestRow[] {
  validateLegacyOfferManifest(input.manifest);
  assertLegacyOfferImportLimit(input.limit);

  const statusByProductId = new Map<string, DryRunRow>();
  for (const row of input.dryRunRows) {
    if (statusByProductId.has(row.productId)) {
      throw new Error(`legacy_offer_import_duplicate_dry_run_product:${row.productId}`);
    }
    statusByProductId.set(row.productId, row);
  }

  if (statusByProductId.size !== input.manifest.rows.length) {
    throw new Error("legacy_offer_import_dry_run_coverage_mismatch");
  }

  const blockers = input.dryRunRows.filter(
    (row) => row.status === "stale_product" || row.status === "identity_conflict",
  );
  if (blockers.length > 0) {
    const stale = blockers.filter((row) => row.status === "stale_product").length;
    const conflicts = blockers.filter((row) => row.status === "identity_conflict").length;
    throw new Error(`legacy_offer_import_blocked:stale=${stale}:identity_conflict=${conflicts}`);
  }

  const selected = input.manifest.rows.filter((row) => {
    if (input.productId && row.productId !== input.productId) return false;
    const dryRun = statusByProductId.get(row.productId);
    if (!dryRun) {
      throw new Error(`legacy_offer_import_missing_dry_run_product:${row.productId}`);
    }
    return dryRun.status === "would_insert";
  });

  if (input.productId && selected.length === 0) {
    const status = statusByProductId.get(input.productId)?.status ?? "missing";
    throw new Error(`legacy_offer_import_product_not_insertable:${input.productId}:${status}`);
  }

  return selected.slice(0, input.limit);
}

export function buildProductOfferInsertPayload(row: LegacyOfferManifestRow): ProductOfferInsertPayload {
  const offer = row.proposedOffer;
  if (
    offer.productId !== row.productId ||
    !offer.sellerKey.trim() ||
    !offer.sellerName.trim() ||
    !offer.listingId.trim() ||
    !offer.listingUrl.trim() ||
    offer.priceAmount !== null ||
    offer.availabilityState !== "unknown" ||
    offer.offerState !== "current" ||
    offer.productScopeState !== "product_subject_unresolved"
  ) {
    throw new Error(`legacy_offer_import_row_contract_mismatch:${row.productId}`);
  }

  return {
    product_id: row.productId,
    seller_key: offer.sellerKey,
    seller_name: offer.sellerName,
    source_name: offer.sourceName,
    listing_id: offer.listingId,
    listing_url: offer.listingUrl,
    price_amount: null,
    currency_code: "KRW",
    availability_state: "unknown",
    market_code: "KR",
    locale: null,
    offer_state: "current",
    product_scope_state: "product_subject_unresolved",
    first_observed_at: null,
    last_observed_at: null,
  };
}

export function assertProductOfferReadback(
  readback: ProductOfferReadback,
  expected: ProductOfferInsertPayload,
): void {
  if (!readback.offer_id) {
    throw new Error("legacy_offer_import_readback_offer_id_missing");
  }

  for (const key of Object.keys(expected) as Array<keyof ProductOfferInsertPayload>) {
    if (readback[key] !== expected[key]) {
      throw new Error(`legacy_offer_import_readback_mismatch:${key}`);
    }
  }
}
