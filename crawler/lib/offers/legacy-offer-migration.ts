import { createHash } from "node:crypto";

import type { LegacyOfferClassification } from "./legacy-offer-classifier.js";

export const LEGACY_OFFER_MANIFEST_SCHEMA = "legacy_offer_link_only_manifest_v1" as const;
export const LEGACY_OFFER_SOURCE_NAME = "legacy_product_buy_link_v1" as const;

export type ProposedLinkOnlyOffer = {
  productId: string;
  sellerKey: string;
  sellerName: string;
  sourceName: typeof LEGACY_OFFER_SOURCE_NAME;
  listingId: string;
  listingUrl: string;
  priceAmount: null;
  currencyCode: "KRW";
  availabilityState: "unknown";
  marketCode: "KR";
  locale: null;
  offerState: "current";
  productScopeState: "product_subject_unresolved";
  firstObservedAt: null;
  lastObservedAt: null;
};

export type LegacyOfferManifestRow = {
  productId: string;
  brand: string | null;
  name: string | null;
  classifierRulesVersion: string;
  migrationDecision: "LINK_ONLY_READY";
  legacyBuyLink: string;
  legacyPriceMin: number | null;
  legacyPriceMax: number | null;
  legacyPriceState: "unknown";
  proposedOffer: ProposedLinkOnlyOffer;
  rowDigest: string;
};

export type LegacyOfferMigrationManifest = {
  schemaVersion: typeof LEGACY_OFFER_MANIFEST_SCHEMA;
  classifierRulesVersion: string;
  generatedAt: string;
  sourceProductCount: number;
  decisionCounts: {
    AUTO_READY: number;
    LINK_ONLY_READY: number;
    REVIEW_REQUIRED: number;
    DO_NOT_MIGRATE: number;
  };
  rows: LegacyOfferManifestRow[];
  manifestDigest: string;
};

export type ExistingOfferIdentity = {
  offerId: string;
  productId: string;
  sellerKey: string;
  listingId: string | null;
  listingUrl: string;
};

export type DryRunRowStatus =
  | "would_insert"
  | "already_present"
  | "stale_product"
  | "identity_conflict";

export type DryRunRow = {
  productId: string;
  sellerKey: string;
  listingId: string;
  listingUrl: string;
  status: DryRunRowStatus;
  reason: string;
  existingOfferId: string | null;
};

function canonicalJson(value: unknown): string {
  if (value === undefined) {
    throw new Error("canonical_json_undefined_not_allowed");
  }
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      throw new Error("canonical_json_unserializable_value");
    }
    return encoded;
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function sellerNameFromClassification(classification: LegacyOfferClassification): string {
  return classification.host ?? classification.sellerKey ?? "unknown";
}

function assertManifestable(classification: LegacyOfferClassification): asserts classification is
  LegacyOfferClassification & {
    migrationDecision: "LINK_ONLY_READY";
    sellerKey: string;
    listingId: string;
    canonicalListingUrl: string;
    priceState: "unknown";
  } {
  if (classification.migrationDecision !== "LINK_ONLY_READY") {
    throw new Error("legacy_offer_manifest_non_link_only_row");
  }
  if (!classification.sellerKey || !classification.listingId || !classification.canonicalListingUrl) {
    throw new Error("legacy_offer_manifest_missing_stable_listing_identity");
  }
  if (classification.priceState !== "unknown") {
    throw new Error("legacy_offer_manifest_price_must_remain_unknown");
  }
}

export function buildManifestRow(
  classification: LegacyOfferClassification,
  legacyBuyLink: string | null,
  classifierRulesVersion: string,
): LegacyOfferManifestRow {
  assertManifestable(classification);
  if (!legacyBuyLink) {
    throw new Error("legacy_offer_manifest_missing_legacy_buy_link");
  }

  const withoutDigest = {
    productId: classification.productId,
    brand: classification.brand,
    name: classification.name,
    classifierRulesVersion,
    migrationDecision: "LINK_ONLY_READY" as const,
    legacyBuyLink,
    legacyPriceMin: classification.priceMin,
    legacyPriceMax: classification.priceMax,
    legacyPriceState: "unknown" as const,
    proposedOffer: {
      productId: classification.productId,
      sellerKey: classification.sellerKey,
      sellerName: sellerNameFromClassification(classification),
      sourceName: LEGACY_OFFER_SOURCE_NAME,
      listingId: classification.listingId,
      listingUrl: classification.canonicalListingUrl,
      priceAmount: null,
      currencyCode: "KRW" as const,
      availabilityState: "unknown" as const,
      marketCode: "KR" as const,
      locale: null,
      offerState: "current" as const,
      productScopeState: "product_subject_unresolved" as const,
      firstObservedAt: null,
      lastObservedAt: null,
    },
  };

  return {
    ...withoutDigest,
    rowDigest: sha256Canonical(withoutDigest),
  };
}

