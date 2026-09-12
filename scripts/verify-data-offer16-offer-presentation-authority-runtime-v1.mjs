#!/usr/bin/env node
import assert from "node:assert/strict";
import postgres from "postgres";

const databaseUrl = process.env.DATA_OFFER16_DATABASE_URL;
assert.ok(databaseUrl, "DATA_OFFER16_DATABASE_URL is required");

const sql = postgres(databaseUrl, {
  prepare: false,
  max: 1,
  connect_timeout: 5,
  idle_timeout: 5,
  max_lifetime: 30,
});

const LEGACY_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const TORRIDEN_PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const LEGACY_OFFER_ID = "33333333-3333-4333-8333-333333333333";
const TORRIDEN_OFFER_ID = "44444444-4444-4444-8444-444444444444";
const RPC_SIGNATURE = "public.read_product_offer_presentation_authority_v1(uuid[])";
const EXPECTED_FIELDS = [
  "availability_state",
  "created_at",
  "currency_code",
  "first_observed_at",
  "last_observed_at",
  "listing_id",
  "listing_url",
  "locale",
  "market_code",
  "offer_id",
  "offer_state",
  "price_amount",
  "product_id",
  "product_scope_state",
  "seller_key",
  "seller_name",
  "source_name",
].sort();

async function readAsRuntime(productIds) {
  return sql.begin(async (tx) => {
    await tx.unsafe("set local role recommendation_admission_runtime");
    const [{ role }] = await tx`select current_user::text as role`;
    assert.equal(role, "recommendation_admission_runtime");
    const rows = await tx`
      select public.read_product_offer_presentation_authority_v1(
        ${tx.array(productIds)}::uuid[]
      ) as payload
    `;
    assert.equal(rows.length, 1);
    return rows[0].payload;
  });
}

async function rawSelectIsDenied() {
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe("set local role recommendation_admission_runtime");
      await tx`select offer_id from public.product_offers limit 1`;
    });
    return false;
  } catch (error) {
    return String(error?.code || "") === "42501";
  }
}

async function readLiteralAsRuntime(expression) {
  return sql.begin(async (tx) => {
    await tx.unsafe("set local role recommendation_admission_runtime");
    const rows = await tx.unsafe(
      `select public.read_product_offer_presentation_authority_v1(${expression}) as payload`,
    );
    assert.equal(rows.length, 1);
    return rows[0].payload;
  });
}

