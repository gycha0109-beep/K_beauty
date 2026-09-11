import {
  admitSellerListingParserFixtureV1,
  decodeAdmittedSellerListingParserFixturePayloadV1,
} from "./seller-listing-parser-fixture-v1.js";
import {
  TORRIDEN_PUBLIC_CAPTURE_TARGET,
  TORRIDEN_PUBLIC_CAPTURE_VERSION,
} from "./torriden-public-listing-capture-v1.js";

export const TORRIDEN_PUBLIC_LISTING_PARSER_VERSION =
  "torriden-public-product-html-parser-v1";

export class TorridenPublicListingParserError extends Error {
  constructor(code, options = {}) {
    super(code, options);
    this.name = "TorridenPublicListingParserError";
    this.code = code;
  }
}

function fail(code, cause) {
  throw new TorridenPublicListingParserError(code, cause ? { cause } : undefined);
}

function requireAuthority(fixture) {
  if (fixture.evidence.seller !== "torriden_official") {
    fail("torriden_public_parser_seller_mismatch");
  }
  if (fixture.evidence.listing_url !== TORRIDEN_PUBLIC_CAPTURE_TARGET) {
    fail("torriden_public_parser_listing_url_mismatch");
  }
  if (fixture.evidence.source_version !== TORRIDEN_PUBLIC_CAPTURE_VERSION) {
    fail("torriden_public_parser_source_version_mismatch");
  }
  if (
    typeof fixture.evidence.content_type !== "string" ||
    !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(
      fixture.evidence.content_type.trim(),
    )
  ) {
    fail("torriden_public_parser_content_type_mismatch");
  }
}

function requireConsensus(label, values) {
  const normalized = values.map((value) => String(value).trim());
  if (normalized.some((value) => !value)) {
    fail(`torriden_public_parser_${label}_empty_signal`);
  }
  if (new Set(normalized).size !== 1) {
    fail(`torriden_public_parser_${label}_conflict`);
  }
  return normalized[0];
}

function requireConsensusMatches(html, regex, label, missingCode) {
  const matches = [...html.matchAll(regex)].map((match) => match[1]);
  if (matches.length === 0) fail(missingCode);
  return requireConsensus(label, matches);
}

function parseListingId(html) {
  const globalGoodsNo = requireConsensusMatches(
    html,
    /\bvar\s+goodsNo\s*=\s*['"]([0-9]+)['"]\s*;/g,
    "goods_no_global",
    "torriden_public_parser_goods_no_global_missing",
  );
  const controllerGoodsNo = requireConsensusMatches(
    html,
    /['"]setGoodsNo['"]\s*:\s*['"]([0-9]+)['"]/g,
    "goods_no_controller",
    "torriden_public_parser_goods_no_controller_missing",
  );
  const listingId = requireConsensus("goods_no", [globalGoodsNo, controllerGoodsNo]);

  const target = new URL(TORRIDEN_PUBLIC_CAPTURE_TARGET).searchParams.get("goodsNo");
  if (listingId !== target) fail("torriden_public_parser_goods_no_target_mismatch");
  return listingId;
}

function parsePrice(html) {
  const controllerPrice = requireConsensusMatches(
    html,
    /['"]setGoodsPrice['"]\s*:\s*['"]([0-9]+(?:\.[0-9]+)?)['"]/g,
    "controller_price",
    "torriden_public_parser_controller_price_missing",
  );
  const hiddenPrice = requireConsensusMatches(
    html,
    /<input\b(?=[^>]*\bname=['"]set_goods_price['"])(?=[^>]*\bvalue=['"]([0-9]+(?:\.[0-9]+)?)['"])[^>]*>/gi,
    "hidden_price",
    "torriden_public_parser_hidden_price_missing",
  );

  const controllerAmount = Number(controllerPrice);
  const hiddenAmount = Number(hiddenPrice);
  if (!Number.isFinite(controllerAmount) || !Number.isFinite(hiddenAmount)) {
    fail("torriden_public_parser_price_not_finite");
  }
  if (controllerAmount < 0 || hiddenAmount < 0) {
    fail("torriden_public_parser_price_negative");
  }
  if (controllerAmount !== hiddenAmount) {
    fail("torriden_public_parser_price_conflict");
  }

  const currencyCode = requireConsensusMatches(
    html,
    /\bvar\s+gdCurrencyCode\s*=\s*['"]([A-Z]{3})['"]\s*;/g,
    "currency_code",
    "torriden_public_parser_currency_code_missing",
  );
  const baseCurrency = requireConsensusMatches(
    html,
    /\bfx\.base\s*=\s*['"]([A-Z]{3})['"]\s*;/g,
    "base_currency",
    "torriden_public_parser_base_currency_missing",
  );
  const currency = requireConsensus("currency", [currencyCode, baseCurrency]);
  if (currency !== "KRW") fail("torriden_public_parser_currency_not_krw");

  return Object.freeze({ amount: hiddenAmount, currency });
}

function hasActiveButton(html, className, label) {
  const pattern = new RegExp(
    `<button\\b(?=[^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'])[^>]*>\\s*${label}\\s*</button>`,
    "i",
  );
  return pattern.test(html);
}

function parseAvailability(html) {
  const buyButton = hasActiveButton(html, "btn_add_order", "바로 구매");
  const cartButton = hasActiveButton(html, "btn_add_cart", "장바구니 담기");
  const naverPayEnabled = /\bENABLE\s*:\s*['"]Y['"]/i.test(html);
  const unlimitedControllerStock =
    /['"]setStockFl['"]\s*:\s*['"]n['"]/i.test(html) &&
    /['"]setStockCnt['"]\s*:\s*['"]∞['"]/u.test(html);
  const unlimitedHiddenStock =
    /<input\b(?=[^>]*\bname=['"]set_goods_stock['"])(?=[^>]*\bvalue=['"]∞['"])[^>]*>/iu.test(
      html,
    );

  return buyButton &&
    cartButton &&
    naverPayEnabled &&
    unlimitedControllerStock &&
    unlimitedHiddenStock
    ? "in_stock"
    : "unknown";
}

export function parseTorridenCapturedListingFixtureV1(input) {
  const fixture = admitSellerListingParserFixtureV1(input);
  requireAuthority(fixture);

  const payload = decodeAdmittedSellerListingParserFixturePayloadV1(fixture);
  const html = payload.toString("utf8");
  if (!html.trim()) fail("torriden_public_parser_empty_html");
  if (html.includes("\u0000")) fail("torriden_public_parser_nul_byte");

  const listingId = parseListingId(html);
  const price = parsePrice(html);
  const availability = parseAvailability(html);

  return Object.freeze({
    listing_id: listingId,
    price,
    availability,
  });
}