function assertRowContract(row: LegacyOfferManifestRow): void {
  if (row.migrationDecision !== "LINK_ONLY_READY" || row.legacyPriceState !== "unknown") {
    throw new Error(`legacy_offer_manifest_row_contract_mismatch:${row.productId}`);
  }
  const offer = row.proposedOffer;
  if (
    !offer ||
    offer.productId !== row.productId ||
    !offer.sellerKey?.trim() ||
    !offer.sellerName?.trim() ||
    !offer.listingId?.trim() ||
    !offer.listingUrl?.trim() ||
    offer.sourceName !== LEGACY_OFFER_SOURCE_NAME ||
    offer.priceAmount !== null ||
    offer.currencyCode !== "KRW" ||
    offer.availabilityState !== "unknown" ||
    offer.marketCode !== "KR" ||
    offer.locale !== null ||
    offer.offerState !== "current" ||
    offer.productScopeState !== "product_subject_unresolved" ||
    offer.firstObservedAt !== null ||
    offer.lastObservedAt !== null
  ) {
    throw new Error(`legacy_offer_manifest_offer_contract_mismatch:${row.productId}`);
  }
}

function validateRows(rows: LegacyOfferManifestRow[]): void {
  const listingIds = new Map<string, string>();
  const listingUrls = new Map<string, string>();
  const productIds = new Set<string>();
  for (const row of rows) {
    assertRowContract(row);
    if (productIds.has(row.productId)) {
      throw new Error(`legacy_offer_manifest_duplicate_product:${row.productId}`);
    }
    productIds.add(row.productId);

    const withoutDigest = { ...row } as Record<string, unknown>;
    delete withoutDigest.rowDigest;
    if (row.rowDigest !== sha256Canonical(withoutDigest)) {
      throw new Error(`legacy_offer_manifest_row_digest_mismatch:${row.productId}`);
    }

    const idIdentity = `${row.proposedOffer.sellerKey}\u0000${row.proposedOffer.listingId}`;
    const idOwner = listingIds.get(idIdentity);
    if (idOwner && idOwner !== row.productId) {
      throw new Error(`legacy_offer_manifest_duplicate_listing_id:${idIdentity}`);
    }
    listingIds.set(idIdentity, row.productId);

    const urlIdentity = `${row.proposedOffer.sellerKey}\u0000${row.proposedOffer.listingUrl}`;
    const urlOwner = listingUrls.get(urlIdentity);
    if (urlOwner && urlOwner !== row.productId) {
      throw new Error(`legacy_offer_manifest_duplicate_listing_url:${urlIdentity}`);
    }
    listingUrls.set(urlIdentity, row.productId);
  }
}

function validateDecisionCounts(manifest: LegacyOfferMigrationManifest): void {
  const counts = Object.values(manifest.decisionCounts);
  if (
    !Number.isInteger(manifest.sourceProductCount) ||
    manifest.sourceProductCount < 0 ||
    counts.some((count) => !Number.isInteger(count) || count < 0) ||
    counts.reduce((sum, count) => sum + count, 0) !== manifest.sourceProductCount
  ) {
    throw new Error("legacy_offer_manifest_decision_counts_invalid");
  }
}

function manifestDigestPayload(input: {
  classifierRulesVersion: string;
  sourceProductCount: number;
  decisionCounts: LegacyOfferMigrationManifest["decisionCounts"];
  rows: LegacyOfferManifestRow[];
}) {
  return {
    schemaVersion: LEGACY_OFFER_MANIFEST_SCHEMA,
    classifierRulesVersion: input.classifierRulesVersion,
    sourceProductCount: input.sourceProductCount,
    decisionCounts: input.decisionCounts,
    rows: input.rows,
  };
}

export function buildLegacyOfferManifest(input: {
  classifierRulesVersion: string;
  generatedAt: string;
  sourceProductCount: number;
  decisionCounts: LegacyOfferMigrationManifest["decisionCounts"];
  rows: LegacyOfferManifestRow[];
}): LegacyOfferMigrationManifest {
  const rows = [...input.rows].sort((a, b) => a.productId.localeCompare(b.productId));
  const manifest: LegacyOfferMigrationManifest = {
    schemaVersion: LEGACY_OFFER_MANIFEST_SCHEMA,
    classifierRulesVersion: input.classifierRulesVersion,
    generatedAt: input.generatedAt,
    sourceProductCount: input.sourceProductCount,
    decisionCounts: input.decisionCounts,
    rows,
    manifestDigest: "",
  };
  validateDecisionCounts(manifest);
  if (rows.length !== input.decisionCounts.LINK_ONLY_READY) {
    throw new Error("legacy_offer_manifest_link_only_count_mismatch");
  }
  validateRows(rows);
  manifest.manifestDigest = sha256Canonical(
    manifestDigestPayload({
      classifierRulesVersion: input.classifierRulesVersion,
      sourceProductCount: input.sourceProductCount,
      decisionCounts: input.decisionCounts,
      rows,
    }),
  );
  return manifest;
}

