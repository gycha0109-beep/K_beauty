import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

const TABLE = "seller_listing_observations";
const LISTING_URL =
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000200001";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`seller_observation_runtime_missing_${name.toLowerCase()}`);
  return value;
}

function canonicalRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    seller: "oliveyoung",
    listing_id: "A000000200001",
    listing_url: LISTING_URL,
    price_amount: 18900,
    price_currency: "KRW",
    availability: "in_stock",
    observed_at: "2026-09-11T08:30:00Z",
    source_version: "oliveyoung-listing-capture-v1",
    ...overrides,
  };
}

async function main(): Promise<void> {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.API_URL ||
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = process.env.ANON_KEY;

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const initial = await service.from(TABLE).select("observation_id");
  if (initial.error) throw new Error(`seller_observation_initial_load_failed:${initial.error.message}`);
  assert.equal(initial.data.length, 0, "append-only observation migration must not backfill rows");

  if (anonKey) {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonymousRead = await anon.from(TABLE).select("observation_id").limit(1);
    assert.ok(anonymousRead.error, "anonymous clients must not read seller observations");
  }

  const first = await service
    .from(TABLE)
    .insert(canonicalRow())
    .select(
      "observation_id, seller, listing_id, listing_url, price_amount, price_currency, availability, observed_at, source_version, created_at",
    )
    .single();
  if (first.error) throw new Error(`seller_observation_first_insert_failed:${first.error.message}`);
  assert.ok(first.data.observation_id);
  assert.ok(first.data.created_at);
  assert.equal(first.data.seller, "oliveyoung");
  assert.equal(Number(first.data.price_amount), 18900);
  assert.equal(first.data.price_currency, "KRW");

  const repeated = await service
    .from(TABLE)
    .insert(canonicalRow())
    .select("observation_id")
    .single();
  if (repeated.error) throw new Error(`seller_observation_repeat_insert_failed:${repeated.error.message}`);
  assert.notEqual(
    repeated.data.observation_id,
    first.data.observation_id,
    "independent repeated observations must remain separate append-only events",
  );

  const unknownWithoutPrice = await service
    .from(TABLE)
    .insert(
      canonicalRow({
        listing_id: null,
        price_amount: null,
        price_currency: null,
        availability: "unknown",
        observed_at: "2026-09-11T08:31:00Z",
      }),
    )
    .select("listing_id, price_amount, price_currency, availability")
    .single();
  if (unknownWithoutPrice.error) {
    throw new Error(`seller_observation_null_price_insert_failed:${unknownWithoutPrice.error.message}`);
  }
  assert.equal(unknownWithoutPrice.data.listing_id, null);
  assert.equal(unknownWithoutPrice.data.price_amount, null);
  assert.equal(unknownWithoutPrice.data.price_currency, null);
  assert.equal(unknownWithoutPrice.data.availability, "unknown");

  for (const forbiddenColumn of ["product_id", "product_subject_id", "offer_id"]) {
    const forbiddenRead = await service.from(TABLE).select(forbiddenColumn).limit(1);
    assert.ok(forbiddenRead.error, `${forbiddenColumn} must not exist on raw observation persistence`);
  }

  const updateAttempt = await service
    .from(TABLE)
    .update({ availability: "out_of_stock" })
    .eq("observation_id", first.data.observation_id);
  assert.ok(updateAttempt.error, "service_role must not update append-only observations");

  const deleteAttempt = await service
    .from(TABLE)
    .delete()
    .eq("observation_id", first.data.observation_id);
  assert.ok(deleteAttempt.error, "service_role must not delete append-only observations");

  const negativePrice = await service.from(TABLE).insert(
    canonicalRow({
      listing_id: "negative-price",
      listing_url: "https://example.com/negative-price",
      price_amount: -1,
      observed_at: "2026-09-11T08:32:00Z",
    }),
  );
  assert.ok(negativePrice.error, "negative seller-observed price must be rejected");
  assert.equal(negativePrice.error.code, "23514");

  const unpairedCurrency = await service.from(TABLE).insert(
    canonicalRow({
      listing_id: "unpaired-currency",
      listing_url: "https://example.com/unpaired-currency",
      price_amount: null,
      price_currency: "KRW",
      observed_at: "2026-09-11T08:33:00Z",
    }),
  );
  assert.ok(unpairedCurrency.error, "price amount and currency must be jointly present or absent");
  assert.equal(unpairedCurrency.error.code, "23514");

  const lowercaseCurrency = await service.from(TABLE).insert(
    canonicalRow({
      listing_id: "lowercase-currency",
      listing_url: "https://example.com/lowercase-currency",
      price_currency: "krw",
      observed_at: "2026-09-11T08:34:00Z",
    }),
  );
  assert.ok(lowercaseCurrency.error, "persisted currency must be uppercase ISO-like code");
  assert.equal(lowercaseCurrency.error.code, "23514");

  const invalidAvailability = await service.from(TABLE).insert(
    canonicalRow({
      listing_id: "invalid-availability",
      listing_url: "https://example.com/invalid-availability",
      availability: "available",
      observed_at: "2026-09-11T08:35:00Z",
    }),
  );
  assert.ok(invalidAvailability.error, "unregistered availability state must be rejected");
  assert.equal(invalidAvailability.error.code, "23514");

  const httpUrl = await service.from(TABLE).insert(
    canonicalRow({
      listing_id: "http-url",
      listing_url: "http://example.com/http-url",
      observed_at: "2026-09-11T08:36:00Z",
    }),
  );
  assert.ok(httpUrl.error, "database defense-in-depth must reject non-HTTPS listing URLs");
  assert.equal(httpUrl.error.code, "23514");

  const missingObservedAt = await service.from(TABLE).insert(
    canonicalRow({
      listing_id: "missing-observed-at",
      listing_url: "https://example.com/missing-observed-at",
      observed_at: null,
    }),
  );
  assert.ok(missingObservedAt.error, "observed_at provenance must be mandatory");
  assert.equal(missingObservedAt.error.code, "23502");

  const blankSourceVersion = await service.from(TABLE).insert(
    canonicalRow({
      listing_id: "blank-source-version",
      listing_url: "https://example.com/blank-source-version",
      observed_at: "2026-09-11T08:37:00Z",
      source_version: "",
    }),
  );
  assert.ok(blankSourceVersion.error, "source_version provenance must not be blank");
  assert.equal(blankSourceVersion.error.code, "23514");

  const final = await service
    .from(TABLE)
    .select("observation_id, seller, listing_id, observed_at")
    .order("created_at", { ascending: true });
  if (final.error) throw new Error(`seller_observation_final_load_failed:${final.error.message}`);
  assert.equal(final.data.length, 3);
  assert.equal(final.data.every((row) => row.seller === "oliveyoung"), true);
  assert.equal(
    final.data.filter((row) => row.listing_id === "A000000200001").length,
    2,
    "repeated raw observations must not be deduplicated into current Offer state",
  );

  process.stdout.write(
    "verify:seller-listing-observation-persistence:local-runtime PASS (private append-only ledger, no Product/Subject/Offer columns, repeat preservation, null evidence preservation, DB constraints)\n",
  );
}

main().catch((error) => {
  process.stderr.write("verify:seller-listing-observation-persistence:local-runtime FAIL\n");
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
