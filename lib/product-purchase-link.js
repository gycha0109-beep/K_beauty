const NAVER_SHOPPING_SEARCH_BASE = "https://search.shopping.naver.com/search/all";
const MAX_DIRECT_URL_LENGTH = 2048;
const MAX_SEARCH_TERM_LENGTH = 96;
const MAX_SEARCH_QUERY_LENGTH = 180;
const MAX_PAYLOAD_DEPTH = 24;
const MAX_PAYLOAD_ARRAY_LENGTH = 200;
const MAX_PAYLOAD_OBJECT_KEYS = 200;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;
const IPV4_LITERAL_PATTERN = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const PURCHASE_URL_ALIASES = Object.freeze([
  "buy_link",
  "buyLink",
  "purchase_url",
  "purchaseUrl",
  "purchaseLink",
  "product_url",
  "productUrl",
  "external_url",
  "externalUrl",
  "source_url",
  "sourceUrl",
  "href",
  "link",
  "url"
]);
const PURCHASE_URL_ALIAS_SET = new Set(PURCHASE_URL_ALIASES);
const DANGEROUS_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const PLATFORM_LINK_SOURCES = [
  {
    source: "olive_young",
    hostnames: new Set(["oliveyoung.co.kr", "www.oliveyoung.co.kr", "m.oliveyoung.co.kr"]),
    matchesPath: (pathname) => /^\/store\/goods\/getGoodsDetail(?:\.do)?\/?$/i.test(pathname)
  },
  {
    source: "hwahae",
    hostnames: new Set(["www.hwahae.co.kr"]),
    matchesPath: (pathname) => /^\/(?:goods\/[^/]+|products\/\d+)\/?$/i.test(pathname)
  }
];

const OFFICIAL_BRAND_LINK_SOURCES = [
  { brand: "anua", source: "official:anua", hostnames: new Set(["anua.com"]), path: /^\/products\/[^/]+\/?$/i },
  {
    brand: "beautyofjoseon",
    source: "official:beautyofjoseon",
    hostnames: new Set(["beautyofjoseon.com"]),
    path: /^\/products\/[^/]+\/?$/i
  },
  { brand: "skin1004", source: "official:skin1004", hostnames: new Set(["www.skin1004.com"]), path: /^\/products\/[^/]+\/?$/i },
  { brand: "purito", source: "official:purito", hostnames: new Set(["purito.com"]), path: /^\/product\/[^/]+\/?$/i },
  { brand: "aestura", source: "official:aestura", hostnames: new Set(["int.aestura.com"]), path: /^\/products\/[^/]+\/?$/i },
  { brand: "drg", source: "official:drg", hostnames: new Set(["dr-g.com"]), path: /^\/products\/[^/]+\/?$/i },
  {
    brand: "roundlab",
    source: "official:roundlab",
    hostnames: new Set(["roundlab.com", "roundlabcosmetics.com"]),
    path: /^\/products\/[^/]+\/?$/i
  }
];

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeSourceHint(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizePurchaseBrand(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "");
}

export function normalizePurchaseSearchTerm(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKC")
    .replace(CONTROL_CHARACTER_PATTERN, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_SEARCH_TERM_LENGTH);
}

function isLocalOrIpLiteral(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    IPV4_LITERAL_PATTERN.test(normalized) ||
    (normalized.startsWith("[") && normalized.endsWith("]"))
  );
}

function resolveTrustedSource({ hostname, pathname, brand, sourceHint }) {
  const candidates = [
    ...PLATFORM_LINK_SOURCES.map((entry) => ({
      ...entry,
      matches: entry.hostnames.has(hostname) && entry.matchesPath(pathname)
    })),
    ...OFFICIAL_BRAND_LINK_SOURCES.map((entry) => ({
      ...entry,
      matches:
        entry.brand === brand &&
        entry.hostnames.has(hostname) &&
        entry.path.test(pathname)
    }))
  ];

  return candidates.find((entry) => entry.matches && (!sourceHint || entry.source === sourceHint)) || null;
}

export function resolveProductPurchaseLink({ buyLink, brand, name, sourceHint } = {}) {
  const fallback = buildNaverShoppingFallback({ brand, name });

  if (
    typeof buyLink !== "string" ||
    !buyLink ||
    buyLink !== buyLink.trim() ||
    buyLink.length > MAX_DIRECT_URL_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(buyLink)
  ) {
    return fallback;
  }

  let parsed;
  try {
    parsed = new URL(buyLink);
  } catch {
    return fallback;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== "443") ||
    !hostname ||
    hostname.endsWith(".") ||
    isLocalOrIpLiteral(hostname)
  ) {
    return fallback;
  }

  const trustedSource = resolveTrustedSource({
    hostname,
    pathname: parsed.pathname,
    brand: normalizePurchaseBrand(brand),
    sourceHint: normalizeSourceHint(sourceHint)
  });

  if (!trustedSource) {
    return fallback;
  }

  return {
    kind: "direct",
    href: parsed.toString(),
    source: trustedSource.source
  };
}

export function buildNaverShoppingFallback({ brand, name } = {}) {
  const query = [normalizePurchaseSearchTerm(brand), normalizePurchaseSearchTerm(name)]
    .filter(Boolean)
    .join(" ")
    .slice(0, MAX_SEARCH_QUERY_LENGTH);

  if (!query) {
    return { kind: "none", href: null, source: null };
  }

  const url = new URL(NAVER_SHOPPING_SEARCH_BASE);
  url.searchParams.set("query", query);

  return {
    kind: "fallback",
    href: url.toString(),
    source: "naver_shopping"
  };
}