try {
  await sql`
    insert into public.products (id)
    values (${LEGACY_PRODUCT_ID}::uuid), (${TORRIDEN_PRODUCT_ID}::uuid)
  `;

  await sql`
    insert into public.product_offers (
      offer_id,
      product_id,
      seller_key,
      seller_name,
      source_name,
      listing_id,
      listing_url,
      price_amount,
      currency_code,
      availability_state,
      market_code,
      locale,
      offer_state,
      product_scope_state,
      first_observed_at,
      last_observed_at,
      created_at
    ) values
      (
        ${LEGACY_OFFER_ID}::uuid,
        ${LEGACY_PRODUCT_ID}::uuid,
        'oliveyoung',
        'Olive Young',
        'legacy_product_buy_link_v1',
        'A000000200001',
        'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000200001',
        null,
        'KRW',
        'unknown',
        'KR',
        'ko-KR',
        'current',
        'product_subject_unresolved',
        null,
        null,
        '2026-09-10T08:00:00.000Z'::timestamptz
      ),
      (
        ${TORRIDEN_OFFER_ID}::uuid,
        ${TORRIDEN_PRODUCT_ID}::uuid,
        'torriden_official',
        'Torriden',
        'torriden_official',
        '136',
        'https://www.torriden.com/goods/goods_view.php?goodsNo=136',
        17500,
        'KRW',
        'in_stock',
        'KR',
        'ko-KR',
        'current',
        'product',
        '2026-09-11T00:30:12.118Z'::timestamptz,
        '2026-09-11T00:30:12.118Z'::timestamptz,
        '2026-09-13T03:58:24.294Z'::timestamptz
      )
  `;

  const [privileges] = await sql`
    select
      has_table_privilege(
        'recommendation_admission_runtime',
        'public.product_offers',
        'SELECT'
      ) as runtime_raw_select,
      has_table_privilege(
        'recommendation_admission_runtime',
        'public.product_offers',
        'INSERT'
      ) as runtime_raw_insert,
      has_table_privilege(
        'recommendation_admission_runtime',
        'public.product_offers',
        'UPDATE'
      ) as runtime_raw_update,
      has_table_privilege(
        'recommendation_admission_runtime',
        'public.product_offers',
        'DELETE'
      ) as runtime_raw_delete,
      has_function_privilege(
        'recommendation_admission_runtime',
        ${RPC_SIGNATURE},
        'EXECUTE'
      ) as runtime_rpc_execute,
      has_function_privilege('anon', ${RPC_SIGNATURE}, 'EXECUTE') as anon_rpc_execute,
      has_function_privilege('authenticated', ${RPC_SIGNATURE}, 'EXECUTE') as authenticated_rpc_execute,
      has_function_privilege('service_role', ${RPC_SIGNATURE}, 'EXECUTE') as service_rpc_execute,
      has_schema_privilege(
        'product_offer_presentation_reader_owner',
        'public',
        'CREATE'
      ) as owner_schema_create
  `;

  assert.equal(privileges.runtime_raw_select, false);
  assert.equal(privileges.runtime_raw_insert, false);
  assert.equal(privileges.runtime_raw_update, false);
  assert.equal(privileges.runtime_raw_delete, false);
  assert.equal(privileges.runtime_rpc_execute, true);
  assert.equal(privileges.anon_rpc_execute, false);
  assert.equal(privileges.authenticated_rpc_execute, false);
  assert.equal(privileges.service_rpc_execute, false);
  assert.equal(privileges.owner_schema_create, false);
  assert.equal(await rawSelectIsDenied(), true);

  const beforeCounts = await sql`
    select
      (select count(*)::integer from public.products) as products,
      (select count(*)::integer from public.product_offers) as offers
  `;

  const payload = await readAsRuntime([LEGACY_PRODUCT_ID, TORRIDEN_PRODUCT_ID]);
  assert.equal(payload.read_contract_version, "product-offer-presentation-authority-read-v1");
  assert.equal(payload.status, "AUTHORITY_RESOLVED");
  assert.equal(payload.offers.length, 2);
  assert.deepEqual(
    payload.offers.map((offer) => offer.product_id),
    [LEGACY_PRODUCT_ID, TORRIDEN_PRODUCT_ID],
  );
  for (const offer of payload.offers) {
    assert.deepEqual(Object.keys(offer).sort(), EXPECTED_FIELDS);
  }

  const torridenPayload = await readAsRuntime([TORRIDEN_PRODUCT_ID]);
  assert.equal(torridenPayload.status, "AUTHORITY_RESOLVED");
  assert.equal(torridenPayload.offers.length, 1);
  assert.equal(torridenPayload.offers[0].offer_id, TORRIDEN_OFFER_ID);
  assert.equal(torridenPayload.offers[0].seller_key, "torriden_official");
  assert.equal(Number(torridenPayload.offers[0].price_amount), 17500);
  assert.equal(torridenPayload.offers[0].availability_state, "in_stock");
  assert.equal(torridenPayload.offers[0].product_scope_state, "product");

  const emptyPayload = await readLiteralAsRuntime("'{}'::uuid[]");
  assert.equal(emptyPayload.status, "NO_AUTHORITY");
  assert.equal(emptyPayload.reason, "PRODUCT_IDS_REQUIRED");

  const nullPayload = await readLiteralAsRuntime(
    `array['${TORRIDEN_PRODUCT_ID}'::uuid, null::uuid]`,
  );
  assert.equal(nullPayload.status, "NO_AUTHORITY");
  assert.equal(nullPayload.reason, "MALFORMED_PRODUCT_IDS");

  const overLimitPayload = await readLiteralAsRuntime(
    `array_fill('${TORRIDEN_PRODUCT_ID}'::uuid, array[65])`,
  );
  assert.equal(overLimitPayload.status, "NO_AUTHORITY");
  assert.equal(overLimitPayload.reason, "PRODUCT_ID_LIMIT_EXCEEDED");

  const afterCounts = await sql`
    select
      (select count(*)::integer from public.products) as products,
      (select count(*)::integer from public.product_offers) as offers
  `;
  assert.deepEqual(afterCounts, beforeCounts);

  console.log(JSON.stringify({
    stage: "DATA-OFFER16-RUNTIME",
    runtimeRole: "recommendation_admission_runtime",
    rawSelectDenied: true,
    rawWriteDenied: true,
    runtimeRpcExecute: true,
    broadRpcExecuteDenied: true,
    transportedOfferCount: 2,
    readOnlyCountInvariant: afterCounts[0],
    result: "PASS",
  }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
