#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath } from "node:url";

register("./node-next-alias-loader.mjs", import.meta.url);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase/migrations/20260913041800_data_offer16_offer_presentation_authority_read_v1.sql",
);
const servicePath = path.join(root, "lib/server/product-offer-read-service.js");
const offerPath = path.join(root, "lib/product-offer-read-path.js");
const purchasePath = path.join(root, "lib/product-purchase-link.js");
const healthPath = path.join(root, "scripts/verify-current-main-health.mjs");

const migration = fs.readFileSync(migrationPath, "utf8");
const serviceSource = fs.readFileSync(servicePath, "utf8");
const offerSource = fs.readFileSync(offerPath, "utf8");
const purchaseSource = fs.readFileSync(purchasePath, "utf8");
const healthSource = fs.readFileSync(healthPath, "utf8");

assert.match(migration, /create role product_offer_presentation_reader_owner[\s\S]*nologin noinherit nosuperuser/i);
assert.match(migration, /security definer/i);
assert.match(migration, /set search_path = ''/i);
assert.match(migration, /read_product_offer_presentation_authority_v1\([\s\S]*uuid\[\]/i);
assert.match(migration, /cardinality\(p_product_ids\) > 64/i);
assert.match(migration, /v_offer_count > 256/i);
assert.match(migration, /revoke all privileges on public\.product_offers from recommendation_admission_runtime/i);
assert.match(migration, /grant select \([\s\S]*offer_id[\s\S]*created_at[\s\S]*\) on public\.product_offers[\s\S]*to product_offer_presentation_reader_owner/i);
assert.match(migration, /create policy data_offer16_offer_presentation_owner_select_v1[\s\S]*to product_offer_presentation_reader_owner[\s\S]*using \(true\)/i);
assert.match(migration, /revoke all on function public\.read_product_offer_presentation_authority_v1\(uuid\[\]\)[\s\S]*from public, anon, authenticated, service_role/i);
assert.match(migration, /grant execute on function public\.read_product_offer_presentation_authority_v1\(uuid\[\]\)[\s\S]*to recommendation_admission_runtime/i);
assert.match(migration, /owner to product_offer_presentation_reader_owner/i);
assert.match(migration, /DATA_OFFER16_RUNTIME_RAW_SELECT_FORBIDDEN/);
assert.match(migration, /DATA_OFFER16_RUNTIME_RAW_WRITE_FORBIDDEN/);
assert.match(migration, /DATA_OFFER16_BROAD_RPC_EXECUTE_FORBIDDEN/);
assert.doesNotMatch(migration, /grant\s+execute[\s\S]{0,180}to\s+service_role/i);
assert.doesNotMatch(migration, /password\s+['"]/i);

assert.match(serviceSource, /import\s+"server-only"/);
assert.match(serviceSource, /import postgres from "postgres"/);
assert.match(serviceSource, /RECOMMENDATION_ADMISSION_DATABASE_URL/);
assert.match(serviceSource, /recommendation_admission_runtime/);
assert.match(serviceSource, /read_product_offer_presentation_authority_v1/);
assert.match(serviceSource, /\.pooler\.supabase\.com/);
assert.match(serviceSource, /parsed\.port === "6543"/);
assert.match(serviceSource, /prepare:\s*false/);
assert.match(serviceSource, /max:\s*1/);
assert.match(serviceSource, /sql\.array\(normalizedProductIds\)/);
assert.match(serviceSource, /::uuid\[\]/);
assert.doesNotMatch(serviceSource, /createSupabaseAdminClient/);
assert.doesNotMatch(serviceSource, /\.from\(["']product_offers["']\)/);
assert.doesNotMatch(serviceSource, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(serviceSource, /NEXT_PUBLIC_/);

assert.match(offerSource, /torriden_official::torriden_official/);
assert.match(offerSource, /sourceHint:\s*"official:torriden"/);
assert.match(offerSource, /allowedProductScopeStates:\s*new Set\(\["product"\]\)/);
assert.match(
  offerSource,
  /torriden_official::torriden_official[\s\S]{0,260}priceAuthority:\s*false/,
);
assert.match(purchaseSource, /brand:\s*"토리든"[\s\S]{0,220}source:\s*"official:torriden"/);
assert.match(purchaseSource, /brand:\s*"torriden"[\s\S]{0,220}source:\s*"official:torriden"/);
assert.match(purchaseSource, /torriden\.com/);
assert.match(purchaseSource, /goods_view\\\.php/);
assert.match(healthSource, /verify-data-offer16-offer-presentation-authority-v1\.mjs/);

const {
  projectProductWithOfferAuthority,
  selectCurrentProductOffer,
} = await import("../lib/product-offer-read-path.js");
const { resolveProductPurchaseLink } = await import("../lib/product-purchase-link.js");

const PRODUCT_ID = "08b85f37-b1fa-42d7-893a-0d4facb17878";
const TORRIDEN_URL = "https://www.torriden.com/goods/goods_view.php?goodsNo=136";
const LEGACY_URL =
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000200001";

function product(overrides = {}) {
  return {
    id: PRODUCT_ID,
    brand: "토리든",
    name: "다이브인 무기자차 마일드 선크림",
    category: "sunscreen",
    buy_link: "https://search.shopping.naver.com/search/all?query=legacy",
    price_min: 27000,
    price_max: 27000,
    price_range: "$$",
    engine_score: 91.25,
    ...overrides,
  };
}

function torridenOffer(overrides = {}) {
  return {
    offer_id: "4e99c4ea-008a-4aa0-b8bc-12c71a90db1f",
    product_id: PRODUCT_ID,
    seller_key: "torriden_official",
    seller_name: "Torriden",
    source_name: "torriden_official",
    listing_id: "136",
    listing_url: TORRIDEN_URL,
    price_amount: 17500,
    currency_code: "KRW",
    availability_state: "in_stock",
    market_code: "KR",
    locale: "ko-KR",
    offer_state: "current",
    product_scope_state: "product",
    first_observed_at: "2026-09-11T00:30:12.118Z",
    last_observed_at: "2026-09-11T00:30:12.118Z",
    created_at: "2026-09-12T18:58:24.294Z",
    ...overrides,
  };
}

{
  const source = product();
  const projected = projectProductWithOfferAuthority(source, [torridenOffer()]);
  assert.equal(projected.buy_link, TORRIDEN_URL);
  assert.equal(projected.price_min, source.price_min);
  assert.equal(projected.price_max, source.price_max);
  assert.equal(projected.price_range, source.price_range);
  assert.equal(projected.engine_score, source.engine_score);
}

{
  const selected = selectCurrentProductOffer(product(), [torridenOffer()]);
  assert.equal(selected?.offer?.offer_id, "4e99c4ea-008a-4aa0-b8bc-12c71a90db1f");
  assert.equal(selected?.sourcePolicy?.priceAuthority, false);
}

for (const invalidOffer of [
  torridenOffer({ offer_state: "retired" }),
  torridenOffer({ availability_state: "out_of_stock" }),
  torridenOffer({ market_code: "US" }),
  torridenOffer({ product_scope_state: "product_subject_unresolved" }),
  torridenOffer({ source_name: "unregistered_offer_observation_v1" }),
  torridenOffer({ listing_url: "https://evil.example/goods/goods_view.php?goodsNo=136" }),
]) {
  const projected = projectProductWithOfferAuthority(product(), [invalidOffer]);
  assert.equal(projected.buy_link, "");
  assert.equal(projected.price_min, 27000);
}

{
  const resolved = resolveProductPurchaseLink({
    buyLink: TORRIDEN_URL,
    brand: "토리든",
    name: "다이브인 무기자차 마일드 선크림",
    sourceHint: "official:torriden",
  });
  assert.equal(resolved.kind, "direct");
  assert.equal(resolved.source, "official:torriden");
  assert.equal(resolved.href, TORRIDEN_URL);
}

{
  const resolved = resolveProductPurchaseLink({
    buyLink: TORRIDEN_URL,
    brand: "Torriden",
    name: "DIVE IN Mild Sun Cream",
    sourceHint: "official:torriden",
  });
  assert.equal(resolved.kind, "direct");
  assert.equal(resolved.source, "official:torriden");
}

{
  const wrongBrand = resolveProductPurchaseLink({
    buyLink: TORRIDEN_URL,
    brand: "Other Brand",
    name: "Mild Sun Cream",
    sourceHint: "official:torriden",
  });
  assert.equal(wrongBrand.kind, "fallback");
}

{
  const legacyProduct = product({
    id: "11111111-1111-4111-8111-111111111111",
    brand: "Test Brand",
    name: "Test Product",
  });
  const legacyOffer = {
    ...torridenOffer(),
    offer_id: "22222222-2222-4222-8222-222222222222",
    product_id: legacyProduct.id,
    seller_key: "oliveyoung",
    seller_name: "Olive Young",
    source_name: "legacy_product_buy_link_v1",
    listing_id: "A000000200001",
    listing_url: LEGACY_URL,
    price_amount: null,
    availability_state: "unknown",
    product_scope_state: "product_subject_unresolved",
  };
  const projected = projectProductWithOfferAuthority(legacyProduct, [legacyOffer]);
  assert.equal(projected.buy_link, LEGACY_URL);
  assert.equal(projected.price_min, legacyProduct.price_min);
}

console.log(JSON.stringify({
  stage: "DATA-OFFER16",
  readContract: "product-offer-presentation-authority-read-v1",
  runtimeRole: "recommendation_admission_runtime",
  rawOfferSelect: "DENIED_BY_CONTRACT",
  trustedTorridenDirectLink: true,
  torridenPriceAuthority: false,
  legacyOliveYoungPreserved: true,
  result: "PASS",
}, null, 2));
