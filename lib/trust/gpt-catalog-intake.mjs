import {
  canonicalizeOfficialHtmlTextV1,
  fetchOfficialBytes,
  sha256Hex
} from "./official-source-fetch.mjs";

export const GPT_CATALOG_RESEARCH_CONTRACT = "gpt-catalog-research-v1";

export const GPT_CATALOG_SUPPORTED_CATEGORIES = Object.freeze([
  "cleanser",
  "toner_essence",
  "toner_pad",
  "treatment",
  "moisturizer",
  "moisturizer_lotion_emulsion",
  "moisturizer_gel",
  "moisturizer_cream",
  "moisturizer_balm",
  "sunscreen"
]);

const UUIDISH_REQUEST = /^[A-Za-z0-9._:-]{8,160}$/;
const SHA256 = /^[0-9a-f]{64}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;

export class GptCatalogIntakeError extends Error {
  constructor(code, detail = null) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "GptCatalogIntakeError";
    this.code = code;
    this.detail = detail;
  }
}

function record(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value, maxLength, { required = true } = {}) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    if (required) throw new GptCatalogIntakeError("gpt_catalog_text_required");
    return null;
  }
  if (normalized.length > maxLength || CONTROL.test(normalized)) {
    throw new GptCatalogIntakeError("gpt_catalog_text_invalid");
  }
  return normalized;
}

function normalizeIdentity(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[™®©]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(value) {
  return [...new Set(
    normalizeIdentity(value)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  )];
}

function pageContainsIdentity(bytes, brand, productName) {
  const page = normalizeIdentity(canonicalizeOfficialHtmlTextV1(bytes));
  const compactPage = page.replace(/\s+/g, "");
  const brandNormalized = normalizeIdentity(brand);
  const nameNormalized = normalizeIdentity(productName);
  const brandTokens = significantTokens(brand);
  const nameTokens = significantTokens(productName);
  const brandMatched =
    (brandNormalized && page.includes(brandNormalized)) ||
    brandTokens.some((token) => page.includes(token));
  const exactNameMatched =
    nameNormalized && (
      page.includes(nameNormalized) ||
      compactPage.includes(nameNormalized.replace(/\s+/g, ""))
    );
  const matchedNameTokens = nameTokens.filter((token) => page.includes(token));
  const coverage = nameTokens.length ? matchedNameTokens.length / nameTokens.length : 0;
  const productMatched = exactNameMatched || coverage >= 0.5 || matchedNameTokens.length >= 2;

  if (!productMatched || (!brandMatched && coverage < 0.75)) {
    throw new GptCatalogIntakeError(
      "gpt_catalog_official_identity_not_observed",
      `brandMatched=${brandMatched};productCoverage=${coverage.toFixed(2)}`
    );
  }

  return {
    brandMatched,
    productMatched,
    productTokenCoverage: Number(coverage.toFixed(4)),
    matchedProductTokens: matchedNameTokens
  };
}

function normalizeProvider(provider, brand, productName) {
  if (!record(provider)) {
    throw new GptCatalogIntakeError("gpt_catalog_identity_provider_invalid");
  }
  const normalized = {
    provider: text(provider.provider, 80),
    locator: text(provider.locator, 2048),
    canonical_brand: text(provider.canonical_brand, 200),
    canonical_name: text(provider.canonical_name, 300)
  };
  let locator;
  try {
    locator = new URL(normalized.locator);
  } catch {
    throw new GptCatalogIntakeError("gpt_catalog_identity_provider_url_invalid");
  }
  if (locator.protocol !== "https:" || locator.username || locator.password) {
    throw new GptCatalogIntakeError("gpt_catalog_identity_provider_url_invalid");
  }
  if (
    normalizeIdentity(normalized.canonical_brand) !== normalizeIdentity(brand) ||
    normalizeIdentity(normalized.canonical_name) !== normalizeIdentity(productName)
  ) {
    throw new GptCatalogIntakeError("gpt_catalog_identity_provider_mismatch");
  }
  return normalized;
}

export function validateGptCatalogResearchInput(input) {
  if (!record(input)) throw new GptCatalogIntakeError("gpt_catalog_input_invalid");

  const requestId = text(input.request_id, 160);
  if (!UUIDISH_REQUEST.test(requestId)) {
    throw new GptCatalogIntakeError("gpt_catalog_request_id_invalid");
  }

  const brand = text(input.brand, 200);
  const productName = text(input.product_name, 300);
  const category = text(input.category, 80).toLowerCase();
  const market = text(input.market, 16).toUpperCase();
  const locale = text(input.locale, 32, { required: false });
  const officialUrl = text(input.official_url, 2048);
  const officialExternalId = text(input.official_external_id, 240, { required: false });

  if (!/^[A-Z0-9_-]{2,16}$/.test(market)) {
    throw new GptCatalogIntakeError("gpt_catalog_market_invalid");
  }

  let parsedOfficial;
  try {
    parsedOfficial = new URL(officialUrl);
  } catch {
    throw new GptCatalogIntakeError("gpt_catalog_official_url_invalid");
  }
  if (
    parsedOfficial.protocol !== "https:" ||
    parsedOfficial.username ||
    parsedOfficial.password
  ) {
    throw new GptCatalogIntakeError("gpt_catalog_official_url_invalid");
  }

  const evidence = record(input.identity_evidence) ? input.identity_evidence : null;
  const providers = Array.isArray(evidence?.providers)
    ? evidence.providers.map((provider) => normalizeProvider(provider, brand, productName))
    : [];
  if (providers.length < 2 || providers.length > 10) {
    throw new GptCatalogIntakeError("gpt_catalog_identity_provider_count_invalid");
  }
  if (new Set(providers.map((provider) => provider.provider.toLowerCase())).size < 2) {
    throw new GptCatalogIntakeError("gpt_catalog_identity_provider_diversity_required");
  }
  if (!providers.some((provider) => provider.provider.toLowerCase().includes("official"))) {
    throw new GptCatalogIntakeError("gpt_catalog_official_identity_provider_required");
  }

  return {
    requestId,
    payload: {
      contract_version: GPT_CATALOG_RESEARCH_CONTRACT,
      brand,
      product_name: productName,
      category,
      market,
      ...(locale ? { locale } : {}),
      official_url: officialUrl,
      ...(officialExternalId ? { official_external_id: officialExternalId } : {}),
      identity_evidence: { providers }
    }
  };
}

export async function prepareGptCatalogResearchPayload(input, fetchImpl = fetch) {
  const validated = validateGptCatalogResearchInput(input);
  const fetched = await fetchOfficialBytes(validated.payload.official_url, fetchImpl);
  const identityObservation = pageContainsIdentity(
    fetched.bytes,
    validated.payload.brand,
    validated.payload.product_name
  );
  const contentDigest = sha256Hex(fetched.bytes);
  if (!SHA256.test(contentDigest)) {
    throw new GptCatalogIntakeError("gpt_catalog_official_digest_invalid");
  }

  return {
    requestId: validated.requestId,
    payload: {
      ...validated.payload,
      official_fetch: {
        final_url: fetched.finalUrl,
        content_digest: contentDigest,
        content_type: fetched.contentType,
        fetched_at: new Date().toISOString(),
        identity_observation: identityObservation
      }
    }
  };
}
