import { createHash } from "node:crypto";

import type { LegacyOfferClassification } from "./legacy-offer-classifier.js";

export const LEGACY_OFFER_MANIFEST_SCHEMA = "legacy_offer_link_only_manifest_v1" as const;
export const LEGACY_OFFER_SOURCE_NAME = "legacy_product_buy_link_v1" as const;

export type ProposedLinkOnlyOffer = {
  productId: string;
  sellerKey: string;
  sellerName: string;
  sourceName: typeof LEGACY_OFFER_SOURCE_NAME;
  listingId: null;
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
    normalizedUrl: string;
    priceState: "unknown";
  } {
  if (classification.migrationDecision !== "LINK_ONLY_READY") {
    throw new Error("legacy_offer_manifest_non_link_only_row");
  }
  if (!classification.sellerKey || !classification.normalizedUrl) {
    throw new Error("legacy_offer_manifest_missing_listing_identity");
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
      listingId: null,
      listingUrl: classification.normalizedUrl,
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

function validateRows(rows: LegacyOfferManifestRow[]): void {
  const identities = new Map<string, string>();
  for (const row of rows) {
    const withoutDigest = { ...row } as Record<string, unknown>;
    delete withoutDigest.rowDigest;
    if (row.rowDigest !== sha256Canonical(withoutDigest)) {
      throw new Error(`legacy_offer_manifest_row_digest_mismatch:${row.productId}`);
    }
    const identity = `${row.proposedOffer.sellerKey}\u0000${row.proposedOffer.listingUrl}`;
    const previous = identities.get(identity);
    if (previous && previous !== row.productId) {
      throw new Error(`legacy_offer_manifest_duplicate_listing:${identity}`);
    }
    identities.set(identity, row.productId);
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
  validateRows(rows);
  return {
    schemaVersion: LEGACY_OFFER_MANIFEST_SCHEMA,
    classifierRulesVersion: input.classifierRulesVersion,
    generatedAt: input.generatedAt,
    sourceProductCount: input.sourceProductCount,
    decisionCounts: input.decisionCounts,
    rows,
    manifestDigest: sha256Canonical(
      manifestDigestPayload({
        classifierRulesVersion: input.classifierRulesVersion,
        sourceProductCount: input.sourceProductCount,
        decisionCounts: input.decisionCounts,
        rows,
      }),
    ),
  };
}

export function validateLegacyOfferManifest(manifest: LegacyOfferMigrationManifest): void {
  if (manifest.schemaVersion !== LEGACY_OFFER_MANIFEST_SCHEMA) {
    throw new Error("legacy_offer_manifest_schema_mismatch");
  }
  if (!manifest.classifierRulesVersion) {
    throw new Error("legacy_offer_manifest_rules_version_missing");
  }
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

  const existingByIdentity = new Map<string, ExistingOfferIdentity>();
  for (const offer of input.existingOffers) {
    existingByIdentity.set(`${offer.sellerKey}\u0000${offer.listingUrl}`, offer);
  }

  return input.manifest.rows.map((row) => {
    const current = input.currentClassifications.get(row.productId);
    if (
      !current ||
      current.migrationDecision !== "LINK_ONLY_READY" ||
      current.priceState !== "unknown" ||
      current.sellerKey !== row.proposedOffer.sellerKey ||
      current.normalizedUrl !== row.proposedOffer.listingUrl
    ) {
      return {
        productId: row.productId,
        sellerKey: row.proposedOffer.sellerKey,
        listingUrl: row.proposedOffer.listingUrl,
        status: "stale_product" as const,
        reason: "current_product_no_longer_matches_reviewed_manifest",
        existingOfferId: null,
      };
    }

    const identity = `${row.proposedOffer.sellerKey}\u0000${row.proposedOffer.listingUrl}`;
    const existing = existingByIdentity.get(identity);
    if (!existing) {
      return {
        productId: row.productId,
        sellerKey: row.proposedOffer.sellerKey,
        listingUrl: row.proposedOffer.listingUrl,
        status: "would_insert" as const,
        reason: "reviewed_link_only_offer_not_present",
        existingOfferId: null,
      };
    }
    if (existing.productId === row.productId) {
      return {
        productId: row.productId,
        sellerKey: row.proposedOffer.sellerKey,
        listingUrl: row.proposedOffer.listingUrl,
        status: "already_present" as const,
        reason: "same_product_listing_already_present",
        existingOfferId: existing.offerId,
      };
    }
    return {
      productId: row.productId,
      sellerKey: row.proposedOffer.sellerKey,
      listingUrl: row.proposedOffer.listingUrl,
      status: "identity_conflict" as const,
      reason: "listing_already_bound_to_different_product",
      existingOfferId: existing.offerId,
    };
  });
}
