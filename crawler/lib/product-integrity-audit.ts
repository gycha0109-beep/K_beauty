export type IntegritySeverity = "info" | "gap" | "review" | "blocker";

export type IntegrityIssueCode =
  | "LEGACY_EXTERNAL_BINDING_MISSING"
  | "LEGACY_BUY_LINK_MISSING"
  | "LEGACY_BUY_LINK_REVIEW_REQUIRED"
  | "LEGACY_BUY_LINK_NOT_SELLER_OFFER"
  | "CURRENT_OFFER_MISSING"
  | "CURRENT_OFFER_DUPLICATE_SELLER_LISTING"
  | "SUBJECT_IDENTITY_UNRESOLVED"
  | "SUBJECT_NOT_CURRENT"
  | "LEGACY_FACT_CURRENT_MISSING"
  | "CURRENT_FACT_LEGACY_MISSING"
  | "LEGACY_FACT_VALUE_DIVERGENCE";

export type IntegrityProduct = {
  id: string;
  brand: string | null;
  name: string | null;
  normalized_brand: string;
  normalized_name: string;
  buy_link: string | null;
  price_min: number | null;
  price_max: number | null;
  external_source: string | null;
  external_type: string | null;
  external_id: string | null;
  spf_value: string | null;
  uva_label: string | null;
  uv_filter_type: string | null;
};

export type IntegritySourceBinding = {
  product_id: string;
  source_name: string;
  external_type: string;
  external_id: string;
  binding_state: string;
  product_scope_state: string;
};

export type IntegrityOffer = {
  offer_id: string;
  product_id: string;
  seller_key: string;
  listing_id: string | null;
  listing_url: string;
  offer_state: string;
  availability_state: string;
  product_scope_state: string;
};

export type IntegritySubject = {
  subject_id: string;
  product_id: string;
  identity_status: string;
  current_state: string;
  market_applicability: string | null;
  variant_key: string | null;
  formulation_revision_key: string;
};

export type IntegrityCurrentFact = {
  product_id: string;
  subject_id: string;
  fact_key: string;
  semantic_status: string;
  market: string | null;
  value_number: number | string | null;
  value_enum: string | null;
};

export type IntegrityLegacyOfferClassification = {
  productId: string;
  migrationDecision: "AUTO_READY" | "LINK_ONLY_READY" | "REVIEW_REQUIRED" | "DO_NOT_MIGRATE";
  linkRole: "seller_page" | "reference_page" | "listing_page" | "unknown";
  linkState: "verified" | "unknown" | "conflict" | "not_applicable";
  sellerKey: string | null;
  listingId: string | null;
  canonicalListingUrl: string | null;
  reasons: string[];
};

export type IntegrityIssue = {
  code: IntegrityIssueCode;
  severity: IntegritySeverity;
  productId: string;
  subjectId: string | null;
  factKey: string | null;
  detail: string;
  comparisonAuthority: boolean;
};

export type ProductIntegrityRow = {
  productId: string;
  brand: string | null;
  name: string | null;
  identityStatus: "ok" | "review" | "blocker";
  trustStatus: "not_adopted" | "ok" | "review" | "blocker";
  commerceStatus: "legacy_only" | "offer_ready" | "review" | "blocker";
  issues: IntegrityIssue[];
};

export type ProductIntegrityAudit = {
  schemaVersion: "product_integrity_audit_v1";
  productCount: number;
  issueCount: number;
  severityCounts: Record<IntegritySeverity, number>;
  issueCounts: Partial<Record<IntegrityIssueCode, number>>;
  commerceCoverage: {
    legacyBuyLinks: number;
    currentOffers: number;
    productsWithCurrentOffers: number;
    productsWithoutCurrentOffers: number;
  };
  trustCoverage: {
    subjects: number;
    productsWithSubjects: number;
    currentFacts: number;
  };
  rows: ProductIntegrityRow[];
};

const FACT_KEYS = ["spf_value", "uva_label", "uv_filter_type"] as const;
type ComparableFactKey = (typeof FACT_KEYS)[number];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSpf(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).toUpperCase().match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) ? String(number) : null;
}