export function getTrustedDirectPurchaseUrl({ buyLink, brand, name, sourceHint } = {}) {
  const result = resolveProductPurchaseLink({ buyLink, brand, name, sourceHint });
  return result.kind === "direct" ? result.href : "";
}

function getFirstPurchaseUrlAlias(value) {
  for (const key of PURCHASE_URL_ALIASES) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      return value[key];
    }
  }

  return undefined;
}

function isRecognizedProductNode(callback, context) {
  if (typeof callback !== "function") {
    return false;
  }

  try {
    return callback(context) === true;
  } catch {
    return false;
  }
}

/**
 * Clones JSON-shaped response data while stripping every raw purchase URL alias.
 * A caller must explicitly recognize product nodes before a resolver-owned URL
 * can be written back to the canonical buy_link field.
 */
export function sanitizePurchaseLinkPayload(value, { isProductNode } = {}) {
  const seen = new WeakSet();

  const visit = (current, path = []) => {
    if (current === null || typeof current !== "object") {
      return current;
    }

    if (path.length > MAX_PAYLOAD_DEPTH || seen.has(current)) {
      return null;
    }

    seen.add(current);

    if (Array.isArray(current)) {
      if (current.length > MAX_PAYLOAD_ARRAY_LENGTH) {
        return null;
      }

      return current.map((item, index) => visit(item, [...path, index]));
    }

    if (!isPlainObject(current)) {
      return null;
    }

    const keys = Object.keys(current);
    if (keys.length > MAX_PAYLOAD_OBJECT_KEYS) {
      return null;
    }

    const next = {};
    for (const key of keys) {
      if (DANGEROUS_OBJECT_KEYS.has(key) || PURCHASE_URL_ALIAS_SET.has(key)) {
        continue;
      }

      next[key] = visit(current[key], [...path, key]);
    }

    if (isRecognizedProductNode(isProductNode, { value: current, path })) {
      const resolved = resolveProductPurchaseLink({
        buyLink: getFirstPurchaseUrlAlias(current),
        brand: current.brand,
        name: current.name,
        sourceHint: current.purchase_source
      });

      if (resolved.kind !== "none") {
        next.buy_link = resolved.href;
      }
    }

    return next;
  };

  return visit(value);
}

function isArrayEntry(path, parentKey) {
  return path.length === 2 && path[0] === parentKey && Number.isInteger(path[1]);
}

function isPremiumReportProductNode({ value, path }) {
  if (
    path.length === 2 &&
    path[0] === "freeResult" &&
    ["topPick", "alternative"].includes(path[1])
  ) {
    return true;
  }

  if (
    path.length === 3 &&
    path[0] === "freeResult" &&
    ["products", "categoryPicks", "altPicks", "explanationProducts"].includes(path[1]) &&
    Number.isInteger(path[2])
  ) {
    return true;
  }

  if (isArrayEntry(path, "supportingProducts")) {
    return !isPlainObject(value.product);
  }

  if (
    path.length === 3 &&
    path[0] === "supportingProducts" &&
    Number.isInteger(path[1]) &&
    path[2] === "product"
  ) {
    return true;
  }

  if (
    path.length === 4 &&
    path[0] === "fullRoutine" &&
    ["morningSteps", "nightSteps"].includes(path[1]) &&
    Number.isInteger(path[2]) &&
    path[3] === "product"
  ) {
    return true;
  }

  if (isArrayEntry(path, "budgetAlternatives")) {
    return true;
  }

  return (
    path.length === 3 &&
    path[0] === "currentProductVerdicts" &&
    Number.isInteger(path[1]) &&
    path[2] === "product"
  );
}

export function sanitizePremiumReportPurchaseLinks(report) {
  if (!isPlainObject(report)) {
    return {};
  }

  return sanitizePurchaseLinkPayload(report, { isProductNode: isPremiumReportProductNode });
}

export function sanitizeAnalyzeResultPurchaseLinks(payload) {
  if (!isPlainObject(payload)) {
    return {};
  }

  return sanitizePurchaseLinkPayload(payload, {
    isProductNode: ({ path }) => path.length === 1 && ["topPick", "alternative"].includes(path[0])
  });
}

export function projectProductPurchaseLink(product) {
  if (!isPlainObject(product)) {
    return null;
  }

  return sanitizePurchaseLinkPayload(product, {
    isProductNode: ({ path }) => path.length === 0
  });
}

export const PRODUCT_PURCHASE_LINK_LIMITS = {
  maxDirectUrlLength: MAX_DIRECT_URL_LENGTH,
  maxSearchTermLength: MAX_SEARCH_TERM_LENGTH,
  maxSearchQueryLength: MAX_SEARCH_QUERY_LENGTH,
  maxPayloadDepth: MAX_PAYLOAD_DEPTH,
  maxPayloadArrayLength: MAX_PAYLOAD_ARRAY_LENGTH,
  maxPayloadObjectKeys: MAX_PAYLOAD_OBJECT_KEYS
};

export const PRODUCT_PURCHASE_URL_ALIASES = PURCHASE_URL_ALIASES;