export function validateLegacyOfferManifest(manifest: LegacyOfferMigrationManifest): void {
  if (manifest.schemaVersion !== LEGACY_OFFER_MANIFEST_SCHEMA) {
    throw new Error("legacy_offer_manifest_schema_mismatch");
  }
  if (!manifest.classifierRulesVersion) {
    throw new Error("legacy_offer_manifest_rules_version_missing");
  }
  validateDecisionCounts(manifest);
  if (manifest.rows.length !== manifest.decisionCounts.LINK_ONLY_READY) {
    throw new Error("legacy_offer_manifest_link_only_count_mismatch");
  }
  validateRows(manifest.rows);
  const expected = sha256Canonical(
    manifestDigestPayload({
      classifierRulesVersion: manifest.classifierRulesVersion,
      sourceProductCount: manifest.sourceProductCount,
      decisionCounts: manifest.decisionCounts,
      rows: manifest.rows,
    }),
  );
  if (expected !== manifest.manifestDigest) {
    throw new Error("legacy_offer_manifest_digest_mismatch");
  }
}

export function buildLegacyOfferDryRun(input: {
  manifest: LegacyOfferMigrationManifest;
  currentClassifications: Map<string, LegacyOfferClassification>;
  existingOffers: ExistingOfferIdentity[];
}): DryRunRow[] {
  validateLegacyOfferManifest(input.manifest);

  const existingByListingId = new Map<string, ExistingOfferIdentity>();
  const existingByListingUrl = new Map<string, ExistingOfferIdentity>();
  for (const offer of input.existingOffers) {
    if (offer.listingId) {
      existingByListingId.set(`${offer.sellerKey}\u0000${offer.listingId}`, offer);
    }
    existingByListingUrl.set(`${offer.sellerKey}\u0000${offer.listingUrl}`, offer);
  }

  return input.manifest.rows.map((row) => {
    const current = input.currentClassifications.get(row.productId);
    if (
      !current ||
      current.migrationDecision !== "LINK_ONLY_READY" ||
      current.priceState !== "unknown" ||
      current.sellerKey !== row.proposedOffer.sellerKey ||
      current.listingId !== row.proposedOffer.listingId ||
      current.canonicalListingUrl !== row.proposedOffer.listingUrl
    ) {
      return {
        productId: row.productId,
        sellerKey: row.proposedOffer.sellerKey,
        listingId: row.proposedOffer.listingId,
        listingUrl: row.proposedOffer.listingUrl,
        status: "stale_product" as const,
        reason: "current_product_no_longer_matches_reviewed_manifest",
        existingOfferId: null,
      };
    }

    const idIdentity = `${row.proposedOffer.sellerKey}\u0000${row.proposedOffer.listingId}`;
    const urlIdentity = `${row.proposedOffer.sellerKey}\u0000${row.proposedOffer.listingUrl}`;
    const existingById = existingByListingId.get(idIdentity);
    const existingByUrl = existingByListingUrl.get(urlIdentity);

    for (const existing of [existingById, existingByUrl]) {
      if (existing && existing.productId !== row.productId) {
        return {
          productId: row.productId,
          sellerKey: row.proposedOffer.sellerKey,
          listingId: row.proposedOffer.listingId,
          listingUrl: row.proposedOffer.listingUrl,
          status: "identity_conflict" as const,
          reason: existing === existingById
            ? "listing_id_already_bound_to_different_product"
            : "listing_url_already_bound_to_different_product",
          existingOfferId: existing.offerId,
        };
      }
    }

    const existing = existingById ?? existingByUrl;
    if (existing) {
      return {
        productId: row.productId,
        sellerKey: row.proposedOffer.sellerKey,
        listingId: row.proposedOffer.listingId,
        listingUrl: row.proposedOffer.listingUrl,
        status: "already_present" as const,
        reason: existingById
          ? "same_product_listing_id_already_present"
          : "same_product_listing_url_already_present",
        existingOfferId: existing.offerId,
      };
    }

    return {
      productId: row.productId,
      sellerKey: row.proposedOffer.sellerKey,
      listingId: row.proposedOffer.listingId,
      listingUrl: row.proposedOffer.listingUrl,
      status: "would_insert" as const,
      reason: "reviewed_link_only_offer_not_present",
      existingOfferId: null,
    };
  });
}