function normalizeUva(value: unknown): string | null {
  const normalized = text(value).toUpperCase().replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeUvFilter(value: unknown): string | null {
  const normalized = text(value).toLowerCase().replace(/[\s_-]+/g, "");
  if (!normalized) return null;
  if (["organic", "chemical", "유기자차"].includes(normalized)) return "organic";
  if (["mineral", "physical", "무기자차"].includes(normalized)) return "mineral";
  if (["hybrid", "mixed", "혼합자차"].includes(normalized)) return "hybrid";
  return normalized;
}

function normalizeLegacyFact(product: IntegrityProduct, factKey: ComparableFactKey): string | null {
  if (factKey === "spf_value") return normalizeSpf(product.spf_value);
  if (factKey === "uva_label") return normalizeUva(product.uva_label);
  return normalizeUvFilter(product.uv_filter_type);
}

function normalizeCurrentFact(fact: IntegrityCurrentFact): string | null {
  if (fact.fact_key === "spf_value") return normalizeSpf(fact.value_number);
  if (fact.fact_key === "uva_label") return normalizeUva(fact.value_enum);
  if (fact.fact_key === "uv_filter_type") return normalizeUvFilter(fact.value_enum);
  return null;
}

function addIssue(
  issues: IntegrityIssue[],
  input: Omit<IntegrityIssue, "comparisonAuthority"> & { comparisonAuthority?: boolean },
): void {
  issues.push({ ...input, comparisonAuthority: input.comparisonAuthority === true });
}

function worstStatus(issues: IntegrityIssue[]): "ok" | "review" | "blocker" {
  if (issues.some((issue) => issue.severity === "blocker")) return "blocker";
  if (issues.some((issue) => issue.severity === "review")) return "review";
  return "ok";
}

function currentOffersForProduct(offers: IntegrityOffer[], productId: string): IntegrityOffer[] {
  return offers.filter((offer) => offer.product_id === productId && offer.offer_state === "current");
}

function hasMatchingLegacyBinding(product: IntegrityProduct, bindings: IntegritySourceBinding[]): boolean {
  const source = text(product.external_source);
  const type = text(product.external_type);
  const id = text(product.external_id);
  if (!source || !type || !id) return true;
  return bindings.some(
    (binding) =>
      binding.product_id === product.id &&
      binding.binding_state === "resolved" &&
      binding.source_name === source &&
      binding.external_type === type &&
      binding.external_id === id,
  );
}

function duplicateOfferIdentityIssues(offers: IntegrityOffer[]): Map<string, IntegrityIssue[]> {
  const byIdentity = new Map<string, IntegrityOffer[]>();
  for (const offer of offers.filter((item) => item.offer_state === "current")) {
    const identity = offer.listing_id
      ? `${offer.seller_key}\u0000id\u0000${offer.listing_id}`
      : `${offer.seller_key}\u0000url\u0000${offer.listing_url}`;
    const list = byIdentity.get(identity) ?? [];
    list.push(offer);
    byIdentity.set(identity, list);
  }

  const issues = new Map<string, IntegrityIssue[]>();
  for (const group of byIdentity.values()) {
    const productIds = new Set(group.map((offer) => offer.product_id));
    if (productIds.size <= 1) continue;
    for (const offer of group) {
      const list = issues.get(offer.product_id) ?? [];
      addIssue(list, {
        code: "CURRENT_OFFER_DUPLICATE_SELLER_LISTING",
        severity: "blocker",
        productId: offer.product_id,
        subjectId: null,
        factKey: null,
        detail: `${offer.seller_key}:${offer.listing_id ?? offer.listing_url}`,
      });
      issues.set(offer.product_id, list);
    }
  }
  return issues;
}

export function auditProductIntegrity(input: {
  products: IntegrityProduct[];
  sourceBindings: IntegritySourceBinding[];
  offers: IntegrityOffer[];
  subjects: IntegritySubject[];
  currentFacts: IntegrityCurrentFact[];
  legacyOfferClassifications: IntegrityLegacyOfferClassification[];
}): ProductIntegrityAudit {
  const classificationByProduct = new Map(
    input.legacyOfferClassifications.map((classification) => [classification.productId, classification]),
  );
  const subjectsByProduct = new Map<string, IntegritySubject[]>();
  for (const subject of input.subjects) {
    const list = subjectsByProduct.get(subject.product_id) ?? [];
    list.push(subject);
    subjectsByProduct.set(subject.product_id, list);
  }
  const factsByProduct = new Map<string, IntegrityCurrentFact[]>();
  for (const fact of input.currentFacts) {
    const list = factsByProduct.get(fact.product_id) ?? [];
    list.push(fact);
    factsByProduct.set(fact.product_id, list);
  }
  const duplicateOfferIssues = duplicateOfferIdentityIssues(input.offers);

  const rows: ProductIntegrityRow[] = input.products.map((product) => {
    const issues: IntegrityIssue[] = [...(duplicateOfferIssues.get(product.id) ?? [])];
    const subjects = subjectsByProduct.get(product.id) ?? [];
    const facts = factsByProduct.get(product.id) ?? [];
    const currentOffers = currentOffersForProduct(input.offers, product.id);
    const classification = classificationByProduct.get(product.id);

    if (!hasMatchingLegacyBinding(product, input.sourceBindings)) {
      addIssue(issues, {
        code: "LEGACY_EXTERNAL_BINDING_MISSING",
        severity: "review",
        productId: product.id,
        subjectId: null,
        factKey: null,
        detail: `${text(product.external_source)}:${text(product.external_type)}:${text(product.external_id)}`,
      });
    }

    if (!text(product.buy_link)) {
      addIssue(issues, {
        code: "LEGACY_BUY_LINK_MISSING",
        severity: "gap",
        productId: product.id,
        subjectId: null,
        factKey: null,
        detail: "products.buy_link is empty",
      });
    } else if (classification?.migrationDecision === "REVIEW_REQUIRED") {
      addIssue(issues, {
        code: "LEGACY_BUY_LINK_REVIEW_REQUIRED",
        severity: "review",
        productId: product.id,
        subjectId: null,
        factKey: null,
        detail: classification.reasons.join(","),
      });
    } else if (classification?.migrationDecision === "DO_NOT_MIGRATE") {
      addIssue(issues, {
        code: "LEGACY_BUY_LINK_NOT_SELLER_OFFER",
        severity: "gap",
        productId: product.id,
        subjectId: null,
        factKey: null,
        detail: `${classification.linkRole}:${classification.reasons.join(",")}`,
      });
    }

    if (text(product.buy_link) && currentOffers.length === 0) {
      addIssue(issues, {
        code: "CURRENT_OFFER_MISSING",
        severity: "gap",
        productId: product.id,
        subjectId: null,
        factKey: null,
        detail: "legacy purchase link exists but no current product_offers row exists",
      });
    }

    for (const subject of subjects) {
      if (subject.identity_status !== "resolved") {
        addIssue(issues, {
          code: "SUBJECT_IDENTITY_UNRESOLVED",
          severity: "review",
          productId: product.id,
          subjectId: subject.subject_id,
          factKey: null,
          detail: subject.identity_status,
        });
      }
      if (subject.current_state !== "current") {
        addIssue(issues, {
          code: "SUBJECT_NOT_CURRENT",
          severity: "info",
          productId: product.id,
          subjectId: subject.subject_id,
          factKey: null,
          detail: subject.current_state,
        });
      }
    }

    const currentByFact = new Map<ComparableFactKey, IntegrityCurrentFact[]>();
    for (const fact of facts) {
      if (!FACT_KEYS.includes(fact.fact_key as ComparableFactKey)) continue;
      const key = fact.fact_key as ComparableFactKey;
      const list = currentByFact.get(key) ?? [];
      list.push(fact);
      currentByFact.set(key, list);
    }

    for (const factKey of FACT_KEYS) {
      const legacy = normalizeLegacyFact(product, factKey);
      const currents = currentByFact.get(factKey) ?? [];
      if (legacy && currents.length === 0) {
        addIssue(issues, {
          code: "LEGACY_FACT_CURRENT_MISSING",
          severity: "info",
          productId: product.id,
          subjectId: null,
          factKey,
          detail: `legacy=${legacy}; current Product Fact absent`,
        });
        continue;
      }
      if (!legacy && currents.length > 0) {
        for (const current of currents) {
          addIssue(issues, {
            code: "CURRENT_FACT_LEGACY_MISSING",
            severity: "info",
            productId: product.id,
            subjectId: current.subject_id,
            factKey,
            detail: `current=${normalizeCurrentFact(current) ?? "unserializable"}; legacy field empty`,
          });
        }
        continue;
      }
      if (!legacy) continue;
      for (const current of currents) {
        const normalizedCurrent = normalizeCurrentFact(current);
        if (normalizedCurrent && normalizedCurrent !== legacy) {
          addIssue(issues, {
            code: "LEGACY_FACT_VALUE_DIVERGENCE",
            severity: "review",
            productId: product.id,
            subjectId: current.subject_id,
            factKey,
            detail: `legacy=${legacy}; current=${normalizedCurrent}; market=${current.market ?? "unspecified"}`,
            comparisonAuthority: false,
          });
        }
      }
    }

    const identityIssues = issues.filter((issue) =>
      ["LEGACY_EXTERNAL_BINDING_MISSING", "SUBJECT_IDENTITY_UNRESOLVED"].includes(issue.code),
    );
    const trustIssues = issues.filter((issue) =>
      [
        "SUBJECT_IDENTITY_UNRESOLVED",
        "SUBJECT_NOT_CURRENT",
        "LEGACY_FACT_CURRENT_MISSING",
        "CURRENT_FACT_LEGACY_MISSING",
        "LEGACY_FACT_VALUE_DIVERGENCE",
      ].includes(issue.code),
    );
    const commerceIssues = issues.filter((issue) =>
      [
        "LEGACY_BUY_LINK_MISSING",
        "LEGACY_BUY_LINK_REVIEW_REQUIRED",
        "LEGACY_BUY_LINK_NOT_SELLER_OFFER",
        "CURRENT_OFFER_MISSING",
        "CURRENT_OFFER_DUPLICATE_SELLER_LISTING",
      ].includes(issue.code),
    );

    const identityWorst = worstStatus(identityIssues);
    const trustWorst = worstStatus(trustIssues);
    const commerceWorst = worstStatus(commerceIssues);

    return {
      productId: product.id,
      brand: product.brand,
      name: product.name,
      identityStatus: identityWorst,
      trustStatus: subjects.length === 0 ? "not_adopted" : trustWorst,
      commerceStatus:
        currentOffers.length > 0
          ? commerceWorst === "blocker"
            ? "blocker"
            : commerceWorst === "review"
              ? "review"
              : "offer_ready"
          : commerceWorst === "blocker"
            ? "blocker"
            : commerceWorst === "review"
              ? "review"
              : "legacy_only",
      issues: issues.sort((a, b) => a.code.localeCompare(b.code)),
    };
  });

  const allIssues = rows.flatMap((row) => row.issues);
  const severityCounts: Record<IntegritySeverity, number> = { info: 0, gap: 0, review: 0, blocker: 0 };
  const issueCounts: Partial<Record<IntegrityIssueCode, number>> = {};
  for (const issue of allIssues) {
    severityCounts[issue.severity] += 1;
    issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1;
  }

  const currentOffers = input.offers.filter((offer) => offer.offer_state === "current");
  return {
    schemaVersion: "product_integrity_audit_v1",
    productCount: input.products.length,
    issueCount: allIssues.length,
    severityCounts,
    issueCounts,
    commerceCoverage: {
      legacyBuyLinks: input.products.filter((product) => Boolean(text(product.buy_link))).length,
      currentOffers: currentOffers.length,
      productsWithCurrentOffers: new Set(currentOffers.map((offer) => offer.product_id)).size,
      productsWithoutCurrentOffers: input.products.filter(
        (product) => !currentOffers.some((offer) => offer.product_id === product.id),
      ).length,
    },
    trustCoverage: {
      subjects: input.subjects.length,
      productsWithSubjects: new Set(input.subjects.map((subject) => subject.product_id)).size,
      currentFacts: input.currentFacts.length,
    },
    rows: rows.sort((a, b) => a.productId.localeCompare(b.productId)),
  };
}
