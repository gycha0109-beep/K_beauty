#!/usr/bin/env node
// D8K-2 synthetic-only in-memory transport tests: NO Supabase client or network.
import assert from 'node:assert/strict';
import {
  planProductOfferAuthorityReads, readProductOfferAuthorityTransport,
  EXISTING_OFFER_RPC_VERSION, PRODUCT_OFFER_AUTHORITY_READ_VERSION
} from '../../lib/commerce/product-offer-authority-read-v1.mjs';
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const response = offers => ({ read_contract_version: EXISTING_OFFER_RPC_VERSION,
  status: 'AUTHORITY_RESOLVED', offers });
const row = (n, productId = id(1)) => ({
  offer_id: id(n + 600), product_id: productId,
  seller_key: 'seller' + n, seller_name: 'Seller ' + n,
  listing_id: 'listing' + n, listing_url: 'https://example.org/products/' + n,
  price_amount: 20000 + n, link_health_state: 'healthy',
  last_observed_at: '2026-10-15T00:00:00Z'
});
let cases = 0;
const check = async (reader, ids = [id(1)]) => { cases++; return readProductOfferAuthorityTransport({
  productIds: ids, invokeAuthorizedRead: reader
}); };
const plan = planProductOfferAuthorityReads([id(2), id(1), id(2).toUpperCase()]);
assert.equal(plan.status, 'READY');
assert.deepEqual(plan.productIds, [id(1), id(2)]);
assert.equal(plan.batches.length, 1);
assert.equal(planProductOfferAuthorityReads(Array.from({ length: 65 }, (_, i) => id(i + 1))).batches.length, 2);
assert.equal(planProductOfferAuthorityReads(Array.from({ length: 512 }, (_, i) => id(i + 1))).batches.length, 8);
assert.equal(planProductOfferAuthorityReads(Array.from({ length: 513 }, (_, i) => id(i + 1))).status, 'HOLD');
for (const invalid of [[null], ['not-a-uuid'], [id(1), 1], null]) {
  assert.equal(planProductOfferAuthorityReads(invalid).status, 'HOLD');cases++;
}
let calls = [];
const good = await check(ids => { calls.push(ids);return response([row(1, id(1))]); }, [id(1),id(2)]);
assert.equal(good.version, PRODUCT_OFFER_AUTHORITY_READ_VERSION);
assert.equal(good.status, 'READ_WITH_EVIDENCE_HOLD');
assert.equal(good.offerRowCount, 1);
assert.equal(good.requestedProductCount, 2);
assert.equal(good.selectedOptionAuthority, false);
assert.equal(good.directCtaAuthority, false);
assert.equal(good.priceAuthority, false);
assert.equal(good.offersByProduct[id(2)].length, 0);
assert.deepEqual(calls, [[id(1), id(2)]]);
const projected = good.offersByProduct[id(1)][0];
assert.equal(projected.comparisonEligible, false);
assert.equal(projected.ctaEnabled, false);
for (const forbidden of ['listing_url', 'listingUrl', 'price_amount', 'observedPrice', 'shippingAmount', 'link_health_state']) {
  assert.equal(Object.hasOwn(projected, forbidden), false, forbidden);
}
const empty = await check(() => response([]));
assert.equal(empty.status, 'READ_WITH_EVIDENCE_HOLD');
assert.equal(empty.offerRowCount, 0);
assert.equal((await check(() => { throw new Error('secret=do-not-echo'); })).reason, 'RPC_READ_FAILED');
assert.equal((await check(async()=>{ throw new Error('failed'); })).reason, 'RPC_READ_FAILED');
assert.equal((await readProductOfferAuthorityTransport({ productIds:[id(1)] })).reason, 'AUTHORIZED_READER_NOT_PROVIDED');cases++;
for (const [value, reason] of [
  [{ status:'NO_AUTHORITY', reason:'OFFER_ROW_LIMIT_EXCEEDED', read_contract_version:EXISTING_OFFER_RPC_VERSION }, 'RPC_NO_AUTHORITY'],
  [{...response([]),read_contract_version:'wrong'}, 'READ_CONTRACT_MISMATCH'],
  [response([row(1, id(3))]), 'RPC_ROW_IDENTITY_INVALID'],
  [response([{...row(1),offer_id:'x'}]), 'RPC_ROW_IDENTITY_INVALID'],
  [response([{...row(1),listing_url:'  https://example.org  '}]), 'RPC_ROW_IDENTITY_INVALID'],
  [response([row(1), row(1)]), 'RPC_DUPLICATE_OFFER_IDENTITY'],
  [response([row(1),{...row(2),seller_key:'seller1',listing_id:'listing1'}]), 'RPC_DUPLICATE_OFFER_IDENTITY'],
  [response([row(1),{...row(2),seller_key:'seller1',listing_url:row(1).listing_url}]), 'RPC_DUPLICATE_OFFER_IDENTITY'],
  [response(Array.from({ length:257 },(_,i)=>row(i+1))), 'RPC_OFFER_LIMIT_OR_SHAPE_INVALID'],
  [{...response([]),offers:null}, 'RPC_OFFER_LIMIT_OR_SHAPE_INVALID']
]) {
  const result = await check(() => value);
  assert.equal(result.status, 'HOLD');
  assert.equal(result.reason, reason);
  assert.deepEqual(result.offersByProduct, {});
}
const ids65 = Array.from({length:65},(_,i)=>id(i+1));
let batchN = 0;
const batched = await check(ids => {
  batchN++;
  assert(ids.length <= 64);
  return response(ids.map((productId,i)=>row(batchN*100+i,productId)));
}, ids65);
assert.equal(batched.status,'READ_WITH_EVIDENCE_HOLD');
assert.equal(batched.rpcCalls, 2);
assert.equal(batched.offerRowCount, 65);
const lateFailure = await check(ids => ids.includes(id(65)) ?
  { ...response([]),status:'NO_AUTHORITY',reason:'OFFER_ROW_LIMIT_EXCEEDED' } : response([row(1)]), ids65);
assert.equal(lateFailure.status,'HOLD');
assert.equal(lateFailure.offerRowCount,0);
// Across multiple successful batches >256 raw rows cannot feed the 256-row comparator.
const limit = await check(ids => response(ids.flatMap((pid,i) =>
  Array.from({length:4},(_,j)=>row(Number(pid.slice(-12))*4+j+1,pid)))), ids65);
assert.equal(limit.reason,'COMPARISON_CAPACITY_EXCEEDED');
assert.equal(limit.offerRowCount,0);
assert.equal((await readProductOfferAuthorityTransport({productIds:[],invokeAuthorizedRead:()=>{throw Error('must not call');}})).status,'EMPTY');cases++;
console.log(JSON.stringify({status:'PASS', stage:'D8K2_PRIVATE_OFFER_RPC_TRANSPORT_SHADOW',
  syntheticScenarios:cases, maxIdsPerCall:64, maxOfferRowsPerCall:256,
  actualSellerDataAttested:false, actualAuthorizedDbReadExecuted:false,
  optionsVerified:false, directCtaAuthority:false, changedApiFields:false,
  productWrites:0, offerWrites:0, productionReleaseAuthorized:false}));
