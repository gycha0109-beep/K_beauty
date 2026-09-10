export type LinkRole = "seller_page" | "reference_page" | "listing_page" | "unknown";
export type EvidenceState = "verified" | "unknown" | "conflict" | "not_applicable";
export type MigrationDecision =
  | "AUTO_READY"
  | "LINK_ONLY_READY"
  | "REVIEW_REQUIRED"
  | "DO_NOT_MIGRATE";

export type ListingIdSource =
  | { kind: "query"; key: string }
  | { kind: "path"; pattern: string; group?: number };

export type ProductRouteRule = {
  path_pattern: string;
  required_query_all?: string[];
  listing_id_source?: ListingIdSource;
};

export type HostRule = {
  kind: "seller" | "reference";
  seller_key: string | null;
  product_routes?: ProductRouteRule[];
  listing_routes?: ProductRouteRule[];
};

export type OfferSourceRules = {
  version: string;
  hosts: Record<string, HostRule>;
};

export type LegacyCommercialInput = {
  productId: string;
  brand: string | null;
  name: string | null;
  buyLink: string | null;
  priceMin: number | null;
  priceMax: number | null;
  sourceUrl?: string | null;
  explicitPriceSourceUrl?: string | null;
};

export type LegacyOfferClassification = {
  schemaVersion: "legacy_offer_classification_v1";
  productId: string;
  brand: string | null;
  name: string | null;
  host: string | null;
  normalizedUrl: string | null;
  canonicalListingUrl: string | null;
  listingId: string | null;
  linkRole: LinkRole;
  linkState: EvidenceState;
  sellerKey: string | null;
  priceState: EvidenceState;
  priceMin: number | null;
  priceMax: number | null;
  migrationDecision: MigrationDecision;
  reasons: string[];
};

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function normalizeComparableUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    url.hash = "";
    const removable = [
      "srsltid",
      "NaPm",
      "nt_source",
      "nt_medium",
      "nt_detail",
      "nt_keyword",
      "trackingCd",
      "t_page",
      "t_click",
      "t_search_name",
      "t_number",
    ];
    for (const key of removable) {
      url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return null;
  }
}

function routeMatches(url: URL, route: ProductRouteRule): boolean {
  let pattern: RegExp;
  try {
    pattern = new RegExp(route.path_pattern);
  } catch {
    return false;
  }
  if (!pattern.test(url.pathname)) {
    return false;
  }
  return (route.required_query_all ?? []).every((key) => url.searchParams.has(key));
}

function extractListingId(url: URL, source: ListingIdSource | undefined): string | null {
  if (!source) return null;
  if (source.kind === "query") {
    const value = url.searchParams.get(source.key)?.trim() ?? "";
    return value || null;
  }
  try {
    const match = url.pathname.match(new RegExp(source.pattern));
    const value = match?.[source.group ?? 1]?.trim() ?? "";
    return value || null;
  } catch {
    return null;
  }
}

function canonicalListingUrl(
  url: URL,
  source: ListingIdSource | undefined,
  listingId: string | null,
): string | null {
  if (!source || !listingId) return null;
  const canonical = new URL(url.origin);
  canonical.pathname = url.pathname;
  if (source.kind === "query") {
    canonical.searchParams.set(source.key, listingId);
  }
  return canonical.toString();
}

