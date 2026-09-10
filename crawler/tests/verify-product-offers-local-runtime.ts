import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

const PRODUCT_1 = "93000000-0000-4000-8000-000000000001";
const PRODUCT_2 = "93000000-0000-4000-8000-000000000002";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`product_offer_runtime_missing_${name.toLowerCase()}`);
  return value;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.API_URL || requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = process.env.ANON_KEY;

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const initial = await service.from("product_offers").select("offer_id");
  if (initial.error) throw new Error(`product_offer_initial_load_failed:${initial.error.message}`);
  assert.equal(initial.data.length, 0, "shadow migration must not backfill legacy product price/link fields");

  if (anonKey) {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonymousRead = await anon.from("product_offers").select("offer_id").limit(1);
    assert.ok(anonymousRead.error, "anonymous clients must not read internal offers");
  }

  const observedThroughHwahae = await service
    .from("product_offers")
    .insert({
      product_id: PRODUCT_1,
      seller_key: "oliveyoung",
      seller_name: "Olive Young",
      source_name: "hwahae",
      listing_id: "A000000001",
      listing_url: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000001",
      price_amount: 18000,
    })
    .select(
      "offer_id, product_id, seller_key, seller_name, source_name, price_amount, currency_code, availability_state, market_code, offer_state, product_scope_state",
    )
    .single();
  if (observedThroughHwahae.error) {
    throw new Error(`product_offer_first_insert_failed:${observedThroughHwahae.error.message}`);
  }
  assert.ok(observedThroughHwahae.data.offer_id);
  assert.equal(observedThroughHwahae.data.seller_key, "oliveyoung");
  assert.equal(observedThroughHwahae.data.source_name, "hwahae");
  assert.equal(observedThroughHwahae.data.availability_state, "unknown");
  assert.equal(observedThroughHwahae.data.currency_code, "KRW");
  assert.equal(observedThroughHwahae.data.market_code, "KR");
  assert.equal(observedThroughHwahae.data.offer_state, "current");
  assert.equal(observedThroughHwahae.data.product_scope_state, "product_subject_unresolved");

  const secondSeller = await service
    .from("product_offers")
    .insert({
      product_id: PRODUCT_1,
      seller_key: "roundlab_official",
      seller_name: "ROUND LAB Official",
      source_name: "roundlab_official",
      listing_id: "birch-sun-50",
      listing_url: "https://example.com/roundlab/birch-sun-50",
      price_amount: 21000,
      availability_state: "in_stock",
      product_scope_state: "product",
    })
    .select("offer_id")
    .single();
  if (secondSeller.error) throw new Error(`product_offer_second_seller_insert_failed:${secondSeller.error.message}`);
  assert.ok(secondSeller.data.offer_id, "one product must support multiple seller listings");

  const duplicateListingId = await service.from("product_offers").insert({
    product_id: PRODUCT_2,
    seller_key: "oliveyoung",
    seller_name: "Olive Young",
    source_name: "oliveyoung",
    listing_id: "A000000001",
    listing_url: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000099",
    price_amount: 15000,
  });
  assert.ok(duplicateListingId.error, "one seller listing id must not map to two products");
  assert.equal(duplicateListingId.error.code, "23505");

  const duplicateListingUrl = await service.from("product_offers").insert({
    product_id: PRODUCT_2,
    seller_key: "oliveyoung",
    seller_name: "Olive Young",
    source_name: "oliveyoung",
    listing_id: "A000000099",
    listing_url: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000001",
    price_amount: 15000,
  });
  assert.ok(duplicateListingUrl.error, "one seller listing URL must not map to two products");
  assert.equal(duplicateListingUrl.error.code, "23505");

  const negativePrice = await service.from("product_offers").insert({
    product_id: PRODUCT_2,
    seller_key: "test_seller",
    seller_name: "Test Seller",
    source_name: "test_source",
    listing_id: "negative-price",
    listing_url: "https://example.com/negative-price",
    price_amount: -1,
  });
  assert.ok(negativePrice.error, "negative prices must be rejected");
  assert.equal(negativePrice.error.code, "23514");

  const invalidCurrency = await service.from("product_offers").insert({
    product_id: PRODUCT_2,
    seller_key: "test_seller",
    seller_name: "Test Seller",
    source_name: "test_source",
    listing_id: "bad-currency",
    listing_url: "https://example.com/bad-currency",
    price_amount: 100,
    currency_code: "krw",
  });
  assert.ok(invalidCurrency.error, "currency must use a three-letter uppercase code");
  assert.equal(invalidCurrency.error.code, "23514");

  const mutableFields = await service
    .from("product_offers")
    .update({
      price_amount: 17500,
      availability_state: "out_of_stock",
      last_observed_at: "2026-09-10T01:00:00Z",
    })
    .eq("offer_id", observedThroughHwahae.data.offer_id)
    .select("price_amount, availability_state")
    .single();
  if (mutableFields.error) throw new Error(`product_offer_mutable_update_failed:${mutableFields.error.message}`);
  assert.equal(Number(mutableFields.data.price_amount), 17500);
  assert.equal(mutableFields.data.availability_state, "out_of_stock");

  const identityReassignment = await service
    .from("product_offers")
    .update({ product_id: PRODUCT_2 })
    .eq("offer_id", observedThroughHwahae.data.offer_id);
  assert.ok(identityReassignment.error, "product_id must be immutable after offer creation");

  const listingReassignment = await service
    .from("product_offers")
    .update({ listing_id: "A000000002" })
    .eq("offer_id", observedThroughHwahae.data.offer_id);
  assert.ok(listingReassignment.error, "seller listing identity must be immutable after offer creation");

  const legacyProduct = await service
    .from("products")
    .select("price_min, price_max, buy_link")
    .eq("id", PRODUCT_1)
    .single();
  if (legacyProduct.error) throw new Error(`product_offer_legacy_product_readback_failed:${legacyProduct.error.message}`);
  assert.equal(Number(legacyProduct.data.price_min), 18000);
  assert.equal(Number(legacyProduct.data.price_max), 22000);
  assert.equal(
    legacyProduct.data.buy_link,
    "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000001",
  );

  const retire = await service
    .from("product_offers")
    .update({ offer_state: "retired" })
    .eq("offer_id", observedThroughHwahae.data.offer_id)
    .select("offer_state")
    .single();
  if (retire.error) throw new Error(`product_offer_retire_failed:${retire.error.message}`);
  assert.equal(retire.data.offer_state, "retired");

  const duplicateAfterRetire = await service.from("product_offers").insert({
    product_id: PRODUCT_2,
    seller_key: "oliveyoung",
    seller_name: "Olive Young",
    source_name: "oliveyoung",
    listing_id: "A000000001",
    listing_url: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000001",
    price_amount: 15000,
  });
  assert.ok(duplicateAfterRetire.error, "retiring an offer must not free its seller listing identity for another product");
  assert.equal(duplicateAfterRetire.error.code, "23505");

  const deleteAttempt = await service
    .from("product_offers")
    .delete()
    .eq("offer_id", observedThroughHwahae.data.offer_id);
  assert.ok(deleteAttempt.error, "offers must be retired, not deleted through service_role");

  const final = await service
    .from("product_offers")
    .select("product_id, seller_key, source_name, offer_state")
    .order("seller_key", { ascending: true });
  if (final.error) throw new Error(`product_offer_final_load_failed:${final.error.message}`);
  assert.equal(final.data.length, 2);
  assert.equal(final.data.every((row) => row.product_id === PRODUCT_1), true);
  assert.equal(final.data.filter((row) => row.offer_state === "retired").length, 1);
  assert.equal(final.data.filter((row) => row.offer_state === "current").length, 1);

  process.stdout.write(
    "verify:product-offers:local-runtime PASS (empty shadow, private access, multi-seller, source/seller separation, collision blocking, validated price state, immutable listing identity, legacy product fields unchanged, retire-not-delete)\n",
  );
}

main().catch((error) => {
  process.stderr.write("verify:product-offers:local-runtime FAIL\n");
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
