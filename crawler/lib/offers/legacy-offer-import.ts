import {
  validateLegacyOfferManifest,
  type DryRunRow,
  type LegacyOfferManifestRow,
  type LegacyOfferMigrationManifest,
} from "./legacy-offer-migration.js";

export const LEGACY_OFFER_IMPORT_CONFIRM_TOKEN = "legacy-offer-link-only-import-v1" as const;
export const LEGACY_OFFER_IMPORT_MAX_BATCH = 5;
export const LEGACY_OFFER_IMPORT_PRESENTATION_SELLERS = new Set(["oliveyoung"]);

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

export function normalizeLegacyOfferImportSellerKey(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(normalized)) {
    throw new Error("legacy_offer_import_seller_key_invalid");
  }
  return normalized;
}

export function assertLegacyOfferPresentationParity(input: {
  row: LegacyOfferManifestRow;
  currentClassification: {
    migrationDecision: string;
    sellerKey: string | null;
    listingId: string | null;
    canonicalListingUrl: string | null;
  };
  currentBuyLink: string | null;
  sellerKey: string | null;
}): void {
  const scopedSeller = normalizeLegacyOfferImportSellerKey(input.sellerKey);
  if (!scopedSeller) return;
  if (!LEGACY_OFFER_IMPORT_PRESENTATION_SELLERS.has(scopedSeller)) {
    throw new Error(`legacy_offer_import_presentation_seller_not_admitted:${scopedSeller}`);
  }

  const offer = input.row.proposedOffer;
  const current = input.currentClassification;
  if (
    offer.sellerKey !== scopedSeller ||
    offer.sourceName !== "legacy_product_buy_link_v1" ||
    current.migrationDecision !== "LINK_ONLY_READY" ||
    current.sellerKey !== scopedSeller ||
    current.listingId !== offer.listingId ||
    current.canonicalListingUrl !== offer.listingUrl
  ) {
    throw new Error(`legacy_offer_import_presentation_parity_mismatch:${input.row.productId}`);
  }

  let currentUrl: URL;
  try {
    currentUrl = new URL(input.currentBuyLink ?? "");
  } catch {
    throw new Error(`legacy_offer_import_presentation_current_url_invalid:${input.row.productId}`);
  }

  const hostname = currentUrl.hostname.toLowerCase();
  const allowedHosts = new Set([
    "oliveyoung.co.kr",
    "www.oliveyoung.co.kr",
    "m.oliveyoung.co.kr",
  ]);
  if (
    currentUrl.protocol !== "https:" ||
    !allowedHosts.has(hostname) ||
    !/^\/store\/goods\/getGoodsDetail(?:\.do)?\/?$/i.test(currentUrl.pathname) ||
    currentUrl.searchParams.get("goodsNo") !== offer.listingId
  ) {
    throw new Error(`legacy_offer_import_presentation_current_url_mismatch:${input.row.productId}`);
  }
}

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
  sellerKey?: string | null;
}): LegacyOfferManifestRow[] {
  validateLegacyOfferManifest(input.manifest);
  assertLegacyOfferImportLimit(input.limit);
  const sellerKey = normalizeLegacyOfferImportSellerKey(input.sellerKey);

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

  const manifestByProductId = new Map(input.manifest.rows.map((row) => [row.productId, row]));
  const blockers = input.dryRunRows.filter((row) => {
    const manifestRow = manifestByProductId.get(row.productId);
    if (!manifestRow) return true;
    if (sellerKey && manifestRow.proposedOffer.sellerKey !== sellerKey) return false;
    return row.status === "stale_product" || row.status === "identity_conflict";
  });
  if (blockers.length > 0) {
    const stale = blockers.filter((row) => row.status === "stale_product").length;
    const conflicts = blockers.filter((row) => row.status === "identity_conflict").length;
    throw new Error(`legacy_offer_import_blocked:stale=${stale}:identity_conflict=${conflicts}`);
  }

  const selected = input.manifest.rows.filter((row) => {
    if (sellerKey && row.proposedOffer.sellerKey !== sellerKey) return false;
    if (input.productId && row.productId !== input.productId) return false;
    const dryRun = statusByProductId.get(row.productId);
    if (!dryRun) {
      throw new Error(`legacy_offer_import_missing_dry_run_product:${row.productId}`);
    }
    return dryRun.status === "would_insert";
  });

  if (input.productId && selected.length === 0) {
    const manifestRow = manifestByProductId.get(input.productId);
    if (sellerKey && manifestRow && manifestRow.proposedOffer.sellerKey !== sellerKey) {
      throw new Error(
        `legacy_offer_import_product_not_in_seller_scope:${input.productId}:${sellerKey}`,
      );
    }
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
