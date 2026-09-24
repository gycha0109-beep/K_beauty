const CLAIM_KEYS = new Set(["observed_claim", "current_direct_claim", "direct_claim"]);
const IDENTITY_KEYS = new Set(["current_name"]);
const PRODUCT_JSONLD_KEYS = new Set([
  "@type", "name", "description", "brand", "category", "sku", "mpn",
  "gtin", "gtin8", "gtin12", "gtin13", "gtin14", "material", "size",
  "additionalProperty", "keywords"
]);

function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export function normalizeSemanticTextV1(value) {
  return decodeEntities(value)
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleText(html) {
  return normalizeSemanticTextV1(
    String(html)
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function parseAttributes(tag) {
  const out = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+))/g;
  for (const match of tag.matchAll(pattern)) {
    out[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return out;
}

function extractMeta(html, key) {
  for (const match of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const identity = String(attrs.name || attrs.property || "").toLowerCase();
    if (identity === key.toLowerCase() && attrs.content) return normalizeSemanticTextV1(attrs.content);
  }
  return null;
}

function extractTitle(html) {
  const match = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return match ? normalizeSemanticTextV1(match[1].replace(/<[^>]+>/g, " ")) : null;
}

function canonicalizeJson(value) {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!value || typeof value !== "object") return typeof value === "string" ? normalizeSemanticTextV1(value) : value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalizeJson(value[key])])
  );
}

function productType(value) {
  const types = Array.isArray(value) ? value : [value];
  return types.some((item) => String(item).toLowerCase() === "product");
}

function projectProductJsonLd(value) {
  if (Array.isArray(value)) return value.map(projectProductJsonLd).filter((item) => item !== undefined);
  if (!value || typeof value !== "object") return typeof value === "string" ? normalizeSemanticTextV1(value) : value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (!PRODUCT_JSONLD_KEYS.has(key)) continue;
    if (key === "brand") {
      const brand = value[key];
      if (typeof brand === "string") out.brand = normalizeSemanticTextV1(brand);
      else if (brand && typeof brand === "object") {
        const name = normalizeSemanticTextV1(brand.name || "");
        if (name) out.brand = { name };
      }
      continue;
    }
    out[key] = projectProductJsonLd(value[key]);
  }
  return canonicalizeJson(out);
}

function extractProductJsonLd(html) {
  const products = [];
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const match of String(html).matchAll(pattern)) {
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (queue.length) {
      const item = queue.shift();
      if (!item || typeof item !== "object") continue;
      if (productType(item["@type"])) {
        const projected = projectProductJsonLd(item);
        if (projected.name || projected.description) products.push(projected);
      }
      if (Array.isArray(item["@graph"])) queue.push(...item["@graph"]);
    }
  }
  return products
    .map(canonicalizeJson)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function collectMetadataAnchors(metadata) {
  const claims = [];
  const identities = [];
  const seen = new Set();

  function add(kind, path, raw) {
    const value = normalizeSemanticTextV1(raw || "");
    if (value.length < 3) return;
    const token = `${kind}:\0${value}`;
    if (seen.has(token)) return;
    seen.add(token);
    (kind === "claim" ? claims : identities).push({ path, value });
  }

  function walk(value, path = []) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const next = [...path, key];
      if (typeof child === "string" && CLAIM_KEYS.has(key)) add("claim", next.join("."), child);
      if (typeof child === "string" && IDENTITY_KEYS.has(key)) add("identity", next.join("."), child);
      if (child && typeof child === "object" && !Array.isArray(child)) walk(child, next);
    }
  }

  walk(metadata || {});
  return { claims, identities };
}

function anchorObservation(canonicalText, metadata) {
  const candidates = collectMetadataAnchors(metadata);
  const check = (entry) => ({
    path: entry.path,
    value: entry.value,
    present: canonicalText.includes(entry.value),
  });
  return {
    claims: candidates.claims.map(check),
    identities: candidates.identities.map(check),
  };
}

function semanticSurfaceCorpus(html, products) {
  return {
    visible_text: visibleText(html),
    title: extractTitle(html) || "",
    meta_title: extractMeta(html, "title") || "",
    og_title: extractMeta(html, "og:title") || "",
    meta_description: extractMeta(html, "description") || "",
    og_description: extractMeta(html, "og:description") || "",
    structured_products: normalizeSemanticTextV1(JSON.stringify(products || [])),
  };
}

function diagnosticAnchorObservation(surfaces, metadata) {
  const candidates = collectMetadataAnchors(metadata);
  const check = (entry) => {
    const matches = Object.entries(surfaces)
      .filter(([, value]) => value.includes(entry.value))
      .map(([surface]) => surface);
    return {
      path: entry.path,
      value: entry.value,
      present: matches.length > 0,
      surfaces: matches,
    };
  };
  return {
    claims: candidates.claims.map(check),
    identities: candidates.identities.map(check),
  };
}

export function inspectOfficialProductSemanticSurfacesV1(bytes, {
  sourceMetadata = {},
} = {}) {
  const html = Buffer.from(bytes).toString("utf8");
  const products = extractProductJsonLd(html);
  const surfaces = semanticSurfaceCorpus(html, products);
  return canonicalizeJson({
    document: {
      title: extractTitle(html),
      meta_title: extractMeta(html, "title"),
      og_title: extractMeta(html, "og:title"),
      meta_description: extractMeta(html, "description"),
      og_description: extractMeta(html, "og:description"),
    },
    structured_product_count: products.length,
    structured_product_names: products
      .map((item) => normalizeSemanticTextV1(item?.name || ""))
      .filter(Boolean),
    anchor_probes: diagnosticAnchorObservation(surfaces, sourceMetadata),
    surface_lengths: Object.fromEntries(
      Object.entries(surfaces).map(([key, value]) => [key, value.length])
    ),
  });
}

export function buildOfficialProductSemanticObservationV1(bytes, {
  sourceMetadata = {},
  canonicalLocator = null,
} = {}) {
  const html = Buffer.from(bytes).toString("utf8");
  const canonicalText = visibleText(html);
  const anchors = anchorObservation(canonicalText, sourceMetadata);
  const products = extractProductJsonLd(html);
  const claimCandidates = anchors.claims.length;
  const missingClaims = anchors.claims.filter((item) => !item.present);

  if (claimCandidates > 0 && missingClaims.length > 0) {
    const error = new Error("SOURCE_SEMANTIC_ADAPTER_REQUIRED_ANCHOR_MISSING");
    error.semanticStatus = "AMBIGUOUS";
    error.missingAnchorPaths = missingClaims.map((item) => item.path);
    throw error;
  }

  const supportedByClaims = claimCandidates > 0;
  const supportedByStructuredProduct = products.some((item) => item.name && item.description);
  if (!supportedByClaims && !supportedByStructuredProduct) {
    const error = new Error("SOURCE_SEMANTIC_ADAPTER_UNSUPPORTED");
    error.semanticStatus = "UNSUPPORTED";
    throw error;
  }

  return canonicalizeJson({
    contract: "canonical-official-product-semantics-v1",
    canonical_locator: canonicalLocator || null,
    document: {
      title: extractTitle(html),
      description: extractMeta(html, "description") || extractMeta(html, "og:description"),
    },
    evidence_anchors: {
      claims: anchors.claims,
      identities: anchors.identities.filter((item) => item.present),
    },
    structured_products: products,
  });
}

export function stableSemanticJsonV1(value) {
  return JSON.stringify(canonicalizeJson(value));
}