function classifyLink(
  rawUrl: string | null,
  rules: OfferSourceRules,
): {
  host: string | null;
  normalizedUrl: string | null;
  canonicalListingUrl: string | null;
  listingId: string | null;
  role: LinkRole;
  state: EvidenceState;
  sellerKey: string | null;
  reasons: string[];
} {
  if (!rawUrl || !rawUrl.trim()) {
    return {
      host: null,
      normalizedUrl: null,
      canonicalListingUrl: null,
      listingId: null,
      role: "unknown",
      state: "unknown",
      sellerKey: null,
      reasons: ["missing_buy_link"],
    };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      host: null,
      normalizedUrl: null,
      canonicalListingUrl: null,
      listingId: null,
      role: "unknown",
      state: "unknown",
      sellerKey: null,
      reasons: ["malformed_buy_link"],
    };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      host: normalizeHost(url.hostname),
      normalizedUrl: null,
      canonicalListingUrl: null,
      listingId: null,
      role: "unknown",
      state: "unknown",
      sellerKey: null,
      reasons: ["unsupported_buy_link_protocol"],
    };
  }

  const host = normalizeHost(url.hostname);
  const normalizedUrl = normalizeComparableUrl(rawUrl);
  const rule = rules.hosts[host];
  if (!rule) {
    return {
      host,
      normalizedUrl,
      canonicalListingUrl: null,
      listingId: null,
      role: "unknown",
      state: "unknown",
      sellerKey: null,
      reasons: ["unclassified_host"],
    };
  }

  if (rule.kind === "reference") {
    return {
      host,
      normalizedUrl,
      canonicalListingUrl: null,
      listingId: null,
      role: "reference_page",
      state: "verified",
      sellerKey: null,
      reasons: ["known_reference_source"],
    };
  }

  const listingMatch = (rule.listing_routes ?? []).some((route) => routeMatches(url, route));
  if (listingMatch) {
    return {
      host,
      normalizedUrl,
      canonicalListingUrl: null,
      listingId: null,
      role: "listing_page",
      state: "verified",
      sellerKey: rule.seller_key,
      reasons: ["known_seller_listing_route"],
    };
  }

  const productRoute = (rule.product_routes ?? []).find((route) => routeMatches(url, route));
  if (productRoute) {
    const listingId = extractListingId(url, productRoute.listing_id_source);
    const canonicalUrl = canonicalListingUrl(url, productRoute.listing_id_source, listingId);
    const identityReady = Boolean(listingId && canonicalUrl);
    return {
      host,
      normalizedUrl,
      canonicalListingUrl: canonicalUrl,
      listingId,
      role: "seller_page",
      state: identityReady ? "verified" : "unknown",
      sellerKey: rule.seller_key,
      reasons: identityReady
        ? ["known_seller_product_route", "stable_listing_identity_extracted"]
        : ["known_seller_product_route", "stable_listing_identity_missing"],
    };
  }

  return {
    host,
    normalizedUrl,
    canonicalListingUrl: null,
    listingId: null,
    role: "unknown",
    state: "unknown",
    sellerKey: rule.seller_key,
    reasons: ["known_seller_host_unrecognized_route"],
  };
}

function classifyPrice(input: LegacyCommercialInput): {
  state: EvidenceState;
  reasons: string[];
} {
  const { priceMin, priceMax } = input;
  if (priceMin == null && priceMax == null) {
    return { state: "unknown", reasons: ["legacy_price_missing"] };
  }
  if (
    (priceMin != null && (!Number.isFinite(priceMin) || priceMin < 0)) ||
    (priceMax != null && (!Number.isFinite(priceMax) || priceMax < 0)) ||
    (priceMin != null && priceMax != null && priceMin > priceMax)
  ) {
    return { state: "conflict", reasons: ["legacy_price_invalid"] };
  }

  const explicit = input.explicitPriceSourceUrl
    ? normalizeComparableUrl(input.explicitPriceSourceUrl)
    : null;
  const buy = input.buyLink ? normalizeComparableUrl(input.buyLink) : null;
  if (explicit && buy && explicit === buy) {
    return { state: "verified", reasons: ["explicit_price_source_matches_buy_link"] };
  }

  const source = input.sourceUrl ? normalizeComparableUrl(input.sourceUrl) : null;
  if (source && buy && source === buy) {
    return {
      state: "unknown",
      reasons: ["source_url_matches_buy_link_but_price_provenance_not_explicit"],
    };
  }

  return {
    state: "unknown",
    reasons: ["legacy_product_price_has_no_explicit_offer_provenance"],
  };
}

export function classifyLegacyOffer(
  input: LegacyCommercialInput,
  rules: OfferSourceRules,
): LegacyOfferClassification {
  const link = classifyLink(input.buyLink, rules);
  const price = classifyPrice(input);
  let migrationDecision: MigrationDecision;

  if (link.role === "reference_page" || link.role === "listing_page") {
    migrationDecision = "DO_NOT_MIGRATE";
  } else if (link.role !== "seller_page" || link.state !== "verified") {
    migrationDecision = "REVIEW_REQUIRED";
  } else if (price.state === "conflict") {
    migrationDecision = "REVIEW_REQUIRED";
  } else if (price.state === "verified") {
    migrationDecision = "AUTO_READY";
  } else {
    migrationDecision = "LINK_ONLY_READY";
  }

  return {
    schemaVersion: "legacy_offer_classification_v1",
    productId: input.productId,
    brand: input.brand,
    name: input.name,
    host: link.host,
    normalizedUrl: link.normalizedUrl,
    canonicalListingUrl: link.canonicalListingUrl,
    listingId: link.listingId,
    linkRole: link.role,
    linkState: link.state,
    sellerKey: link.sellerKey,
    priceState: price.state,
    priceMin: input.priceMin,
    priceMax: input.priceMax,
    migrationDecision,
    reasons: [...link.reasons, ...price.reasons],
  };
}
